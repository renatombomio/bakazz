import {useEffect,useState} from "react";
import PersonalLibraryActions from "../personal-library/PersonalLibraryActions";
import { getLibrary } from "../../data/library";
import { fetchFallbackAnime } from "../../lib/api/anime-fallback";
import { isAnimeCandidateMatch } from "../../lib/api/poster-fallback";
import { useT, type Lang } from "../../i18n";

interface Media{
 id:number|string;
 title?:{romaji?:string|null;english?:string|null};
 description?:string|null;
 genres?:string[];
 startDate?:{year?:number|null;month?:number|null;day?:number|null}|null;
 format?:string|null;
 status?:string|null;
 episodes?:number|null;
 duration?:number|null;
 studios?:{nodes?:{name:string}[]};
 coverImage?:{extraLarge?:string|null;large?:string|null};
 bannerImage?:string|null;
 trailer?:{id?:string|null;site?:string|null;thumbnail?:string|null}|null;
 relations?:{edges?:{relationType?:string|null;node?:{id:number;format?:string|null}}[]}|null;
 recommendations?:{nodes?:{mediaRecommendation?:{id:number;title?:{romaji?:string|null;english?:string|null};coverImage?:{extraLarge?:string|null;large?:string|null};format?:string|null;startDate?:{year?:number|null}|null}|null}[]};
}

const ENDPOINT="https://graphql.anilist.co";

async function translate(text:string,lang:Lang="es"){
 if(lang==="en") return cleanDescription(text);
 const clean=cleanDescription(text);
 if(!clean)return clean;
 try{
  const response=await fetch("https://api.mymemory.translated.net/get?"+new URLSearchParams({q:clean,langpair:"en|es",mt:"1"}));
  if(!response.ok)return clean;
  const payload=await response.json();
  return payload.responseData?.translatedText||clean;
 }catch{return clean;}
}

function cleanDescription(text:string){
 const htmlEntityDecoder=document.createElement("textarea");
 htmlEntityDecoder.innerHTML=text
   .replace(/<br\s*\/?>/gi,"\n")
   .replace(/\\+n/g,"\n")
   .replace(/<[^>]*>/g,"");
 return (htmlEntityDecoder.value||text)
   .replace(/\u00a0/g," ")
   .replace(/\n{3,}/g,"\n\n")
   .trim();
}
function date(value:Media["startDate"],lang:Lang="es"){
 if(!value?.year)return lang==="en"?"Unknown date":"Fecha desconocida";
 if(!value.month||!value.day)return String(value.year);
 return new Date(value.year,value.month-1,value.day).toLocaleDateString(lang==="en"?"en-GB":"es-ES",{day:"numeric",month:"long",year:"numeric"});
}


function getSeasonCount(media: Media){
  if(media.format==="MOVIE") return null;
  const relatedTv=(media.relations?.edges??[])
    .filter((edge)=>edge.relationType==="PREQUEL"||edge.relationType==="SEQUEL")
    .filter((edge)=>edge.node?.format==="TV")
    .map((edge)=>edge.node?.id)
    .filter((id): id is number => typeof id==="number");
  return Math.max(1,new Set(relatedTv).size+1);
}

interface Props {
 lang?: Lang;
}

