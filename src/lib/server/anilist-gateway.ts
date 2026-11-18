import { createClient } from "@supabase/supabase-js";
const ENDPOINT="https://graphql.anilist.co",SLOTS=4,WAIT=250,ATTEMPTS=12;
let localInFlight=0;
const url=import.meta.env.PUBLIC_SUPABASE_URL,key=import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY??import.meta.env.PUBLIC_SUPABASE_ANON_KEY,token=import.meta.env.ANIME_SEARCH_CACHE_TOKEN;
const db=url&&key?createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{headers:{"x-cache-token":token??"","X-Client-Info":"renanime-anilist-gateway"}}}):null;
async function hash(s:string){const b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s));return Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,"0")).join("");}
async function acquire():Promise<()=>Promise<void>>{
 const owner=crypto.randomUUID();
 if(db&&token){const keys=await Promise.all(Array.from({length:SLOTS},(_,i)=>hash("anilist-global-slot:"+i)));
  for(let n=0;n<ATTEMPTS;n++){for(const k of keys){const {data,error}=await db.rpc("anime_search_cache_claim",{p_cache_key:k,p_owner:owner});if(error)throw new Error("ANILIST_LIMITER_UNAVAILABLE");if(data===true)return async()=>{const r=await db!.rpc("anime_search_cache_release",{p_cache_key:k,p_owner:owner});if(r.error)console.warn("[anilist-gateway] release failed",r.error.message);};}if(n<ATTEMPTS-1)await new Promise(r=>setTimeout(r,WAIT));}
  throw Object.assign(new Error("ANILIST_CAPACITY_EXCEEDED"),{status:503,retry:"2"});
 }
 if(localInFlight>=2)throw Object.assign(new Error("ANILIST_CAPACITY_EXCEEDED"),{status:503,retry:"2"});
 localInFlight++;return async()=>{localInFlight=Math.max(0,localInFlight-1);};
}
export async function requestAniList<T=any>(query:string,variables:Record<string,unknown>,options:{timeoutMs?:number;attempts?:number}={}):Promise<T>{
 const release=await acquire(),attempts=Math.max(1,Math.min(3,options.attempts??2));let last:unknown;
 try{for(let i=0;i<attempts;i++){try{
  const r=await fetch(ENDPOINT,{method:"POST",headers:{"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify({query,variables}),signal:AbortSignal.timeout(options.timeoutMs??10000)});
  if(r.status===429||r.status>=500){if(i<attempts-1){const ra=Number(r.headers.get("Retry-After"));await new Promise(x=>setTimeout(x,Math.min(8000,Math.max(ra*1000||0,800*(i+1)))));continue;}throw Object.assign(new Error("ANILIST_TEMPORARILY_UNAVAILABLE"),{status:r.status,retry:r.headers.get("Retry-After")??"30"});}
  if(!r.ok)throw Object.assign(new Error("ANILIST_HTTP_"+r.status),{status:r.status});
  const p=await r.json();if(p.errors?.length)throw new Error("ANILIST_GRAPHQL_ERROR");if(!p.data)throw new Error("ANILIST_EMPTY_RESPONSE");return p.data as T;
 }catch(e){last=e;if(i<attempts-1)await new Promise(x=>setTimeout(x,500*(i+1)));}}
 throw last??new Error("ANILIST_UNAVAILABLE");}finally{await release();}
}
