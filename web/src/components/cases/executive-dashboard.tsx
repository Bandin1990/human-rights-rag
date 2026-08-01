"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BarChart3, PieChart as PieChartIcon, Activity, CheckCircle, ShieldCheck, TrendingUp, FileSearch, Map as MapIcon, ArrowRight, FilePenLine } from "lucide-react";
import type { ComplaintCase, CaseActor } from "@/types/case";
import { formatThaiDate, complaintStatusLabels, priorityLabels, deadlineText } from "@/lib/cases/presentation";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from "recharts";
import { ThailandMap } from "./thailand-map";

interface ExecutiveDashboardProps { cases: ComplaintCase[]; actor?: CaseActor; }

export function ExecutiveDashboard({ cases, actor }: ExecutiveDashboardProps) {
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  const total = cases.length;
  const closed = cases.filter(c => c.status === "closed").length;
  
  // Results of Screening
  const investigateCount = cases.filter(c => c.screening?.resolution === "investigate" || (!c.screening?.resolution && c.status !== "closed")).length;
  const mediateCount = cases.filter(c => c.screening?.resolution === "mediate").length;
  const referCount = cases.filter(c => c.status === "referred").length;
  const terminateScreeningCount = cases.filter(c => c.status === "closed" && c.report.outcome === "pending").length;

  const screeningData = [
    { name: "รับไว้ตรวจสอบ", value: investigateCount, color: "#3b82f6" }, // vibrant blue
    { name: "ประสานงาน", value: mediateCount, color: "#10b981" }, // emerald
    { name: "ส่งต่อหน่วยงาน", value: referCount, color: "#f59e0b" }, // amber
    { name: "ยุติเรื่อง", value: terminateScreeningCount, color: "#64748b" } // slate
  ].filter(d => d.value > 0);

  // Results of Investigation (Outcomes)
  const violations = cases.filter(c => c.report.outcome === "violation").length;
  const noViolations = cases.filter(c => c.report.outcome === "no_violation").length;
  const termWithdraw = cases.filter(c => c.report.outcome === "terminated_withdrawal").length;
  const termCourt = cases.filter(c => c.report.outcome === "terminated_court").length;
  const termOther = cases.filter(c => c.report.outcome === "terminated_other").length;

  const investigationData = [
    { name: "ละเมิดสิทธิ", value: violations, color: "#ef4444" }, // red
    { name: "ไม่ละเมิดสิทธิ", value: noViolations, color: "#10b981" }, // emerald
    { name: "ถอนคำร้อง", value: termWithdraw, color: "#f59e0b" },
    { name: "อยู่ในชั้นศาล", value: termCourt, color: "#3b82f6" },
    { name: "เหตุอื่น", value: termOther, color: "#94a3b8" }
  ].filter(d => d.value > 0);

  // Monthly trends (mocked by month of receivedAt)
  const monthNames = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  const trendsMap: Record<string, number> = {};
  cases.forEach(c => {
    const d = new Date(c.receivedAt);
    const month = monthNames[d.getMonth()];
    trendsMap[month] = (trendsMap[month] || 0) + 1;
  });
  
  // Create an array for the last 6 months (static for demo purposes)
  const trendsData = [
    { name: "ก.พ.", รับเรื่อง: trendsMap["ก.พ."] || 5 },
    { name: "มี.ค.", รับเรื่อง: trendsMap["มี.ค."] || 8 },
    { name: "เม.ย.", รับเรื่อง: trendsMap["เม.ย."] || 6 },
    { name: "พ.ค.", รับเรื่อง: trendsMap["พ.ค."] || 12 },
    { name: "มิ.ย.", รับเรื่อง: trendsMap["มิ.ย."] || 15 },
    { name: "ก.ค.", รับเรื่อง: trendsMap["ก.ค."] || 18 }
  ];

  // Rights Issues
  const rightsCount = cases.reduce((acc, c) => {
    c.rightsIssues.forEach(issue => {
      acc[issue] = (acc[issue] || 0) + 1;
    });
    return acc;
  }, {} as Record<string, number>);

  const topRights = Object.entries(rightsCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, value]) => ({ name, value }));

  // Location Map Data
  const locationCount = cases.reduce((acc, c) => {
    const loc = c.location.replace("จังหวัด", "").trim();
    acc[loc] = (acc[loc] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Follow Ups
  const followUps = cases.flatMap(c => c.followUps || []);
  const fuPending = followUps.filter(f => f.status === "pending").length;
  const fuImplemented = followUps.filter(f => f.status === "implemented").length;
  const fuPartial = followUps.filter(f => f.status === "partially_implemented").length;
  const fuIgnored = followUps.filter(f => f.status === "ignored").length;

  return (
    <div className="case-container executive-dashboard">
      <section className="case-dashboard-hero">
        <div>
          <span className="case-eyebrow">EXECUTIVE DASHBOARD</span>
          <h1>ภาพรวมการดำเนินงาน กสม.</h1>
          <p>รายงานสถิติเรื่องร้องเรียน ผลการพิจารณา และการติดตามผล</p>
        </div>
        <div className="case-hero-actions">
          <Link href="/cases" className="case-secondary-button">กลับหน้ารายการงาน</Link>
        </div>
      </section>

      <section className="case-metrics executive-metrics" aria-label="ภาพรวมสถิติ">
        <article className="metric-card gradient-blue">
          <div className="metric-content">
            <small>รับเรื่องร้องเรียนทั้งหมด</small>
            <b>{total}</b>
            <span>เรื่องสะสมในระบบ</span>
          </div>
          <span className="metric-icon-large"><Activity /></span>
        </article>
        <article className="metric-card gradient-amber">
          <div className="metric-content">
            <small>ตรวจสอบ / ประเมินผล</small>
            <b>{investigateCount}</b>
            <span>เรื่องที่เข้าสู่กระบวนการ</span>
          </div>
          <span className="metric-icon-large"><FileSearch /></span>
        </article>
        <article className="metric-card gradient-mint">
          <div className="metric-content">
            <small>เสร็จสิ้น / ยุติเรื่อง</small>
            <b>{closed}</b>
            <span>คิดเป็น {Math.round((closed/total)*100 || 0)}%</span>
          </div>
          <span className="metric-icon-large"><CheckCircle /></span>
        </article>
        <article className="metric-card gradient-violet">
          <div className="metric-content">
            <small>ละเมิดสิทธิมนุษยชน</small>
            <b>{violations}</b>
            <span>เรื่องที่มีมติว่าละเมิด</span>
          </div>
          <span className="metric-icon-large"><ShieldCheck /></span>
        </article>
      </section>

      <div className="dashboard-charts" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", marginTop: "2rem" }}>
        
        {/* Trend Area Chart */}
        <section className="workspace-card" style={{ gridColumn: "1 / -1" }}>
          <div className="workspace-card-heading"><div><span className="case-eyebrow">TRENDS</span><h2>สถิติรับเรื่องร้องเรียน (6 เดือนย้อนหลัง)</h2></div><TrendingUp /></div>
          <div style={{ height: "300px", marginTop: "1.5rem" }}>
            {mounted && (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendsData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorReceived" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ background: "rgba(255, 255, 255, 0.9)", backdropFilter: "blur(8px)", border: "1px solid #e2e8f0", borderRadius: "12px", boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1)" }}
                  itemStyle={{ color: "var(--text-primary)", fontWeight: "bold" }}
                />
                <Area type="monotone" dataKey="รับเรื่อง" stroke="#3b82f6" strokeWidth={4} fillOpacity={1} fill="url(#colorReceived)" />
              </AreaChart>
            </ResponsiveContainer>
            )}
          </div>
        </section>

        {/* Screening Pie Chart */}
        <section className="workspace-card">
          <div className="workspace-card-heading"><div><span className="case-eyebrow">SCREENING</span><h2>ผลการพิจารณาเบื้องต้น (กลั่นกรอง)</h2></div><PieChartIcon /></div>
          <div style={{ height: "250px", marginTop: "1rem" }}>
            {mounted && (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                <Pie data={screeningData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                  {screeningData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="rgba(255,255,255,0.5)" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "rgba(255, 255, 255, 0.9)", backdropFilter: "blur(8px)", borderRadius: "12px", border: "1px solid #e2e8f0" }} itemStyle={{ fontWeight: "bold" }} />
                <Legend verticalAlign="bottom" height={36} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
            )}
          </div>
        </section>

        {/* Investigation Results Pie Chart */}
        <section className="workspace-card">
          <div className="workspace-card-heading"><div><span className="case-eyebrow">OUTCOMES</span><h2>ผลการตรวจสอบและการยุติเรื่อง</h2></div><PieChartIcon /></div>
          <div style={{ height: "250px", marginTop: "1rem" }}>
            {mounted && (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                <Pie data={investigationData} cx="50%" cy="50%" innerRadius={40} outerRadius={80} paddingAngle={2} dataKey="value" label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}>
                  {investigationData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="rgba(255,255,255,0.5)" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "rgba(255, 255, 255, 0.9)", backdropFilter: "blur(8px)", borderRadius: "12px", border: "1px solid #e2e8f0" }} itemStyle={{ fontWeight: "bold" }} />
              </PieChart>
            </ResponsiveContainer>
            )}
          </div>
        </section>

        {/* Top Rights Issues */}
        <section className="workspace-card">
          <div className="workspace-card-heading"><div><span className="case-eyebrow">ISSUES</span><h2>ประเด็นสิทธิที่มีการร้องเรียนสูงสุด</h2></div><BarChart3 /></div>
          <div style={{ height: "250px", marginTop: "1.5rem" }}>
            {mounted && (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topRights} layout="vertical" margin={{ top: 0, right: 30, left: 60, bottom: 0 }}>
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} width={150} />
                <Tooltip cursor={{ fill: "rgba(0,0,0,0.02)" }} contentStyle={{ background: "rgba(255, 255, 255, 0.9)", backdropFilter: "blur(8px)", borderRadius: "12px", border: "1px solid #e2e8f0" }} itemStyle={{ fontWeight: "bold" }} />
                <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={20}>
                  {topRights.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={`hsl(220, 80%, ${60 - index * 5}%)`} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            )}
          </div>
        </section>

        {/* Location Map */}
        <section className="workspace-card" style={{ gridColumn: "1 / -1", minHeight: "500px", display: "flex", flexDirection: "column" }}>
          <div className="workspace-card-heading"><div><span className="case-eyebrow">GEOGRAPHY</span><h2>ความหนาแน่นของเรื่องร้องเรียนรายพื้นที่</h2></div><MapIcon /></div>
          <div style={{ flex: 1, marginTop: "1rem", borderRadius: "8px", background: "var(--surface)", overflow: "hidden", border: "1px solid var(--surface-border)", position: "relative" }}>
            <ThailandMap locationCount={locationCount} />
          </div>
        </section>



        {/* Follow-up Tracking */}
        <section className="workspace-card">
          <div className="workspace-card-heading"><div><span className="case-eyebrow">FOLLOW-UP</span><h2>ผลการติดตามการปฏิบัติตามข้อเสนอแนะ</h2></div><PieChartIcon /></div>
          <div style={{ height: "250px", marginTop: "1.5rem" }}>
            {mounted && (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                <Pie 
                  data={[
                    { name: "ปฏิบัติตามครบถ้วน", value: fuImplemented, color: "#10b981" }, // emerald
                    { name: "ปฏิบัติตามบางส่วน", value: fuPartial, color: "#3b82f6" }, // blue
                    { name: "รอดำเนินการ", value: fuPending, color: "#f59e0b" }, // amber
                    { name: "เพิกเฉย", value: fuIgnored, color: "#ef4444" } // red
                  ].filter(d => d.value > 0)} 
                  cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value"
                >
                  {
                    [
                      { name: "ปฏิบัติตามครบถ้วน", value: fuImplemented, color: "#10b981" },
                      { name: "ปฏิบัติตามบางส่วน", value: fuPartial, color: "#3b82f6" },
                      { name: "รอดำเนินการ", value: fuPending, color: "#f59e0b" },
                      { name: "เพิกเฉย", value: fuIgnored, color: "#ef4444" }
                    ].filter(d => d.value > 0).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="rgba(255,255,255,0.5)" strokeWidth={2} />
                    ))
                  }
                </Pie>
                <Tooltip contentStyle={{ background: "rgba(255, 255, 255, 0.9)", backdropFilter: "blur(8px)", borderRadius: "12px", border: "1px solid #e2e8f0" }} itemStyle={{ fontWeight: "bold" }} />
                <Legend verticalAlign="bottom" height={36} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
            )}
          </div>
        </section>

      </div>

      <section className="case-list-panel" style={{ marginTop: "2rem" }}>
        <div className="case-panel-heading">
          <div><span className="case-eyebrow">RECENT CASES</span><h2>เรื่องร้องเรียนล่าสุด</h2></div>
          <span>{cases.length} เรื่อง</span>
        </div>
        <div className="case-list">
          {cases.slice(0, 10).map((item) => {
            const deadline = item.deadlines.find((entry) => entry.status !== "completed");
            return (
              <div className="case-list-row" key={item.id} style={{ paddingRight: "16px", gridTemplateColumns: "minmax(0,1fr) 150px 160px auto" }}>
                <Link href={`/cases/${item.id}`} style={{ display: 'contents' }}>
                  <div className="case-row-main">
                    <div className="case-row-kicker"><span>{item.referenceNo}</span><span className={`priority-${item.priority}`}>{priorityLabels[item.priority]}</span>{item.vulnerableGroup && <span className="vulnerable-chip">กลุ่มเปราะบาง</span>}</div>
                    <h3>{item.title}</h3>
                    <div className="case-rights">{item.rightsIssues.map((issue) => <span key={issue}>{issue}</span>)}</div>
                  </div>
                  <div className="case-row-owner"><small>ผู้รับผิดชอบ</small><b>{item.assignedOfficer}</b><span>{formatThaiDate(item.receivedAt)}</span></div>
                  <div className="case-row-state"><span className={`case-status status-${item.status}`}>{complaintStatusLabels[item.status]}</span>{deadline && <small className={`deadline-${deadline.status}`}>{deadlineText(deadline.dueAt)}</small>}</div>
                </Link>
                <div className="case-row-actions" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <Link href={`/cases/${item.id}?tab=report`} className="case-action-btn" title="แก้ไข/ทำรายงาน" onClick={(e) => e.stopPropagation()} style={{ color: "var(--teal)", padding: "4px" }}>
                    <FilePenLine size={16} />
                  </Link>
                  <ArrowRight className="case-row-arrow" size={18} />
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
