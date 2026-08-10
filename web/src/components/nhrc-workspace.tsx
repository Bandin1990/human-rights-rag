"use client";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, ExternalLink, FileText, Menu, Plus, Scale, Send, X } from "lucide-react";
import { NhrcCaseCard } from "@/components/nhrc-case-card";
import { MarkdownLite } from "@/components/markdown-lite";
import { DOCUMENT_CATEGORIES, Facet, NhrcDocument } from "@/lib/nhrc/types";

// Per-category label for the sub_type facet group - purely cosmetic (falls
// back to a generic label below for any category not listed here, so a new
// category with sub_type data still gets a working, if generic, filter
// without a code change). Whether the group renders at all is decided by
// whether the API actually returned any facets.subType values, not by this
// map - see the "ประเภทเอกสาร" facet UI markup further down.
const SUB_TYPE_FACET_LABELS: Record<string, string> = {
  "รายงานตรวจสอบ/ข้อเสนอแนะ กสม.": "ประเภทเอกสาร",
  "กฎหมายไทย": "ประเภทกฎหมาย",
  "กฎหมายสิทธิมนุษยชนระหว่างประเทศและเอกสารตีความ": "ประเภทตราสาร",
};
function subTypeFacetLabel(category: string): string {
  return SUB_TYPE_FACET_LABELS[category] || "ประเภทย่อย";
}

