import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";
import { jikanProvider } from "../../lib/api/jikan";

const ENDPOINT = "https://graphql.anilist.co";
const PAGE_SIZE = 24;
const MAX_PAGE = 10;
const SEARCH_TTL = 12 * 60 * 60;
const FILTER_TTL = 6 * 60 * 60;
const GENRES = new Set(["Action","Adventure","Comedy","Drama","Fantasy","Horror","Mahou Shoujo","Mecha","Music","Mystery","Psychological","Romance","Sci-Fi","Slice of Life","Sports","Supernatural","Thriller"]);
const FIELDS = "id title { romaji english } startDate { year month day } coverImage { extraLarge large } format genres seasonYear status averageScore";
type Media = { id:number; title?:{romaji?:string|null;english?:string|null}; startDate?:{year?:number|null;month?:number|null;day?:number|null}|null; coverImage?:{extraLarge?:string|null;large?:string|null}; format?:string|null; genres?:string[]; seasonYear?:number|null; status?:string|null; averageScore?:number|null };
type Data = {items:Media[];total:number;hasNextPage:boolean;source:"anilist"|"jikan"};
type CacheState = "HIT"|"MISS"|"BYPASS";
const pending = new Map<string,Promise<{data:Data;cache:CacheState}>>();

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseKey = import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
const cacheToken = import.meta.env.ANIME_SEARCH_CACHE_TOKEN;
const cacheClient = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession:false, autoRefreshToken:false, detectSessionInUrl:false },
      global: { headers: { "x-cache-token": cacheToken ?? "", "X-Client-Info": "renanime-search-cache" } }
    })
  : null;

function fail(error:string,status:number,retry?:string) {
  const headers = new Headers({"Cache-Control":"no-store","Vercel-CDN-Cache-Control":"no-store"});
  if(retry) headers.set("Retry-After",retry);
  return Response.json({success:false,error},{status,headers});
}
async function digest(value:string):Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,"0")).join("");
}
async function readCache(key:string):Promise<Data|null> {
  if(!cacheClient||!cacheToken) return null;
  const {data,error}=await cacheClient.rpc("anime_search_cache_get",{p_cache_key:key});
  if(error) { console.warn("[anime-search] cache read failed:",error.message); return null; }
  return data && typeof data==="object" && Array.isArray(data.items) ? data as Data : null;
}
async function writeCache(key:string,type:"search"|"filters",filters:Record<string,unknown>,data:Data,ttl:number) {
  if(!cacheClient||!cacheToken) return;
  const {error}=await cacheClient.rpc("anime_search_cache_put",{
    p_cache_key:key,p_query_type:type,p_filters:filters,p_payload:data,p_ttl_seconds:data.source==="jikan"?Math.min(ttl,1800):ttl
  });
  if(error) console.warn("[anime-search] cache write failed:",error.message);
}
async function claimCacheLock(key:string,owner:string):Promise<boolean> {
  if(!cacheClient||!cacheToken) return false;
  const {data,error}=await cacheClient.rpc("anime_search_cache_claim",{p_cache_key:key,p_owner:owner});
  if(error) { console.warn("[anime-search] cache lock failed:",error.message); return false; }
  return data===true;
}
async function releaseCacheLock(key:string,owner:string) {
  if(!cacheClient||!cacheToken) return;
  const {error}=await cacheClient.rpc("anime_search_cache_release",{p_cache_key:key,p_owner:owner});
  if(error) console.warn("[anime-search] cache lock release failed:",error.message);
}
const ANILIST_GLOBAL_SLOTS = 4;
const ANILIST_SLOT_WAIT_MS = 250;
const ANILIST_SLOT_ATTEMPTS = 8;
let localAniListInFlight = 0;

async function acquireAniListPermit():Promise<()=>Promise<void>> {
  const owner=crypto.randomUUID();

  // Supabase cache locks are shared across Vercel instances, so these four
  // stable keys form a small distributed concurrency gate for AniList.
  if(cacheClient&&cacheToken) {
    const keys=await Promise.all(Array.from({length:ANILIST_GLOBAL_SLOTS},(_,slot)=>digest("anilist-global-slot:"+slot)));
    for(let attempt=0;attempt<ANILIST_SLOT_ATTEMPTS;attempt++) {
      for(const key of keys) {
        if(await claimCacheLock(key,owner)) {
          return async()=>releaseCacheLock(key,owner);
        }
      }
      if(attempt<ANILIST_SLOT_ATTEMPTS-1) {
        await new Promise(resolve=>setTimeout(resolve,ANILIST_SLOT_WAIT_MS));
      }
    }
    throw Object.assign(new Error("ANILIST_CAPACITY_EXCEEDED"),{status:503,retry:"2"});
  }

  // Degraded fallback when shared cache credentials are unavailable.
  // This only protects one warm server instance, not the whole deployment.
  if(localAniListInFlight>=2) {
    throw Object.assign(new Error("ANILIST_CAPACITY_EXCEEDED"),{status:503,retry:"2"});
  }
  localAniListInFlight+=1;
  return async()=>{localAniListInFlight=Math.max(0,localAniListInFlight-1);};
}

