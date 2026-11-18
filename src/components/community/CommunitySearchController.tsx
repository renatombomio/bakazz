import { useCallback, useEffect, useState } from "react";
import CommunitySearch, { type DebateHit, type SearchTab, type UserHit } from "./CommunitySearch";

type Props={api:string;lang:"es"|"en";t: {all:string;users:string;debates:string;seeAll:string;more:string;similar:string;stats:(seen:number,favorites:number)=>string;empty:(q:string)=>string;emptyHint:string}};
type Payload={users:UserHit[];usersTotal:number;debates:DebateHit[];debatesTotal:number;usersPage:number;debatesPage:number};
export default function CommunitySearchController({api,lang,t}:Props){
 const [query,setQuery]=useState("");const [tab,setTab]=useState<SearchTab>("todo");
 const [payload,setPayload]=useState<Payload>({users:[],usersTotal:0,debates:[],debatesTotal:0,usersPage:0,debatesPage:0});
 const [loading,setLoading]=useState(false);const [loadingMore,setLoadingMore]=useState(false);const [error,setError]=useState("");
 const search=useCallback(async(q:string,nextTab:SearchTab,replace=true)=>{
  setQuery(q);setTab(nextTab);if(q.replace(/^@/,"").length<2){setPayload({users:[],usersTotal:0,debates:[],debatesTotal:0,usersPage:0,debatesPage:0});setError("");return;}
  setLoading(true);setError("");
  try{const u=new URL(api,window.location.origin);u.searchParams.set("q",q);const r=await fetch(u,{credentials:"same-origin",headers:{Accept:"application/json"}});if(!r.ok)throw new Error("SEARCH_FAILED");const d=await r.json();setPayload({users:d.users??[],usersTotal:d.usersTotal??0,debates:d.debates??[],debatesTotal:d.debatesTotal??0,usersPage:0,debatesPage:0});}
  catch{setError(lang==="en"?"Search is temporarily unavailable.":"La búsqueda no está disponible temporalmente.");}
  finally{setLoading(false);}
  if(replace){const url=new URL(location.href);url.searchParams.set("q",q);nextTab==="todo"?url.searchParams.delete("tipo"):url.searchParams.set("tipo",nextTab);history.replaceState(null,"",url);}
 },[api,lang]);
 useEffect(()=>{
  const input=document.querySelector<HTMLInputElement>("#community-search");if(!input)return;
  let timer:number|undefined;
  const setNormal=(q:string)=>{const normal=document.querySelector<HTMLElement>("#community-normal");if(normal)normal.hidden=q.replace(/^@/,"").length>=2;};
  const onInput=()=>{const q=input.value.trim();setNormal(q);window.clearTimeout(timer);if(!q){const u=new URL(location.href);u.searchParams.delete("q");u.searchParams.delete("tipo");history.replaceState(null,"",u);setQuery("");setPayload({users:[],usersTotal:0,debates:[],debatesTotal:0,usersPage:0,debatesPage:0});setError("");return;}timer=window.setTimeout(()=>void search(q,"todo",true),250);};
  const onPop=()=>{const u=new URL(location.href),q=u.searchParams.get("q")?.trim()??"",v=u.searchParams.get("tipo");if(input.value!==q)input.value=q;setNormal(q);void search(q, v==="usuarios"||v==="debates"?v:"todo",false);};
  input.addEventListener("input",onInput);window.addEventListener("popstate",onPop);
  const initial=new URL(location.href),q=initial.searchParams.get("q")?.trim()??"",v=initial.searchParams.get("tipo");if(q){input.value=q;setNormal(q);void search(q,v==="usuarios"||v==="debates"?v:"todo",false);}
  return()=>{window.clearTimeout(timer);input.removeEventListener("input",onInput);window.removeEventListener("popstate",onPop);};
 },[search]);
 const loadMore=async(kind:"users"|"debates")=>{
  if(loadingMore)return;setLoadingMore(true);
  const page=payload[kind==="users"?"usersPage":"debatesPage"]+1;
  try{const u=new URL(api,window.location.origin);u.searchParams.set("q",query);u.searchParams.set(kind==="users"?"usersPage":"debatesPage",String(page));const r=await fetch(u,{credentials:"same-origin"});if(!r.ok)throw new Error();const d=await r.json();setPayload(p=>kind==="users"?{...p,users:[...p.users,...d.users],usersPage:page}:{...p,debates:[...p.debates,...d.debates],debatesPage:page});}
  catch{setError(lang==="en"?"Could not load more results.":"No se pudieron cargar más resultados.");}finally{setLoadingMore(false);}
 };
 const visible=query.replace(/^@/,"").length>=2;
 return <div hidden={!visible} aria-busy={loading}>{error&&<p className="community-note">{error}</p>}{visible&&<CommunitySearch key={query+":"+tab} query={query} initialTab={tab} users={payload.users} usersTotal={payload.usersTotal} hasMoreUsers={payload.users.length<payload.usersTotal} onMoreUsers={()=>void loadMore("users")} debates={payload.debates} debatesTotal={payload.debatesTotal} hasMoreDebates={payload.debates.length<payload.debatesTotal} onMoreDebates={()=>void loadMore("debates")} loadingMore={loadingMore} onTabChange={setTab} t={t}/>}</div>;
}