import type { APIRoute } from "astro";
import { createSupabaseSsrClient } from "../../../lib/supabase-ssr";

export const prerender = false;
type SocialKind = "instagram" | "tiktok";
const RULES: Record<SocialKind,{re:RegExp;hosts:string[]}> = {
  instagram:{re:/^[a-z0-9._]{1,30}$/,hosts:["instagram.com","instagr.am"]},
  tiktok:{re:/^[a-z0-9._]{2,24}$/,hosts:["tiktok.com"]}
};
const RESERVED = new Set(["p","reel","reels","explore","stories","tv","accounts","direct","video","tag","discover"]);
function normalizeHandle(kind:SocialKind,input:string):{ok:true;value:string|null}|{ok:false}{
  let s=(input??"").trim(); if(!s)return {ok:true,value:null};
  if(/[/.]/.test(s)&&/^(https?:\/\/)?[^\s/]+\.[^\s/]+\//i.test(s+"/")){
    try{const url=new URL(/^https?:\/\//i.test(s)?s:"https://"+s);const host=url.hostname.replace(/^(www|m)\./,"").toLowerCase();if(!RULES[kind].hosts.includes(host))return {ok:false};s=url.pathname.split("/").filter(Boolean)[0]??"";if(RESERVED.has(s.toLowerCase())||(kind==="tiktok"&&!s.startsWith("@")))return {ok:false};}catch{return {ok:false};}
  }
  s=s.replace(/^@+/,"").toLowerCase();if(!RULES[kind].re.test(s)||s.endsWith("."))return {ok:false};return {ok:true,value:s};
}
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
}
export const POST: APIRoute = async ({ request, cookies }) => {
  let body: { name?:unknown; aka?:unknown; headline?:unknown; bio?:unknown; location?:unknown; interests?:unknown; isPrivate?:unknown; instagram?:unknown; tiktok?:unknown };
  try { body = await request.json(); } catch { return json({ok:false,error:"INVALID_REQUEST"},400); }
  const updates:Record<string,unknown>={};
  if(body.name!==undefined){const v=typeof body.name==="string"?body.name.trim():"";if(v.length<2||v.length>40)return json({ok:false,error:"INVALID_NAME"},400);updates.name=v;}
  if(body.aka!==undefined){const v=typeof body.aka==="string"?body.aka.trim().replace(/^@/,""):"";if(!/^[\p{L}\p{N}_-]{2,24}$/u.test(v))return json({ok:false,error:"INVALID_NICKNAME"},400);updates.aka=v;}
  if(body.headline!==undefined){if(typeof body.headline!=="string"||body.headline.length>80)return json({ok:false,error:"INVALID_HEADLINE"},400);updates.headline=body.headline.trim()||null;}
  if(body.interests!==undefined){if(!Array.isArray(body.interests)||body.interests.length>8||body.interests.some(v=>typeof v!=="string"||v.trim().length>24))return json({ok:false,error:"INVALID_INTERESTS"},400);updates.interests=[...new Set(body.interests.map((v:string)=>v.trim()).filter(Boolean))];}
  if(body.bio!==undefined){if(typeof body.bio!=="string"||body.bio.length>280)return json({ok:false,error:"INVALID_BIO"},400);updates.bio=body.bio.trim()||null;}
  if(body.location!==undefined){if(typeof body.location!=="string"||body.location.length>80)return json({ok:false,error:"INVALID_LOCATION"},400);updates.location=body.location.trim()||null;}
  if(body.isPrivate!==undefined){if(typeof body.isPrivate!=="boolean")return json({ok:false,error:"INVALID_PRIVACY_SETTING"},400);updates.is_private=body.isPrivate;}
  for(const kind of ["instagram","tiktok"] as const){if(body[kind]!==undefined){if(typeof body[kind]!=="string"&&body[kind]!==null)return json({ok:false,error:"INVALID_SOCIAL_HANDLE"},400);const parsed=normalizeHandle(kind,typeof body[kind]==="string"?body[kind]:"");if(!parsed.ok)return json({ok:false,error:"INVALID_SOCIAL_HANDLE",field:kind},400);updates[kind]=parsed.value;}}
  if(!Object.keys(updates).length)return json({ok:false,error:"NO_CHANGES"},400);
  try{
    const supabase=createSupabaseSsrClient(request,cookies);const {data:authData,error:authError}=await supabase.auth.getUser();
    if(authError||!authData.user)return json({ok:false,error:"AUTH_REQUIRED"},401);
    const {data,error}=await supabase.from("profiles").update({...updates,updated_at:new Date().toISOString()}).eq("id",authData.user.id)
      .select("name, aka, headline, bio, location, interests, is_private, instagram, tiktok").single();
    if(error){console.warn("Profile update failed:",error.code);return json({ok:false,error:"PROFILE_UPDATE_FAILED",code:error.code??"UNKNOWN"},400);}
    return json({ok:true,profile:data});
  }catch(error){console.error("Profile update endpoint failed:",error);return json({ok:false,error:"AUTH_UNAVAILABLE"},503);}
};
