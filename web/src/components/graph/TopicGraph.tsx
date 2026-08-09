"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import type { GraphData, GraphNode, NhrcDocument } from "@/lib/nhrc/types";
import { computeLayout, nodeRadius, type Point } from "@/lib/nhrc/force-layout";
import { MarkdownLite } from "@/components/markdown-lite";

const WIDTH = 960;
const HEIGHT = 620;
const MIN_ZOOM_W = WIDTH * 0.28; // most zoomed-in
const MAX_ZOOM_W = WIDTH * 2.2; // most zoomed-out

// Muted, earthy palette instead of a saturated rainbow - keeps the 5 areas
// distinguishable but cohesive with the ink/gold institutional theme (see
// .cw-graph-page in chat-workspace.css).
const AREA_COLORS: Record<string, string> = {
  A: "#c9a961", // gold
  B: "#7a9e7e", // sage
  C: "#b8763f", // terracotta
  D: "#6b8caf", // dusty blue
  E: "#a67c9e", // muted plum
};
const HIGHLIGHT = "#e3c583";

function areaColor(areaCode?: string): string {
  return (areaCode && AREA_COLORS[areaCode]) || "#8a8578";
}

interface ViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}
const DEFAULT_VIEWBOX: ViewBox = { x: 0, y: 0, w: WIDTH, h: HEIGHT };
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function TopicGraph() {
  const [graph, setGraph] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [cases, setCases] = useState<NhrcDocument[] | null>(null);
  const [casesLoading, setCasesLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [viewBox, setViewBox] = useState<ViewBox>(DEFAULT_VIEWBOX);
  const [isPanning, setIsPanning] = useState(false);
  const dragRef = useRef<{ id: string } | null>(null);
  const panRef = useRef<{ startClientX: number; startClientY: number; startVbX: number; startVbY: number } | null>(
    null
  );
  const [positions, setPositions] = useState<Map<string, Point>>(new Map());

  useEffect(() => {
    fetch("/api/graph")
      .then((res) => res.json())
      .then((data: GraphData) => {
        if (data.nodes) {
          setGraph(data);
          setPositions(computeLayout(data.nodes, WIDTH, HEIGHT));
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selected) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selected]);

  useEffect(() => {
    if (!selected) {
      setCases(null);
      return;
    }
    setCasesLoading(true);
    const params =
      selected.type === "topic"
        ? `topic=${encodeURIComponent(selected.id)}`
        : `area=${encodeURIComponent(selected.areaCode || "")}`;
    fetch(`/api/search/hybrid?${params}&type=case_note&limit=100`)
      .then((res) => res.json())
      .then((data) => setCases(data.success ? data.data : []))
      .catch(() => setCases([]))
      .finally(() => setCasesLoading(false));
  }, [selected]);

  const maxWeight = useMemo(
    () => Math.max(1, ...(graph?.edges.filter((e) => e.type === "shared_cases").map((e) => e.weight || 1) || [1])),
    [graph]
  );

  const connectedIds = useMemo(() => {
    if (!selected || !graph) return null;
    const ids = new Set<string>([selected.id]);
    for (const e of graph.edges) {
      if (e.source === selected.id) ids.add(e.target);
      if (e.target === selected.id) ids.add(e.source);
    }
    return ids;
  }, [selected, graph]);

  // Edges touching the hovered node get a flowing-dash animation (see
  // .cw-graph-edge-flow) so pointing at a node visibly "runs" its
  // connections, rather than the link just sitting there highlighted.
  const hoveredEdgeKeys = useMemo(() => {
    if (!hoveredId || !graph) return null;
    const keys = new Set<string>();
    graph.edges.forEach((e, i) => {
      if (e.source === hoveredId || e.target === hoveredId) keys.add(String(i));
    });
    return keys;
  }, [hoveredId, graph]);

  // Node label -> node, for rendering readable "เชื่อมโยงกับ" links in the
  // detail modal instead of raw ids.
  const nodesById = useMemo(() => {
    const map = new Map<string, GraphNode>();
    graph?.nodes.forEach((n) => map.set(n.id, n));
    return map;
  }, [graph]);

  const selectedConnections = useMemo(() => {
    if (!selected || !graph) return [];
    return graph.edges
      .filter((e) => e.source === selected.id || e.target === selected.id)
      .map((e) => {
        const otherId = e.source === selected.id ? e.target : e.source;
        return { node: nodesById.get(otherId), edge: e };
      })
      .filter((c): c is { node: GraphNode; edge: typeof graph.edges[number] } => !!c.node);
  }, [selected, graph, nodesById]);

  // Search dims everything that doesn't match, independent of (and combined
  // with) node-selection dimming - lets you find a topic by name in a graph
  // that's grown past what you can scan by eye.
  const searchMatchIds = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q || !graph) return null;
    return new Set(graph.nodes.filter((n) => n.label.toLowerCase().includes(q)).map((n) => n.id));
  }, [search, graph]);

  function isDimmed(id: string): boolean {
    if (searchMatchIds && !searchMatchIds.has(id)) return true;
    if (connectedIds && !connectedIds.has(id)) return true;
    return false;
  }

  function screenToGraph(svg: SVGSVGElement, clientX: number, clientY: number) {
    const rect = svg.getBoundingClientRect();
    return {
      scaleX: viewBox.w / rect.width,
      scaleY: viewBox.h / rect.height,
      x: viewBox.x + (clientX - rect.left) * (viewBox.w / rect.width),
      y: viewBox.y + (clientY - rect.top) * (viewBox.h / rect.height),
    };
  }

  function handleNodePointerDown(id: string, e: React.PointerEvent<SVGGElement>) {
    // preventDefault: without it the browser treats mousedown+move on an SVG
    // shape as native text-selection/ghost-image drag, hijacking the pointer
    // sequence. stopPropagation: keeps this from also starting a canvas pan.
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { id };
    (e.target as Element).setPointerCapture(e.pointerId);
  }

  function handleCanvasPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    panRef.current = { startClientX: e.clientX, startClientY: e.clientY, startVbX: viewBox.x, startVbY: viewBox.y };
    setIsPanning(true);
    (e.target as Element).setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent<SVGSVGElement>) {
    const svg = e.currentTarget;
    if (dragRef.current) {
      e.preventDefault();
      const { x, y } = screenToGraph(svg, e.clientX, e.clientY);
      const id = dragRef.current.id;
      setPositions((prev) => {
        const next = new Map(prev);
        next.set(id, { x: clamp(x, 30, WIDTH - 30), y: clamp(y, 30, HEIGHT - 30) });
        return next;
      });
      return;
    }
    if (panRef.current) {
      e.preventDefault();
      const { scaleX, scaleY } = screenToGraph(svg, e.clientX, e.clientY);
      const dx = (e.clientX - panRef.current.startClientX) * scaleX;
      const dy = (e.clientY - panRef.current.startClientY) * scaleY;
      setViewBox((vb) => ({ ...vb, x: panRef.current!.startVbX - dx, y: panRef.current!.startVbY - dy }));
    }
  }

  function handlePointerUp() {
    dragRef.current = null;
    panRef.current = null;
    setIsPanning(false);
  }

  function zoomBy(factor: number, svg?: SVGSVGElement | null) {
    setViewBox((vb) => {
      const newW = clamp(vb.w * factor, MIN_ZOOM_W, MAX_ZOOM_W);
      const newH = newW * (HEIGHT / WIDTH);
      const cx = vb.x + vb.w / 2;
      const cy = vb.y + vb.h / 2;
      void svg;
      return { x: cx - newW / 2, y: cy - newH / 2, w: newW, h: newH };
    });
  }

  function handleWheel(e: React.WheelEvent<SVGSVGElement>) {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const ratioX = (e.clientX - rect.left) / rect.width;
    const ratioY = (e.clientY - rect.top) / rect.height;
    setViewBox((vb) => {
      const factor = e.deltaY > 0 ? 1.14 : 1 / 1.14;
      const newW = clamp(vb.w * factor, MIN_ZOOM_W, MAX_ZOOM_W);
      const newH = newW * (HEIGHT / WIDTH);
      const graphX = vb.x + ratioX * vb.w;
      const graphY = vb.y + ratioY * vb.h;
      return { x: graphX - ratioX * newW, y: graphY - ratioY * newH, w: newW, h: newH };
    });
  }

  if (loading) {
    return <div className="cw-graph-status">กำลังโหลดแผนที่ประเด็นสิทธิ...</div>;
  }
  if (!graph || graph.nodes.length === 0) {
    return <div className="cw-graph-status">ยังไม่มีข้อมูลกราฟ - รัน setup_obsidian_index.py ก่อน</div>;
  }

  return (
    <div className="cw-graph-page">
      <div className="cw-graph-head">
        <div>
          <h1>แผนที่ประเด็นสิทธิ</h1>
          <p>
            แต่ละจุดคือประเด็นสิทธิหรือกลุ่มประเด็น เส้นทึบเชื่อมประเด็นย่อยเข้ากับกลุ่มประเด็นหลัก เส้นสีทองบาง ๆ
            แสดงว่าสองประเด็นมีกรณีตรวจสอบร่วมกัน (ยิ่งเข้มยิ่งมีกรณีร่วมกันมาก) — คลิกจุดเพื่อดูรายการกรณี
            ลากจุดเพื่อจัดตำแหน่งใหม่ ลากพื้นที่ว่างเพื่อเลื่อนมุมมอง
          </p>
        </div>
      </div>

      <div className="cw-graph-toolbar">
        <label className="cw-graph-search">
          <Search size={15} />
          <input
            type="text"
            placeholder="ค้นหาประเด็นสิทธิ..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {searchMatchIds && <span className="cw-graph-search-count">{searchMatchIds.size} รายการ</span>}
        </label>
        <div className="cw-graph-zoom-controls">
          <button type="button" onClick={() => zoomBy(1 / 1.4)} aria-label="ซูมเข้า">
            <ZoomIn size={16} />
          </button>
          <button type="button" onClick={() => zoomBy(1.4)} aria-label="ซูมออก">
            <ZoomOut size={16} />
          </button>
          <button type="button" onClick={() => setViewBox(DEFAULT_VIEWBOX)} aria-label="รีเซ็ตมุมมอง">
            <Maximize2 size={16} />
          </button>
        </div>
      </div>

      <div className="cw-graph-body">
        <div className={`cw-graph-canvas ${isPanning ? "is-panning" : ""}`}>
          <svg
            viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
            width="100%"
            height="620"
            onPointerDown={handleCanvasPointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            onWheel={handleWheel}
          >
            <defs>
              <radialGradient id="seal-area-fill" cx="35%" cy="30%" r="75%">
                <stop offset="0%" stopColor="#2a3348" />
                <stop offset="100%" stopColor="#1a1f2e" />
              </radialGradient>
            </defs>

            {graph.edges.map((e, i) => {
              const a = positions.get(e.source);
              const b = positions.get(e.target);
              if (!a || !b) return null;
              const flowing = hoveredEdgeKeys?.has(String(i)) ?? false;
              const touchesSelected = !!selected && (e.source === selected.id || e.target === selected.id);
              // Edges are hidden at rest - drawing every one of them at once
              // turns a graph this size into an unreadable web. They only
              // appear for a node you're actively pointing at (hover, with
              // the flowing-dash animation) or have opened the detail modal
              // for (selected, static highlight so the modal has visible
              // on-canvas context behind it).
              if (!flowing && !touchesSelected) return null;
              const weight = e.weight || 1;
              if (e.type === "hierarchy") {
                return (
                  <line
                    key={i}
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke={HIGHLIGHT}
                    strokeWidth={flowing ? 2 : 1.5}
                    opacity={flowing ? 0.9 : 0.55}
                    className={flowing ? "cw-graph-edge-flow" : undefined}
                  />
                );
              }
              return (
                <line
                  key={i}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke={HIGHLIGHT}
                  strokeWidth={flowing ? 2.5 : 1 + (weight / maxWeight) * 2}
                  opacity={flowing ? 0.95 : 0.5}
                  className={flowing ? "cw-graph-edge-flow" : undefined}
                />
              );
            })}

            {graph.nodes.map((n) => {
              const p = positions.get(n.id);
              if (!p) return null;
              const isArea = n.type === "area";
              const r = nodeRadius(n);
              const dimmed = isDimmed(n.id);
              const isSelected = selected?.id === n.id;
              const isHovered = hoveredId === n.id;
              const color = isArea ? "#12141c" : areaColor(n.areaCode);
              const ring = areaColor(n.areaCode);
              // Ring thickness (not just radius) carries case-count weight -
              // reads like a wax-seal impression pressed harder for busier
              // topics, rather than a generic bubble-chart size encoding.
              const ringWidth = isArea ? 2.5 : clamp(1 + Math.sqrt(n.count) * 0.55, 1.5, 6);
              const labelWidth = isArea ? 96 : 78;

              return (
                <g
                  key={n.id}
                  opacity={dimmed ? 0.28 : 1}
                  style={{ cursor: "pointer" }}
                  onPointerDown={(e) => handleNodePointerDown(n.id, e)}
                  onClick={() => setSelected(n)}
                  onPointerEnter={() => setHoveredId(n.id)}
                  onPointerLeave={() => setHoveredId((cur) => (cur === n.id ? null : cur))}
                  role="button"
                  tabIndex={0}
                  aria-label={`${n.label}: ${n.count} กรณีตรวจสอบ`}
                  onFocus={() => setHoveredId(n.id)}
                  onBlur={() => setHoveredId((cur) => (cur === n.id ? null : cur))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelected(n);
                    }
                  }}
                >
                  {isArea && <circle cx={p.x} cy={p.y} r={r + 5} fill="none" stroke={ring} strokeWidth={1} opacity={0.35} />}
                  {/* Sonar-ping pulse, hover-only (see plan discussion: constant
                      idle motion on ~50 nodes at once read as noisy for a
                      formal government tool, so the node itself only "moves"
                      while you're actively pointing at it - the edges get
                      their own always-available flow animation separately). */}
                  {isHovered && (
                    <>
                      <circle cx={p.x} cy={p.y} r={r} fill="none" stroke={HIGHLIGHT} strokeWidth={2} className="cw-graph-node-pulse" />
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r={r}
                        fill="none"
                        stroke={HIGHLIGHT}
                        strokeWidth={2}
                        className="cw-graph-node-pulse cw-graph-node-pulse--delay"
                      />
                    </>
                  )}
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={isHovered ? r + 2 : r}
                    fill={isArea ? "url(#seal-area-fill)" : "#1a1f2e"}
                    stroke={isSelected ? HIGHLIGHT : ring}
                    strokeWidth={isSelected ? ringWidth + 1.5 : ringWidth}
                    className="cw-graph-node-circle"
                  />
                  <text
                    x={p.x}
                    y={p.y + 4}
                    textAnchor="middle"
                    fontSize={isArea ? 12 : 10.5}
                    fontWeight={700}
                    fill={ring}
                  >
                    {n.count}
                  </text>
                  <foreignObject x={p.x - labelWidth / 2} y={p.y + r + 6} width={labelWidth} height={30}>
                    <div className={`cw-graph-node-label ${isArea ? "is-area" : ""}`}>{n.label}</div>
                  </foreignObject>
                </g>
              );
            })}
          </svg>
        </div>

      </div>

      {selected && (
        <div className="cw-graph-modal-backdrop" onClick={() => setSelected(null)}>
          <div
            className="cw-graph-modal"
            role="dialog"
            aria-modal="true"
            aria-label={selected.label}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="cw-graph-panel-head">
              <div>
                <span className="cw-case-tag is-muted">{selected.type === "area" ? "กลุ่มประเด็น" : "ประเด็นสิทธิ"}</span>
                <h3>{selected.label}</h3>
                <p>{selected.count} กรณีตรวจสอบ</p>
              </div>
              <button onClick={() => setSelected(null)} aria-label="ปิด">
                <X size={18} />
              </button>
            </div>

            <div className="cw-graph-modal-body">
              {selected.summary && (
                <div className="cw-graph-modal-section cw-graph-modal-summary">
                  <h4>สถานการณ์และแนวโน้มรายปี</h4>
                  <MarkdownLite text={selected.summary} />
                </div>
              )}

              {!!selected.keywords?.length && (
                <div className="cw-graph-modal-section">
                  <div className="cw-graph-tag-row">
                    {selected.keywords.map((k) => (
                      <span key={k} className="cw-graph-tag">
                        {k}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {selectedConnections.length > 0 && (
                <div className="cw-graph-modal-section">
                  <h4>เชื่อมโยงกับ</h4>
                  <div className="cw-graph-related-list">
                    {selectedConnections.map(({ node, edge }) => (
                      <button
                        key={node.id}
                        type="button"
                        className="cw-graph-related-item"
                        onClick={() => setSelected(node)}
                      >
                        <span>{node.type === "area" ? "กลุ่มประเด็น" : "ประเด็นสิทธิ"}</span>
                        {node.label}
                        {edge.type === "shared_cases" && <em> · มีกรณีร่วมกัน {edge.weight} กรณี</em>}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {selected.type === "topic" && (
                <Link href={`/case/${encodeURIComponent(selected.id)}`} className="cw-graph-modal-fulldoc">
                  ดูรายละเอียดฉบับเต็ม →
                </Link>
              )}

              <div className="cw-graph-modal-section">
                <h4>กรณีตรวจสอบที่เกี่ยวข้อง</h4>
                <div className="cw-graph-panel-list">
                  {casesLoading && <p className="cw-graph-status">กำลังโหลด...</p>}
                  {!casesLoading && cases?.length === 0 && <p className="cw-graph-status">ไม่พบกรณี</p>}
                  {!casesLoading &&
                    cases?.slice(0, 40).map((c) => (
                      <Link href={`/case/${c.case_id}`} key={c.document_id} className="cw-detail-related-item">
                        <span>{c.case_id}</span>
                        {c.title}
                      </Link>
                    ))}
                  {!casesLoading && cases && cases.length > 40 && (
                    <p className="cw-graph-status">และอีก {cases.length - 40} กรณี</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
