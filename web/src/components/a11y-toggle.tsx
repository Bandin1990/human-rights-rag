"use client";

import { useState } from "react";
import { Accessibility, X, Type, Palette } from "lucide-react";
import { useA11y } from "./a11y-provider";

export function A11yToggle() {
  const [open, setOpen] = useState(false);
  const { fontSizeScale, themeContrast, setFontSizeScale, setThemeContrast } = useA11y();

  return (
    <div style={{ position: "fixed", bottom: "24px", right: "24px", zIndex: 9999 }}>
      {open ? (
        <div style={{ background: "var(--paper, #fff)", border: "1px solid var(--line, #e2e8f0)", borderRadius: "16px", padding: "20px", boxShadow: "0 10px 25px rgba(0,0,0,0.1)", width: "300px", marginBottom: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", borderBottom: "1px solid var(--line, #e2e8f0)", paddingBottom: "12px" }}>
            <h3 style={{ margin: 0, fontSize: "16px", display: "flex", alignItems: "center", gap: "8px" }}><Accessibility size={18} /> การเข้าถึง (Accessibility)</h3>
            <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted, #64748b)" }}><X size={18} /></button>
          </div>
          
          <div style={{ marginBottom: "20px" }}>
            <b style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", marginBottom: "10px", color: "var(--muted, #64748b)" }}><Type size={14} /> ขนาดตัวอักษร</b>
            <div style={{ display: "flex", gap: "8px" }}>
              {(["normal", "large", "xlarge"] as const).map(scale => (
                <button
                  key={scale}
                  onClick={() => setFontSizeScale(scale)}
                  style={{
                    flex: 1, padding: "8px", borderRadius: "8px", cursor: "pointer",
                    border: fontSizeScale === scale ? "2px solid var(--teal, #0ea5e9)" : "1px solid var(--line, #e2e8f0)",
                    background: fontSizeScale === scale ? "var(--mint, #e0f2fe)" : "transparent",
                    color: "var(--ink, #0f172a)", fontSize: scale === "normal" ? "12px" : scale === "large" ? "14px" : "16px", fontWeight: 600
                  }}
                >
                  {scale === "normal" ? "ปกติ" : scale === "large" ? "ใหญ่" : "ใหญ่พิเศษ"}
                </button>
              ))}
            </div>
          </div>

          <div>
            <b style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", marginBottom: "10px", color: "var(--muted, #64748b)" }}><Palette size={14} /> โทนสีและคอนทราสต์</b>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <button
                onClick={() => setThemeContrast("normal")}
                style={{
                  padding: "10px", borderRadius: "8px", cursor: "pointer", textAlign: "left",
                  border: themeContrast === "normal" ? "2px solid var(--teal, #0ea5e9)" : "1px solid var(--line, #e2e8f0)",
                  background: themeContrast === "normal" ? "var(--mint, #e0f2fe)" : "transparent",
                  color: "var(--ink, #0f172a)", fontSize: "13px", fontWeight: 500
                }}
              >
                โหมดปกติ (สว่าง)
              </button>
              <button
                onClick={() => setThemeContrast("high")}
                style={{
                  padding: "10px", borderRadius: "8px", cursor: "pointer", textAlign: "left",
                  border: themeContrast === "high" ? "2px solid var(--teal, #0ea5e9)" : "1px solid var(--line, #e2e8f0)",
                  background: themeContrast === "high" ? "#fff" : "#f8fafc",
                  color: "#000", fontSize: "13px", fontWeight: 700
                }}
              >
                ความเปรียบต่างสูง (High Contrast)
              </button>
              <button
                onClick={() => setThemeContrast("dark")}
                style={{
                  padding: "10px", borderRadius: "8px", cursor: "pointer", textAlign: "left",
                  border: themeContrast === "dark" ? "2px solid var(--teal, #0ea5e9)" : "1px solid var(--line, #e2e8f0)",
                  background: themeContrast === "dark" ? "#1e293b" : "#334155",
                  color: "#fff", fontSize: "13px", fontWeight: 500
                }}
              >
                โหมดมืด (Dark Mode)
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button 
          onClick={() => setOpen(true)}
          style={{ width: "50px", height: "50px", borderRadius: "50%", background: "var(--teal, #0ea5e9)", color: "white", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 14px rgba(14, 165, 233, 0.4)", transition: "transform 0.2s" }}
          onMouseOver={(e) => e.currentTarget.style.transform = "scale(1.1)"}
          onMouseOut={(e) => e.currentTarget.style.transform = "scale(1)"}
          title="ตั้งค่าการเข้าถึง (Accessibility)"
        >
          <Accessibility size={24} />
        </button>
      )}
    </div>
  );
}
