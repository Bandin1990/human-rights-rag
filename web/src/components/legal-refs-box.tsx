"use client";

/**
 * AI-suggested legal references for a case note (see src/lib/nhrc/legal-refs.ts).
 *
 * Fetched client-side from /api/case/[id]/legal-refs instead of awaited
 * server-side in case/[id]/page.tsx. getLegalRefs() makes a live Claude API
 * call plus an external OpenThai 2.0 Legal lookup on every cache-miss (i.e.
 * every case not already visited this server lifetime) - awaiting that in
 * the page's server render blocked the *entire* page behind however long
 * those two network round-trips took, multiple seconds on a cold cache.
 * Rendering this box's own loading state instead lets the rest of the page
 * (which is all local/instant data) show immediately.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";

interface LegalRefs {
  summary: string;
  internationalInstruments: string[];
  thaiLaws: string[];
  groundedThaiLaws?: string[];
  groundedInternationalInstruments?: { document_id: string; title: string }[];
  groundedThaiLawDocs?: { document_id: string; title: string }[];
}

// Shared by LegalRefsBox (sidebar: instruments/laws) and AiCaseSummary (main
// column: the one-paragraph summary) - both render different slices of the
// same getLegalRefs() result, fetched independently since the two boxes sit
// far apart in the page layout. The endpoint's own in-memory cache (see
// legal-refs.ts) means the second fetch is nearly free once either resolves.
function useLegalRefs(caseId: string) {
  // undefined = still loading, null = fetch succeeded but AI unavailable/failed
  const [refs, setRefs] = useState<LegalRefs | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    setRefs(undefined);
    fetch(`/api/case/${encodeURIComponent(caseId)}/legal-refs`)
      .then((res) => res.json())
      .then((body) => {
        if (cancelled) return;
        setRefs(body.success ? body.data : null);
      })
      .catch(() => {
        if (!cancelled) setRefs(null);
      });
    return () => {
      cancelled = true;
    };
  }, [caseId]);

  return refs;
}

export function AiCaseSummary({ caseId }: { caseId: string }) {
  const refs = useLegalRefs(caseId);
  if (!refs?.summary) return null;
  return (
    <div className="cw-legal-refs" style={{ marginTop: 24 }}>
      <div className="cw-legal-refs-head">
        <Sparkles size={15} /> สรุปโดย AI
      </div>
      <p className="cw-legal-refs-note">สรุปโดยอัตโนมัติจากเนื้อหากรณี</p>
      <p style={{ color: "#d1d5db", fontSize: "0.92rem", lineHeight: 1.7, margin: 0 }}>{refs.summary}</p>
    </div>
  );
}

export function LegalRefsBox({ caseId }: { caseId: string }) {
  const refs = useLegalRefs(caseId);

  return (
    <div className="cw-legal-refs">
      <div className="cw-legal-refs-head">
        <Sparkles size={15} /> กฎหมาย/ตราสารที่เกี่ยวข้อง
      </div>
      <p className="cw-legal-refs-note">แนะนำโดย AI จากเนื้อหากรณี — ยังไม่ผ่านการตรวจสอบ โปรดยืนยันก่อนอ้างอิงจริง</p>

      {refs === undefined ? (
        <div className="cw-legal-refs-empty">กำลังวิเคราะห์ด้วย AI...</div>
      ) : refs === null ? (
        <div className="cw-legal-refs-empty">ยังไม่สามารถวิเคราะห์ได้ในขณะนี้</div>
      ) : (
        <>
          <h4>ตราสารระหว่างประเทศที่เกี่ยวข้อง</h4>
          {refs.internationalInstruments.length > 0 ? (
            refs.internationalInstruments.map((item, i) => (
              <div className="cw-legal-ref-item" key={i}>
                {item}
              </div>
            ))
          ) : (
            <div className="cw-legal-refs-empty">ไม่พบตราสารที่เกี่ยวข้องชัดเจน</div>
          )}

          <h4>กฎหมายไทยที่เกี่ยวข้อง</h4>
          {refs.thaiLaws.length > 0 ? (
            refs.thaiLaws.map((item, i) => (
              <div className="cw-legal-ref-item" key={i}>
                {item}
              </div>
            ))
          ) : (
            <div className="cw-legal-refs-empty">ไม่พบกฎหมายที่เกี่ยวข้องชัดเจน</div>
          )}

          {refs.groundedThaiLaws && refs.groundedThaiLaws.length > 0 && (
            <>
              <h4>ยืนยันจากฐานข้อมูลตัวบทกฎหมาย</h4>
              <p className="cw-legal-refs-note cw-legal-refs-note--grounded">
                พบมาตราต่อไปนี้จริงในฐานข้อมูลตัวบทกฎหมายไทย 6,300 มาตรา (OpenThai 2.0 Legal) — ยังควรตรวจสอบก่อนอ้างอิงทางการ
              </p>
              {refs.groundedThaiLaws.map((item, i) => (
                <div className="cw-legal-ref-item" key={i}>
                  {item}
                </div>
              ))}
            </>
          )}

          {refs.groundedInternationalInstruments && refs.groundedInternationalInstruments.length > 0 && (
            <>
              <h4>ยืนยันจากคลังตราสารระหว่างประเทศในระบบ</h4>
              <p className="cw-legal-refs-note cw-legal-refs-note--grounded">
                พบเอกสารตราสารต่อไปนี้จริงในคลังความรู้ กสม. (จับคู่จากคำสำคัญของกรณีนี้) — คลิกเพื่อดูรายละเอียดตราสาร
              </p>
              {refs.groundedInternationalInstruments.map((doc) => (
                <Link
                  href={`/case/${doc.document_id}`}
                  className="cw-legal-ref-item cw-legal-ref-item--link"
                  key={doc.document_id}
                >
                  {doc.title}
                </Link>
              ))}
            </>
          )}

          {refs.groundedThaiLawDocs && refs.groundedThaiLawDocs.length > 0 && (
            <>
              <h4>ยืนยันจากคลังกฎหมายไทยในระบบ</h4>
              <p className="cw-legal-refs-note cw-legal-refs-note--grounded">
                พบเอกสารกฎหมายต่อไปนี้จริงในคลังความรู้ กสม. (จับคู่จากคำสำคัญของกรณีนี้) — คลิกเพื่อดูรายละเอียดกฎหมาย
              </p>
              {refs.groundedThaiLawDocs.map((doc) => (
                <Link
                  href={`/case/${doc.document_id}`}
                  className="cw-legal-ref-item cw-legal-ref-item--link"
                  key={doc.document_id}
                >
                  {doc.title}
                </Link>
              ))}
            </>
          )}
        </>
      )}
    </div>
  );
}
