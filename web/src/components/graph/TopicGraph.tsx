"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import type { GraphData, GraphNode, NhrcDocument } from "@/lib/nhrc/types";
import { computeLayout, nodeRadius, type Point } from "@/lib/nhrc/force-layout";

const WIDTH = 960;
const HEIGHT = 620;

const AREA_COLORS: Record<string, string> = {
  A: "#60a5fa",
  B: "#34d399",
  C: "#f472b6",
  D: "#fbbf24",
  E: "#a78bfa",
};
const HIGHLIGHT = "#fb923c";

function areaColor(areaCode?: string): string {
  return (areaCode && AREA_COLORS[areaCode]) || "#9ca3af";
}

export function TopicGraph() {
  const [graph, setGraph] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [cases, setCases] = useState<NhrcDocument[] | null>(null);
  const [casesLoading, setCasesLoading] = useState(false);
  const dragRef = useRef<{ id: string; svg: SVGSVGElement } | null>(null);
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

  function handlePointerDown(id: string, e: React.PointerEvent<SVGCircleElement | SVGGElement>) {
    // Without this, the browser treats mousedown+move on an SVG <text>/shape
    // as a native text-selection or ghost-image drag, which hijacks the
    // pointer sequence - our pointermove handler stops getting events and
    // the node looks frozen even though the drag logic itself is fine.
    e.preventDefault();
    const svg = e.currentTarget.ownerSVGElement;
    if (!svg) return;
    dragRef.current = { id, svg };
    (e.target as Element).setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent) {
    const drag = dragRef.current;
    if (!drag) return;
    e.preventDefault();
    const rect = drag.svg.getBoundingClientRect();
    const scaleX = WIDTH / rect.width;
    const scaleY = HEIGHT / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    setPositions((prev) => {
      const next = new Map(prev);
      next.set(drag.id, { x: Math.max(30, Math.min(WIDTH - 30, x)), y: Math.max(30, Math.min(HEIGHT - 30, y)) });
      return next;
    });
  }

  function handlePointerUp() {
    dragRef.current = null;
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
        <h1>แผนที่ประเด็นสิทธิ</h1>
        <p>
          แต่ละจุดคือประเด็นสิทธิหรือกลุ่มประเด็น เส้นทึบเชื่อมประเด็นย่อยเข้ากับกลุ่มประเด็นหลัก
          เส้นสีส้มบาง ๆ แสดงว่าสองประเด็นมีกรณีตรวจสอบร่วมกัน (ยิ่งเข้มยิ่งมีกรณีร่วมกันมาก) —
          คลิกจุดเพื่อดูรายการกรณี ลากจุดเพื่อจัดตำแหน่งใหม่
        </p>
      </div>

      <div className="cw-graph-body">
        <div className="cw-graph-canvas">
          <svg
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            width="100%"
            height="100%"
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          >
            {graph.edges.map((e, i) => {
              const a = positions.get(e.source);
              const b = positions.get(e.target);
              if (!a || !b) return null;
              const dimmed = connectedIds ? !(connectedIds.has(e.source) && connectedIds.has(e.target)) : false;
              if (e.type === "hierarchy") {
                return (
                  <line
                    key={i}
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke="#3a3f4b"
                    strokeWidth={1.5}
                    opacity={dimmed ? 0.15 : 0.6}
                  />
                );
              }
              const weight = e.weight || 1;
              const opacity = dimmed ? 0.06 : 0.15 + (weight / maxWeight) * 0.55;
              return (
                <line
                  key={i}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke={HIGHLIGHT}
                  strokeWidth={0.75 + (weight / maxWeight) * 2.5}
                  opacity={opacity}
                />
              );
            })}

            {graph.nodes.map((n) => {
              const p = positions.get(n.id);
              if (!p) return null;
              const isArea = n.type === "area";
              const r = nodeRadius(n);
              const dimmed = connectedIds ? !connectedIds.has(n.id) : false;
              const isSelected = selected?.id === n.id;
              return (
                <g
                  key={n.id}
                  opacity={dimmed ? 0.35 : 1}
                  style={{ cursor: "pointer" }}
                  onPointerDown={(e) => handlePointerDown(n.id, e)}
                  onClick={() => setSelected(n)}
                  role="button"
                  tabIndex={0}
                  aria-label={`${n.label}: ${n.count} กรณีตรวจสอบ`}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelected(n);
                    }
                  }}
                >
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={r}
                    fill={isArea ? "#20242c" : areaColor(n.areaCode)}
                    stroke={isSelected ? HIGHLIGHT : areaColor(n.areaCode)}
                    strokeWidth={isArea ? 2.5 : isSelected ? 2.5 : 1}
                    fillOpacity={isArea ? 1 : 0.85}
                  />
                  <text
                    x={p.x}
                    y={p.y + r + 14}
                    textAnchor="middle"
                    fontSize={isArea ? 12 : 10.5}
                    fontWeight={isArea ? 700 : 500}
                    fill={isArea ? "#f3f4f6" : "#d1d5db"}
                  >
                    {n.label.length > 20 ? n.label.slice(0, 19) + "…" : n.label}
                  </text>
                  <text x={p.x} y={p.y + 4} textAnchor="middle" fontSize={isArea ? 11 : 10} fontWeight={700} fill={isArea ? "#f3f4f6" : "#1e2128"}>
                    {n.count}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {selected && (
          <aside className="cw-graph-panel">
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
          </aside>
        )}
      </div>
    </div>
  );
}
