"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { SearchResponse, Answer, Citation } from "@/types/document";
import { Search, Folder, Clock, Plus, Bot, User, Send, Book, Scale, Star, FileText, ExternalLink } from "lucide-react";

export function ChatWorkspace({ initial }: { initial: SearchResponse }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [chatHistory, setChatHistory] = useState<{role: "user" | "ai", text: string, citations?: Citation[]}[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeCitations, setActiveCitations] = useState<Citation[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [useAI, setUseAI] = useState(true);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const categories = [
    "รายงานตรวจสอบ/ข้อเสนอแนะ กสม.",
    "รายงานประเมินสถานการณ์",
    "กฎหมายสิทธิมนุษยชนระหว่างประเทศและเอกสารตีความ",
    "คลังความรู้ด้านสิทธิมนุษยชน",
    "กฎหมายไทย",
    "คำพิพากษาศาลต่างประเทศ",
    "คำพิพากษาศาลไทย"
  ];

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || loading) return;

    const userQuery = query.trim();
    setQuery("");
    setChatHistory(prev => [...prev, { role: "user", text: userQuery }]);
    setRecentSearches(prev => [userQuery, ...prev.filter(q => q !== userQuery)].slice(0, 5));
    setLoading(true);

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: userQuery, category: activeCategory, useAI })
      });
      if (!res.ok) throw new Error("API Error");
      const data: Answer = await res.json();
      
      setChatHistory(prev => [...prev, { role: "ai", text: data.answer, citations: data.citations }]);
      if (data.citations && data.citations.length > 0) {
        setActiveCitations(data.citations);
      }
    } catch (err) {
      setChatHistory(prev => [...prev, { role: "ai", text: "ขออภัย ไม่สามารถเชื่อมต่อกับระบบได้ในขณะนี้" }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="cw-container">
      {/* Sidebar */}
      <div className="cw-sidebar">
        <div className="cw-logo">
          <Scale size={24} /> HumanRights
        </div>
        
        <div className="cw-new-chat">
          <button className="cw-new-chat-btn">
            <Plus size={18} /> แชทใหม่
          </button>
        </div>

        <div className="cw-nav">
          <div className="cw-nav-title">คลังข้อมูลสิทธิมนุษยชน</div>
          {categories.map(cat => (
            <button 
              key={cat} 
              className={`cw-nav-link ${activeCategory === cat ? 'active' : ''}`}
              onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
            >
              <Book size={18} /> 
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cat}</span>
            </button>
          ))}

          <div className="cw-nav-title" style={{ marginTop: '16px' }}>เครื่องมือภายนอก</div>
          <a href="https://notebooklm.google.com/" target="_blank" rel="noopener noreferrer" className="cw-nav-link">
            <Folder size={18} /> NotebookLM ของฉัน
          </a>
          <a href="obsidian://open?vault=HumanRights" className="cw-nav-link">
            <Book size={18} /> เปิด Obsidian Vault
          </a>

          <div className="cw-nav-title" style={{ marginTop: '16px' }}>ล่าสุด</div>
          {recentSearches.length > 0 ? recentSearches.map((search, i) => (
            <div 
              key={i} 
              className="cw-history-item" 
              style={{ cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              onClick={() => setQuery(search)}
              title={search}
            >
              {search}
            </div>
          )) : (
            <div className="cw-history-item" style={{ color: '#6b7280', fontSize: '0.85rem', cursor: 'default' }}>ยังไม่มีประวัติการค้นหา</div>
          )}
        </div>
        
        <div className="cw-footer">
          &copy; 2026 Human Rights RAG
        </div>
      </div>

      {/* Main Chat */}
      <div className="cw-main">
        <div className="cw-chat-scroll">
          {chatHistory.length === 0 ? (
            <div className="cw-empty-state">
              <div className="cw-empty-title">
                <Scale size={40} /> HumanRights RAG
              </div>
              <p className="cw-empty-desc">ผู้ช่วยวิเคราะห์ข้อมูลสิทธิมนุษยชน — ถามคำถามเกี่ยวกับสิทธิ กฎหมาย หรือข้อร้องเรียนที่เกี่ยวข้อง</p>
              
              <div className="cw-suggestions">
                {["สิทธิการชุมนุมสาธารณะคืออะไร?", "การเยียวยาความเสียหายทางสิ่งแวดล้อม", "สิทธิในที่ดินทำกินของกลุ่มชาติพันธุ์", "การเข้าถึงทนายความในชั้นสอบสวน"].map(q => (
                  <button key={q} onClick={() => setQuery(q)} className="cw-suggestion-btn">
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="cw-messages">
              {chatHistory.map((chat, idx) => (
                <div key={idx} className={`cw-message-row ${chat.role}`}>
                  {chat.role === "ai" && (
                    <div className="cw-avatar">
                      <Scale size={18} />
                    </div>
                  )}
                  <div className="cw-bubble">
                    {chat.text}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="cw-message-row ai">
                  <div className="cw-avatar">
                    <Scale size={18} />
                  </div>
                  <div className="cw-bubble" style={{ opacity: 0.6 }}>กำลังค้นหาและวิเคราะห์...</div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          )}
        </div>
        
        {/* Input Area */}
        <div className="cw-input-area">
          <div className="cw-input-container">
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: '#9ca3af', cursor: 'pointer' }}>
                <input type="checkbox" checked={useAI} onChange={e => setUseAI(e.target.checked)} style={{ cursor: 'pointer' }} />
                <span>เปิดใช้งาน AI ช่วยสรุปคำตอบ</span>
              </label>
            </div>
            <form onSubmit={handleSubmit} className="cw-input-form">
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="ถามเกี่ยวกับสิทธิมนุษยชน กฎหมาย หรือข้อร้องเรียน..."
                className="cw-input"
              />
              <button 
                type="submit" 
                disabled={!query.trim() || loading}
                className="cw-send-btn"
              >
                <Send size={18} />
              </button>
            </form>
            <div className="cw-disclaimer">
              ข้อมูลที่ได้ไม่ใช่คำปรึกษาทางกฎหมาย โปรดพิจารณาและตรวจสอบกับเอกสารฉบับจริงเสมอ
            </div>
          </div>
        </div>
      </div>

      {/* References */}
      <div className={`cw-references ${activeCitations.length === 0 ? 'hidden' : ''}`}>
        <div className="cw-ref-header">
          รายละเอียดการอ้างอิง
        </div>
        <div className="cw-ref-content">
          <div className="cw-ref-label">เอกสารที่เกี่ยวข้อง</div>
          {activeCitations.map((cit, idx) => (
            <div 
              key={idx} 
              className="cw-ref-card"
            >
              <div className="cw-ref-card-header">
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span className="cw-ref-badge">{idx + 1}</span>
                  <Scale size={14} style={{ color: '#fb923c', marginRight: '6px' }} />
                  <span className="cw-ref-title">{cit.title}</span>
                </div>
                <button className="cw-ref-open-link" onClick={() => router.push(`/document/${cit.documentId}`)}>
                  <ExternalLink size={12} /> ดูรายละเอียด
                </button>
              </div>

              <div className="cw-ref-summary-box">
                <div className="cw-ref-summary-title">
                  ✨ สรุปโดย RAG
                </div>
                <div className="cw-ref-summary-text">
                  {cit.excerpt.substring(0, Math.floor(cit.excerpt.length * 0.4))}
                </div>
              </div>

              <div className="cw-ref-excerpt">
                {cit.excerpt.substring(Math.floor(cit.excerpt.length * 0.4))}
              </div>
              
              {cit.page && <div className="cw-ref-meta">หน้า {cit.page}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
