import { documents } from "@/data/documents";
import { Answer, HumanRightsDocument, SearchFilters } from "@/types/document";

export function searchMockDocuments(filters: SearchFilters = {}): HumanRightsDocument[] {
  const q=(filters.query||"").trim().toLocaleLowerCase("th");
  return documents.filter(d =>
    (!filters.year || d.buddhistYear===filters.year) && (!filters.type || d.type===filters.type) &&
    (!filters.category || d.categories.includes(filters.category)) && (!filters.sourceSystem || d.sourceSystem===filters.sourceSystem) &&
    (!filters.language || d.language===filters.language) &&
    (!q || [d.title,d.summary,d.type,d.documentNumber||"",d.agency,...d.categories,...d.sections.flatMap(s=>[s.heading,s.content])].join(" ").toLocaleLowerCase("th").includes(q))
  );
}

export function getMockDocument(id:string){ return documents.find(d=>d.id===id); }

function terms(value:string){
  const normalized=value.toLowerCase().normalize("NFKC");
  const words=normalized.split(/[^\p{L}\p{N}]+/u).filter(v=>v.length>1);
  const thai=Array.from(normalized).filter(char=>/[\u0E00-\u0E7F]/u.test(char)).join("");
  const thaiWindows=thai.length>=3?Array.from({length:thai.length-2},(_,i)=>thai.slice(i,i+3)):[thai];
  return [...new Set([...words,...thaiWindows])].filter(t=>t.length>1);
}

export function answerFromMockDocuments(question:string, documentId?:string, category?:string):Answer {
  let pool = documents;
  if (documentId) pool = pool.filter(d=>d.id===documentId);
  if (category) pool = pool.filter(d=>d.type===category || (d.categories as string[]).includes(category));
  const searchTerms=terms(question);
  const exactTerm=question.toLocaleLowerCase("th").trim();
  const ranked=pool.flatMap(d=>d.sections.map(s=>{
    const haystack = (s.content+s.heading+d.title).toLocaleLowerCase("th");
    const exactBonus = haystack.includes(exactTerm) ? 10 : 0;
    const score = exactBonus + searchTerms.reduce((n,t)=>n+(haystack.includes(t)?1:0),0);
    return {d,s,score};
  })).filter(item=>item.score > 0).sort((a,b)=>b.score-a.score).slice(0,3);
  if(!ranked.length)return {answer:"ไม่พบข้อมูลเพียงพอจากเอกสารที่อยู่ในคลัง",citations:[],disclaimer:"คำตอบนี้สร้างจากเอกสารในคลังเท่านั้น กรุณาตรวจสอบต้นฉบับก่อนนำไปใช้อ้างอิง"};
  const best=ranked[0];
  return {answer:`จากเอกสารที่ค้นพบ ประเด็นสำคัญคือ ${best.s.content} ควรพิจารณาร่วมกับบริบท ข้อเท็จจริง และสถานะของแหล่งอ้างอิงแต่ละประเภท`,citations:ranked.map(({d,s})=>({documentId:d.id,sectionId:s.id,title:d.title,page:s.page,anchor:s.anchor,excerpt:s.content,sourceUrl:d.sourceUrl})),disclaimer:"คำตอบนี้สร้างจากเอกสารในคลังเท่านั้น กรุณาตรวจสอบต้นฉบับและสถานะทางกฎหมายก่อนนำไปใช้อ้างอิง"};
}
