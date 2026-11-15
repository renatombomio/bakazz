import { useEffect, useRef } from "react";
export interface HeroSlide { id:string; title:string; year?:number; format?:string; banner?:string; cover?:string; eyebrow?:string; note?:string; }
interface Props { slides:HeroSlide[]; kicker?:string; title?:string; copy?:string; ariaLabel?:string; videoSrc?:string; variant?:"default"|"ghibli"; }
export default function HeroCarousel({slides:_slides,kicker="Renanime's",title="Gallery.",copy="Anime a través de mis ojos.\\nEste es mi regalo para ti.",ariaLabel="Renanime's Gallery",videoSrc="/videos/hero.mp4",variant="default"}:Props){
 const videoRef=useRef<HTMLVideoElement>(null);
 useEffect(()=>{const video=videoRef.current;if(!video)return;video.defaultMuted=true;video.muted=true;const mq=window.matchMedia("(prefers-reduced-motion: reduce)");const sync=()=>{video.defaultMuted=true;video.muted=true;if(mq.matches){video.pause();return;}void video.play().catch(()=>{});};sync();mq.addEventListener("change",sync);return()=>mq.removeEventListener("change",sync);},[]);
 const ghibli=variant==="ghibli";
 return <section className={ghibli?"hero hero--ghibli":"hero hero--world"} aria-label={ariaLabel}>
  <div className="hero-media" aria-hidden="true"><video className="hero-video" ref={videoRef} muted suppressHydrationWarning loop playsInline preload="metadata" aria-hidden="true"><source src={videoSrc} type="video/mp4"/></video></div>
  {ghibli?<div className="hero-inner"><div className="hero-title"><p className="hero-kicker">{kicker}</p><h1>{title}</h1><p className="hero-copy">{copy.split("\\n").map((line,i)=><span key={line}>{i>0&&<br/>}{line}</span>)}</p></div></div>
  :<div className="hero-inner hero-world-inner"><div className="hero-title hero-world-title"><span className="hero-world-eyebrow">WORLD</span><h1 aria-label="Renanime World"><span className="hero-wordmark-ren">REN</span><span className="hero-wordmark-anime">ANIME</span></h1>{copy&&<p className="hero-copy">{copy}</p>}</div><span className="hero-world-index" aria-hidden="true">ANIME · COMMUNITY · CULTURE</span></div>}
 </section>;
}