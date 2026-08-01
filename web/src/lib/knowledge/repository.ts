import { getPublicSupabaseClient } from "@/lib/supabase/server";
import { getAdminSupabaseClient } from "@/lib/supabase/admin";
import { createEmbedding, embeddingToHalfvec } from "@/lib/embeddings";
import { answerFromMockDocuments, getMockDocument, searchMockDocuments } from "./mock-repository";
import { Answer, Citation, HumanRightsDocument, SearchFilters, SearchResponse } from "@/types/document";

type DocumentRow={id:string;title:string;summary:string|null;publication_year:number|null;buddhist_year:number|null;document_type:string;rights_categories:string[];page_count:number|null;published_at:string|null;source_organization:string;source_system:string;source_url:string|null;document_number:string|null;authority_level:string;language:string;file_formats:string[];featured:boolean;verified_at:string|null;document_sections?:{id:string;page_number:number|null;anchor:string|null;heading:string;content:string}[]};
type SectionRow={id:string;document_id:string;page_number:number|null;anchor:string|null;heading:string;content:string};
function mapRow(r:DocumentRow):HumanRightsDocument{return {id:r.id,title:r.title,summary:r.summary||"",year:r.publication_year||0,buddhistYear:r.buddhist_year||0,type:r.document_type as HumanRightsDocument["type"],categories:r.rights_categories as HumanRightsDocument["categories"],pages:r.page_count||undefined,publishedAt:r.published_at||"ไม่ระบุวันที่",agency:r.source_organization,sourceSystem:r.source_system as HumanRightsDocument["sourceSystem"],sourceUrl:r.source_url||undefined,documentNumber:r.document_number||undefined,authorityLevel:r.authority_level as HumanRightsDocument["authorityLevel"],language:r.language as HumanRightsDocument["language"],fileFormats:r.file_formats as HumanRightsDocument["fileFormats"],featured:r.featured,verifiedAt:r.verified_at||undefined,sections:(r.document_sections||[]).map(s=>({id:s.id,page:s.page_number||undefined,anchor:s.anchor||undefined,heading:s.heading,content:s.content}))};}

function matchesExactSearch(doc: HumanRightsDocument, rawQuery: string) {
  const haystack = [doc.title, doc.summary, doc.documentNumber || "", doc.agency, ...doc.categories, ...doc.sections.flatMap(section => [section.heading, section.content])].join(" ").toLowerCase().normalize("NFKC");
  const exact = rawQuery.toLowerCase().normalize("NFKC").trim();
  if (haystack.includes(exact)) return true;

  const queryTerms = terms(rawQuery);
  if (queryTerms.length === 0) return false;

  // For partial match, require a significant portion of terms to match
  const matchedTerms = queryTerms.filter(term => haystack.includes(term));
  return matchedTerms.length >= Math.min(3, Math.ceil(queryTerms.length * 0.4));
}

function getMappedDbTypes(uiCategory: string): string[] | null {
  if (uiCategory === "รายงานตรวจสอบ/ข้อเสนอแนะ กสม.") return ["รายงานผลการตรวจสอบ", "ข้อเสนอแนะ"];
  if (uiCategory === "รายงานประเมินสถานการณ์") return ["รายงานสถานการณ์ประจำปี"];
  if (uiCategory === "กฎหมายสิทธิมนุษยชนระหว่างประเทศและเอกสารตีความ") return ["เอกสาร UN", "กฎหมายและระเบียบ"];
  if (uiCategory === "คลังความรู้ด้านสิทธิมนุษยชน") return ["คู่มือและงานวิชาการ"];
  if (uiCategory === "กฎหมายไทย") return ["กฎหมายและระเบียบ"];
  if (uiCategory === "คำพิพากษาศาลต่างประเทศ" || uiCategory === "คำพิพากษาศาลไทย") return ["คำพิพากษา"];
  return [uiCategory];
}

