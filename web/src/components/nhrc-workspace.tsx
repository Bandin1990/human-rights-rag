"use client";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, FileText, Menu, Plus, Scale, Send, X } from "lucide-react";
import { NhrcCaseCard } from "@/components/nhrc-case-card";
import { MarkdownLite } from "@/components/markdown-lite";
import { DOCUMENT_CATEGORIES, NhrcDocument } from "@/lib/nhrc/types";

const AREAS = [
  { code: "A", name: "สิทธิพลเมืองและสิทธิทางการเมือง" },
  { code: "B", name: "สิทธิทางเศรษฐกิจ สังคม และวัฒนธรรม" },
  { code: "C", name: "สิทธิของกลุ่มบุคคล" },
  { code: "D", name: "สถานการณ์เชิงพื้นที่-เฉพาะ" },
  { code: "E", name: "เพิ่มเติมจากแท็กซอนอมีเดิม" },
];

const YEARS = Array.from({ length: 7 }, (_, i) => 2563 + i).reverse();

// A larger, deliberately cross-category pool (land/environment, health,
// justice, children, gender, disability, labor, statelessness, business,
// international/Thai law) rather than 4 fixed case-note-flavored examples -
// SUGGESTION_COUNT of these are picked at random per visit (see
// useEffect below) so repeat visitors see different examples over time,
// not always the exact same 4.
const SUGGESTION_POOL = [
  "สิทธิชุมชนกรณีเหมืองแร่มีกี่กรณี",
  "กรณี HIV ที่เกี่ยวกับการเลือกปฏิบัติมีอะไรบ้าง",
  "สิทธิผู้ต้องขังที่ถูกละเมิดมีกรณีอะไรบ้าง",
  "กรณีเกี่ยวกับผลกระทบสิ่งแวดล้อมและ EIA",
  "สิทธิเด็กที่ถูกล่วงละเมิดมีกรณีอะไรบ้าง",
  "การเลือกปฏิบัติทางเพศในที่ทำงานมีกรณีอะไรบ้าง",
  "สิทธิคนพิการในการเข้าถึงบริการสาธารณะมีกรณีอะไรบ้าง",
  "กรณีการทรมานหรือการบังคับสูญหายมีอะไรบ้าง",
  "สิทธิแรงงานข้ามชาติที่ถูกละเมิดมีกรณีอะไรบ้าง",
  "เสรีภาพในการชุมนุมและการแสดงออกมีกรณีอะไรบ้าง",
  "กรณีคนไร้รัฐไร้สัญชาติมีอะไรบ้าง",
  "ธุรกิจกับสิทธิมนุษยชน (BHR) มีกรณีอะไรบ้าง",
  "สถานการณ์สิทธิมนุษยชนชายแดนใต้เป็นอย่างไร",
  "กติการะหว่างประเทศ ICCPR เกี่ยวข้องกับกรณีใดบ้าง",
  "กฎหมายไทยที่เกี่ยวกับการป้องกันการทรมานมีอะไรบ้าง",
  "สิทธิผู้สูงอายุที่เกี่ยวข้องมีกรณีอะไรบ้าง",
];
const SUGGESTION_COUNT = 4;

function pickRandomSuggestions(): string[] {
  const shuffled = [...SUGGESTION_POOL].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, SUGGESTION_COUNT);
}

interface SearchResult {
  data: NhrcDocument[];
  pagination: { total: number; limit: number; offset: number; hasMore: boolean };
}

interface AskCitation {
  case_id: string;
  title: string;
  area_code?: string;
  area_name?: string;
  year_buddhist?: number;
  excerpt: string;
}

interface ChatTurn {
  role: "user" | "ai";
  text: string;
}

