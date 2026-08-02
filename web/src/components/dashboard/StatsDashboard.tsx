"use client";

/**
 * Statistics Dashboard Component
 * Display index statistics and insights
 */

import Link from "next/link";
import { useEffect, useState } from "react";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { FileText, Users, TrendingUp, Calendar } from "lucide-react";

interface Statistics {
  totalDocuments: number;
  byType: Record<string, number>;
  byArea: Record<string, number>;
  casesByYear: Record<number, number>;
  topKeywords: { keyword: string; count: number }[];
  recentCases: any[];
}

const COLORS = ["#3b82f6", "#1d4ed8", "#60a5fa", "#93c5fd", "#0f172a"];

const AREA_NAMES: Record<string, string> = {
  A: "สิทธิพลเมือง",
  B: "สิทธิทางเศรษฐกิจ",
  C: "สิทธิของกลุ่ม",
  D: "สถานการณ์พื้นที่",
  E: "อื่น ๆ",
};

export function StatsDashboard() {
  const [stats, setStats] = useState<Statistics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/stats")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setStats(data.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="container stats-page">กำลังโหลดสถิติ...</div>;
  }

  if (!stats) {
    return <div className="container stats-page">ไม่สามารถโหลดสถิติ</div>;
  }

  const byTypeData = Object.entries(stats.byType).map(([type, count]) => ({
    name: type,
    value: count,
  }));

  const byAreaData = Object.entries(stats.byArea).map(([code, count]) => ({
    name: AREA_NAMES[code] || code,
    value: count,
  }));

  const casesByYearData = Object.entries(stats.casesByYear)
    .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
    .map(([year, count]) => ({ year, cases: count }));

  const latestYear = Math.max(...Object.keys(stats.casesByYear).map(Number), 0);
  const topKeywordCount = stats.topKeywords[0]?.count || 1;

  return (
    <div className="container stats-page">
      <div className="stats-head">
        <span className="eyebrow">ฐานความรู้ กสม.</span>
        <h1>สถิติฐานความรู้สิทธิมนุษยชน</h1>
        <p>ข้อมูลรวมเกี่ยวกับกรณีตรวจสอบและประเด็นสิทธิในระบบ</p>
      </div>

      <div className="stats-metrics">
        <MetricCard icon={FileText} label="เอกสารทั้งหมด" value={stats.totalDocuments} />
        <MetricCard icon={TrendingUp} label="กรณีตรวจสอบ" value={stats.byType.case_note || 0} />
        <MetricCard icon={Users} label="ประเด็นสิทธิ" value={stats.byType.topic || 0} />
        <MetricCard icon={Calendar} label="ปีล่าสุด" value={latestYear || "-"} />
      </div>

      <div className="stats-charts">
        <div className="stats-panel">
          <h2>เอกสารตามประเภท</h2>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={byTypeData} cx="50%" cy="50%" labelLine={false} label={({ name, value }) => `${name}: ${value}`} outerRadius={95} dataKey="value">
                {byTypeData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="stats-panel">
          <h2>การกระจายตามประเด็นสิทธิ</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={byAreaData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
              <XAxis dataKey="name" fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip />
              <Bar dataKey="value" fill="#3b82f6" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="stats-panel" style={{ marginBottom: 24 }}>
        <h2>กรณีตรวจสอบตามปี (พ.ศ.)</h2>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={casesByYearData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
            <XAxis dataKey="year" fontSize={12} />
            <YAxis fontSize={12} />
            <Tooltip />
            <Bar dataKey="cases" fill="#1d4ed8" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="stats-charts">
        <div className="stats-panel">
          <h2>คำสำคัญที่บ่อยที่สุด</h2>
          {stats.topKeywords.slice(0, 10).map((item) => (
            <div className="stats-keyword-row" key={item.keyword}>
              <span>{item.keyword}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div className="stats-keyword-bar">
                  <div style={{ width: `${(item.count / topKeywordCount) * 100}%` }} />
                </div>
                <span className="stats-keyword-count">{item.count}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="stats-panel">
          <h2>กรณีล่าสุด</h2>
          {stats.recentCases.slice(0, 10).map((caseItem) => (
            <Link
              href={`/case/${caseItem.case_id}`}
              className="stats-recent-item"
              key={caseItem.case_id}
            >
              <b>{caseItem.case_id}</b>
              <p>{caseItem.title}</p>
              <small>
                {caseItem.year_buddhist} · {caseItem.area_name || caseItem.area_code || "ยังไม่จัดประเด็น"}
              </small>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

interface MetricCardProps {
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  value: number | string;
}

function MetricCard({ icon: Icon, label, value }: MetricCardProps) {
  return (
    <div className="stats-card">
      <div className="stats-card-icon">
        <Icon size={22} />
      </div>
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}