async function anilist(query:string,variables:Record<string,unknown>) {
  const release=await acquireAniListPermit();
  try {
    const r=await fetch(ENDPOINT,{method:"POST",headers:{"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify({query,variables}),signal:AbortSignal.timeout(10000)});
    if(r.status===429) throw Object.assign(new Error("RATE_LIMIT"),{status:429,retry:r.headers.get("Retry-After")||"30"});
    const body=await r.text();
    if(!r.ok) {
      console.error("[anime-search] AniList HTTP error",r.status,body.slice(0,1200));
      throw new Error("ANILIST_HTTP_"+r.status);
    }
    let p:any;
    try { p=JSON.parse(body); } catch {
      console.error("[anime-search] AniList returned invalid JSON",body.slice(0,500));
      throw new Error("ANILIST_INVALID_JSON");
    }
    if(p.errors?.length||!p.data?.Page||!Array.isArray(p.data.Page.media)) {
      console.error("[anime-search] AniList GraphQL error",JSON.stringify(p.errors??p).slice(0,1600));
      throw new Error("ANILIST_INVALID_RESPONSE");
    }
    return p.data.Page;
  } finally {
    await release();
  }
}
async function searchAnime(q:string,page:number,perPage=PAGE_SIZE):Promise<Data> {
  const query="query SearchAnime($search:String!,$page:Int!,$perPage:Int!){Page(page:$page,perPage:$perPage){pageInfo{total hasNextPage} media(search:$search,type:ANIME,sort:SEARCH_MATCH,isAdult:false){"+FIELDS+"}}}";
  try {
    const p=await anilist(query,{search:q,page,perPage});
    return {items:p.media,total:p.pageInfo?.total??0,hasNextPage:Boolean(p.pageInfo?.hasNextPage),source:"anilist"};
  } catch(e) {
    if((e as {status?:number}).status===429) throw e;
    const entries=await jikanProvider.search({query:q,page,perPage});
    const items:Media[]=entries.map(x=>({id:x.external.mal??Number(x.id.replace("mal-","")),title:{romaji:x.metadata.title,english:x.metadata.title},startDate:x.metadata.year?{year:x.metadata.year}:null,coverImage:x.metadata.images.cover?{extraLarge:x.metadata.images.cover,large:x.metadata.images.cover}:undefined,format:x.metadata.format}));
    return {items,total:items.length,hasNextPage:false,source:"jikan"};
  }
}
async function filterAnime(genres:string[],year:string,status:string,q:string,page:number,perPage:number):Promise<Data> {
  const definitions=["$page:Int!","$perPage:Int!"];
  const args=["type:ANIME","sort:POPULARITY_DESC","isAdult:false"];
  const variables:Record<string,unknown>={page,perPage};

  // Only send AniList filter operators when they have an actual value.
  // AniList rejects explicit null values for some operator arguments.
  if(genres.length) {
    definitions.push("$genres:[String]");
    args.push("genre_in:$genres");
    variables.genres=genres;
  }
  if(status) {
    definitions.push("$status:MediaStatus");
    args.push("status:$status");
    variables.status=status;
  }
  if(year==="before2020") {
    definitions.push("$before:FuzzyDateInt");
    args.push("startDate_lesser:$before");
    variables.before=20200000;
  } else if(year) {
    const selectedYear=Number(year);
    definitions.push("$after:FuzzyDateInt","$before:FuzzyDateInt");
    args.push("startDate_greater:$after","startDate_lesser:$before");
    // AniList uses YYYY0000 fuzzy dates for whole-year boundaries.
    variables.after=selectedYear*10000;
    variables.before=(selectedYear+1)*10000;
  }
  if(q) {
    definitions.push("$search:String");
    args.push("search:$search");
    variables.search=q;
  }

  const query="query FilterAnime("+definitions.join(",")+"){Page(page:$page,perPage:$perPage){pageInfo{total hasNextPage} media("+args.join(",")+"){"+FIELDS+"}}}";
  const p=await anilist(query,variables);
  return {items:p.media,total:p.pageInfo?.total??0,hasNextPage:Boolean(p.pageInfo?.hasNextPage),source:"anilist"};
}
async function popularAnime(page:number,perPage:number):Promise<Data> {
  const query="query PopularAnime($page:Int!,$perPage:Int!){Page(page:$page,perPage:$perPage){pageInfo{total hasNextPage} media(type:ANIME,sort:POPULARITY_DESC,isAdult:false){"+FIELDS+"}}}";
  const p=await anilist(query,{page,perPage});
  return {items:p.media,total:p.pageInfo?.total??0,hasNextPage:Boolean(p.pageInfo?.hasNextPage),source:"anilist"};
}
function loadGenres() {
  return Array.from(GENRES);
}
function loadYears() {
  const currentYear=new Date().getFullYear();
  return [...Array.from({length:7},(_,index)=>String(currentYear-index)),"before2020"];
}
async function loadCached(key:string,type:"search"|"filters",filters:Record<string,unknown>,ttl:number,load:()=>Promise<Data>):Promise<{data:Data;cache:CacheState}> {
  if(!cacheClient||!cacheToken) return {data:await load(),cache:"BYPASS"};
  const hit=await readCache(key);
  if(hit) return {data:hit,cache:"HIT"};

  const owner=crypto.randomUUID();
  let ownsLock=await claimCacheLock(key,owner);
  if(!ownsLock) {
    // Another server instance is filling this exact query. Wait for its result.
    for(let attempt=0;attempt<12;attempt++) {
      await new Promise(resolve=>setTimeout(resolve,500));
      const shared=await readCache(key);
      if(shared) return {data:shared,cache:"HIT"};
    }
    // The cache lock is still held. Fail fast instead of creating a thundering herd.
    throw Object.assign(new Error("CACHE_FILL_IN_PROGRESS"),{status:503,retry:"2"});
  }

  try {
    const secondHit=await readCache(key);
    if(secondHit) return {data:secondHit,cache:"HIT"};
    const data=await load();
    await writeCache(key,type,filters,data,ttl);
    return {data,cache:"MISS"};
  } finally {
    if(ownsLock) await releaseCacheLock(key,owner);
  }
}

export const GET:APIRoute=async({request})=>{
  const params=new URL(request.url).searchParams;
  const q=(params.get("q")||"").trim().replace(/\s+/g," ");
  const page=Number(params.get("page")||"1");
  const genres=[...new Set(params.getAll("genre").flatMap(value=>value.split(",")).map(x=>x.trim()).filter(Boolean))].sort();
  const year=params.get("year")||"";
  const status=params.get("status")||"";
  const popular=params.get("popular")==="1";
  const perPage=PAGE_SIZE;
  const now=new Date().getFullYear();

  if(params.get("genres")==="1"||params.get("years")==="1") {
    try {
      if(params.get("genres")==="1") return Response.json({success:true,genres:await loadGenres()},{headers:{"Cache-Control":"public, max-age=3600, s-maxage=43200"}});
      return Response.json({success:true,years:await loadYears()},{headers:{"Cache-Control":"public, max-age=3600, s-maxage=43200"}});
    } catch(e) {
      const limited=(e as {status?:number}).status===429;
      return fail(limited?"SEARCH_PROVIDER_RATE_LIMITED":"SEARCH_PROVIDER_UNAVAILABLE",limited?503:502,(e as {retry?:string}).retry);
    }
  }

  if(!Number.isInteger(page)||page<1||page>MAX_PAGE) return fail("INVALID_PAGE",400);
  if(q.length>80||(q&&q.length<2)) return fail("INVALID_QUERY",400);
  if(genres.some(x=>!GENRES.has(x))) return fail("INVALID_GENRE",400);
  if(year&&year!=="before2020"&&(!/^\d{4}$/.test(year)||Number(year)<1900||Number(year)>now)) return fail("INVALID_YEAR",400);
  if(status&&!["FINISHED","RELEASING"].includes(status)) return fail("INVALID_STATUS",400);
  if(popular&&(q||genres.length||year||status)) return fail("INVALID_POPULAR_FILTERS",400);
  if(!popular&&!q&&!genres.length&&!year&&!status) return fail("MISSING_SEARCH_OR_FILTER",400);

  const normalizedQuery=q.toLocaleLowerCase("en");
  const isSearch=q.length>=2;
  const isFiltered=genres.length>0||Boolean(year||status);
  const filterState={query:normalizedQuery,genres,year,status,page,perPage,popular};
  const rawKey=(popular?"popular:":isFiltered?"filters:":"search:")+JSON.stringify(filterState);
  const key=await digest(rawKey);
  const localKey=key;

  try {
    let job=pending.get(localKey);
    if(!job) {
      const useFilters=isFiltered;
      job=loadCached(
        key,useFilters||popular?"filters":"search",filterState,popular?FILTER_TTL:useFilters?FILTER_TTL:SEARCH_TTL,
        ()=>popular?popularAnime(page,perPage):useFilters?filterAnime(genres,year,status,q,page,perPage):searchAnime(q,page,perPage)
      );
      pending.set(localKey,job);
    }
    let result:{data:Data;cache:CacheState};
    try { result=await job; } finally { if(pending.get(localKey)===job) pending.delete(localKey); }
    return Response.json({success:true,...result.data},{headers:{
      "Cache-Control":"public, max-age=0, s-maxage=300, stale-while-revalidate=600",
      "Vercel-CDN-Cache-Control":"max-age=300, stale-while-revalidate=600",
      "X-Renanime-Search-Source":result.data.source,
      "X-Renanime-Cache":result.cache
    }});
  } catch(e) {
    console.error("[anime-search] request failed",e instanceof Error?{name:e.name,message:e.message}:String(e));
    const limited=(e as {status?:number}).status===429;
    return fail(limited?"SEARCH_PROVIDER_RATE_LIMITED":"SEARCH_PROVIDER_UNAVAILABLE",limited?503:502,(e as {retry?:string}).retry);
  }
};
