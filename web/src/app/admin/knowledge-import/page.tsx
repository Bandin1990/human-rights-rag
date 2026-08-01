"use client";

import React, { useState, useRef } from 'react';
import { Book, Upload, Folder, Search, Check, AlertCircle, Plus, Trash2, Calendar, User, FileText, Clock, Sparkles } from 'lucide-react';

const CATEGORIES = [
  "รายงานตรวจสอบ/ข้อเสนอแนะ กสม.",
  "รายงานประเมินสถานการณ์",
  "กฎหมายสิทธิมนุษยชนระหว่างประเทศและเอกสารตีความ",
  "คลังความรู้ด้านสิทธิมนุษยชน",
  "กฎหมายไทย",
  "คำพิพากษาศาลต่างประเทศ",
  "คำพิพากษาศาลไทย",
  "สมุดโน้ตส่วนตัว (Obsidian/NotebookLM)" // For external tools
];

export default function KnowledgeImportPage() {
  const [activeTab, setActiveTab] = useState<'upload' | 'existing'>('upload');
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  
  // AI Extraction State
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiInputText, setAiInputText] = useState('');
  const [aiInputFile, setAiInputFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form State
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [documentNumber, setDocumentNumber] = useState('');
  const [buddhistYear, setBuddhistYear] = useState('');
  const [agency, setAgency] = useState('');
  const [sourceSystem, setSourceSystem] = useState('');
  const [shortSummary, setShortSummary] = useState('');
  const [longSummary, setLongSummary] = useState('');
  const [file, setFile] = useState<File | null>(null);

  // Dynamic Array States
  const [timeline, setTimeline] = useState<{order: string, title: string, subtitle: string, description: string}[]>([]);
  const [relatedPersons, setRelatedPersons] = useState<{role: string, names: string}[]>([]);
  const [relatedInternationalLaws, setRelatedInternationalLaws] = useState<string[]>([]);
  const [relatedThaiLaws, setRelatedThaiLaws] = useState<string[]>([]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setStatus({ type: 'error', message: 'กรุณาเลือกไฟล์ที่ต้องการนำเข้า (รองรับ .pdf, .docx, .md, .zip)' });
      return;
    }
    
    setLoading(true);
    setStatus(null);
    
    try {
      // Create FormData representing the full metadata payload
      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', title);
      formData.append('category', category);
      formData.append('documentNumber', documentNumber);
      formData.append('buddhistYear', buddhistYear);
      formData.append('agency', agency);
      formData.append('sourceSystem', sourceSystem);
      formData.append('shortSummary', shortSummary);
      formData.append('longSummary', longSummary);
      formData.append('timeline', JSON.stringify(timeline));
      formData.append('relatedPersons', JSON.stringify(relatedPersons));
      formData.append('relatedInternationalLaws', JSON.stringify(relatedInternationalLaws));
      formData.append('relatedThaiLaws', JSON.stringify(relatedThaiLaws));
      
      // Simulate API Call
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      setStatus({ type: 'success', message: `บันทึกข้อมูล ${title} ลงระบบสำเร็จ (ข้อมูลพร้อมแสดงในหน้ารายละเอียด)` });
      // Optional: clear form
      // setTitle(''); setFile(null); setTimeline([]); setRelatedPersons([]);
    } catch (err) {
      setStatus({ type: 'error', message: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล' });
    } finally {
      setLoading(false);
    }
  };

  const handleExtractMetadata = async () => {
    if (!aiInputText && !aiInputFile) {
      alert('กรุณากรอกข้อความหรือเลือกไฟล์ก่อน');
      return;
    }
    
    setExtracting(true);
    setStatus(null);
    
    try {
      const formData = new FormData();
      if (aiInputFile) formData.append('file', aiInputFile);
      if (aiInputText) formData.append('text', aiInputText);
      
      const res = await fetch('/api/admin/extract-metadata', {
        method: 'POST',
        body: formData
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Extraction failed');
      }
      
      const data = await res.json();
      
      // Auto-fill form
      if (data.title) setTitle(data.title);
      if (data.category) setCategory(data.category);
      if (data.documentNumber) setDocumentNumber(data.documentNumber);
      if (data.buddhistYear) setBuddhistYear(data.buddhistYear);
      if (data.agency) setAgency(data.agency);
      if (data.sourceSystem) setSourceSystem(data.sourceSystem);
      if (data.shortSummary) setShortSummary(data.shortSummary);
      if (data.longSummary) setLongSummary(data.longSummary);
      if (data.timeline && Array.isArray(data.timeline)) setTimeline(data.timeline);
      if (data.relatedPersons && Array.isArray(data.relatedPersons)) setRelatedPersons(data.relatedPersons);
      if (data.relatedInternationalLaws && Array.isArray(data.relatedInternationalLaws)) setRelatedInternationalLaws(data.relatedInternationalLaws);
      if (data.relatedThaiLaws && Array.isArray(data.relatedThaiLaws)) setRelatedThaiLaws(data.relatedThaiLaws);
      
      setStatus({ type: 'success', message: 'ดึงข้อมูลสำเร็จ! กรุณาตรวจสอบและแก้ไขข้อมูลในฟอร์ม' });
      setShowAiModal(false);
      setAiInputText('');
      setAiInputFile(null);
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message || 'เกิดข้อผิดพลาดในการสกัดข้อมูล' });
    } finally {
      setExtracting(false);
    }
  };

  const addTimeline = () => setTimeline([...timeline, { order: '', title: '', subtitle: '', description: '' }]);
  const updateTimeline = (index: number, field: string, value: string) => {
    const newTimeline = [...timeline];
    newTimeline[index] = { ...newTimeline[index], [field]: value };
    setTimeline(newTimeline);
  };
  const removeTimeline = (index: number) => setTimeline(timeline.filter((_, i) => i !== index));

  const addPerson = () => setRelatedPersons([...relatedPersons, { role: '', names: '' }]);
  const updatePerson = (index: number, field: string, value: string) => {
    const newPersons = [...relatedPersons];
    newPersons[index] = { ...newPersons[index], [field]: value };
    setRelatedPersons(newPersons);
  };
  const removePerson = (index: number) => setRelatedPersons(relatedPersons.filter((_, i) => i !== index));

  const inputStyle = { width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1px solid #374151', fontSize: '15px', background: '#252830', color: '#f3f4f6' };
  const labelStyle = { display: 'block', fontWeight: 600, marginBottom: '8px', color: '#9ca3af', fontSize: '0.9rem' };
  const sectionStyle = { background: '#1e2128', border: '1px solid #374151', borderRadius: '16px', padding: '24px', marginBottom: '24px' };
  const sectionTitleStyle = { fontSize: '1.1rem', color: '#f3f4f6', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' };

  return (
    <div className="cw-container" style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflowY: 'auto' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px', width: '100%' }}>
        <div style={{ marginBottom: '32px' }}>
          <div>
            <span style={{ color: '#fb923c', fontWeight: 600, fontSize: '0.85rem', textTransform: 'uppercase' }}>Data Management</span>
            <h1 style={{ color: '#f3f4f6', fontSize: '2rem', margin: '8px 0' }}>Knowledge Ingestion</h1>
            <p style={{ color: '#9ca3af', margin: 0 }}>นำเข้าและจัดการรายละเอียดข้อมูลเชิงลึกเข้าสู่ระบบ</p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '32px' }}>
            {/* Sidebar for admin layout */}
            <div style={{ width: '250px', display: 'flex', flexDirection: 'column', gap: '8px', flexShrink: 0 }}>
              <button 
                onClick={() => setActiveTab('upload')}
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderRadius: '8px',
                  background: activeTab === 'upload' ? '#252830' : 'transparent',
                  color: activeTab === 'upload' ? '#f3f4f6' : '#9ca3af',
                  border: 'none', cursor: 'pointer', textAlign: 'left', fontWeight: 600
                }}
              >
                <Upload size={18} color={activeTab === 'upload' ? '#fb923c' : '#9ca3af'} /> นำเข้าข้อมูลใหม่
              </button>
              <button 
                onClick={() => setActiveTab('existing')}
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderRadius: '8px',
                  background: activeTab === 'existing' ? '#252830' : 'transparent',
                  color: activeTab === 'existing' ? '#f3f4f6' : '#9ca3af',
                  border: 'none', cursor: 'pointer', textAlign: 'left', fontWeight: 600
                }}
              >
                <Folder size={18} color={activeTab === 'existing' ? '#fb923c' : '#9ca3af'} /> จัดการข้อมูลที่มีอยู่
              </button>
            </div>

            {/* Main Content Area */}
            <div style={{ flex: 1 }}>
              
              {status && (
                <div style={{ 
                  padding: '16px', marginBottom: '24px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '12px',
                  background: status.type === 'success' ? '#dcfce7' : '#fee2e2',
                  color: status.type === 'success' ? '#166534' : '#991b1b'
                }}>
                  {status.type === 'success' ? <Check size={20} /> : <AlertCircle size={20} />}
                  {status.message}
                </div>
              )}

              {activeTab === 'upload' && (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  
                  {/* AI Extract Feature Box */}
                  <div style={{ background: 'rgba(249, 115, 22, 0.05)', border: '1px dashed #fb923c', borderRadius: '16px', padding: '24px', marginBottom: '24px' }}>
                    {!showAiModal ? (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <h3 style={{ margin: '0 0 8px 0', color: '#fb923c', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Sparkles size={20} /> สกัดข้อมูลอัตโนมัติด้วย AI
                          </h3>
                          <p style={{ margin: 0, color: '#9ca3af', fontSize: '0.9rem' }}>ลดเวลาการกรอกข้อมูล โดยให้ AI ช่วยอ่านไฟล์ (.pdf, .docx, .txt) หรือข้อความ แล้วเติมข้อมูลลงฟอร์มให้คุณทันที</p>
                        </div>
                        <button 
                          onClick={() => setShowAiModal(true)}
                          style={{ background: '#fb923c', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                        >
                          <Sparkles size={16} /> เริ่มใช้งาน
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <h3 style={{ margin: 0, color: '#fb923c', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Sparkles size={20} /> สกัดข้อมูลอัตโนมัติด้วย AI
                          </h3>
                          <button onClick={() => setShowAiModal(false)} style={{ background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer' }}>ยกเลิก</button>
                        </div>
                        
                        <div style={{ display: 'flex', gap: '20px', alignItems: 'stretch' }}>
                          <div style={{ flex: 1 }}>
                            <label style={labelStyle}>วางข้อความ (Paste Text)</label>
                            <textarea 
                              value={aiInputText} 
                              onChange={e => setAiInputText(e.target.value)} 
                              placeholder="วางข้อความคำพิพากษา หรือเนื้อหาเอกสารที่นี่..."
                              style={{...inputStyle, height: '150px', resize: 'vertical'}}
                            />
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', color: '#6b7280', fontWeight: 600 }}>หรือ</div>
                          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                            <label style={labelStyle}>อัปโหลดไฟล์ (.pdf, .docx, .md)</label>
                            <div 
                              onClick={() => fileInputRef.current?.click()}
                              style={{ flex: 1, border: '2px dashed #4b5563', borderRadius: '8px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', background: '#252830', color: '#9ca3af' }}
                            >
                              <Upload size={24} style={{ marginBottom: '8px' }} />
                              {aiInputFile ? (
                                <span style={{ color: '#fb923c', fontWeight: 600 }}>{aiInputFile.name}</span>
                              ) : (
                                <span>คลิกเพื่อเลือกไฟล์</span>
                              )}
                            </div>
                            <input 
                              type="file" 
                              ref={fileInputRef}
                              accept=".pdf,.docx,.doc,.txt,.md"
                              onChange={e => setAiInputFile(e.target.files?.[0] || null)}
                              style={{ display: 'none' }}
                            />
                          </div>
                        </div>
                        
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                          <button 
                            onClick={handleExtractMetadata}
                            disabled={extracting}
                            style={{ background: extracting ? '#4b5563' : '#fb923c', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '8px', fontWeight: 600, cursor: extracting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                          >
                            {extracting ? 'กำลังให้ AI อ่านและสกัดข้อมูล...' : 'ให้ AI สกัดข้อมูลลงฟอร์ม'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <form onSubmit={handleUpload} style={{ display: 'flex', flexDirection: 'column' }}>
                  
                  {/* Section 1: General Info */}
                  <div style={sectionStyle}>
                    <h2 style={sectionTitleStyle}><Book size={20} color="#fb923c" /> ข้อมูลทั่วไป (General Information)</h2>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                      <div style={{ gridColumn: '1 / -1' }}>
                        <label style={labelStyle}>ชื่อเอกสาร (Title)*</label>
                        <input type="text" value={title} onChange={e => setTitle(e.target.value)} required style={inputStyle} />
                      </div>
                      <div>
                        <label style={labelStyle}>หมวดหมู่ (Category)*</label>
                        <select value={category} onChange={e => setCategory(e.target.value)} style={inputStyle}>
                          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={labelStyle}>เลขที่เอกสาร / เลขคดี (Document Number)</label>
                        <input type="text" value={documentNumber} onChange={e => setDocumentNumber(e.target.value)} placeholder="เช่น ฎีกา 2120/2566" style={inputStyle} />
                      </div>
                      <div>
                        <label style={labelStyle}>ปี พ.ศ. (Buddhist Year)</label>
                        <input type="text" value={buddhistYear} onChange={e => setBuddhistYear(e.target.value)} placeholder="เช่น 2566" style={inputStyle} />
                      </div>
                      <div>
                        <label style={labelStyle}>แหล่งที่มา / หน่วยงาน (Agency)</label>
                        <input type="text" value={agency} onChange={e => setAgency(e.target.value)} placeholder="เช่น ศาลฎีกา, กสม." style={inputStyle} />
                      </div>
                      <div>
                        <label style={labelStyle}>ระบบที่มา (Source System)</label>
                        <input type="text" value={sourceSystem} onChange={e => setSourceSystem(e.target.value)} placeholder="เช่น coj.go.th" style={inputStyle} />
                      </div>
                    </div>
                  </div>

                  {/* Section 2: Summaries */}
                  <div style={sectionStyle}>
                    <h2 style={sectionTitleStyle}><FileText size={20} color="#fb923c" /> สรุปเนื้อหา (Summaries)</h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                      <div>
                        <label style={{...labelStyle, color: '#fb923c'}}>✨ สรุปสั้นโดย RAG (Short Summary)</label>
                        <textarea 
                          value={shortSummary} onChange={e => setShortSummary(e.target.value)} 
                          placeholder="สรุปประเด็นสำคัญความยาวไม่เกิน 3-4 บรรทัด (หากเว้นว่าง ระบบจะสร้างให้อัตโนมัติในภายหลัง)" 
                          style={{...inputStyle, minHeight: '80px', resize: 'vertical'}} 
                        />
                      </div>
                      <div>
                        <label style={labelStyle}>ย่อยาว / สาระสำคัญ (Long Summary)</label>
                        <textarea 
                          value={longSummary} onChange={e => setLongSummary(e.target.value)} 
                          placeholder="เนื้อหาสาระสำคัญแบบละเอียด" 
                          style={{...inputStyle, minHeight: '150px', resize: 'vertical'}} 
                        />
                      </div>
                    </div>
                  </div>

                  {/* Section 3: Timeline */}
                  <div style={sectionStyle}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                      <h2 style={{...sectionTitleStyle, margin: 0}}><Clock size={20} color="#fb923c" /> ลำดับเหตุการณ์ (Timeline)</h2>
                      <button type="button" onClick={addTimeline} style={{ background: 'transparent', border: '1px solid #fb923c', color: '#fb923c', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem' }}>
                        <Plus size={14} /> เพิ่มเหตุการณ์
                      </button>
                    </div>
                    
                    {timeline.length === 0 ? (
                      <div style={{ color: '#6b7280', fontSize: '0.9rem', textAlign: 'center', padding: '20px' }}>ยังไม่มีการระบุลำดับเหตุการณ์</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {timeline.map((event, idx) => (
                          <div key={idx} style={{ background: '#252830', padding: '16px', borderRadius: '12px', position: 'relative' }}>
                            <button type="button" onClick={() => removeTimeline(idx)} style={{ position: 'absolute', top: '16px', right: '16px', background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}>
                              <Trash2 size={16} />
                            </button>
                            <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1fr', gap: '12px', marginBottom: '12px', paddingRight: '24px' }}>
                              <input type="text" placeholder="ลำดับ" value={event.order} onChange={e => updateTimeline(idx, 'order', e.target.value)} style={inputStyle} />
                              <input type="text" placeholder="ชื่อเหตุการณ์" value={event.title} onChange={e => updateTimeline(idx, 'title', e.target.value)} style={inputStyle} />
                              <input type="text" placeholder="คำอธิบายย่อย (Subtitle)" value={event.subtitle} onChange={e => updateTimeline(idx, 'subtitle', e.target.value)} style={inputStyle} />
                            </div>
                            <textarea placeholder="รายละเอียด" value={event.description} onChange={e => updateTimeline(idx, 'description', e.target.value)} style={{...inputStyle, minHeight: '60px'}} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Section 4: Related Laws */}
                  <div style={sectionStyle}>
                    <h2 style={sectionTitleStyle}><Book size={20} color="#fb923c" /> กฎหมายที่อ้าง (Related Laws)</h2>
                    
                    <div style={{ marginBottom: '24px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <label style={{...labelStyle, marginBottom: 0}}>ตราสารระหว่างประเทศที่เกี่ยวข้อง</label>
                        <button type="button" onClick={() => setRelatedInternationalLaws([...relatedInternationalLaws, ''])} style={{ background: 'transparent', border: '1px solid #fb923c', color: '#fb923c', padding: '4px 10px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem' }}>
                          <Plus size={12} /> เพิ่ม
                        </button>
                      </div>
                      {relatedInternationalLaws.length === 0 ? (
                        <div style={{ color: '#6b7280', fontSize: '0.9rem', padding: '12px', background: '#252830', borderRadius: '8px' }}>ยังไม่มีการระบุตราสารระหว่างประเทศ</div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          {relatedInternationalLaws.map((law, idx) => (
                            <div key={idx} style={{ display: 'flex', gap: '12px' }}>
                              <input type="text" placeholder="เช่น กติการะหว่างประเทศว่าด้วยสิทธิพลเมืองและการเมือง (ICCPR)" value={law} onChange={e => {
                                const newLaws = [...relatedInternationalLaws];
                                newLaws[idx] = e.target.value;
                                setRelatedInternationalLaws(newLaws);
                              }} style={inputStyle} />
                              <button type="button" onClick={() => setRelatedInternationalLaws(relatedInternationalLaws.filter((_, i) => i !== idx))} style={{ background: '#374151', border: 'none', color: '#ef4444', borderRadius: '8px', width: '46px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                                <Trash2 size={16} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <label style={{...labelStyle, marginBottom: 0}}>กฎหมายไทยที่เกี่ยวข้อง</label>
                        <button type="button" onClick={() => setRelatedThaiLaws([...relatedThaiLaws, ''])} style={{ background: 'transparent', border: '1px solid #fb923c', color: '#fb923c', padding: '4px 10px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem' }}>
                          <Plus size={12} /> เพิ่ม
                        </button>
                      </div>
                      {relatedThaiLaws.length === 0 ? (
                        <div style={{ color: '#6b7280', fontSize: '0.9rem', padding: '12px', background: '#252830', borderRadius: '8px' }}>ยังไม่มีการระบุกฎหมายไทย</div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          {relatedThaiLaws.map((law, idx) => (
                            <div key={idx} style={{ display: 'flex', gap: '12px' }}>
                              <input type="text" placeholder="เช่น รัฐธรรมนูญแห่งราชอาณาจักรไทย พุทธศักราช 2560 มาตรา 4" value={law} onChange={e => {
                                const newLaws = [...relatedThaiLaws];
                                newLaws[idx] = e.target.value;
                                setRelatedThaiLaws(newLaws);
                              }} style={inputStyle} />
                              <button type="button" onClick={() => setRelatedThaiLaws(relatedThaiLaws.filter((_, i) => i !== idx))} style={{ background: '#374151', border: 'none', color: '#ef4444', borderRadius: '8px', width: '46px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                                <Trash2 size={16} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Section 5: Related Persons */}
                  <div style={sectionStyle}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                      <h2 style={{...sectionTitleStyle, margin: 0}}><User size={20} color="#fb923c" /> บุคคล/หน่วยงานที่เกี่ยวข้อง (Related Persons)</h2>
                      <button type="button" onClick={addPerson} style={{ background: 'transparent', border: '1px solid #fb923c', color: '#fb923c', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem' }}>
                        <Plus size={14} /> เพิ่มบุคคล
                      </button>
                    </div>

                    {relatedPersons.length === 0 ? (
                      <div style={{ color: '#6b7280', fontSize: '0.9rem', textAlign: 'center', padding: '20px' }}>ยังไม่มีการระบุบุคคลที่เกี่ยวข้อง</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {relatedPersons.map((person, idx) => (
                          <div key={idx} style={{ display: 'grid', gridTemplateColumns: '150px 1fr 40px', gap: '12px', alignItems: 'start' }}>
                            <input type="text" placeholder="บทบาท เช่น โจทก์" value={person.role} onChange={e => updatePerson(idx, 'role', e.target.value)} style={inputStyle} />
                            <input type="text" placeholder="รายชื่อ (คั่นด้วยลูกน้ำ , เช่น นาย ก, นาย ข)" value={person.names} onChange={e => updatePerson(idx, 'names', e.target.value)} style={inputStyle} />
                            <button type="button" onClick={() => removePerson(idx)} style={{ background: '#374151', border: 'none', color: '#ef4444', borderRadius: '8px', height: '46px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                              <Trash2 size={16} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Section 6: File Upload & Submit */}
                  <div style={sectionStyle}>
                    <h2 style={sectionTitleStyle}><Upload size={20} color="#fb923c" /> ไฟล์เอกสารต้นฉบับ</h2>
                    <div style={{ 
                      border: '2px dashed #4b5563', borderRadius: '12px', padding: '40px 20px', textAlign: 'center', 
                      background: '#181a20', cursor: 'pointer', position: 'relative'
                    }}>
                      <input 
                        type="file" 
                        accept=".pdf,.docx,.doc,.md,.txt,.zip"
                        onChange={e => setFile(e.target.files?.[0] || null)}
                        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
                        required
                      />
                      <Upload size={32} color="#6b7280" style={{ marginBottom: '12px' }} />
                      <div style={{ fontWeight: 500, color: '#d1d5db', marginBottom: '8px' }}>
                        {file ? file.name : 'ลากไฟล์มาวาง หรือคลิกเพื่อเลือกไฟล์ (บังคับ)*'}
                      </div>
                      <div style={{ fontSize: '13px', color: '#9ca3af' }}>
                        รองรับ .pdf, .docx, .md, .txt
                      </div>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                    <button 
                      type="submit" 
                      disabled={loading}
                      style={{ 
                        padding: '16px 32px', background: loading ? '#4b5563' : '#f97316', color: 'white', 
                        border: 'none', borderRadius: '12px', fontWeight: 600, fontSize: '1.1rem', cursor: loading ? 'not-allowed' : 'pointer',
                        boxShadow: '0 4px 14px rgba(249, 115, 22, 0.4)'
                      }}
                    >
                      {loading ? 'กำลังบันทึกและประมวลผลข้อมูล...' : 'บันทึกและนำเข้าข้อมูล (Save & Ingest)'}
                    </button>
                  </div>
                </form>
              </div>
            )}

              {activeTab === 'existing' && (
                <div style={sectionStyle}>
                  <h2 style={{ fontSize: '20px', margin: '0 0 24px 0', color: '#f3f4f6' }}>ค้นหาเอกสารเดิมในระบบ</h2>
                  <div style={{ position: 'relative', marginBottom: '24px' }}>
                    <Search size={20} color="#6b7280" style={{ position: 'absolute', left: '16px', top: '14px' }} />
                    <input 
                      type="text" 
                      placeholder="ค้นหาด้วยชื่อเอกสาร หรือ เลขที่เอกสาร..."
                      style={{ width: '100%', padding: '12px 16px 12px 48px', borderRadius: '8px', border: '1px solid #4b5563', fontSize: '15px', background: '#252830', color: '#f3f4f6' }}
                    />
                  </div>
                  <div style={{ padding: '40px 20px', textAlign: 'center', color: '#9ca3af', border: '1px dashed #4b5563', borderRadius: '12px', background: '#181a20' }}>
                    พิมพ์คำค้นหาเพื่อดึงข้อมูลเอกสารเดิมมาแก้ไข หรือทำการ Embedding ใหม่อีกครั้ง
                  </div>
                </div>
              )}
            </div>
          </div>
      </div>
    </div>
  );
}
