import type { ReactNode } from "react";
import "./AnimeTop.css";
type Props={title:string;bannerImage?:string|null;poster?:string|null;score?:number|null;year?:number|null;formatLabel?:string|null;episodes?:number|null;duration?:number|null;likes:number;liked:boolean;likeBusy?:boolean;likeNotice?:string;onLike:()=>void;share?:ReactNode;libraryActions?:ReactNode;availability?:ReactNode;genres?:string[];synopsis:ReactNode;labels:{like:string;availableOn:string;genres:string;synopsis:string;episodes:string}};
export default function AnimeTop(p:Props){
 const mode=p.bannerImage?"banner":p.poster?"poster":"empty";
 return <section className="ad-top" data-mode={mode}>
  <div className="ad-visual">
   {mode==="banner"&&<img className="ad-banner" src={p.bannerImage!} alt="" fetchPriority="high"/>}
   {mode==="poster"&&<><img className="ad-bg" src={p.poster!} alt="" aria-hidden="true"/><img className="ad-pos" src={p.poster!} alt={p.title} width={320} height={480} fetchPriority="high"/></>}
   {mode==="empty"&&<div className="ad-empty-space" aria-hidden="true"/>}
   <div className="ad-actions">
    <button type="button" className="ad-ic" aria-pressed={p.liked} aria-label={p.labels.like} onClick={p.onLike} disabled={p.likeBusy}>
     <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 8.8c0 5.2-8.8 10-8.8 10s-8.8-4.8-8.8-10a4.6 4.6 0 0 1 8.8-1.9 4.6 4.6 0 0 1 8.8 1.9Z"/></svg><span>{p.likes.toLocaleString()}</span>
    </button>{p.share}
   </div>
  </div>
  {p.likeNotice&&<p className="anime-detail-like-notice" role="status">{p.likeNotice}</p>}
  <div className="ad-body">
   <h1>{p.title}</h1>
   <div className="ad-meta">
    {p.score!=null&&<span className="ad-score">★ {p.score.toFixed(1)}</span>}
    {p.score!=null&&p.year!=null&&<span aria-hidden="true">·</span>}
    {p.year!=null&&<span>{p.year}</span>}
    {p.formatLabel&&<span className="ad-chip">{p.formatLabel}</span>}
    {p.episodes!=null&&<span className="ad-chip">{p.episodes} {p.labels.episodes}</span>}
    {p.duration!=null&&<span className="ad-chip">{p.duration} min</span>}
   </div>
   {p.libraryActions&&<div className="ad-cta">{p.libraryActions}</div>}
   {p.availability&&<div className="ad-avail"><span>{p.labels.availableOn}</span>{p.availability}</div>}
   {p.genres&&p.genres.length>0&&<p className="ad-genres"><b>{p.labels.genres}:</b> {p.genres.join(", ")}</p>}
   <h2>{p.labels.synopsis}</h2><div className="ad-synopsis">{p.synopsis}</div>
  </div>
 </section>;
}