export default function AnimeSearchDetail({ lang = "es" }: Props){
 const t=useT(lang);
 const params=new URLSearchParams(typeof window!=="undefined" ? window.location.search : "");
 const idParam=params.get("id");
 const id=idParam ? Number(idParam) : NaN;
 const localEntry=idParam && !Number.isFinite(id) ? getLibrary().find(entry=>entry.animeId===idParam) : undefined;
 const[media,setMedia]=useState<Media|null>(null),[loading,setLoading]=useState(true),[translated,setTranslated]=useState(""),[translating,setTranslating]=useState(false);
 useEffect(()=>{
  const directId = idParam === "movie-063" ? 178788 : Number.isFinite(id) ? id : null;
  const searchTitle = params.get("title") ?? localEntry?.title ?? null;

  const request = directId
    ? {
        query:"query Detail($id:Int!){Media(id:$id,type:ANIME){id title{romaji english} description(asHtml:false) genres startDate{year month day} format status episodes duration studios(isMain:true){nodes{name}} coverImage{extraLarge large} bannerImage trailer{id site thumbnail} relations{edges{relationType node{id format}}} recommendations(sort:RATING_DESC,page:1,perPage:12){nodes{mediaRecommendation{id title{romaji english} coverImage{extraLarge large} format startDate{year}}}}}}",
        variables:{id:directId}
      }
    : searchTitle
      ? {
          query:"query Detail($search:String!){Page(page:1,perPage:1){media(search:$search,type:ANIME,sort:SEARCH_MATCH){id title{romaji english} description(asHtml:false) genres startDate{year month day} format status episodes duration studios(isMain:true){nodes{name}} coverImage{extraLarge large} bannerImage trailer{id site thumbnail} relations{edges{relationType node{id format}}} recommendations(sort:RATING_DESC,page:1,perPage:12){nodes{mediaRecommendation{id title{romaji english} coverImage{extraLarge large} format startDate{year}}}}}}}",
          variables:{search:searchTitle}
        }
      : null;

  if(!request){setLoading(false);return}

  const resolveWithJikan = async () => {
    if (!searchTitle) return false;
    const recovered = await fetchFallbackAnime(searchTitle);
    if (!recovered) return false;
    setMedia(recovered);
    return true;
  };

  fetch("https://graphql.anilist.co",{method:"POST",headers:{"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify(request)})
    .then(r=>r.ok?r.json():Promise.reject())
    .then(async p=>{
      const candidate=directId ? (p.data?.Media??null) : (p.data?.Page?.media?.[0]??null);
      const found = directId || (candidate && isAnimeCandidateMatch(
        searchTitle || "",
        candidate.title,
        candidate.format,
      )) ? candidate : null;
      if(found) {
        setMedia(found);
        return;
      }
      await resolveWithJikan();
    }).catch(async ()=>{
      await resolveWithJikan();
    }).finally(()=>setLoading(false));
 },[]);
 if(loading)return <div className="anime-search-detail-state">{t("detail.loading")}</div>;
 if(!media)return <div className="anime-search-detail-state">{t("detail.notFound")}</div>;

 const title=idParam==="movie-063" ? "Kimetsu no Yaiba: Mugen-jō-hen" : lang==="en" ? (media.title?.english||media.title?.romaji||localEntry?.title||t("detail.noTitle")) : (media.title?.romaji||media.title?.english||localEntry?.title||t("detail.noTitle"));
 const image=media.coverImage?.extraLarge||media.coverImage?.large;
 const banner=media.bannerImage||image;
 const synopsis=media.description?cleanDescription(media.description):"";
 const hasSynopsis=synopsis.replace(/[\s\\n]+/g,"").length>0;
 const translateSynopsis=async()=>{if(lang==="en"||!media.description||translating)return;setTranslating(true);setTranslated(await translate(media.description,lang));setTranslating(false)};

 return <div className="anime-detail">
  <section className="anime-detail-hero" style={banner?{backgroundImage:'linear-gradient(90deg,rgba(9,9,9,.98),rgba(9,9,9,.72) 45%,rgba(9,9,9,.35) 75%,rgba(9,9,9,.8)),linear-gradient(0deg,rgba(9,9,9,.98),transparent 45%),url("'+banner+'")'}:undefined}>
   <div className="anime-detail-inner">
    <div className={"anime-detail-layout"+(title.length>24?" has-long-title":"")}>
     <div className="anime-detail-poster-column">
      <div className="anime-detail-poster">{image?<img src={image} alt={title}/>:<div className="anime-detail-placeholder">RENANIME</div>}</div>
      <div className="anime-detail-library-actions"><PersonalLibraryActions animeId={localEntry?.animeId ?? media.id} lang={lang} /></div>
     </div>

     <div className="anime-detail-copy">
      <div className="anime-detail-copy-main">
       <h1>{title}</h1>
       <div className="anime-detail-meta">
        <span className="anime-detail-meta-type"><strong>{media.format==="MOVIE"?t("detail.film"):t("detail.series")}</strong></span>
        <span><small>{t("detail.release")}</small><strong>{date(media.startDate,lang)}</strong></span>
        {media.format!=="MOVIE"&&media.episodes&&<span><small>{t("detail.episodes")}</small><strong>{media.episodes}</strong></span>}
        {media.duration&&<span><small>{media.format==="MOVIE"?t("detail.duration"):t("detail.durationEpisode")}</small><strong>{media.duration} min</strong></span>}
        {media.format!=="MOVIE"&&getSeasonCount(media)&&<span><small>{t("detail.seasons")}</small><strong>{getSeasonCount(media)}</strong></span>}
       </div>

       {media.genres?.length&&<div className="anime-detail-genres">{media.genres.slice(0,5).map(genre=><span key={genre}>{genre}</span>)}</div>}
      </div>
     </div>

     <div className="anime-detail-synopsis-wrap">
      <span className="anime-detail-label">{t("detail.synopsis")}</span>
      <p className="anime-detail-synopsis">{translated||synopsis||(hasSynopsis?"":t("detail.noSynopsis"))}</p>
      {lang!=="en"&&hasSynopsis&&media.description&&<button type="button" className="anime-detail-translate" onClick={translateSynopsis} disabled={translating}>{translating?t("detail.translating"):translated?t("detail.translated"):t("detail.translate")}</button>}
     </div>

     {media.trailer?.id&&media.trailer.site==="youtube"&&<section className="anime-detail-trailer"><span className="anime-detail-label">{t("detail.trailer")}</span><div className="anime-detail-video"><iframe src={"https://www.youtube.com/embed/"+media.trailer.id+"?rel=0"} title={(lang==="en"?"Trailer for ":"Tráiler de ")+title} loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen /></div></section>}

     {(() => {
       const seen = new Set<number>();
       const items = (media.recommendations?.nodes ?? [])
        .map((node) => node.mediaRecommendation)
        .filter((item): item is NonNullable<typeof item> => Boolean(item))
        .filter((item) => item.id !== media.id && !seen.has(item.id) && seen.add(item.id))
        .slice(0, 8);
       return items.length ? <section className="anime-detail-recommendations" aria-label={t("detail.recommendations")}>
        <div className="anime-detail-recommendations-head">
         <span className="anime-detail-label">{t("detail.recommendedNext")}</span>
        </div>
        <div className="anime-detail-recommendations-track">
         {items.map((item) => {
          const recTitle=lang==="en"?(item.title?.english||item.title?.romaji||t("detail.noTitle")):(item.title?.romaji||item.title?.english||t("detail.noTitle"));
          const recImage=item.coverImage?.extraLarge||item.coverImage?.large;
          return <a className="anime-detail-recommendation" href={`${lang === "en" ? "/en" : ""}/anime/search?id=${item.id}`} key={item.id}>
           <div className="anime-detail-recommendation-poster">{recImage&&<img src={recImage} alt={recTitle} loading="lazy" />}</div>
           <span className="anime-detail-recommendation-title">{recTitle}</span>
           <span className="anime-detail-recommendation-meta">{item.format==="MOVIE"?t("detail.film"):t("detail.series")}{item.startDate?.year?" · "+item.startDate.year:""}</span>
          </a>;
         })}
        </div>
       </section> : null;
      })()}
    </div>
   </div>
  </section>
  <section className="anime-detail-info">
   <div><span className="anime-detail-label">{t("detail.information")}</span><strong>{media.studios?.nodes?.map(studio=>studio.name).join(" · ")||t("detail.studioUnavailable")}</strong></div>
   <div><span className="anime-detail-label">{t("detail.format")}</span><strong>{media.format==="MOVIE"?t("detail.film"):t("detail.series")}</strong></div>
  </section>
 </div>;
}
