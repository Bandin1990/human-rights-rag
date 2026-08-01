"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Globe2,
  LoaderCircle,
  Pencil,
  RotateCcw,
  Search,
  Trash2,
} from "lucide-react";

type Document = {
  id: string;
  title: string;
  summary: string | null;
  status: string;
  access_scope: string;
  document_type: string;
  rights_categories: string[];
  buddhist_year: number | null;
  page_count: number | null;
  updated_at: string;
};

const statusLabels: Record<string, string> = {
  draft: "ฉบับร่าง",
  pending_review: "รอตรวจทาน",
  approved: "อนุมัติแล้ว",
  processing: "กำลังประมวลผล",
  published: "เผยแพร่",
  archived: "เก็บถาวร",
  failed: "ไม่สำเร็จ",
};

const accessLabels: Record<string, string> = {
  public: "สาธารณะ",
  internal: "ภายใน",
  restricted: "จำกัดสิทธิ์",
};

export function AdminDocumentList() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [right, setRight] = useState("");
  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [updatingId, setUpdatingId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/documents", { cache: "no-store" });
      if (response.status === 401) {
        setUnauthorized(true);
        return;
      }
      const body = (await response.json()) as Document[] & { error?: string };
      if (!response.ok) throw new Error(body.error || "โหลดรายการเอกสารไม่สำเร็จ");
      setDocuments(body);
      setUnauthorized(false);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "โหลดรายการเอกสารไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial client-side data load; later refreshes are event-driven.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    const reload = () => void load();
    window.addEventListener("admin-session-changed", reload);
    window.addEventListener("admin-documents-changed", reload);
    return () => {
      window.removeEventListener("admin-session-changed", reload);
      window.removeEventListener("admin-documents-changed", reload);
    };
  }, [load]);

  const types = useMemo(
    () => [...new Set(documents.map((document) => document.document_type))].sort((a, b) => a.localeCompare(b, "th")),
    [documents],
  );
  const rights = useMemo(
    () =>
      [...new Set(documents.flatMap((document) => document.rights_categories || []))].sort((a, b) =>
        a.localeCompare(b, "th"),
      ),
    [documents],
  );
  const statuses = useMemo(
    () => [...new Set(documents.map((document) => document.status))],
    [documents],
  );

  const visible = useMemo(() => {
    const normalizedQuery = query.toLocaleLowerCase("th").normalize("NFKC").trim();
    return documents.filter((document) => {
      if (status && document.status !== status) return false;
      if (type && document.document_type !== type) return false;
      if (right && !document.rights_categories?.includes(right)) return false;
      if (!normalizedQuery) return true;
      const haystack = [
        document.title,
        document.id,
        document.summary || "",
        document.document_type,
        ...(document.rights_categories || []),
      ]
        .join(" ")
        .toLocaleLowerCase("th")
        .normalize("NFKC");
      return haystack.includes(normalizedQuery);
    });
  }, [documents, query, right, status, type]);

  async function remove(document: Document) {
    if (
      !window.confirm(
        `ลบ “${document.title}” พร้อม sections, embeddings และไฟล์ต้นฉบับทั้งหมดใช่หรือไม่? การดำเนินการนี้ย้อนกลับไม่ได้`,
      )
    ) {
      return;
    }
    setDeletingId(document.id);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/documents", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: document.id }),
      });
      const body = (await response.json()) as { error?: string; cleanupWarning?: string };
      if (!response.ok) throw new Error(body.error || "ลบเอกสารไม่สำเร็จ");
      setMessage(
        body.cleanupWarning
          ? `ลบเอกสารแล้ว แต่ล้างไฟล์ใน Storage บางรายการไม่สำเร็จ: ${body.cleanupWarning}`
          : "ลบเอกสารและไฟล์ต้นฉบับแล้ว",
      );
      await load();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "ลบเอกสารไม่สำเร็จ");
    } finally {
      setDeletingId("");
    }
  }

  async function updateStatus(document: Document, nextStatus: "published" | "draft") {
    const publish = nextStatus === "published";
    const action = publish ? "เผยแพร่" : "ย้ายกลับเป็นฉบับร่าง";
    if (!window.confirm(`${action} “${document.title}” ใช่หรือไม่?`)) return;

    setUpdatingId(document.id);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/admin/documents/${encodeURIComponent(document.id)}/status`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error || "เปลี่ยนสถานะเอกสารไม่สำเร็จ");
      setMessage(publish ? "เผยแพร่เอกสารแล้ว" : "ย้ายเอกสารกลับเป็นฉบับร่างแล้ว");
      await load();
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : "เปลี่ยนสถานะเอกสารไม่สำเร็จ");
    } finally {
      setUpdatingId("");
    }
  }

  if (unauthorized) return null;

  return (
    <section className="container admin-documents-section" id="documents">
      <div className="admin-card document-manager">
        <div className="document-manager-head">
          <div>
            <span className="kicker">DOCUMENT MANAGEMENT</span>
            <h2>เอกสารในคลัง</h2>
            <p>ค้นหา แก้ไข metadata และ sections หรือจัดการไฟล์ต้นฉบับ</p>
          </div>
          <div className="document-total">
            <b>{visible.length.toLocaleString("th-TH")}</b>
            <span>จาก {documents.length.toLocaleString("th-TH")} รายการ</span>
          </div>
        </div>

        <div className="document-filter-bar">
          <label className="document-search">
            <Search size={18} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="ค้นหาชื่อ รหัส หรือคำสำคัญ"
            />
          </label>
          <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="กรองตามสถานะ">
            <option value="">ทุกสถานะ</option>
            {statuses.map((value) => (
              <option key={value} value={value}>
                {statusLabels[value] || value}
              </option>
            ))}
          </select>
          <select value={type} onChange={(event) => setType(event.target.value)} aria-label="กรองตามประเภท">
            <option value="">ทุกประเภท</option>
            {types.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
          <select value={right} onChange={(event) => setRight(event.target.value)} aria-label="กรองตามประเด็นสิทธิ">
            <option value="">ทุกประเด็นสิทธิ</option>
            {rights.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </div>

        {(error || message) && (
          <div className={error ? "admin-feedback is-error" : "admin-feedback is-success"}>
            {error ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
            <span>{error || message}</span>
          </div>
        )}

        {loading ? (
          <div className="document-manager-state">
            <LoaderCircle className="spin" />
            กำลังโหลดรายการเอกสาร...
          </div>
        ) : visible.length ? (
          <div className="admin-document-table">
            {visible.map((document) => (
              <article key={document.id} className="admin-document-row">
                <div className="admin-document-icon">
                  <FileText size={21} />
                </div>
                <div className="admin-document-copy">
                  <div className="admin-document-title-line">
                    <h3>{document.title}</h3>
                    <span className={`status-badge status-${document.status}`}>
                      {statusLabels[document.status] || document.status}
                    </span>
                  </div>
                  <p>
                    {document.summary || "ยังไม่มีคำอธิบายย่อ"}
                  </p>
                  <div className="admin-document-meta">
                    <span>{document.document_type}</span>
                    <span>{document.buddhist_year ? `พ.ศ. ${document.buddhist_year}` : "ไม่ระบุปี"}</span>
                    <span>{document.page_count ? `${document.page_count} ส่วน/หน้า` : "ยังไม่ระบุจำนวนหน้า"}</span>
                    <span>{accessLabels[document.access_scope] || document.access_scope}</span>
                  </div>
                  {!!document.rights_categories?.length && (
                    <div className="admin-rights-tags">
                      {document.rights_categories.slice(0, 4).map((category) => (
                        <span key={category}>{category}</span>
                      ))}
                      {document.rights_categories.length > 4 && (
                        <span>+{document.rights_categories.length - 4}</span>
                      )}
                    </div>
                  )}
                </div>
                <div className="admin-document-actions">
                  <button
                    className={document.status === "published" ? "secondary-button" : "publish-button"}
                    type="button"
                    onClick={() => updateStatus(document, document.status === "published" ? "draft" : "published")}
                    disabled={updatingId === document.id || deletingId === document.id}
                  >
                    {updatingId === document.id ? (
                      <LoaderCircle className="spin" size={16} />
                    ) : document.status === "published" ? (
                      <RotateCcw size={16} />
                    ) : (
                      <Globe2 size={16} />
                    )}
                    {document.status === "published" ? "กลับเป็นร่าง" : "เผยแพร่"}
                  </button>
                  <Link
                    className="secondary-button"
                    href={`/admin/documents/${encodeURIComponent(document.id)}/edit`}
                  >
                    <Pencil size={16} />
                    แก้ไข
                  </Link>
                  <button
                    className="danger-button"
                    type="button"
                    onClick={() => remove(document)}
                    disabled={deletingId === document.id || updatingId === document.id}
                  >
                    {deletingId === document.id ? (
                      <LoaderCircle className="spin" size={16} />
                    ) : (
                      <Trash2 size={16} />
                    )}
                    ลบ
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="document-manager-state">
            <Search />
            <b>ไม่พบเอกสารตามเงื่อนไข</b>
            <span>ลองล้างคำค้นหาหรือเปลี่ยนตัวกรอง</span>
          </div>
        )}
      </div>
    </section>
  );
}
