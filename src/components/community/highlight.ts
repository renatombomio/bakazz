const base=(c:string)=>c.normalize("NFD").charAt(0).toLowerCase();
export function matchRanges(text:string,query:string):[number,number][]{
 const q=[...query.trim()].map(base);if(!q.length)return[];
 const chars=[...text].map(base),out:[number,number][]=[];
 for(let i=0;i+q.length<=chars.length;){let ok=true;for(let j=0;j<q.length;j++)if(chars[i+j]!==q[j]){ok=false;break;}if(ok){out.push([i,i+q.length]);i+=q.length;}else i++;}
 return out;
}