export async function searchKnowledge(filters:SearchFilters={}):Promise<SearchResponse>{
  const supabase=getPublicSupabaseClient();
  if(!supabase){const results=searchMockDocuments(filters);return {results,total:results.length,mode:"mock"};}
  // Thai full-text tokenization is not available in PostgreSQL's `simple`
  // configuration. Search the published corpus directly when a text query is
  // present, so partial similarity on a common word (for example "สิทธิ")
  // cannot return unrelated documents.
  if (filters.query?.trim()) {
    try {
      const queryEmbedding = embeddingToHalfvec(await createEmbedding(filters.query));
      const { data: matches, error: matchError } = await supabase.rpc("match_public_sections", {
        query_embedding: queryEmbedding, match_threshold: 0.50, match_count: 100, filter_category: filters.category || null,
      });
      if (matchError) throw matchError;
      const documentIds = [...new Set((matches || []).map((match: { document_id: string }) => match.document_id))];
      if (documentIds.length) {
        let semanticQuery = supabase.from("documents").select("*, document_sections(id,page_number,anchor,heading,content)").in("id", documentIds).eq("access_scope", "public").eq("status", "published");
        if (filters.year) semanticQuery = semanticQuery.eq("buddhist_year", filters.year);
        if (filters.type) {
          const mappedTypes = getMappedDbTypes(filters.type);
          if (mappedTypes) semanticQuery = semanticQuery.in("document_type", mappedTypes);
        }
        if (filters.sourceSystem) semanticQuery = semanticQuery.eq("source_system", filters.sourceSystem);
        if (filters.language) semanticQuery = semanticQuery.eq("language", filters.language);
        const { data, error } = await semanticQuery;
        if (error) throw error;
        const order = new Map(documentIds.map((id, index) => [id, index]));
        const results = ((data || []) as DocumentRow[]).map(mapRow).sort((a, b) => (order.get(a.id) || 0) - (order.get(b.id) || 0));
        return { results, total: results.length, mode: "semantic" };
      }
    } catch (error) {
      // Search remains available while embeddings are being configured or a provider is temporarily unavailable.
      console.error("Semantic search unavailable; using text search", error);
    }
    let query = supabase.from("documents").select("*, document_sections(id,page_number,anchor,heading,content)").eq("access_scope", "public").eq("status", "published");
    if (filters.year) query = query.eq("buddhist_year", filters.year);
    if (filters.type) {
      const mappedTypes = getMappedDbTypes(filters.type);
      if (mappedTypes) query = query.in("document_type", mappedTypes);
    }
    if (filters.category) query = query.contains("rights_categories", [filters.category]);
    if (filters.sourceSystem) query = query.eq("source_system", filters.sourceSystem);
    if (filters.language) query = query.eq("language", filters.language);
    const { data, error } = await query;
    if (error) throw new Error(`Knowledge search failed: ${error.message}`);
    const results = ((data || []) as DocumentRow[]).map(mapRow).filter(document => matchesExactSearch(document, filters.query!));
    return { results, total: results.length, mode: "cloud" };
  }
  const {data,error}=await supabase.rpc("search_public_documents",{search_query:filters.query||null,filter_year:filters.year||null,filter_type:filters.type||null,filter_category:filters.category||null,filter_source:filters.sourceSystem||null,filter_language:filters.language||null,result_limit:100});
  if(error)throw new Error(`Knowledge search failed: ${error.message}`);
  const results=((data||[]) as DocumentRow[]).map(mapRow);return {results,total:results.length,mode:"cloud"};
}

export async function getKnowledgeDocument(id:string):Promise<HumanRightsDocument|undefined>{
  const supabase=getPublicSupabaseClient();if(!supabase)return getMockDocument(id);
  const {data,error}=await supabase.from("documents").select("*, document_sections(id,page_number,anchor,heading,content)").eq("id",id).eq("access_scope","public").eq("status","published").single();
  if(error){if(error.code==="PGRST116")return undefined;throw new Error(`Document lookup failed: ${error.message}`);}return mapRow(data as DocumentRow);
}

function terms(value:string){const normalized=value.toLowerCase().normalize("NFKC");const words=normalized.split(/[^\p{L}\p{N}]+/u).filter(v=>v.length>1);const thai=Array.from(normalized).filter(char=>/[\u0E00-\u0E7F]/u.test(char)).join("");const thaiWindows=thai.length>=3?Array.from({length:thai.length-2},(_,i)=>thai.slice(i,i+3)):[];return [...new Set([...words,...thaiWindows])];}
function evidenceScore(question:string,doc:HumanRightsDocument,content:string,heading:string){const haystack=`${doc.title} ${doc.summary} ${heading} ${content}`.toLowerCase().normalize("NFKC");const exact=haystack.includes(question.toLowerCase().normalize("NFKC"))?12:0;return exact+terms(question).reduce((score,term)=>score+(haystack.includes(term)?Math.min(6,2+(haystack.split(term).length-2)):0),0);}
function excerpt(content:string,question:string){const compact=content.replace(/\s+/g," ").trim();const positions=terms(question).map(term=>compact.toLowerCase().indexOf(term)).filter(i=>i>=0).sort((a,b)=>a-b);const position=positions[0]??0;const start=Math.max(0,position-120);const end=Math.min(compact.length,start+520);return `${start>0?"…":""}${compact.slice(start,end)}${end<compact.length?"…":""}`;}

