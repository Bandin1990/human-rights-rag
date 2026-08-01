"use client";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { documentTypes, rightsCategories, sourceSystems, years } from "@/data/documents";
import { DocumentCard } from "@/components/document-card";
import { Search, SlidersHorizontal, X } from "@/components/icons";
import { HumanRightsDocument, SearchResponse } from "@/types/document";

export function SearchExperience({initial}:{initial:SearchResponse}){
 const [query,setQuery]=useState("");
 const [submitted,setSubmitted]=useState("");
 const [popularSearches,setPopularSearches]=useState(["เสรีภาพการชุมนุม","สิทธิชุมชน","การเข้าถึงทนายความ"]);

 useEffect(()=>{
  try {
   const saved=localStorage.getItem("hr_recent_searches");
   if(saved) {
    const parsed=JSON.parse(saved);
    if(Array.isArray(parsed)&&parsed.length>0) setPopularSearches(parsed);
   }
  } catch(e){}
 },[]);
 const [year,setYear]=useState(0);
 const [type,setType]=useState("");
 const [category,setCategory]=useState("");
 const [source,setSource]=useState("");
 const [language,setLanguage]=useState("");
 const [searchResults,setSearchResults]=useState<HumanRightsDocument[]>([]);
 const [loading,setLoading]=useState(false);
 const [mode,setMode]=useState<SearchResponse["mode"]>(initial.mode);
 const filtering=!!(submitted||year||type||category||source||language);
 const visibleResults=filtering?searchResults:initial.results;
 const params=useMemo(()=>{const p=new URLSearchParams();if(submitted)p.set("q",submitted);if(year)p.set("year",String(year));if(type)p.set("type",type);if(category)p.set("category",category);if(source)p.set("source",source);if(language)p.set("language",language);return p},[submitted,year,type,category,source,language]);
 useEffect(()=>{if(!filtering)return;const controller=new AbortController();const timer=setTimeout(()=>setLoading(true),0);fetch(`/api/search?${params}`,{signal:controller.signal}).then(r=>{if(!r.ok)throw new Error("search failed");return r.json()}).then((d:SearchResponse)=>{setSearchResults(d.results);setMode(d.mode)}).catch(e=>{if(e.name!=="AbortError")setSearchResults([])}).finally(()=>setLoading(false));return()=>{clearTimeout(timer);controller.abort()}},[filtering,params]);
 const reset=()=>{setSubmitted("");setQuery("");setYear(0);setType("");setCategory("");setSource("");setLanguage("")};
 const submit=(e:FormEvent)=>{
  e.preventDefault();
  const q = query.trim();
  setSubmitted(q);
  if (q) {
   const newSearches = [q, ...popularSearches.filter(s => s !== q)].slice(0, 3);
   setPopularSearches(newSearches);
   try { localStorage.setItem("hr_recent_searches", JSON.stringify(newSearches)); } catch(e){}
  }
 };
 return <>
  <section className="hero"><div className="orb orb-one"/><div className="orb orb-two"/><div className="container hero-inner"><span className="eyebrow">คลังความรู้สิทธิมนุษยชน</span><h1>ค้นคว้าเพื่อเข้าใจ<br/><em>สิทธิของทุกคน</em></h1><p>ค้นรายงาน กสม. คำพิพากษา กฎหมาย และมาตรฐานระหว่างประเทศ<br/>พร้อมแหล่งที่มาและตำแหน่งอ้างอิงที่ตรวจสอบย้อนกลับได้</p><form className="search-box" onSubmit={submit}><Search/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="ค้นหาประเด็น เลขเอกสาร ชื่อเรื่อง หรือคำสำคัญ..."/><button>ค้นหา</button></form><div className="quick"><span>ค้นหายอดนิยม</span>{popularSearches.map(t=><button key={t} type="button" onClick={()=>{setQuery(t);setSubmitted(t);const newSearches=[t,...popularSearches.filter(s=>s!==t)].slice(0,3);setPopularSearches(newSearches);try{localStorage.setItem("hr_recent_searches",JSON.stringify(newSearches))}catch(e){}}}>{t}</button>)}</div></div></section>
  <main className="container content">
   <aside className="filters"><div className="filter-title"><span><SlidersHorizontal size={18}/> ตัวกรอง</span>{filtering&&<button onClick={reset}>ล้างทั้งหมด</button>}</div>
    <label>ปีที่เผยแพร่<select value={year} onChange={e=>setYear(Number(e.target.value))}><option value="0">ทุกปี</option>{years.map(y=><option key={y}>{y}</option>)}</select></label>
    <label>ประเภทเอกสาร<select value={type} onChange={e=>setType(e.target.value)}><option value="">ทุกประเภท</option>{documentTypes.map(v=><option key={v}>{v}</option>)}</select></label>
    <label>หมวดสิทธิ<select value={category} onChange={e=>setCategory(e.target.value)}><option value="">ทุกหมวดสิทธิ</option>{rightsCategories.map(v=><option key={v}>{v}</option>)}</select></label>
    <label>แหล่งข้อมูล<select value={source} onChange={e=>setSource(e.target.value)}><option value="">ทุกแหล่งข้อมูล</option>{sourceSystems.map(v=><option key={v}>{v}</option>)}</select></label>
    <label>ภาษา<select value={language} onChange={e=>setLanguage(e.target.value)}><option value="">ทุกภาษา</option><option value="th">ภาษาไทย</option><option value="en">English</option><option value="th-en">สองภาษา</option></select></label>
    <div className="filter-note"><b>แหล่งข้อมูลตรวจสอบย้อนกลับได้</b><p>แสดงองค์กรเจ้าของเอกสาร ประเภทแหล่ง ภาษา และตำแหน่ง citation</p></div>
   </aside>
   <section className="results"><div className="section-head"><div><span className="kicker">{filtering?"ผลการค้นหา":"เอกสารแนะนำ"}</span><h2>{loading?"กำลังค้นคลังเอกสาร...":filtering?`พบ ${visibleResults.length} เอกสาร`:"คัดสรรจากหลายแหล่งความรู้"}</h2></div><span className="result-count">{mode==="semantic"?"SEMANTIC INDEX":mode==="cloud"?"CLOUD INDEX":"DEMO INDEX"} · {visibleResults.length} รายการ</span></div>
    <div className="active-filters">{submitted&&<span>“{submitted}” <X size={13} onClick={()=>setSubmitted("")}/></span>}{year>0&&<span>พ.ศ. {year} <X size={13} onClick={()=>setYear(0)}/></span>}{type&&<span>{type} <X size={13} onClick={()=>setType("")}/></span>}{category&&<span>{category} <X size={13} onClick={()=>setCategory("")}/></span>}{source&&<span>{source} <X size={13} onClick={()=>setSource("")}/></span>}{language&&<span>{language.toUpperCase()} <X size={13} onClick={()=>setLanguage("")}/></span>}</div>
    <div className={`doc-list ${loading?"is-loading":""}`}>{visibleResults.map(d=><DocumentCard key={d.id} doc={d}/>)}</div>
    {!loading&&visibleResults.length===0&&<div className="empty"><Search/><h3>ยังไม่พบเอกสารที่ตรงกัน</h3><p>ลองใช้คำค้นที่กว้างขึ้นหรือเปลี่ยนตัวกรอง</p><button onClick={reset}>ล้างการค้นหา</button></div>}
   </section>
  </main>
 </>;
}