// "E" (เพิ่มเติมจากแท็กซอนอมีเดิม) intentionally left out - no longer a real
// category in the Obsidian vault. One legacy topic note is still tagged with
// area_code "E" server-side (obsidian_parser.py's AREA_MAPPING) so it isn't
// broken by this, it's just not offered as a filter choice here anymore.
const AREAS = [
  { code: "A", name: "สิทธิพลเมืองและสิทธิทางการเมือง" },
  { code: "B", name: "สิทธิทางเศรษฐกิจ สังคม และวัฒนธรรม" },
  { code: "C", name: "สิทธิของกลุ่มบุคคล" },
  { code: "D", name: "สถานการณ์เชิงพื้นที่-เฉพาะ" },
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
  // Sub-filters within a selected document category (e.g. "ประเภทกฎหมาย" for
  // กฎหมายไทย, "ผลการตรวจสอบ" for case notes) - see the facet chip UI further
  // down and repository.ts's search(). Empty string = no filter on that
  // dimension. facets holds whatever distinct values + counts the current
  // category/area/year selection actually has, from the API response -
  // there's no fixed/hardcoded list, so a category with no sub-typing (e.g.
  // งานวิจัย) just renders no chips at all.
  const [subTypeFilter, setSubTypeFilter] = useState("");
  const [resultFilter, setResultFilter] = useState("");
  const [facets, setFacets] = useState<{ subType: Facet[]; result: Facet[] }>({ subType: [], result: [] });

  const [mode, setMode] = useState<"welcome" | "browse" | "chat">("welcome");
  const [useAI, setUseAI] = useState(true);
  const [question, setQuestion] = useState("");
  const [chatHistory, setChatHistory] = useState<ChatTurn[]>([]);
  const [activeCitations, setActiveCitations] = useState<AskCitation[]>([]);
  const [asking, setAsking] = useState(false);
  // Live progress while `asking` is true - set from the "status" events on
  // the streamed response (see runAsk / api/ask-nhrc/route.ts) so this
  // reflects what the server is actually doing right now, not a canned
  // timed animation. streamingText accumulates "delta" events so the answer
  // renders as it's generated instead of appearing all at once at the end.
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [streamingText, setStreamingText] = useState("");
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

  // Desktop-only collapse toggles (see the .cw-sidebar-toggle/.cw-ref-toggle
  // buttons + their matching "collapsed" rail buttons further down) - a
  // separate concern from sidebarOpen/referencesOpen above, which are the
  // mobile drawer open/close state. On desktop both panels normally stay
  // permanently visible; this lets the user reclaim the width for the chat
  // itself when they don't need the filters/references right now. Hidden
  // under 900px via CSS - mobile already has its own open/close mechanism.
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [referencesCollapsed, setReferencesCollapsed] = useState(false);

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
    if (subTypeFilter) params.set("subType", subTypeFilter);
    if (resultFilter) params.set("result", resultFilter);
    params.set("limit", "30");

    fetch(`/api/search/hybrid?${params}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((d) => {
        setResults(d.data);
        setTotal(d.pagination.total);
        setFacets(d.facets || { subType: [], result: [] });
      })
      .catch((e) => {
        if (e.name !== "AbortError") setResults([]);
      })
      .finally(() => setLoadingList(false));

    return () => controller.abort();
  }, [area, category, year, mode, subTypeFilter, resultFilter]);

  const runAsk = async (q: string) => {
    setQuestion("");
    setMode("chat");
    setChatHistory((prev) => [...prev, { role: "user", text: q }]);
    setRecentQuestions((prev) => [q, ...prev.filter((s) => s !== q)].slice(0, 5));
    setAsking(true);
    setStatusMessage("กำลังเริ่มค้นหา...");
    setStreamingText("");

    let answerText = "";
    try {
      const res = await fetch("/api/ask-nhrc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, useAI, areaCode: area || undefined, category: category || undefined }),
      });
      if (!res.body) throw new Error("Response has no body to stream");

      // The route emits newline-delimited JSON events (not SSE) - read the
      // raw bytes and split on "\n" ourselves, buffering any partial line
      // that landed at a chunk boundary until the rest of it arrives.
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let newlineIndex;
        while ((newlineIndex = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);
          if (!line.trim()) continue;
          let event: { type: string; message?: string; text?: string; citations?: AskCitation[] };
          try {
            event = JSON.parse(line);
          } catch {
            continue;
          }
          if (event.type === "status" && event.message) {
            setStatusMessage(event.message);
          } else if (event.type === "citations") {
            setActiveCitations(event.citations || []);
          } else if (event.type === "delta" && event.text) {
            answerText += event.text;
            setStreamingText(answerText);
          } else if (event.type === "error" && event.message) {
            answerText = event.message;
            setStreamingText(answerText);
          }
        }
      }

      setChatHistory((prev) => [...prev, { role: "ai", text: answerText || "ไม่สามารถตอบคำถามนี้ได้" }]);
    } catch {
      setChatHistory((prev) => [
        ...prev,
        { role: "ai", text: answerText || "ขออภัย ไม่สามารถประมวลผลคำถามได้ในขณะนี้" },
      ]);
    } finally {
      setAsking(false);
      setStatusMessage(null);
      setStreamingText("");
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
    setSubTypeFilter("");
    setResultFilter("");
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
    // Sub-filters belong to whichever category was previously selected (a
    // "ผลการตรวจสอบ" value or a "ประเภทกฎหมาย" value has no meaning outside
    // its own category) - clear both whenever the category itself changes.
    setSubTypeFilter("");
    setResultFilter("");
    setSidebarOpen(false);
  };

  return (
    <div className="cw-container">
      {/* Sidebar - fixed 280px column on desktop, off-canvas drawer under
          900px (see chat-workspace.css's .cw-sidebar media query). Desktop
          also gets a collapse toggle (.cw-sidebar-toggle here + the
          .cw-panel-expand rail button below) so the menu can be tucked away
          for more chat width - see sidebarCollapsed. */}
      <div className={`cw-sidebar ${sidebarOpen ? "is-open" : ""} ${sidebarCollapsed ? "is-collapsed" : ""}`}>
        <button className="cw-drawer-close" aria-label="ปิดเมนู" onClick={() => setSidebarOpen(false)}>
          <X size={18} />
        </button>
        <div className="cw-logo">
          <span>
            <Scale size={24} /> ค้นหาสิทธิ
          </span>
          <button
            className="cw-sidebar-toggle"
            aria-label="ซ่อนเมนู"
            title="ซ่อนเมนู"
            onClick={() => setSidebarCollapsed(true)}
          >
            <ChevronLeft size={16} />
          </button>
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

      {/* Desktop-only "bring the menu back" rail button - shown in place of
          the sidebar once it's collapsed (see .cw-sidebar-toggle above).
          Hidden under 900px via CSS, same as the toggle button itself. */}
      {sidebarCollapsed && (
        <button
          className="cw-panel-expand cw-panel-expand--left"
          aria-label="แสดงเมนู"
          title="แสดงเมนู"
          onClick={() => setSidebarCollapsed(false)}
        >
          <ChevronRight size={16} />
        </button>
      )}

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

              {/* Sub-filters for the currently selected category - entirely
                  data-driven (see repository.ts's search()/countBy): a group
                  only renders when the API actually returned facet values for
                  it, so a category with no sub_type/result data (e.g.
                  งานวิจัย) shows neither, and a brand-new document kind added
                  to the vault later shows up as a new chip automatically. */}
              {(facets.subType.length > 0 || facets.result.length > 0) && (
                <div className="cw-facet-panel">
                  {facets.subType.length > 0 && (
                    <div className="cw-facet-group">
                      <div className="cw-facet-group-title">{subTypeFacetLabel(category)}</div>
                      <div className="cw-facet-chips">
                        <button
                          className={`cw-facet-chip ${!subTypeFilter ? "active" : ""}`}
                          onClick={() => setSubTypeFilter("")}
                        >
                          ทั้งหมด
                          <span>{facets.subType.reduce((sum, f) => sum + f.count, 0)}</span>
                        </button>
                        {facets.subType.map((f) => (
                          <button
                            key={f.value}
                            className={`cw-facet-chip ${subTypeFilter === f.value ? "active" : ""}`}
                            onClick={() => setSubTypeFilter(subTypeFilter === f.value ? "" : f.value)}
                          >
                            {f.value}
                            <span>{f.count}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {facets.result.length > 0 && (
                    <div className="cw-facet-group">
                      <div className="cw-facet-group-title">ผลการตรวจสอบ</div>
                      <div className="cw-facet-chips">
                        <button
                          className={`cw-facet-chip ${!resultFilter ? "active" : ""}`}
                          onClick={() => setResultFilter("")}
                        >
                          ทั้งหมด
                          <span>{facets.result.reduce((sum, f) => sum + f.count, 0)}</span>
                        </button>
                        {facets.result.map((f) => (
                          <button
                            key={f.value}
                            className={`cw-facet-chip ${resultFilter === f.value ? "active" : ""}`}
                            onClick={() => setResultFilter(resultFilter === f.value ? "" : f.value)}
                          >
                            {f.value}
                            <span>{f.count}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

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
                  {streamingText ? (
                    // First tokens have arrived - switch from the status
                    // line to the answer growing in place, with a blinking
                    // caret (.cw-typing-caret, chat-workspace.css) so it
                    // reads as "still being written" rather than finished.
                    <div className="cw-bubble cw-bubble-streaming">
                      <MarkdownLite text={streamingText} onCiteClick={scrollToCitation} />
                      <span className="cw-typing-caret" aria-hidden="true" />
                    </div>
                  ) : (
                    <div className="cw-bubble cw-status-bubble">
                      <span className="cw-status-dots" aria-hidden="true">
                        <span />
                        <span />
                        <span />
                      </span>
                      {statusMessage || "กำลังค้นและวิเคราะห์..."}
                    </div>
                  )}
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
              ข้อมูลที่ได้ไม่ใช่คำวินิจฉัยทางการของหน่วยงาน โปรดตรวจสอบกับเอกสารฉบับจริงเสมอ
            </div>
          </div>
        </div>
      </div>

      {/* References - fixed 420px column on desktop, off-canvas drawer
          under 900px. referencesCollapsed reuses the existing "hidden"
          class (already does a width/transform/opacity transition for the
          no-citations case) so an explicit user collapse looks identical -
          on mobile ".hidden" is a no-op anyway (position is driven by
          "is-open" there instead, see chat-workspace.css's media query). */}
      <div
        className={`cw-references ${activeCitations.length === 0 || referencesCollapsed ? "hidden" : ""} ${
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
        <div className="cw-ref-header">
          เอกสารอ้างอิง
          <button
            className="cw-ref-toggle"
            aria-label="ซ่อนเอกสารอ้างอิง"
            title="ซ่อนเอกสารอ้างอิง"
            onClick={() => setReferencesCollapsed(true)}
          >
            <ChevronRight size={16} />
          </button>
        </div>
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

      {/* Desktop-only "bring references back" rail button - mirrors
          .cw-panel-expand--left above. Only worth showing when there's
          actually something to bring back. */}
      {referencesCollapsed && activeCitations.length > 0 && (
        <button
          className="cw-panel-expand cw-panel-expand--right"
          aria-label="แสดงเอกสารอ้างอิง"
          title="แสดงเอกสารอ้างอิง"
          onClick={() => setReferencesCollapsed(false)}
        >
          <ChevronLeft size={16} />
          <FileText size={14} /> {activeCitations.length}
        </button>
      )}

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
