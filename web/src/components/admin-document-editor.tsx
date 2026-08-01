"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  FileText,
  LoaderCircle,
  Plus,
  Save,
  Trash2,
  Upload,
} from "lucide-react";

type AdminDocument = {
  id: string;
  title: string;
  summary: string | null;
  document_type: string;
  document_number: string | null;
  buddhist_year: number | null;
  published_at: string | null;
  source_organization: string;
  source_system: string;
  source_url: string | null;
  authority_level: string;
  language: string;
  rights_categories: string[];
  access_scope: string;
  status: string;
  page_count: number | null;
  updated_at: string;
};

type AdminSection = {
  id?: string;
  clientId: string;
  section_index: number;
  page_number: number | null;
  anchor: string | null;
  heading: string;
  content: string;
  language: string;
};

type AdminFile = {
  id: string;
  file_format: string;
  storage_key: string;
  mime_type: string;
  byte_size: number | null;
  is_primary: boolean;
  created_at: string;
};

type ApiResponse = {
  document: AdminDocument;
  sections: Omit<AdminSection, "clientId">[];
  files: AdminFile[];
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

const statusOptions = [
  { value: "draft", label: "ฉบับร่าง" },
  { value: "pending_review", label: "รอตรวจทาน" },
  { value: "approved", label: "อนุมัติแล้ว" },
  { value: "processing", label: "กำลังประมวลผล" },
  { value: "published", label: "เผยแพร่" },
  { value: "archived", label: "เก็บถาวร" },
  { value: "failed", label: "ประมวลผลไม่สำเร็จ" },
];

const accessOptions = [
  { value: "public", label: "สาธารณะ" },
  { value: "internal", label: "ภายใน" },
  { value: "restricted", label: "จำกัดสิทธิ์" },
];

function snapshot(document: AdminDocument | null, sections: AdminSection[]) {
  if (!document) return "";
  return JSON.stringify({
    document,
    sections: sections.map((section) => ({
      id: section.id,
      section_index: section.section_index,
      page_number: section.page_number,
      anchor: section.anchor,
      heading: section.heading,
      content: section.content,
      language: section.language,
    })),
  });
}

function formatBytes(bytes: number | null) {
  if (!bytes) return "ไม่ระบุขนาด";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function fileName(storageKey: string) {
  const storedName = storageKey.split("/").pop() || storageKey;
  return storedName.replace(/^[a-f0-9]{12}-/i, "");
}

export function AdminDocumentEditor({ documentId }: { documentId: string }) {
  const [document, setDocument] = useState<AdminDocument | null>(null);
  const [sections, setSections] = useState<AdminSection[]>([]);
  const [files, setFiles] = useState<AdminFile[]>([]);
  const [baseline, setBaseline] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [unauthorized, setUnauthorized] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadDocument = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/documents/${encodeURIComponent(documentId)}`, {
        cache: "no-store",
      });
      if (response.status === 401) {
        setUnauthorized(true);
        return;
      }
      const body = (await response.json()) as ApiResponse & { error?: string };
      if (!response.ok) throw new Error(body.error || "โหลดเอกสารไม่สำเร็จ");
      const loadedSections = body.sections.map((section) => ({
        ...section,
        clientId: section.id || crypto.randomUUID(),
      }));
      setDocument(body.document);
      setSections(loadedSections);
      setFiles(body.files);
      setBaseline(snapshot(body.document, loadedSections));
      setUnauthorized(false);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "โหลดเอกสารไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  useEffect(() => {
    // Initial client-side data load for this interactive editor.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadDocument();
  }, [loadDocument]);

  const dirty = useMemo(() => snapshot(document, sections) !== baseline, [baseline, document, sections]);

  function setDocumentField<K extends keyof AdminDocument>(field: K, value: AdminDocument[K]) {
    setDocument((current) => (current ? { ...current, [field]: value } : current));
    setMessage("");
  }

  function setSectionField<K extends keyof AdminSection>(
    clientId: string,
    field: K,
    value: AdminSection[K],
  ) {
    setSections((current) =>
      current.map((section) => (section.clientId === clientId ? { ...section, [field]: value } : section)),
    );
    setMessage("");
  }

  function addSection() {
    const nextIndex = sections.reduce((maximum, section) => Math.max(maximum, section.section_index), -1) + 1;
    setSections((current) => [
      ...current,
      {
        clientId: crypto.randomUUID(),
        section_index: nextIndex,
        page_number: null,
        anchor: null,
        heading: `ส่วนที่ ${current.length + 1}`,
        content: "",
        language: document?.language || "th",
      },
    ]);
    setMessage("");
  }

  function removeSection(clientId: string) {
    if (sections.length === 1) {
      setError("เอกสารต้องมีอย่างน้อย 1 ส่วน");
      return;
    }
    if (!window.confirm("ลบส่วนนี้ออกจากเอกสารใช่หรือไม่?")) return;
    setSections((current) => current.filter((section) => section.clientId !== clientId));
    setMessage("");
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!document || saving) return;
    setSaving(true);
    setError("");
    setMessage("กำลังบันทึกและสร้าง embedding สำหรับส่วนที่เปลี่ยน...");
    try {
      const response = await fetch(`/api/admin/documents/${encodeURIComponent(documentId)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: document.title,
          summary: document.summary || "",
          documentType: document.document_type,
          documentNumber: document.document_number,
          buddhistYear: document.buddhist_year,
          publishedAt: document.published_at,
          sourceOrganization: document.source_organization,
          sourceSystem: document.source_system,
          sourceUrl: document.source_url,
          authorityLevel: document.authority_level,
          language: document.language,
          rightsCategories: document.rights_categories,
          accessScope: document.access_scope,
          status: document.status,
          sections: sections.map((section) => ({
            id: section.id,
            sectionIndex: section.section_index,
            pageNumber: section.page_number,
            anchor: section.anchor,
            heading: section.heading,
            content: section.content,
            language: section.language,
          })),
        }),
      });
      const body = (await response.json()) as { error?: string; reindexedSections?: number };
      if (!response.ok) throw new Error(body.error || "บันทึกเอกสารไม่สำเร็จ");
      await loadDocument();
      setMessage(`บันทึกแล้ว · สร้าง embedding ใหม่ ${body.reindexedSections || 0} ส่วน`);
    } catch (saveError) {
      setMessage("");
      setError(saveError instanceof Error ? saveError.message : "บันทึกเอกสารไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  async function replaceFile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (replacing) return;
    if (
      !window.confirm(
        "แทนที่ไฟล์ต้นฉบับและสร้าง sections/embeddings ใหม่ทั้งหมดใช่หรือไม่? Metadata และสถานะปัจจุบันจะคงเดิม",
      )
    ) {
      return;
    }
    const form = event.currentTarget;
    const formData = new FormData(form);
    formData.set("documentId", documentId);
    setReplacing(true);
    setError("");
    setMessage("กำลังอ่านไฟล์และสร้างดัชนีใหม่...");
    try {
      const response = await fetch("/api/admin/import", { method: "POST", body: formData });
      const body = (await response.json()) as {
        error?: string;
        sections?: number;
        cleanupWarning?: string;
      };
      if (!response.ok) throw new Error(body.error || "แทนที่ไฟล์ไม่สำเร็จ");
      form.reset();
      await loadDocument();
      setMessage(
        body.cleanupWarning
          ? `แทนที่ไฟล์แล้ว ${body.sections || 0} ส่วน แต่ล้างไฟล์เก่าบางรายการไม่สำเร็จ: ${body.cleanupWarning}`
          : `แทนที่ไฟล์และสร้างดัชนีใหม่แล้ว ${body.sections || 0} ส่วน`,
      );
    } catch (replaceError) {
      setMessage("");
      setError(replaceError instanceof Error ? replaceError.message : "แทนที่ไฟล์ไม่สำเร็จ");
    } finally {
      setReplacing(false);
    }
  }

  if (loading) {
    return (
      <main className="admin-page admin-edit-page">
        <div className="container admin-card admin-loading">
          <LoaderCircle className="spin" />
          กำลังโหลดเอกสาร...
        </div>
      </main>
    );
  }

  if (unauthorized) {
    return (
      <main className="admin-page admin-edit-page">
        <div className="container admin-card admin-state-card">
          <AlertCircle />
          <h1>กรุณาเข้าสู่ระบบผู้ดูแล</h1>
          <p>เซสชันผู้ดูแลหมดอายุหรือยังไม่ได้เข้าสู่ระบบ</p>
          <Link className="primary-link" href="/admin/import">
            ไปหน้าเข้าสู่ระบบ
          </Link>
        </div>
      </main>
    );
  }

  if (!document) {
    return (
      <main className="admin-page admin-edit-page">
        <div className="container admin-card admin-state-card">
          <AlertCircle />
          <h1>เปิดเอกสารไม่ได้</h1>
          <p>{error || "ไม่พบเอกสารที่ต้องการแก้ไข"}</p>
          <Link className="primary-link" href="/admin/import#documents">
            กลับไปรายการเอกสาร
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="admin-page admin-edit-page">
      <div className="container">
        <div className="admin-edit-nav">
          <Link href="/admin/import#documents">
            <ArrowLeft size={16} />
            กลับไปรายการเอกสาร
          </Link>
          <span className={dirty ? "dirty-indicator is-dirty" : "dirty-indicator"}>
            {dirty ? "มีการแก้ไขที่ยังไม่บันทึก" : "บันทึกล่าสุดแล้ว"}
          </span>
        </div>

        <header className="admin-head admin-edit-head">
          <div>
            <span>DOCUMENT EDITOR</span>
            <h1>แก้ไขเอกสาร</h1>
            <p>{document.title}</p>
          </div>
        </header>

        {(error || message) && (
          <div className={error ? "admin-feedback is-error" : "admin-feedback is-success"}>
            {error ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
            <span>{error || message}</span>
          </div>
        )}

        <div className="edit-document-layout">
          <form id="document-edit-form" className="edit-document-main" onSubmit={save}>
            <section className="editor-panel">
              <div className="editor-panel-head">
                <div>
                  <span className="kicker">METADATA</span>
                  <h2>ข้อมูลเอกสาร</h2>
                </div>
                <span>ช่องที่มี * จำเป็นต้องกรอก</span>
              </div>

              <label className="field-full">
                ชื่อเอกสาร *
                <input
                  value={document.title}
                  onChange={(event) => setDocumentField("title", event.target.value)}
                  required
                />
              </label>
              <label className="field-full">
                คำอธิบายย่อ
                <textarea
                  value={document.summary || ""}
                  onChange={(event) => setDocumentField("summary", event.target.value)}
                  rows={4}
                />
              </label>

              <div className="editor-form-grid">
                <label>
                  ประเภทเอกสาร *
                  <input
                    value={document.document_type}
                    onChange={(event) => setDocumentField("document_type", event.target.value)}
                    placeholder="พิมพ์หรือคลิกเลือก"
                    required
                  />
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "8px" }}>
                    {documentTypes.map(type => (
                      <button type="button" key={type} onClick={() => setDocumentField("document_type", type)} style={{
                        padding: "4px 10px", fontSize: "12px", borderRadius: "100px", 
                        border: "1px solid var(--teal)", 
                        background: document.document_type === type ? "var(--teal)" : "transparent",
                        color: document.document_type === type ? "white" : "var(--teal)",
                        cursor: "pointer"
                      }}>
                        {type}
                      </button>
                    ))}
                  </div>
                </label>
                <label>
                  ปี พ.ศ.
                  <input
                    type="number"
                    min="2400"
                    max="2700"
                    value={document.buddhist_year || ""}
                    onChange={(event) =>
                      setDocumentField("buddhist_year", event.target.value ? Number(event.target.value) : null)
                    }
                  />
                </label>
                <label>
                  วันที่เผยแพร่ต้นฉบับ
                  <input
                    value={document.published_at || ""}
                    onChange={(event) => setDocumentField("published_at", event.target.value || null)}
                    placeholder="เช่น 10 ธันวาคม 2568"
                  />
                </label>
                <label>
                  ภาษาเอกสาร
                  <select
                    value={document.language}
                    onChange={(event) => setDocumentField("language", event.target.value)}
                  >
                    <option value="th">ไทย (TH)</option>
                    <option value="en">English (EN)</option>
                  </select>
                </label>
                <label>
                  หน่วยงานเจ้าของเอกสาร *
                  <input
                    value={document.source_organization}
                    onChange={(event) => setDocumentField("source_organization", event.target.value)}
                    required
                  />
                </label>
                <label>
                  URL ต้นฉบับ
                  <input
                    type="url"
                    value={document.source_url || ""}
                    onChange={(event) => setDocumentField("source_url", event.target.value || null)}
                    placeholder="https://..."
                  />
                </label>
                <label>
                  ระดับการเข้าถึง
                  <select
                    value={document.access_scope}
                    onChange={(event) => setDocumentField("access_scope", event.target.value)}
                  >
                    {accessOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  สถานะ
                  <select
                    value={document.status}
                    onChange={(event) => setDocumentField("status", event.target.value)}
                  >
                    {statusOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="field-full">
                ประเด็นสิทธิ
                <input
                  value={(document.rights_categories || []).join(", ")}
                  onChange={(event) =>
                    setDocumentField(
                      "rights_categories",
                      event.target.value
                        .split(",")
                        .map((value) => value.trim())
                        .filter(Boolean),
                    )
                  }
                  placeholder="เช่น สิทธิเด็ก, กระบวนการยุติธรรม"
                />
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "8px" }}>
                  {recommendedCategories.map(cat => {
                    const isActive = (document.rights_categories || []).includes(cat);
                    return (
                      <button type="button" key={cat} onClick={() => {
                        const current = document.rights_categories || [];
                        if (isActive) {
                          setDocumentField("rights_categories", current.filter(c => c !== cat));
                        } else {
                          setDocumentField("rights_categories", [...current, cat]);
                        }
                      }} style={{
                        padding: "4px 10px", fontSize: "12px", borderRadius: "100px", 
                        border: "1px solid var(--teal)", 
                        background: isActive ? "var(--teal)" : "transparent",
                        color: isActive ? "white" : "var(--teal)",
                        cursor: "pointer"
                      }}>
                        {cat}
                      </button>
                    );
                  })}
                </div>
              </label>
            </section>

            <section className="editor-panel">
              <div className="editor-panel-head section-editor-heading">
                <div>
                  <span className="kicker">SECTIONS</span>
                  <h2>เนื้อหาสำหรับค้นหา</h2>
                  <p>แก้หัวข้อและเนื้อหาทีละส่วน ระบบจะสร้าง embedding ใหม่เฉพาะส่วนที่เปลี่ยน</p>
                </div>
                <button className="secondary-button" type="button" onClick={addSection}>
                  <Plus size={16} />
                  เพิ่มส่วน
                </button>
              </div>

              <div className="section-editor-list">
                {sections.map((section, index) => (
                  <details className="section-editor" key={section.clientId}>
                    <summary>
                      <span className="section-order">{String(index + 1).padStart(2, "0")}</span>
                      <span>
                        <b>{section.heading || "ไม่มีหัวข้อ"}</b>
                        <small>
                          {section.page_number ? `หน้า ${section.page_number} · ` : ""}
                          {section.content.length.toLocaleString("th-TH")} ตัวอักษร
                        </small>
                      </span>
                    </summary>
                    <div className="section-editor-body">
                      <div className="section-fields">
                        <label>
                          หัวข้อ
                          <input
                            value={section.heading}
                            onChange={(event) =>
                              setSectionField(section.clientId, "heading", event.target.value)
                            }
                          />
                        </label>
                        <label>
                          เลขหน้า
                          <input
                            type="number"
                            min="1"
                            value={section.page_number || ""}
                            onChange={(event) =>
                              setSectionField(
                                section.clientId,
                                "page_number",
                                event.target.value ? Number(event.target.value) : null,
                              )
                            }
                          />
                        </label>
                      </div>
                      <label>
                        เนื้อหา *
                        <textarea
                          value={section.content}
                          onChange={(event) =>
                            setSectionField(section.clientId, "content", event.target.value)
                          }
                          rows={12}
                          required
                        />
                      </label>
                      <div className="section-actions">
                        <span>ลำดับในดัชนี: {section.section_index}</span>
                        <button type="button" onClick={() => removeSection(section.clientId)}>
                          <Trash2 size={15} />
                          ลบส่วนนี้
                        </button>
                      </div>
                    </div>
                  </details>
                ))}
              </div>
            </section>
          </form>

          <aside className="edit-document-sidebar">
            <section className="editor-panel save-panel">
              <h3>บันทึกการแก้ไข</h3>
              <p>
                {dirty
                  ? "มีข้อมูลที่เปลี่ยนจากเวอร์ชันล่าสุด"
                  : "ข้อมูลบนหน้าตรงกับเวอร์ชันล่าสุดแล้ว"}
              </p>
              <button
                className="primary-button"
                type="submit"
                form="document-edit-form"
                disabled={saving || !dirty}
              >
                {saving ? <LoaderCircle className="spin" size={18} /> : <Save size={18} />}
                {saving ? "กำลังบันทึก..." : "บันทึกและสร้างดัชนี"}
              </button>
              <small>ปรับ embedding เฉพาะ section ที่เปลี่ยน หากแก้ชื่อเอกสารจะปรับใหม่ทุก section</small>
            </section>

            <section className="editor-panel replace-file-panel">
              <div className="sidebar-panel-title">
                <FileText size={19} />
                <h3>ไฟล์ต้นฉบับ</h3>
              </div>
              <div className="current-files">
                {files.length ? (
                  files.map((file) => (
                    <div key={file.id}>
                      <b>{fileName(file.storage_key)}</b>
                      <span>
                        {file.file_format.toUpperCase()} · {formatBytes(file.byte_size)}
                      </span>
                    </div>
                  ))
                ) : (
                  <p>ไม่พบข้อมูลไฟล์ต้นฉบับ</p>
                )}
              </div>
              <form onSubmit={replaceFile}>
                <label className="compact-file-input">
                  เลือกไฟล์ใหม่
                  <input name="file" type="file" accept=".md,.docx,.pdf" required />
                </label>
                <button className="secondary-button replace-button" disabled={replacing}>
                  {replacing ? <LoaderCircle className="spin" size={17} /> : <Upload size={17} />}
                  {replacing ? "กำลังแทนที่..." : "แทนที่ไฟล์และสร้างดัชนีใหม่"}
                </button>
              </form>
              <small>รองรับ .md, .docx และ .pdf ขนาดไม่เกิน 25 MB</small>
            </section>

            <section className="editor-panel document-summary-panel">
              <h3>สรุปเอกสาร</h3>
              <dl>
                <div>
                  <dt>Sections</dt>
                  <dd>{sections.length.toLocaleString("th-TH")}</dd>
                </div>
                <div>
                  <dt>จำนวนหน้า</dt>
                  <dd>{document.page_count || "—"}</dd>
                </div>
                <div>
                  <dt>อัปเดตล่าสุด</dt>
                  <dd>
                    {new Intl.DateTimeFormat("th-TH", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(document.updated_at))}
                  </dd>
                </div>
              </dl>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
