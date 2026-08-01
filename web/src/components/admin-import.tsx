"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import {
  CheckCircle2,
  FileUp,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  ShieldAlert,
} from "lucide-react";

type Status = {
  authenticated: boolean;
  configured: boolean;
  storageConfigured: boolean;
  aiConfigured: boolean;
};

const documentTypes = [
  "รายงานผลการตรวจสอบ",
  "ข้อเสนอแนะ",
  "รายงานสถานการณ์ประจำปี",
  "คำพิพากษา",
  "กฎหมายและระเบียบ",
  "มาตรฐานระหว่างประเทศ",
  "เอกสาร UN",
  "คู่มือและงานวิชาการ",
];

const recommendedCategories = [
  "สิทธิในกระบวนการยุติธรรม",
  "สิทธิชุมชน",
  "สิทธิเด็ก",
  "สิทธิสตรี",
  "สิทธิคนพิการ",
  "สิทธิแรงงาน",
  "เสรีภาพในการแสดงออก",
  "สิทธิผู้สูงอายุ",
  "สิทธิในที่ดิน",
  "สิทธิของบุคคลไร้รัฐ"
];

export function AdminImport() {
  const [status, setStatus] = useState<Status | null>(null);
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [docType, setDocType] = useState(documentTypes[0]);

  async function refresh() {
    try {
      const response = await fetch("/api/admin/session", { cache: "no-store" });
      setStatus(await response.json());
    } catch {
      setError("ไม่สามารถตรวจสอบสิทธิ์ผู้ดูแลได้");
    }
  }

  useEffect(() => {
    // Initial authentication check for this client-only admin surface.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, []);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error || "เข้าสู่ระบบไม่สำเร็จ");
      setPassword("");
      await refresh();
      window.dispatchEvent(new Event("admin-session-changed"));
      setMessage("เข้าสู่ระบบแล้ว");
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "เข้าสู่ระบบไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    setBusy(true);
    setError("");
    try {
      await fetch("/api/admin/session", { method: "DELETE" });
      await refresh();
      window.dispatchEvent(new Event("admin-session-changed"));
    } finally {
      setBusy(false);
    }
  }

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    setBusy(true);
    setError("");
    setMessage("กำลังอ่านไฟล์ สร้าง sections และ embeddings...");
    try {
      const response = await fetch("/api/admin/import", {
        method: "POST",
        body: new FormData(form),
      });
      const body = (await response.json()) as {
        error?: string;
        sections?: number;
        status?: string;
      };
      if (!response.ok) throw new Error(body.error || "นำเข้าเอกสารไม่สำเร็จ");
      form.reset();
      setFile(null);
      setCategories([]);
      setDocType(documentTypes[0]);
      setMessage(`นำเข้าแล้ว ${body.sections || 0} ส่วน · สถานะ ${body.status || "draft"}`);
      window.dispatchEvent(new Event("admin-documents-changed"));
    } catch (uploadError) {
      setMessage("");
      setError(uploadError instanceof Error ? uploadError.message : "นำเข้าเอกสารไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  if (!status) {
    return (
      <main className="admin-page">
        <div className="container admin-card admin-loading">
          {error ? (
            <>
              <ShieldAlert />
              {error}
            </>
          ) : (
            <>
              <LoaderCircle className="spin" />
              กำลังตรวจสอบสิทธิ์...
            </>
          )}
        </div>
      </main>
    );
  }

  if (!status.authenticated) {
    return (
      <main className="admin-page admin-login-page">
        <div className="container admin-card admin-login">
          <div className="admin-login-icon">
            <LockKeyhole />
          </div>
          <span className="kicker">SECURE ADMIN</span>
          <h1>จัดการคลังเอกสาร</h1>
          <p>เข้าสู่ระบบเพื่อเพิ่ม แก้ไข และจัดการเอกสารใน Human Rights Knowledge</p>
          {!status.configured && (
            <div className="config-warning">
              <ShieldAlert />
              ยังไม่ได้ตั้งค่า ADMIN_IMPORT_SECRET
            </div>
          )}
          <form onSubmit={login}>
            <label>
              รหัสผ่านผู้ดูแล
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
            </label>
            <button disabled={busy || !status.configured}>
              {busy && <LoaderCircle className="spin" size={17} />}
              เข้าสู่ระบบ
            </button>
          </form>
          {error && <div className="admin-feedback is-error">{error}</div>}
          <Link href="/">กลับหน้าค้นหา</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="admin-page admin-import-page">
      <div className="container">
        <div className="admin-head">
          <div>
            <span>HUMAN RIGHTS KNOWLEDGE</span>
            <h1>นำเข้าเอกสารใหม่</h1>
            <p>เพิ่มไฟล์ต้นฉบับและข้อมูลกำกับ ระบบจะแยกเนื้อหาและสร้าง semantic index ให้อัตโนมัติ</p>
          </div>
          <div className="admin-head-actions">
            <FileUp size={38} />
            <button type="button" onClick={logout} disabled={busy}>
              <LogOut size={15} />
              ออกจากระบบ
            </button>
          </div>
        </div>

        {!status.storageConfigured && (
          <div className="config-warning">
            <ShieldAlert />
            ยังไม่ได้ตั้งค่า SUPABASE_SECRET_KEY
          </div>
        )}
        {!status.aiConfigured && (
          <div className="config-warning">
            <ShieldAlert />
            ยังไม่ได้ตั้งค่า OPENAI_API_KEY
          </div>
        )}

        <form className="import-form" onSubmit={upload}>
          <fieldset>
            <div className="fieldset-heading">
              <span>01</span>
              <div>
                <legend>ไฟล์ต้นฉบับ</legend>
                <p>ไฟล์นี้จะถูกเก็บแบบ private ใน Supabase Storage</p>
              </div>
            </div>
            <label className="file-drop">
              <FileUp />
              <span>
                <b>{file ? file.name : "เลือกไฟล์ .md, .docx หรือ .pdf"}</b>
                <small>ขนาดไม่เกิน 25 MB</small>
              </span>
              <input name="file" type="file" accept=".md,.docx,.pdf" required onChange={(e) => setFile(e.target.files?.[0] || null)} />
            </label>
          </fieldset>

          <fieldset>
            <div className="fieldset-heading">
              <span>02</span>
              <div>
                <legend>ข้อมูลหลัก</legend>
                <p>ข้อมูลนี้ใช้แสดงในหน้าค้นหาและหน้ารายละเอียด</p>
              </div>
            </div>
            <div className="form-grid">
              <label>
                ชื่อเอกสาร *
                <input name="title" required />
              </label>
              <label>
                ปี พ.ศ.
                <input name="year" type="number" min="2400" max="2700" />
              </label>
              <label>
                วันที่เผยแพร่ต้นฉบับ
                <input name="publishedAt" placeholder="เช่น 10 ธันวาคม 2568" />
              </label>
              <label>
                ภาษาเอกสาร
                <select name="language" defaultValue="th">
                  <option value="th">ไทย (TH)</option>
                  <option value="en">English (EN)</option>
                </select>
              </label>
            </div>
            <label>
              คำอธิบายย่อ
              <textarea name="summary" rows={4} />
            </label>
          </fieldset>

          <fieldset>
            <div className="fieldset-heading">
              <span>03</span>
              <div>
                <legend>การจัดหมวดหมู่และสิทธิ์</legend>
                <p>กำหนดแหล่งที่มา ประเด็นสิทธิ และขอบเขตการเผยแพร่</p>
              </div>
            </div>
            <div className="form-grid">
              <label>
                ประเภทเอกสาร
                <input name="documentType" value={docType} onChange={(e) => setDocType(e.target.value)} placeholder="พิมพ์หรือคลิกเลือกจากคำแนะนำ" />
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "8px" }}>
                  {documentTypes.map(type => (
                    <button type="button" key={type} onClick={() => setDocType(type)} style={{
                      padding: "4px 10px", fontSize: "12px", borderRadius: "100px", 
                      border: "1px solid var(--teal)", 
                      background: docType === type ? "var(--teal)" : "transparent",
                      color: docType === type ? "white" : "var(--teal)",
                      cursor: "pointer"
                    }}>
                      {type}
                    </button>
                  ))}
                </div>
              </label>
              <label>
                ประเด็นสิทธิ
                <input name="categories" value={categories.join(", ")} onChange={(e) => {
                  const val = e.target.value;
                  setCategories(val.split(",").map(s => s.trim()).filter(Boolean));
                }} placeholder="พิมพ์หรือคลิกเลือกจากคำแนะนำ" />
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "8px" }}>
                  {recommendedCategories.map(cat => (
                    <button type="button" key={cat} onClick={() => {
                      if (categories.includes(cat)) {
                        setCategories(categories.filter(c => c !== cat));
                      } else {
                        setCategories([...categories, cat]);
                      }
                    }} style={{
                      padding: "4px 10px", fontSize: "12px", borderRadius: "100px", 
                      border: "1px solid var(--teal)", 
                      background: categories.includes(cat) ? "var(--teal)" : "transparent",
                      color: categories.includes(cat) ? "white" : "var(--teal)",
                      cursor: "pointer"
                    }}>
                      {cat}
                    </button>
                  ))}
                </div>
              </label>
              <label>
                หน่วยงานเจ้าของเอกสาร
                <input name="agency" defaultValue="คณะกรรมการสิทธิมนุษยชนแห่งชาติ" />
              </label>
              <label>
                URL เอกสารต้นฉบับ
                <input name="sourceUrl" type="url" placeholder="https://..." />
              </label>
              <label>
                ระดับการเข้าถึง
                <select name="accessScope">
                  <option value="public">สาธารณะ</option>
                  <option value="internal">ภายใน</option>
                  <option value="restricted">จำกัดสิทธิ์</option>
                </select>
              </label>
              <label className="check">
                <input name="publish" type="checkbox" value="true" />
                ตรวจแล้วและเผยแพร่ทันที
              </label>
            </div>
          </fieldset>

          <div className="import-submit-row">
            <p>หากต้องการแก้ metadata, sections หรือแทนที่ไฟล์ของเอกสารเดิม ให้ใช้ปุ่ม “แก้ไข” ในรายการด้านล่าง</p>
            <button
              className="import-button"
              disabled={busy || !status.storageConfigured || !status.aiConfigured}
            >
              {busy ? <LoaderCircle className="spin" /> : <FileUp />}
              {busy ? "กำลังนำเข้าและสร้างดัชนี..." : "นำเข้าเอกสาร"}
            </button>
          </div>
        </form>

        {(error || message) && (
          <div className={error ? "admin-feedback is-error" : "admin-feedback is-success"}>
            {error ? <ShieldAlert size={18} /> : <CheckCircle2 size={18} />}
            <span>{error || message}</span>
          </div>
        )}
      </div>
    </main>
  );
}
