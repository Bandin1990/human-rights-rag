"use client";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { Bot, Quote, Sparkles } from "lucide-react";
import type { Answer } from "@/types/document";

export function AskAI({documentId,title}:{documentId?:string;title?:string}){
  const [q,setQ]=useState("");
  const [answer,setAnswer]=useState<Answer|null>(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  async function ask(e:FormEvent){
    e.preventDefault();if(!q.trim())return;setLoading(true);setError("");
    try{const r=await fetch("/api/ask",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({question:q,documentId})});if(!r.ok)throw new Error();setAnswer(await r.json());}
    catch{setError("ระบบค้นหลักฐานขัดข้อง กรุณาลองใหม่อีกครั้ง");}
    finally{setLoading(false);}
  }
  return <section className="ai-panel" id="ask"><div className="ai-heading"><span className="ai-icon"><Sparkles/></span><div><span>ASK AI · EVIDENCE MODE</span><h2>ถามจาก{title?"เอกสารนี้":"คลังเอกสาร"}</h2></div></div><p className="ai-intro">ค้นเฉพาะเนื้อหาจริงในคลัง แสดงเลขหน้า และไม่ลงข้อยุติแทน กสม.</p><form onSubmit={ask} className="ask-form"><textarea value={q} onChange={e=>setQ(e.target.value)} placeholder="เช่น กสม. มีข้อเสนอแนะเรื่องการมีส่วนร่วมของชุมชนอย่างไร?"/><button disabled={loading}><Sparkles size={17}/>{loading?"กำลังค้นหลักฐาน...":"ถามจากเอกสาร"}</button></form>{error&&<p className="answer-disclaimer">{error}</p>}{!answer&&<div className="suggestions">ลองถาม: {["การคุกคามทางเพศในการทำงานมีข้อเท็จจริงอย่างไร?","ผลกระทบจากโรงไฟฟ้าหงสามีอะไรบ้าง?"].map(s=><button type="button" key={s} onClick={()=>setQ(s)}>{s}</button>)}</div>}{answer&&<div className="answer"><div className="answer-label"><Bot size={19}/> หลักฐานที่ค้นพบ</div><p className="answer-text">{answer.answer}</p><p className="answer-disclaimer">{answer.disclaimer}</p><div className="citations"><h4><Quote size={16}/> แหล่งอ้างอิง {answer.citations.length} รายการ</h4>{answer.citations.map((c,i)=><Link href={`/documents/${c.documentId}#${c.sectionId}`} key={c.sectionId}><b>[{i+1}] {c.title}</b><span>{c.page?`หน้า ${c.page}`:c.anchor?`หัวข้อ ${c.anchor}`:"ไม่ระบุตำแหน่ง"} · “{c.excerpt}”</span></Link>)}</div></div>}</section>;
}