export async function answerKnowledge(question:string,documentId?:string, category?:string, useAI:boolean=true):Promise<Answer>{
  // Answering only reads published public documents. Prefer the public client
  // so an invalid or rotated admin key cannot take Ask AI offline.
  const supabase=getPublicSupabaseClient()||getAdminSupabaseClient();
  if(!supabase)return answerFromMockDocuments(question,documentId,category);

  let ranked: {doc: HumanRightsDocument, section: any, score: number}[] = [];

  if (documentId) {
    const {data,error}=await supabase.from("documents").select("*, document_sections(id,page_number,anchor,heading,content)").eq("access_scope","public").eq("status","published").eq("id",documentId);
    if(error)throw new Error(`Evidence retrieval failed: ${error.message}`);
    const documents=((data||[]) as DocumentRow[]).map(mapRow);
    const documentById=new Map(documents.map(doc=>[doc.id,doc]));
    const {data:sectionData,error:sectionError}=await supabase.from("document_sections").select("id,document_id,page_number,anchor,heading,content").in("document_id",documents.map(doc=>doc.id));
    if(sectionError)throw new Error(`Section retrieval failed: ${sectionError.message}`);
    ranked=((sectionData||[]) as SectionRow[]).flatMap(row=>{
      const doc=documentById.get(row.document_id);
      if(!doc)return [];
      const section={id:row.id,page:row.page_number||undefined,anchor:row.anchor||undefined,heading:row.heading,content:row.content};
      return [{doc,section,score:evidenceScore(question,doc,section.content,section.heading)}];
    }).filter(item=>item.score>0).sort((a,b)=>b.score-a.score).slice(0,5);
  } else {
    try {
      const queryEmbedding = embeddingToHalfvec(await createEmbedding(question));
      const { data: matches, error: matchError } = await supabase.rpc("match_public_sections", { query_embedding: queryEmbedding, match_threshold: 0.40, match_count: 20, filter_category: null });
      if (matchError) throw matchError;
      if (matches && matches.length > 0) {
        const documentIds = [...new Set(matches.map((m:any) => m.document_id))];
        let docQuery = supabase.from("documents").select("*").in("id", documentIds).eq("access_scope", "public").eq("status", "published");
        if (category) {
          const mappedTypes = getMappedDbTypes(category);
          if (mappedTypes) docQuery = docQuery.in("document_type", mappedTypes);
        }
        const { data: docRows, error: docError } = await docQuery;
        if (docError) throw docError;
        const docs = ((docRows||[]) as DocumentRow[]).map(mapRow);
        const docById = new Map(docs.map(d => [d.id, d]));
        ranked = matches.flatMap((match: any) => {
          const doc = docById.get(match.document_id);
          if (!doc) return [];
          const lexical = evidenceScore(question, doc, match.content, match.heading);
          const score = match.similarity * 100 + lexical;
          return [{ doc, section: { id: match.section_id, page: match.page_number||undefined, anchor: match.anchor||undefined, heading: match.heading, content: match.content }, score }];
        }).sort((a:any,b:any)=>b.score-a.score).slice(0,5);
      }
    } catch (error) {
      console.error("Semantic Ask AI failed", error);
    }
    
    if(!ranked.length){
      const cleanQuestion = question.replace(/(คืออะไร|หมายถึงอะไร|หมายความว่าอะไร|ทำไม|อย่างไร|ไหม|หรือไม่|คือใคร)$/g, "").trim();
      const queries=[cleanQuestion, ...terms(cleanQuestion).filter(term=>term.length>=5)].slice(0,12);
      const matches=await Promise.all(queries.map(queryText=>searchKnowledge({query:queryText, type: category})));
      const ids=[...new Set(matches.flatMap(result=>result.results.map(item=>item.id)))].slice(0,5);
      if (ids.length > 0) {
        const {data:fallbackRows,error:fallbackError}=await supabase.from("document_sections").select("id,document_id,page_number,anchor,heading,content").in("document_id",ids);
        if(fallbackError)throw new Error(`Fallback section retrieval failed: ${fallbackError.message}`);
        const { data: docRows } = await supabase.from("documents").select("*").in("id", ids).eq("access_scope", "public").eq("status", "published");
        const docs = ((docRows||[]) as DocumentRow[]).map(mapRow);
        const docById = new Map(docs.map(d => [d.id, d]));
        ranked=((fallbackRows||[]) as SectionRow[]).flatMap(row=>{
          const doc=docById.get(row.document_id);
          if(!doc)return [];
          const section={id:row.id,page:row.page_number||undefined,anchor:row.anchor||undefined,heading:row.heading,content:row.content};
          return [{doc,section,score:evidenceScore(cleanQuestion,doc,section.content,section.heading)}];
        }).sort((a,b)=>b.score-a.score).slice(0,5);
      }
    }
  }

  if(!ranked.length) {
    const mockFallback = answerFromMockDocuments(question, documentId, category);
    if (mockFallback.citations.length > 0) return mockFallback;
    return {answer:"ยังไม่พบข้อความในคลังที่เกี่ยวข้องกับคำถามนี้เพียงพอ กรุณาลองใช้ชื่อบุคคล สถานที่ เลขรายงาน หรือประเด็นสิทธิที่เฉพาะเจาะจงขึ้น",citations:[],disclaimer:"ระบบไม่คาดเดาคำตอบและไม่ลงข้อยุติว่ามีหรือไม่มีการละเมิดสิทธิมนุษยชนแทน กสม."};
  }
  const citations:Citation[]=ranked.map(({doc,section})=>({documentId:doc.id,sectionId:section.id,title:doc.title,page:section.page,anchor:section.anchor,excerpt:excerpt(section.content,question),sourceUrl:doc.sourceUrl}));
  const evidence=citations.map((citation,index)=>`[${index+1}] ${citation.title} ${citation.page?`หน้า ${citation.page}`:""}\n${citation.excerpt}`).join("\n\n");
  const disclaimer="ระบบช่วยค้นและจัดประเด็นจากหลักฐานเท่านั้น ไม่ลงข้อยุติว่ามีหรือไม่มีการละเมิดแทน กสม. โปรดเปิดอ่านเอกสารต้นฉบับและตรวจสอบบริบททุกครั้ง";
  if(useAI && (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY)){
    try {
    const [{generateText},{createGoogleGenerativeAI}]=await Promise.all([import("ai"),import("@ai-sdk/google")]);
    const modelName=process.env.GEMINI_MODEL||"gemini-1.5-flash";
    const google=createGoogleGenerativeAI({apiKey:process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY});
    const result=await generateText({model:google(modelName),maxOutputTokens:1800,system:`คุณเป็นผู้ช่วยค้นคว้าสิทธิมนุษยชนของระบบ Human Rights Knowledge วิเคราะห์ได้เฉพาะจากหลักฐานที่ส่งให้เท่านั้น ห้ามสร้างข้อเท็จจริง กฎหมาย หรือแนววินิจฉัยที่ไม่มีในหลักฐาน ห้ามลงข้อยุติว่ามีหรือไม่มีการละเมิดสิทธิมนุษยชนแทนคณะกรรมการสิทธิมนุษยชนแห่งชาติ ใช้ถ้อยคำว่า “มีเหตุให้พิจารณา”, “อาจเกี่ยวข้อง” หรือ “หลักฐานยังไม่เพียงพอ” แยกข้อเท็จจริง กรอบสิทธิ ความเห็นเชิงวิเคราะห์ ข้อจำกัด และข้อเสนอแนะ ทุกข้อความสำคัญต้องใส่ citation [1], [2] ตามหมายเลขหลักฐาน ห้ามอ้างเลขที่ไม่มีให้มา`,prompt:`คำถาม: ${question}\n\nหลักฐานที่ค้นคืน:\n${evidence}\n\nเรียบเรียงคำตอบภาษาไทยที่กระชับ ตรวจสอบย้อนกลับได้ และบอกชัดเมื่อหลักฐานไม่เพียงพอ`});
    return {answer:result.text,citations,disclaimer,mode:"llm-rag",model:modelName};
    } catch (error) {
      // Keep the evidence-based answer available when the model provider is
      // temporarily unavailable (for example, an exhausted API quota).
      console.error("LLM answer generation failed; returning evidence mode", error);
    }
  }
  return {answer:`พบข้อความที่เกี่ยวข้องจากเอกสารในคลังดังนี้\n\n${evidence}\n\nยังไม่ได้ตั้งค่าโมเดลภาษา จึงแสดงหลักฐานโดยไม่เรียบเรียงวิเคราะห์`,citations,disclaimer,mode:"evidence"};
}