export function NhrcWorkspace({
  initial,
  byCategory,
}: {
  initial: SearchResult;
  byCategory: Record<string, number>;
}) {
  const router = useRouter();

  // Filters shared by browse mode (instant list) and chat mode (search scope)
  const [area, setArea] = useState("");
  const [category, setCategory] = useState("");
  const [year, setYear] = useState(0);
  const [results, setResults] = useState<NhrcDocument[]>(initial.data);
  const [total, setTotal] = useState(initial.pagination.total);
  const [loadingList, setLoadingList] = useState(false);

  const [mode, setMode] = useState<"welcome" | "browse" | "chat">("welcome");
  const [useAI, setUseAI] = useState(true);
  const [question, setQuestion] = useState("");
  const [chatHistory, setChatHistory] = useState<ChatTurn[]>([]);
  const [activeCitations, setActiveCitations] = useState<AskCitation[]>([]);
  const [asking, setAsking] = useState(false);
  const [recentQuestions, setRecentQuestions] = useState<string[]>([]);
  const [highlightedCite, setHighlightedCite] = useState<number | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Starts as a fixed, deterministic slice (so server/client markup match
  // on first paint - Math.random() during render would cause a hydration
  // mismatch) then reshuffles to an actually random 4 once mounted.
  const [suggestions, setSuggestions] = useState<string[]>(SUGGESTION_POOL.slice(0, SUGGESTION_COUNT));
  useEffect(() => {
    setSuggestions(pickRandomSuggestions());
  }, []);

  // Sidebar (280px) and references panel (420px) are both fixed-width flex
  // columns designed for desktop - on a real phone (~375px wide) they don't
  // fit alongside any usable chat area at all. Below 900px (see
  // chat-workspace.css) both become off-canvas drawers instead, opened via
  // the mobile-only topbar/citation clicks and dismissed via their own
  // close button or the shared backdrop. Desktop ignores this state
  // entirely (CSS keeps both panels always visible there).
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [referencesOpen, setReferencesOpen] = useState(false);

  // Clicking a "[n]" citation marker inside an AI answer (see markdown-lite.tsx)
  // scrolls the matching source card into view in the references panel and
  // briefly highlights it, so the reader can jump straight from a claim to
  // the document that backs it instead of hunting through the list. On
  // mobile the panel is a closed drawer by default, so also open it -
  // otherwise the scroll/highlight would happen off-screen, invisibly.
  const scrollToCitation = (n: number) => {
    setReferencesOpen(true);
    const el = document.getElementById(`cw-ref-${n}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightedCite(n);
    setTimeout(() => setHighlightedCite((cur) => (cur === n ? null : cur)), 2000);
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory]);

  useEffect(() => {
    if (mode !== "browse") return;
    const controller = new AbortController();
    setLoadingList(true);
    const params = new URLSearchParams();
    // A specific document category (e.g. "งานวิจัย") may not be case_note docs -
    // only default to case_note browsing when no category is explicitly picked.
    if (category) {
      params.set("category", category);
    } else {
      params.set("type", "case_note");
    }
    if (area) params.set("area", area);
    if (year) params.set("year", String(year));
    params.set("limit", "30");

    fetch(`/api/search/hybrid?${params}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((d) => {
        setResults(d.data);
        setTotal(d.pagination.total);
      })
      .catch((e) => {
        if (e.name !== "AbortError") setResults([]);
      })
      .finally(() => setLoadingList(false));

    return () => controller.abort();
  }, [area, category, year, mode]);

  const runAsk = async (q: string) => {
    setQuestion("");
    setMode("chat");
    setChatHistory((prev) => [...prev, { role: "user", text: q }]);
    setRecentQuestions((prev) => [q, ...prev.filter((s) => s !== q)].slice(0, 5));
    setAsking(true);

    try {
      const res = await fetch("/api/ask-nhrc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, useAI, areaCode: area || undefined, category: category || undefined }),
      });
      const data = await res.json();
      setChatHistory((prev) => [...prev, { role: "ai", text: data.answer || data.error || "ไม่สามารถตอบคำถามนี้ได้" }]);
      setActiveCitations(data.citations || []);
    } catch {
      setChatHistory((prev) => [...prev, { role: "ai", text: "ขออภัย ไม่สามารถประมวลผลคำถามได้ในขณะนี้" }]);
    } finally {
      setAsking(false);
    }
  };

  const handleAsk = (e: FormEvent) => {
    e.preventDefault();
    const q = question.trim();
    if (!q || asking) return;
    runAsk(q);
  };

  const resetAll = () => {
    setMode("welcome");
    setArea("");
    setCategory("");
    setYear(0);
    setChatHistory([]);
    setActiveCitations([]);
    setSidebarOpen(false);
  };

  const selectArea = (code: string) => {
    setMode("browse");
    setArea(code);
    setSidebarOpen(false);
  };
  const selectCategory = (label: string) => {
    setMode("browse");
    setCategory(label);
    setSidebarOpen(false);
  };

  return (
    <div className="cw-container">
      {/* Sidebar - fixed 280px column on desktop, off-canvas drawer under
          900px (see chat-workspace.css's .cw-sidebar media query) */}
      <div className={`cw-sidebar ${sidebarOpen ? "is-open" : ""}`}>
        <button className="cw-drawer-close" aria-label="ปิดเมนู" onClick={() => setSidebarOpen(false)}>
          <X size={18} />
        </button>
        <div className="cw-logo">
          <Scale size={24} /> ค้นหาสิทธิ
        </div>

        <div className="cw-new-chat">
          <button className="cw-new-chat-btn" onClick={resetAll}>
            <Plus size={18} /> เริ่มใหม่
          </button>
        </div>

        <div className="cw-nav">
          <div className="cw-nav-title">ประเภทเอกสาร</div>
          <button className={`cw-nav-link ${mode === "browse" && !category ? "active" : ""}`} onClick={() => selectCategory("")}>
            ทั้งหมด
          </button>
          {DOCUMENT_CATEGORIES.map((c) => {
            const count = byCategory[c] || 0;
            return (
              <button
                key={c}
                className={`cw-nav-link ${mode === "browse" && category === c ? "active" : ""} ${count === 0 ? "is-empty" : ""}`}
                onClick={() => selectCategory(c)}
              >
                {c}
                <span className="cw-nav-count">{count}</span>
              </button>
            );
          })}

          <div className="cw-nav-title" style={{ marginTop: 16 }}>
            ประเด็นสิทธิ
          </div>
          <button className={`cw-nav-link ${mode === "browse" && !area ? "active" : ""}`} onClick={() => selectArea("")}>
            ทั้งหมด
          </button>
          {AREAS.map((a) => (
            <button
              key={a.code}
              className={`cw-nav-link ${mode === "browse" && area === a.code ? "active" : ""}`}
              onClick={() => selectArea(a.code)}
            >
              [{a.code}] {a.name}
            </button>
          ))}

          <div className="cw-nav-title" style={{ marginTop: 16 }}>
            ปี พ.ศ.
          </div>
          <div className="cw-select-wrap">
            <select
              className="cw-select"
              value={year}
              onChange={(e) => {
                setMode("browse");
                setYear(Number(e.target.value));
              }}
            >
              <option value={0}>ทุกปี</option>
              {YEARS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          <div className="cw-nav-title" style={{ marginTop: 16 }}>
            คำถามล่าสุด
          </div>
          {recentQuestions.length > 0 ? (
            recentQuestions.map((q, i) => (
              <div
                key={i}
                className="cw-history-item"
                onClick={() => {
                  setQuestion(q);
                  setSidebarOpen(false);
                }}
                title={q}
              >
                {q}
              </div>
            ))
          ) : (
            <div className="cw-history-item" style={{ color: "#6b7280", cursor: "default" }}>
              ยังไม่มีประวัติการถาม
            </div>
          )}
        </div>

        <div className="cw-footer">© 2026 ค้นหาสิทธิ</div>
      </div>

      {/* Main */}
      <div className="cw-main">
        {/* Mobile-only toolbar (hidden on desktop via CSS) - the sidebar and
            references panel are always-visible columns there, so this
            open/close chrome would be redundant. */}
        <div className="cw-mobile-topbar">
          <button className="cw-mobile-icon-btn" aria-label="เปิดเมนู" onClick={() => setSidebarOpen(true)}>
            <Menu size={20} />
          </button>
          <span className="cw-mobile-topbar-title">ค้นหาสิทธิ</span>
          {activeCitations.length > 0 && (
            <button
              className="cw-mobile-icon-btn cw-mobile-ref-btn"
              aria-label="ดูเอกสารอ้างอิง"
              onClick={() => setReferencesOpen(true)}
            >
              <FileText size={16} /> {activeCitations.length}
            </button>
          )}
        </div>
        <div className="cw-chat-scroll">
          {mode === "welcome" && (
            <div className="cw-empty-state">
              <div className="cw-empty-title">
                <Scale size={40} /> ค้นหาสิทธิ
              </div>
              <p className="cw-empty-desc">
                ผู้ช่วยค้นฐานความรู้กรณีตรวจสอบและประเด็นสิทธิของ กสม. — ค้นด้วยตัวกรอง หรือถามคำถามเป็นภาษาธรรมชาติ
              </p>
              <div className="cw-suggestions">
                {suggestions.map((q) => (
                  <button key={q} className="cw-suggestion-btn" onClick={() => runAsk(q)}>
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {mode === "browse" && (
            <div className="cw-case-list">
              <div className="cw-case-list-head">
                <b>{loadingList ? "กำลังค้นหา..." : `พบ ${total} กรณี`}</b>
                <span>
                  {category || "ทุกประเภทเอกสาร"}
                  {area ? ` · ประเด็น ${area}` : ""}
                  {year ? ` · พ.ศ. ${year}` : ""}
                </span>
              </div>
              {results.map((doc) => (
                <NhrcCaseCard key={doc.document_id} doc={doc} />
              ))}
              {!loadingList && results.length === 0 && (
                <div className="cw-empty-results">ไม่พบกรณีที่ตรงกับตัวกรองนี้ (อาจยังไม่มีข้อมูลในหมวดนี้)</div>
              )}
            </div>
          )}

          {mode === "chat" && (
            <div className="cw-messages">
              {chatHistory.map((chat, idx) => (
                <div key={idx} className={`cw-message-row ${chat.role}`}>
                  {chat.role === "ai" && (
                    <div className="cw-avatar">
                      <Scale size={18} />
                    </div>
                  )}
                  <div className="cw-bubble">
                    {chat.role === "ai" ? (
                      <MarkdownLite text={chat.text} onCiteClick={scrollToCitation} />
                    ) : (
                      chat.text
                    )}
                  </div>
                </div>
              ))}
              {asking && (
                <div className="cw-message-row ai">
                  <div className="cw-avatar">
                    <Scale size={18} />
                  </div>
                  <div className="cw-bubble" style={{ opacity: 0.6 }}>
                    กำลังค้นและวิเคราะห์...
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          )}
        </div>

        <div className="cw-input-area">
          <div className="cw-input-container">
            <label className="cw-ai-toggle">
              <input type="checkbox" checked={useAI} onChange={(e) => setUseAI(e.target.checked)} />
              <span>เปิดใช้งาน AI ช่วยสรุปคำตอบ</span>
            </label>
            <form onSubmit={handleAsk} className="cw-input-form">
              <input
                className="cw-input"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="ค้นหากรณี ประเด็นสิทธิ หรือถามคำถาม เช่น สิทธิชุมชนกรณีเหมืองแร่..."
              />
              <button type="submit" className="cw-send-btn" disabled={!question.trim() || asking}>
                <Send size={18} />
              </button>
            </form>
            <div className="cw-disclaimer">
              ข้อมูลที่ได้ไม่ใช่คำวินิจฉัยของ กสม. โปรดตรวจสอบกับเอกสารฉบับจริงเสมอ
            </div>
          </div>
        </div>
      </div>

      {/* References - fixed 420px column on desktop, off-canvas drawer
          under 900px */}
      <div
        className={`cw-references ${activeCitations.length === 0 ? "hidden" : ""} ${
          referencesOpen ? "is-open" : ""
        }`}
      >
        <button className="cw-drawer-close" aria-label="ปิด" onClick={() => setReferencesOpen(false)}>
          <X size={18} />
        </button>
        {/* "เอกสารอ้างอิง" not "กรณีที่เกี่ยวข้อง" - since the diversified
            retrieval + law/instrument backfill in api/ask-nhrc/route.ts,
            these citations regularly include research, Thai law,
            international instruments, and general comments alongside case
            notes, not just cases. */}
        <div className="cw-ref-header">เอกสารอ้างอิง</div>
        <div className="cw-ref-content">
          {activeCitations.map((c, idx) => {
            return (
              <div
                key={c.case_id}
                id={`cw-ref-${idx + 1}`}
                className={`cw-ref-card ${highlightedCite === idx + 1 ? "cw-ref-card--highlight" : ""}`}
              >
                <div className="cw-ref-card-header">
                  <div style={{ display: "flex", alignItems: "center" }}>
                    <span className="cw-ref-badge">{idx + 1}</span>
                    <span className="cw-ref-title">
                      [{c.case_id}] {c.title}
                    </span>
                  </div>
                  <button
                    className="cw-ref-open-link"
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/case/${c.case_id}`);
                    }}
                  >
                    <ExternalLink size={12} /> ดูรายละเอียด
                  </button>
                </div>
                <div className="cw-ref-excerpt">{c.excerpt}</div>
                <div className="cw-ref-meta">
                  {c.area_name || "ไม่ระบุประเด็น"} · พ.ศ. {c.year_buddhist || "-"}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Shared backdrop for whichever drawer is open (mobile only - see
          chat-workspace.css, hidden entirely on desktop where both panels
          are always-visible columns instead of drawers). */}
      {(sidebarOpen || referencesOpen) && (
        <div
          className="cw-drawer-backdrop"
          onClick={() => {
            setSidebarOpen(false);
            setReferencesOpen(false);
          }}
        />
      )}
    </div>
  );
}
