import { useState, type ReactNode } from "react";
import { matchRanges } from "./highlight";
import "./CommunitySearch.css";

export type SearchTab = "todo" | "usuarios" | "debates";
export type UserHit = { id: string; username: string; name: string | null; avatar: string | null; href: string; seen: number; favorites: number };
export type DebateHit = { id: number; title: string; meta: string; href: string };

type Props = {
  query: string;
  initialTab?: SearchTab;
  users: UserHit[]; usersTotal: number; hasMoreUsers?: boolean; onMoreUsers?: () => void;
  debates: DebateHit[]; debatesTotal: number; hasMoreDebates?: boolean; onMoreDebates?: () => void;
  similar?: UserHit[];
  loadingMore?: boolean;
  onTabChange?: (t: SearchTab) => void;
  t: {
    all: string; users: string; debates: string; seeAll: string; more: string; similar: string;
    stats: string;
    empty: string;
    emptyHint: string;
  };
};
const CAP = 3;
function Mark({ text, q }: { text: string; q: string }) {
  const chars=[...text], ranges=matchRanges(text,q);
  if(!ranges.length)return <>{text}</>;
  const out:ReactNode[]=[];let at=0;
  ranges.forEach(([a,b],i)=>{if(a>at)out.push(chars.slice(at,a).join(""));out.push(<mark key={i}>{chars.slice(a,b).join("")}</mark>);at=b;});
  if(at<chars.length)out.push(chars.slice(at).join(""));
  return <>{out}</>;
}
function UserRow({u,q,t}:{u:UserHit;q:string;t:Props["t"]}){
 const main=u.name?.trim()||u.username;
 return <a className="cs-u" href={u.href}>
  {u.avatar?<img src={u.avatar} alt="" width={46} height={46} loading="lazy"/>:<span className="cs-av" aria-hidden="true">{main.charAt(0).toUpperCase()}</span>}
  <span><b><Mark text={main} q={q}/></b><small>@<Mark text={u.username} q={q}/> · {t.stats.replace("{seen}",String(u.seen)).replace("{favorites}",String(u.favorites))}</small></span>
 </a>;
}
function DebateRow({d,q}:{d:DebateHit;q:string}){
 return <a className="cs-d" href={d.href}><b><Mark text={d.title} q={q}/></b><small>{d.meta}</small></a>;
}
export default function CommunitySearch(p:Props){
 const {t,query:q}=p;
 const [tab,setTab]=useState<SearchTab>(p.initialTab??"todo");
 const go=(next:SearchTab)=>{
  setTab(next);
  try{const u=new URL(location.href);next==="todo"?u.searchParams.delete("tipo"):u.searchParams.set("tipo",next);history.replaceState(null,"",u);}catch{}
  p.onTabChange?.(next);
 };
 const tabs:[SearchTab,string,number|null][]=[["todo",t.all,null],["usuarios",t.users,p.usersTotal],["debates",t.debates,p.debatesTotal]];
 const nothing=tab==="todo"?p.usersTotal+p.debatesTotal===0:tab==="usuarios"?p.usersTotal===0:p.debatesTotal===0;
 return <div className="cs">
  <div className="cs-tabs" role="tablist">
   {tabs.map(([k,label,n])=><button key={k} type="button" role="tab" id={`cs-t-${k}`} aria-selected={tab===k} aria-controls="cs-panel" onClick={()=>go(k)} data-empty={n===0}>{label}{n!==null&&<i>{n}</i>}</button>)}
  </div>
  <div id="cs-panel" role="tabpanel" aria-labelledby={`cs-t-${tab}`}>
   {nothing?<div className="cs-empty"><p>{t.empty} “{q}”</p><span>{t.emptyHint}</span>{!!p.similar?.length&&<section><h2>{t.similar}</h2>{p.similar.map(u=><UserRow key={u.id} u={u} q="" t={t}/>)}</section>}</div>
   :tab==="todo"?<>
    {p.usersTotal>0&&<section><header><h2>{t.users}<i>{p.usersTotal}</i></h2>{p.usersTotal>CAP&&<button type="button" className="cs-all" onClick={()=>go("usuarios")}>{t.seeAll}</button>}</header>{p.users.slice(0,CAP).map(u=><UserRow key={u.id} u={u} q={q} t={t}/>)}</section>}
    {p.debatesTotal>0&&<section><header><h2>{t.debates}<i>{p.debatesTotal}</i></h2>{p.debatesTotal>CAP&&<button type="button" className="cs-all" onClick={()=>go("debates")}>{t.seeAll}</button>}</header>{p.debates.slice(0,CAP).map(d=><DebateRow key={d.id} d={d} q={q}/>)}</section>}
   </>:tab==="usuarios"?<section>{p.users.map(u=><UserRow key={u.id} u={u} q={q} t={t}/>)}{p.hasMoreUsers&&<button type="button" className="cs-all cs-more" disabled={p.loadingMore} onClick={p.onMoreUsers}>{t.more}</button>}</section>
   :<section>{p.debates.map(d=><DebateRow key={d.id} d={d} q={q}/>)}{p.hasMoreDebates&&<button type="button" className="cs-all cs-more" disabled={p.loadingMore} onClick={p.onMoreDebates}>{t.more}</button>}</section>}
  </div>
 </div>;
}