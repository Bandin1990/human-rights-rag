import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CalendarDays, ChevronLeft, Download, FileText, Share2, ShieldCheck } from "lucide-react";
import { AskAI } from "@/components/ask-ai";
import { getKnowledgeDocument } from "@/lib/knowledge/repository";

export const dynamic = "force-dynamic";

export default async function DocumentPage({params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const doc=await getKnowledgeDocument(id);
  if(!doc)notFound();
  return <main className="detail-page"><div className="container"><Link href="/" className="back"><ChevronLeft size={17}/> กลับไปหน้าค้นหา</Link><div className="detail-grid"><article><div className="detail-hero"><div className="tags"><span className="tag tag-type">{doc.type}</span>{doc.categories.map(c=><span className="tag" key={c}>{c}</span>)}</div><h1>{doc.title}</h1><p>{doc.summary}</p><div className="source-strip"><b>{doc.authorityLevel}</b><span>{doc.sourceSystem}</span>{doc.documentNumber&&<span>{doc.documentNumber}</span>}<span>{doc.fileFormats.join(" · ").toUpperCase()}</span></div><div className="detail-meta"><span><CalendarDays/>เผยแพร่ {doc.publishedAt}</span>{doc.pages&&<span><FileText/>{doc.pages} หน้า</span>}<span><ShieldCheck/>{doc.agency}</span></div><div className="detail-actions">{doc.sourceUrl?<a href={doc.sourceUrl} target="_blank" rel="noreferrer"><Download size={17}/> เปิดเอกสารต้นฉบับ</a>:<button disabled><Download size={17}/> ยังไม่มีไฟล์ต้นฉบับ</button>}<button className="secondary"><Share2 size={17}/> แชร์เอกสาร</button></div></div><section className="document-body"><div className="body-heading"><span>เนื้อหาที่จัดทำดัชนี</span><small>{doc.verifiedAt?`ตรวจสอบล่าสุด ${doc.verifiedAt}`:"รอตรวจสอบวันที่"}</small></div>{doc.sections.map((s,i)=><section id={s.id} key={s.id}><span className="section-number">{String(i+1).padStart(2,"0")}</span><div><h2>{s.heading}</h2><p>{s.content}</p><span className="page-ref">{s.page?`หน้า ${s.page}`:s.anchor?`หัวข้อ ${s.anchor}`:"ตำแหน่งไม่ระบุ"}</span></div></section>)}</section></article><aside><AskAI documentId={doc.id} title="เอกสารนี้"/><div className="toc"><b>สารบัญ</b>{doc.sections.map((s,i)=><a href={`#${s.id}`} key={s.id}><span>{String(i+1).padStart(2,"0")}</span>{s.heading}<ArrowRight size={14}/></a>)}</div></aside></div></div></main>;
}
