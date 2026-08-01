import React from 'react';
import Link from 'next/link';
import { getKnowledgeDocument, searchKnowledge } from '@/lib/knowledge/repository';
import { ArrowLeft, Scale, Clock, User, Calendar, FileText, BookOpen } from 'lucide-react';
import '@/app/chat-workspace.css'; // Inherit global styles

export default async function DocumentDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const doc = await getKnowledgeDocument(id);
  
  // Fetch related documents based on title similarity
  let relatedDocs: any[] = [];
  if (doc) {
    const searchRes = await searchKnowledge({ query: doc.title });
    // Exclude the current document itself, take top 5
    relatedDocs = searchRes.results.filter(d => d.id !== id).slice(0, 5);
  }

  if (!doc) {
    return (
      <div className="cw-container" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <h2 style={{ color: 'white' }}>ไม่พบเอกสาร</h2>
        <Link href="/" style={{ background: '#fb923c', color: 'white', padding: '8px 16px', border: 'none', borderRadius: '8px', marginTop: '16px', cursor: 'pointer', textDecoration: 'none' }}>
          กลับไปหน้าหลัก
        </Link>
      </div>
    );
  }

  return (
    <div className="cw-container" style={{ display: 'block', overflowY: 'auto' }}>
      {/* Top Header */}
      <header style={{ padding: '24px 40px', borderBottom: '1px solid #2d303b', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: '#181a20', zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Link 
            href="/"
            style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'transparent', border: 'none', color: '#fb923c', cursor: 'pointer', fontSize: '1rem', fontWeight: 600, textDecoration: 'none' }}
          >
            <ArrowLeft size={20} /> กลับ
          </Link>
          <div style={{ width: '1px', height: '24px', background: '#374151' }}></div>
          <div className="cw-logo" style={{ padding: 0 }}>
            <Scale size={24} /> HumanRights
          </div>
        </div>
        <div style={{ display: 'flex', gap: '16px' }}>
          {doc.sourceUrl && (
            <a href={doc.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ background: '#374151', color: 'white', padding: '8px 16px', border: 'none', borderRadius: '20px', fontSize: '0.85rem', cursor: 'pointer', textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
              เปิดต้นฉบับ
            </a>
          )}
          <button style={{ background: '#f97316', color: 'white', padding: '8px 16px', border: 'none', borderRadius: '20px', fontSize: '0.85rem', cursor: 'pointer' }}>
            ✨ อัปเกรด
          </button>
        </div>
      </header>

      {/* Main Content Layout */}
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px' }}>
        
        {/* Document Title Section */}
        <div style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <Scale size={24} color="#fb923c" />
            <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 700, color: '#f3f4f6' }}>{doc.documentNumber || doc.title}</h1>
            {doc.buddhistYear && (
              <span style={{ padding: '4px 12px', background: '#252830', color: '#9ca3af', borderRadius: '16px', fontSize: '0.85rem' }}>
                พ.ศ. {doc.buddhistYear}
              </span>
            )}
            <span style={{ padding: '4px 12px', background: 'rgba(249,115,22,0.1)', color: '#fb923c', border: '1px solid rgba(249,115,22,0.2)', borderRadius: '16px', fontSize: '0.85rem' }}>
              {doc.type}
            </span>
          </div>
          <h2 style={{ fontSize: '1.1rem', color: '#d1d5db', fontWeight: 400, margin: '0 0 8px 0' }}>{doc.title}</h2>
          <p style={{ color: '#9ca3af', fontSize: '0.95rem' }}>แหล่งที่มา: {doc.agency} ({doc.sourceSystem})</p>
        </div>

        {/* Dashboard Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
          
          {/* Left Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* Short Summary */}
            <div style={{ background: '#252830', border: '1px solid rgba(249,115,22,0.3)', borderRadius: '16px', padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fb923c', fontWeight: 600, marginBottom: '16px' }}>
                <span style={{ fontSize: '1.2rem' }}>✨</span> สรุปโดย AI RAG
              </div>
              <p style={{ color: '#e5e7eb', fontSize: '1.05rem', lineHeight: 1.6, margin: 0 }}>
                {doc.shortSummary || doc.summary}
              </p>
            </div>

            {/* Timeline (If available) */}
            {doc.timeline && doc.timeline.length > 0 && (
              <div style={{ background: '#1e2128', border: '1px solid #374151', borderRadius: '16px', padding: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f3f4f6', fontWeight: 600, marginBottom: '24px' }}>
                  <Clock size={18} color="#9ca3af" /> ลำดับเหตุการณ์
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {doc.timeline.map((event, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '16px' }}>
                      <div style={{ flexShrink: 0, width: '28px', height: '28px', borderRadius: '50%', background: '#313543', border: '1px solid #4b5563', color: '#d1d5db', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', fontWeight: 600 }}>
                        {event.order}
                      </div>
                      <div>
                        <div style={{ color: '#fb923c', fontSize: '0.9rem', marginBottom: '4px' }}>{event.title}</div>
                        {event.subtitle && <div style={{ color: '#e5e7eb', fontWeight: 600, marginBottom: '8px' }}>{event.subtitle}</div>}
                        <div style={{ color: '#9ca3af', fontSize: '0.95rem', lineHeight: 1.5 }}>{event.description}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Long Summary / Excerpts */}
            <div style={{ background: '#1e2128', border: '1px solid #374151', borderRadius: '16px', padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f3f4f6', fontWeight: 600, marginBottom: '16px' }}>
                <FileText size={18} color="#9ca3af" /> ย่อยาว / สาระสำคัญ
              </div>
              <p style={{ color: '#d1d5db', fontSize: '0.95rem', lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap' }}>
                {doc.longSummary || "ไม่มีข้อมูลสรุปแบบยาวสำหรับเอกสารนี้"}
              </p>
            </div>
          </div>

          {/* Right Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* Related Laws */}
            <div style={{ background: '#1e2128', border: '1px solid #374151', borderRadius: '16px', padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f3f4f6', fontWeight: 600, marginBottom: '20px' }}>
                <BookOpen size={18} color="#9ca3af" /> กฎหมายที่อ้าง
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {/* International Laws */}
                {(doc.relatedInternationalLaws && doc.relatedInternationalLaws.length > 0) ? (
                  <div>
                    <div style={{ color: '#fb923c', fontSize: '0.85rem', fontWeight: 600, marginBottom: '8px' }}>ตราสารระหว่างประเทศที่เกี่ยวข้อง</div>
                    <ul style={{ margin: 0, paddingLeft: '20px', color: '#d1d5db', fontSize: '0.9rem', lineHeight: 1.6 }}>
                      {doc.relatedInternationalLaws.map((law, idx) => (
                        <li key={idx} style={{ marginBottom: '8px' }}>{law}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {/* Thai Laws */}
                {(doc.relatedThaiLaws && doc.relatedThaiLaws.length > 0) ? (
                  <div>
                    <div style={{ color: '#fb923c', fontSize: '0.85rem', fontWeight: 600, marginBottom: '8px' }}>กฎหมายไทยที่เกี่ยวข้อง</div>
                    <ul style={{ margin: 0, paddingLeft: '20px', color: '#d1d5db', fontSize: '0.9rem', lineHeight: 1.6 }}>
                      {doc.relatedThaiLaws.map((law, idx) => (
                        <li key={idx} style={{ marginBottom: '8px' }}>{law}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {(!doc.relatedInternationalLaws?.length && !doc.relatedThaiLaws?.length) && (
                  <div style={{ color: '#6b7280', fontSize: '0.9rem' }}>ไม่พบข้อมูลกฎหมายที่เกี่ยวข้อง</div>
                )}
              </div>
            </div>

            {/* Related Documents (Automatic) */}
            <div style={{ background: '#1e2128', border: '1px solid #374151', borderRadius: '16px', padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f3f4f6', fontWeight: 600, marginBottom: '16px' }}>
                <FileText size={18} color="#9ca3af" /> เอกสารที่เกี่ยวข้อง
              </div>
              
              {relatedDocs.length === 0 ? (
                <div style={{ color: '#6b7280', fontSize: '0.9rem' }}>ไม่พบเอกสารอื่นๆ ในระบบที่เกี่ยวข้อง</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {relatedDocs.map((rd, idx) => (
                    <Link key={idx} href={`/document/${rd.id}`} style={{ textDecoration: 'none' }}>
                      <div style={{ padding: '12px', background: '#252830', borderRadius: '8px', border: '1px solid #374151', cursor: 'pointer' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                          <div style={{ color: '#d1d5db', fontSize: '0.85rem', fontWeight: 500, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                            {rd.title}
                          </div>
                          <div style={{ flexShrink: 0, background: 'rgba(249,115,22,0.1)', color: '#fb923c', padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 600 }}>
                            {rd.type === 'คำพิพากษา' ? 'ศาล' : rd.type === 'รายงานผลการตรวจสอบ' ? 'กสม.' : 'อื่นๆ'}
                          </div>
                        </div>
                        {(rd.documentNumber || rd.buddhistYear) && (
                          <div style={{ color: '#9ca3af', fontSize: '0.75rem', marginTop: '6px' }}>
                            {rd.documentNumber} {rd.buddhistYear ? `พ.ศ. ${rd.buddhistYear}` : ''}
                          </div>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Related Persons */}
            {doc.relatedPersons && doc.relatedPersons.length > 0 && (
              <div style={{ background: '#1e2128', border: '1px solid #374151', borderRadius: '16px', padding: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f3f4f6', fontWeight: 600, marginBottom: '16px' }}>
                  <User size={18} color="#9ca3af" /> บุคคล/หน่วยงานที่เกี่ยวข้อง
                </div>
                {doc.relatedPersons.map((group, idx) => (
                  <div key={idx} style={{ marginBottom: idx === doc.relatedPersons!.length - 1 ? 0 : '16px' }}>
                    <div style={{ color: '#9ca3af', fontSize: '0.85rem', marginBottom: '8px' }}>{group.role}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {group.names.map(name => (
                        <span key={name} style={{ background: '#252830', border: '1px solid #374151', color: '#d1d5db', padding: '4px 12px', borderRadius: '16px', fontSize: '0.85rem' }}>
                          {name}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {/* Metadata Card */}
            <div style={{ background: '#1e2128', border: '1px solid #374151', borderRadius: '16px', padding: '24px' }}>
              <div style={{ color: '#f3f4f6', fontWeight: 600, marginBottom: '16px' }}>ข้อมูลทั่วไป</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.9rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#9ca3af' }}>เผยแพร่เมื่อ</span>
                  <span style={{ color: '#d1d5db' }}>{doc.publishedAt}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#9ca3af' }}>หมวดหมู่</span>
                  <span style={{ color: '#d1d5db' }}>{doc.categories[0]}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#9ca3af' }}>ความยาว</span>
                  <span style={{ color: '#d1d5db' }}>{doc.pages || '-'} หน้า</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#9ca3af' }}>ภาษา</span>
                  <span style={{ color: '#d1d5db', textTransform: 'uppercase' }}>{doc.language}</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}
