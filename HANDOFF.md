# HANDOFF — NHRC Hybrid RAG (Obsidian → Web)

เอกสารส่งต่องานให้ Claude Code ทำต่อ
วันที่: 2 ส.ค. 2569

---

## บริบท

โปรเจกต์เดิม (`human-rights-rag`) เป็น RAG แบบ local: Streamlit + ChromaDB + Ollama
เป้าหมายใหม่คือทำให้ค้นหาและแสดงผลได้แบบ fourcorners.law — คือมีทั้ง
**structured filter** (ปี / ประเด็นสิทธิ / ประเภทเอกสาร) และ **semantic search** ควบคู่กัน
แล้วเปิดเป็นเว็บสาธารณะ

แหล่งข้อมูล: Obsidian vault ที่ `D:\back up\รายงานและข้อเสนอแนะ กสม`
โครงสร้าง: `01 โปรเจกต์` / `02 ประเด็นสิทธิ (A–E)` / `03 กรณีตรวจสอบ (ปี 2563–2569)`

---

## สิ่งที่ทำไปแล้ว

### ฝั่ง Python
| ไฟล์ | หน้าที่ | สถานะ |
|---|---|---|
| `src/obsidian_parser.py` | อ่าน .md จาก vault → metadata dict | ✅ parse ได้ 411 ไฟล์ (410 unique หลัง dedupe) — parse frontmatter + infer area_code + Thai tokenization ผ่าน pythainlp (แก้บั๊ก #3, #4) |
| `src/json_index.py` | index แบบ JSON + filter/stats | ✅ ทดสอบแล้ว |
| `src/structured_index.py` | index แบบ SQLite | ⚠️ เขียนแล้วแต่ **ใช้ไม่ได้** (disk I/O error บน mount) — ใช้ `json_index.py` แทน |
| `src/hybrid_search.py` | รวม structured + semantic | ⚠️ เขียน interface แล้วแต่ **ยังไม่ได้ต่อกับ ChromaDB จริง** |
| `setup_obsidian_index.py` | สคริปต์ setup | ✅ รันสำเร็จบน Windows แล้ว, เปลี่ยนไปใช้ `JSONIndex` เขียนตรงไปที่ `data/nhrc_index.json` + แยก content ออกไป `data/nhrc_content/` (บั๊ก #5) |

ผลลัพธ์: `data/nhrc_index.json` (410 เอกสาร, 1.17 MB — ไม่มี `content` แล้ว)
กับ `data/nhrc_content/*.txt` (410 ไฟล์ full text แยกต่างหาก, ~11 MB รวม)

```
case_note: 285 | general: 99 | topic: 25 | project: 1
by area (topic + case_note รวมกัน): A:88 B:168 C:20 D:5 E:13
case_note ที่มี area_code แล้ว: 270/285 (94.7%) — เดิมเป็น null ทั้งหมด (บั๊ก #3, แก้แล้ว)
cases by ปี พ.ศ.: 2563:3 2564:60 2565:20 2566:62 2567:64 2568:68 2569:8
```

area_code ของ case note ตอนนี้มาจากการไขว้ (cross-reference) รายการ
"กรณีตรวจสอบที่เกี่ยวข้อง" ที่ไฟล์ topic แต่ละไฟล์ใน `02 ประเด็นสิทธิ` เก็บ backlink
ไปหา case note ไว้อยู่แล้ว (wikilink target ตรงกับชื่อไฟล์ case แบบตรงตัว)
ส่วน 15 เคสที่ยังไม่มี area_code คือกรณีที่ยังไม่ถูกอ้างอิงกลับจาก topic file ใด ๆ

### ฝั่ง Next.js (`web/`)
| ไฟล์ | หน้าที่ | สถานะ |
|---|---|---|
| `src/lib/nhrc/repository.ts` | shared repository (index + content + ranking) | ✅ ใหม่ — รวม logic เดิมที่ซ้ำกัน 3 ที่เข้าเป็นที่เดียว |
| `src/app/api/search/hybrid/route.ts` | search endpoint | ✅ ใช้ shared repository แล้ว |
| `src/app/api/case/[id]/route.ts` | รายละเอียดกรณี + related | ✅ ใช้ shared repository แล้ว |
| `src/app/api/stats/route.ts` | สถิติ | ✅ ใช้ shared repository แล้ว |
| `src/app/api/ask-nhrc/route.ts` | ถามคำถามภาษาธรรมชาติ → คำตอบพร้อม citation | ✅ ใหม่ — ดูหัวข้อ "Ask NHRC" ด้านล่าง |
| `src/lib/nhrc/types.ts` | client-safe types/constants (`NhrcDocument`, `DOCUMENT_CATEGORIES`) | ✅ ใหม่ — แยกออกจาก `repository.ts` เพราะ client component import `fs` ไม่ได้ |
| `src/lib/nhrc/legal-refs.ts` | AI แนะนำตราสาร/กฎหมายที่เกี่ยวข้อง (unverified) | ✅ ใหม่ — ดูหัวข้อ "Legal refs" ด้านล่าง |
| `src/app/api/case/[id]/legal-refs/route.ts` | wrapper เรียก legal-refs.ts ผ่าน HTTP (เผื่ออนาคต) | ✅ ใหม่ — หน้า case detail เรียก legal-refs.ts ตรง ๆ (server-side) ไม่ผ่าน route นี้ |
| `src/components/nhrc-workspace.tsx` | หน้าแรก (welcome + browse + chat, 3 โหมด) | ✅ เพิ่มตัวกรองประเภทเอกสาร + AI toggle checkbox + suggestion pills |
| `src/components/nhrc-case-card.tsx` | การ์ดกรณีในหน้า browse | ✅ ธีมมืดแล้ว |
| `src/components/header.tsx` | เมนูบนสุด (ใช้ร่วมทุกหน้า) | ✅ ธีมมืดแล้ว, ตัดเมนู "งานเรื่องร้องเรียน"/"นำเข้าเอกสาร" ออก (ยังไม่เสร็จ/ไม่จำเป็นแล้วเพราะใช้ Obsidian) |
| `src/app/case/[id]/page.tsx` | หน้ารายละเอียดกรณี | ✅ ธีมมืดแล้ว (เดิมใช้ theme สว่างของ `search-experience.tsx`) |
| `src/app/chat-workspace.css` | สไตล์ธีมมืด (สืบทอดจาก ChatWorkspace เดิม) | ✅ เพิ่ม class ใหม่: `.cw-select`, `.cw-case-*`, `.cw-detail-*` |
| `src/app/knowledge/dashboard/page.tsx` | สถิติ | ✅ |

**เปลี่ยนสไตล์ทั้งหน้าแรกและหน้ารายละเอียดกรณีเป็นธีมมืดแบบ ChatWorkspace**
(sidebar ดำ, สีส้ม accent, การ์ดโค้งมน) ตามที่ผู้ใช้ขอ — อิงจาก 3 ภาพตัวอย่างที่ผู้ใช้ส่งมา
(หน้าแรก, หน้ารายละเอียดเอกสาร, หน้าแชท+citation) ของ deploy เก่าที่
https://human-rights-rag-enje-chi.vercel.app/ หน้าแรกตอนนี้มี **3 โหมดในหน้าเดียว**:
- **Welcome** (ค่าเริ่มต้นตอนเปิดหน้า): หัวข้อ "HumanRights RAG" + คำอธิบาย + ปุ่มคำถามตัวอย่าง
  4 ปุ่ม + checkbox "เปิดใช้งาน AI ช่วยสรุปคำตอบ" (คุม `useAI` ที่ส่งไป `/api/ask-nhrc`)
- **Browse mode**: คลิกตัวกรอง sidebar (**ประเภทเอกสาร**, ประเด็นสิทธิ A-E, ปี พ.ศ.) → เห็น
  รายการกรณีทันที ไม่ต้องพึ่ง AI
- **Chat mode**: พิมพ์คำถามหรือคลิกปุ่มตัวอย่าง → เรียก `/api/ask-nhrc` (ส่ง filter ปัจจุบัน
  เป็น scope ด้วย) ได้คำตอบสรุปพร้อม citation แบบ chat bubble + panel อ้างอิงด้านขวา
  (แต่ละใบมี "✨ สรุปโดย RAG" + ปุ่ม "ดูรายละเอียด" ตามตัวอย่างที่ส่งมา)

ปุ่ม "เริ่มใหม่" กลับไปที่ welcome mode เสมอ

ไฟล์เดิมที่ถูกลบเพราะซ้ำซ้อน: `nhrc-search-experience.tsx` (theme สว่าง, ถูกแทนที่)

### ตัวกรอง "ประเภทเอกสาร" (taxonomy คงที่ 8 หมวด)
`src/lib/nhrc/types.ts` กำหนด `DOCUMENT_CATEGORIES` เป็น array คงที่ 8 หมวดตามที่ผู้ใช้ต้องการ
โชว์ครบทุกหมวดใน sidebar แม้บางหมวดยังไม่มีข้อมูล (เลข count = 0) — parser (`obsidian_parser.py`)
map จากโฟลเดอร์ต้นทางเป็น `category`:
- `03 กรณีตรวจสอบ` → "รายงานตรวจสอบ/ข้อเสนอแนะ กสม." (285 กรณี)
- `04 คลังงานวิจัย` → "งานวิจัย" (82 ไฟล์)
- topic (`02 ประเด็นสิทธิ`) และไฟล์ loose อื่น ๆ ที่ root → `category: null` (ไม่เข้าหมวดไหน
  ในระบบ taxonomy นี้ ยังกรองผ่านประเด็นสิทธิ A-E ได้ตามปกติ)
- อีก 5 หมวด (รายงานประเมินสถานการณ์, กฎหมายไทย/สากล, คำพิพากษา) — **ยังไม่มีข้อมูลใน
  Obsidian vault เลย** ผู้ใช้ระบุว่าโฟลเดอร์ "รายงานประเมินสถานการณ์" มีไฟล์อยู่แล้วแต่ยัง
  ไม่ได้ import เข้า vault — เมื่อ import แล้ว parser ต้องเพิ่ม mapping ให้โฟลเดอร์นั้นด้วย
  (ตอนนี้ยังไม่รู้ชื่อโฟลเดอร์ที่แน่นอนใน vault จึงยังไม่ได้เพิ่ม logic)

### Legal refs (`src/lib/nhrc/legal-refs.ts`) — AI แนะนำกฎหมาย/ตราสารที่เกี่ยวข้อง ⚠️ unverified
หน้ารายละเอียดกรณีตอนนี้มี 2 ส่วนที่ Claude ช่วยสร้างให้ (ตามที่ผู้ใช้ยืนยันรับความเสี่ยงเอง
"เดี๋ยวผมตามแก้ทีหลัง"):
1. กล่องสรุปสั้น "✨ สรุปโดย AI" (เนื้อหาหลัก, เหนือรายละเอียดเต็ม)
2. sidebar "กฎหมาย/ตราสารที่เกี่ยวข้อง" — แยก **ตราสารระหว่างประเทศ** กับ **กฎหมายไทย**

ทั้งสองส่วน **มีข้อความกำกับชัดเจนว่า "แนะนำโดย AI ... ยังไม่ผ่านการตรวจสอบ โปรดยืนยันก่อน
อ้างอิงจริง"** ห้ามเอาข้อความนี้ออกจนกว่าจะมีการตรวจสอบข้อมูลจริงแล้ว เพราะ AI อาจสร้างชื่อ
กฎหมาย/มาตราที่ไม่มีอยู่จริง (hallucination) — ระบบ cache ผลไว้ใน memory ต่อ process (reset
เมื่อ restart server ไม่ persist ที่ไหน) ป้องกันเรียก Claude ซ้ำทุกครั้งที่เปิดหน้าเดิม

**แนวทางระยะยาวตามที่ผู้ใช้บอกไว้**: จะเข้าไปแก้/ยืนยันข้อมูลจริงใน Obsidian frontmatter เอง
ทีหลัง (เช่น เพิ่ม field `international_instruments` / `thai_laws` ใน frontmatter case note)
ตอนนั้นค่อยเปลี่ยนจาก AI-suggest มาเป็นอ่านจาก field จริงแทน

### เมนูบนสุด (Header) — ตัดออก 2 เมนู + เปลี่ยนธีมมืด
`src/components/header.tsx` ตอนนี้เหลือแค่ "ค้นเอกสาร" กับ "สถิติ กสม." — ตัด "งานเรื่องร้องเรียน"
(`/cases`) และ "นำเข้าเอกสาร" (`/admin/import`) ออกจากเมนู เพราะผู้ใช้ยืนยันว่า:
- งานเรื่องร้องเรียน (case management) ยังพัฒนาไม่เสร็จ
- นำเข้าเอกสาร (admin import ไปที่ Supabase `documents` table) ไม่จำเป็นแล้วเพราะใส่ข้อมูล
  ผ่าน Obsidian แทน

**หน้า `/cases` และ `/admin/import` เองยังไม่ได้ลบ** (แค่เอาลิงก์ในเมนูออก) เข้าตรง URL ได้อยู่
ถ้าจะลบทิ้งจริงต้องให้ผู้ใช้ยืนยันอีกที เพราะเป็นฟีเจอร์คนละชุดที่อาจเอากลับมาทำต่อ

**ธีมมืดของ Header เป็น site-wide** (แก้ `.site-header` ตรง ๆ ใน CSS ไม่ได้ทำ dark/light 2 เวอร์ชัน)
จึงกระทบหน้า `/cases`, `/admin/import`, `/documents/[id]` ด้วยแม้ไม่ได้แก้เนื้อหาข้างในหน้าเหล่านั้น

### รู้แล้วแต่ยังไม่แก้ (นอกสโคปรอบนี้)
- `/knowledge/dashboard` (หน้าสถิติ) ยังใช้พื้นหลังธีมสว่าง (`var(--paper)`) ใต้ Header
  ธีมมืดอันใหม่ — มองแล้วไม่เข้ากัน แต่ผู้ใช้ไม่ได้พูดถึงหน้านี้ในรอบนี้ ยังไม่แก้
- `/documents/[id]`, `/documents`, ระบบ `search-experience.tsx`/`document-card.tsx`
  (Supabase-based, ไม่เกี่ยวกับ NHRC Obsidian) ยังอยู่เหมือนเดิม ไม่ได้แตะ

### ชื่อแบรนด์ — เลือก "ค้นหาสิทธิ"
Header กับ sidebar ของ `nhrc-workspace.tsx` เคยใช้ชื่อคนละชื่อ ("ค้นหาสิทธิ" vs "HumanRights")
บนหน้าเดียวกัน — เลือก **"ค้นหาสิทธิ"** เป็นชื่อเดียวทั้งเว็บ (ภาษาไทย เข้ากับกลุ่มผู้ใช้ที่เป็น
เจ้าหน้าที่/ประชาชนไทย และเนื้อหาทั้งเว็บเป็นภาษาไทยอยู่แล้ว ตัด "HumanRights RAG" ออกเพราะ
"RAG" เป็นศัพท์เทคนิคที่ผู้ใช้ทั่วไปไม่คุ้น)

### หน้ารายละเอียดกรณี — แก้ตามภาพตัวอย่างที่ส่งมา
- ตัด "ตัวอย่างโจทย์วิจัยที่เป็นไปได้" ออกจากทุกกรณี (ไม่ใช่เนื้อหากรณีจริง)
- เรียงหัวข้อใหม่ตามลำดับการเล่าเรื่อง: รายละเอียด → พฤติการณ์ที่วินิจฉัยว่าละเมิด →
  กลุ่มผู้ถูกละเมิดสิทธิ → ประเด็นสิทธิที่เกี่ยวข้อง → ช่องโหว่/สาเหตุของการละเมิด
  (`SECTION_ORDER` ใน `case/[id]/page.tsx` — ก่อนหน้านี้ทั้ง 285 กรณีเรียงตามลำดับเดิม
  ในไฟล์เหมือนกันหมดอยู่แล้ว แค่ลำดับนั้นไม่ใช่ลำดับที่อ่านเข้าใจง่ายที่สุด)
- **"เปิดรายงานฉบับเต็ม" เปิดลิงก์ได้จริงแล้ว** — ไม่ใช่ wikilink ที่ค้างจากไฟล์ markdown
  อีกต่อไป ไปหาไฟล์ PDF จริงและ serve ผ่าน `/api/case/[id]/document`:
  - **กรณีตรวจสอบ**: PDF สแกนต้นฉบับไม่ได้อยู่ในโฟลเดอร์เดียวกับไฟล์ .md แต่อยู่ในโฟลเดอร์
    "ปี XXXX" คู่ขนานที่ root ของ vault (ชื่อไฟล์เดียวกัน ตัด " - บันทึก" ออก) — เจอ 356/380
    ไฟล์ (93.7%) `_find_case_pdf()` ใน `obsidian_parser.py` เป็นคน map ให้
  - **รายงานประเมินสถานการณ์**: PDF อยู่ในโฟลเดอร์เดียวกับ .md เลย (ครบทุกปีที่มีไฟล์ .md)
  - PDF ที่เจอถูกคัดลอกเข้า `data/nhrc_documents/<document_id>.pdf` ตอนรัน
    `setup_obsidian_index.py` (เพิ่ม gitignore ไว้แล้วเหมือน `nhrc_content/`)
  - กรณีที่หาไฟล์ไม่เจอ ปุ่มจะโชว์ "ยังไม่มีไฟล์ต้นฉบับ" แบบ disabled แทนลิงก์เสีย

### กล่อง "สรุปโดย RAG" ใน panel อ้างอิง (หน้าแชท) — ลบทิ้งแล้ว
เดิมโค้ดตัด excerpt ที่ 40% ของความยาวตัวอักษรมาใส่กล่อง "สรุปโดย RAG" แบบกลไก (ไม่ใช่ AI
สรุปจริง) ทำให้ข้อความขาดกลางประโยคอ่านไม่รู้เรื่องตามที่ผู้ใช้ทักท้วงมา (พร้อมภาพหน้าจอ) —
เอาออกแล้ว เหลือแค่ excerpt เดียวอ่านได้ต่อเนื่อง (`.cw-ref-excerpt`) ไม่ทำสรุปย่อยแยกต่อ
citation อีก (ถ้าต้องการจริง ๆ ทีหลังต้องเรียก Claude แยกต่อกรณี ซึ่งมีต้นทุน/เวลาเพิ่ม)

### Import "รายงานประเมินสถานการณ์" เข้าระบบ
ไฟล์เหล่านี้**อยู่ใน vault อยู่แล้ว** (`รายงานประเมินสถานการณ์/รายงานผลการประเมินสถานการณ์-YYYY.md`
ที่ root ของ vault) แค่ parser เดิมไม่รู้จักโฟลเดอร์นี้ (ไม่ตรง prefix 01-05) เลยตกไปเป็น "general"
เพิ่ม `_parse_situation_report()` ให้แล้ว:
- มีเฉพาะปี 2564-2567 (4 ไฟล์ .md) — **ปี 2568 มีแต่ .pdf ไม่มี .md** ถ้าจะให้ขึ้นในระบบต้องมี
  ไฟล์ .md คู่กันด้วย (แปลง PDF เป็น markdown เพิ่ม)
- เนื้อหาที่ดึงมาจาก .md เป็นข้อความที่แปลงจาก PDF ตรง ๆ **ตัวอักษรเพี้ยนเยอะมาก** (เช่น
  "ประเมิินสถานการณ์์" ซ้ำวรรณยุกต์/สระ) และไม่มี YAML frontmatter หรือหัวข้อ "##" เหมือน
  case note เลย — เพราะสภาพเอกสารต่างกันจริงตามที่ผู้ใช้เตือนไว้ จึงจัดการต่างจาก case note:
  - `summary` เป็นข้อความที่เขียนเองสั้น ๆ (ไม่ใช้ text ที่ดึงมาเพราะเพี้ยน) ระบุแค่ปีที่จัดทำ
  - `keywords` ใช้ list คงที่ ไม่ tokenize จากเนื้อหา (จะได้ขยะจาก OCR)
  - หน้าเว็บ (`case/[id]/page.tsx`) แยกสาขาการแสดงผลด้วย `document_type === "situation_report"`:
    ไม่แบ่ง section แบบ case note (ไม่มี "##" ให้แบ่ง), ไม่เรียก AI legal-refs (ไม่เข้ากับ
    เอกสารภาพรวมทั้งประเทศ), ไม่โชว์ "กรณีที่เกี่ยวข้อง" (ไม่มี area_code/case_id) — แสดงแค่
    คำอธิบายสั้น + ปุ่มเปิด PDF + sidebar ลิงก์ไปรายงานปีอื่น
- **ถ้าต้องการเนื้อหาที่อ่านได้จริงในหน้าเว็บ (ไม่ใช่แค่เปิด PDF)** ต้องแปลง PDF ใหม่ด้วยเครื่องมือ
  OCR/text-extraction ที่ดีกว่านี้ แล้ว mapping โครงสร้างใหม่ (บทที่/หัวข้อ) — งานนี้ยังไม่ได้ทำ

### แก้บั๊ก 2 อย่างหลัง import รายงานประเมินสถานการณ์/งานวิจัย

**1. หน้ารายละเอียด "รายงานประเมินสถานการณ์" จัดวางเพี้ยน**
สาเหตุ: `.cw-detail-section` เป็น CSS grid 2 คอลัมน์ (`36px 1fr`) ออกแบบไว้สำหรับ
[เลขหัวข้อ (span), เนื้อหา (div)] แต่สาขา non-case-note ใน `case/[id]/page.tsx` render
แค่ `<div>` เดียวไม่มี span เลขหัวข้อ — grid เลยเอา div ไปวางในคอลัมน์แรก (36px) แทน
ทำให้ข้อความทั้งหมดตกไปอยู่ในคอลัมน์แคบ 36px แล้วขึ้นบรรทัดยาวเป็นแท่งสูงผิดปกติ (วัดได้
1731px ทั้งที่เนื้อหามีแค่ 2 ย่อหน้าสั้น ๆ) แก้ด้วย CSS ใน `chat-workspace.css`:
`.cw-detail-section > div:only-child { grid-column: 1 / -1; }`

**2. เอกสาร "งานวิจัย" ชื่อไม่เต็ม + คลิกแล้ว "ไม่พบเอกสาร"**
- **ชื่อไม่เต็ม**: ชื่อไฟล์ .md จริงใน `04 คลังงานวิจัย (Research)` ถูกตัดสั้นเหลือ ~40
  ตัวอักษร (ตัดกลางคำ) มาตั้งแต่ก่อนอยู่ใน vault นี้แล้ว (เช่น
  `2545_องค์กรที่ทำงานด้านสิทธิมนุษยชน หน่วยงานใ.md`) — แต่ชื่อเต็มยังอยู่ใน heading `# ...`
  บรรทัดแรกของเนื้อหาไฟล์เสมอ แก้ `_parse_generic()` ใน `obsidian_parser.py` ให้ดึง title
  จาก heading นั้นแทน `file_path.stem` — **`document_id` ยังคงอิงจากชื่อไฟล์ (ที่ถูกตัด)
  เหมือนเดิม** เพราะปลอดภัยกับ filesystem (ชื่อเต็มมีอักขระที่ Windows ห้ามใช้ในชื่อไฟล์ เช่น
  ":" ซึ่ง document_id เอาไปใช้ตั้งชื่อไฟล์ content/PDF ด้วย)
- **คลิกแล้ว 404**: Next.js dynamic route `params.id` ไม่ decode percent-encoding ให้เอง
  สำหรับ document_id ที่มีอักขระไทย (ต่างจาก case note ที่ id เป็นตัวเลขล้วนเลยไม่เจอปัญหานี้)
  `getCaseById()` เทียบ id ตรง ๆ กับ `doc.document_id` จึงไม่ match เพราะฝั่งหนึ่งยัง
  percent-encoded อยู่ แก้ใน `repository.ts`: `getCaseById()` ลอง `decodeURIComponent(id)`
  เพิ่มอีกทางเลือกก่อนเทียบ (ครอบคลุมทั้ง `/case/[id]/page.tsx` และ
  `/api/case/[id]/document` เพราะทั้งคู่เรียกเมธอดเดียวกันนี้)
- ระหว่างแก้ยังเจอว่า `summary` ของเอกสารกลุ่มนี้เป็นข้อความ markdown ดิบ (`# title`,
  `**bold**`, `##`) เพราะเดิมตัดมาจาก `content[:500]` ตรง ๆ — เพิ่ม `_extract_section()`
  ดึงเนื้อหาใต้หัวข้อ `## สาระสำคัญ` แทน (มีครบทุกไฟล์ใน 04 คลังงานวิจัย ตรวจแล้ว 82/82)
  ได้ summary ที่เป็นบทคัดย่อจริง อ่านรู้เรื่อง ไม่ใช่ raw markdown

หลัง fix ต้อง **regenerate index** (`python setup_obsidian_index.py`) แล้ว **restart
dev server** — ไม่ใช่แค่ save ไฟล์ เพราะ `NhrcRepository` โหลด `nhrc_index.json` เข้า
memory ครั้งเดียวตอน route ถูกเรียกครั้งแรก ไม่ auto-reload เวลาไฟล์ index เปลี่ยน

### แผนที่ประเด็นสิทธิ (`/knowledge/graph`) - กราฟจาก Obsidian

ผู้ใช้ถามว่าเพิ่มหน้ากราฟ/network visualization จาก Obsidian ได้ไหม - เลือกสโคป
"Topic map" (โหนด = ประเด็นสิทธิ ~23 หัวข้อ + กลุ่มประเด็นใหญ่ A-E, ไม่ใช่กราฟทุกโหนด
แบบ Obsidian graph view จริง ซึ่งจะมีเกิน 400 โหนดและอ่านไม่ออก):

- **ข้อมูล**: `_build_case_area_index()` ใน `obsidian_parser.py` เดิมสแกน backlink ของ
  topic note ใน "02 ประเด็นสิทธิ" อยู่แล้วแต่ทิ้งข้อมูลว่า case อยู่ใน topic ไฟล์ไหน
  (เก็บแค่ area_code A-E) ขยายให้เก็บ `case_topic_index` (case_id -> topic document_id)
  ด้วย เพิ่มเป็นฟิลด์ `topic_ids` ใน case_note documents
- **Export**: `setup_obsidian_index.py` มี step ใหม่ `_export_graph()` สร้าง
  `data/nhrc_graph.json` (ไม่มีข้อมูลส่วนบุคคล มีแค่ชื่อประเด็น/จำนวนกรณี) — โหนด =
  area (5) + topic ที่มีกรณีจริง (23/25 หัวข้อ ตัดที่ไม่มีกรณีออก), edge = area→topic
  (hierarchy) + topic↔topic เมื่อมีกรณีร่วมกัน (`shared_cases`, ใช้ weight ทำเส้นเข้ม/จาง)
- **Backend**: เพิ่ม `topicId` ใน `SearchQuery`/`repository.search()` และ `?topic=` ใน
  `/api/search/hybrid` (คู่กับ `?area=` เดิม) ให้คลิกโหนดในกราฟแล้วดึงรายกรณีได้ทันที
  ผ่าน API เดิม ไม่ต้องสร้าง endpoint ใหม่
- **หน้าเว็บ**: `web/src/components/graph/TopicGraph.tsx` (client component) + force-
  directed layout มือเขียนเอง (`web/src/lib/nhrc/force-layout.ts`, ไม่ใช้ library
  ภายนอกเพราะกราฟเล็กแค่ ~28 โหนด) render เป็น SVG ธรรมดา ลากโหนดได้,
  คลิกโหนด (`role="button"` + keyboard) เปิด panel รายชื่อกรณีทางขวา เชื่อมไปหน้า
  `/case/[case_id]` เดิม
- **การจัด layout**: ลองใช้ force simulation (mutual repulsion + spring edges) ก่อน
  ทั้งแบบ inverse-linear และ inverse-square repulsion ผลคือโหนดกระจายไปเกาะขอบผืนผ้า
  เป็นวงแหวนทั้งคู่ (topic ส่วนใหญ่มีแค่ 1 edge ไปหา area ของตัวเอง แต่โดน repulsion จาก
  โหนดอื่นอีก 27 โหนด แรงผลักเลยชนะแรงดึงเข้ากลุ่มเสมอ) **เปลี่ยนแนวทางทั้งหมด** เป็น
  deterministic radial-cluster layout แทน (`force-layout.ts`): วาง area ทั้ง 5 เป็นวงกลม
  ใหญ่รอบจุดศูนย์กลาง แล้ววาง topic ของแต่ละ area เป็น "กลีบดอก" รอบ area นั้นโดยตรง
  (ตำแหน่งคำนวณตรง ๆ ไม่ต้องพึ่ง physics) จากนั้นรัน collision-resolution แบบเบา ๆ
  (60 iteration, ผลักเฉพาะคู่ที่ทับกันจริง + spring ดึงกลับตำแหน่งตั้งต้นของตัวเอง) แค่
  แก้การทับซ้อนโดยไม่ทำลายรูปทรงกลุ่ม ผลคือแต่ละ area เห็นเป็นกลุ่มชัดเจน ไม่ติดขอบ
- **บั๊กลากโหนดไม่ได้**: ของจริง ไม่ใช่แค่ทดสอบผิด - browser ปฏิบัติกับ mousedown+move บน
  SVG `<text>`/shape เป็น native text-selection หรือ ghost-image drag โดย default ทำให้
  ลำดับ pointer event ถูกขัดจังหวะ (pointermove handler เลยไม่ทำงานต่อ ดูเหมือนโหนดค้าง)
  แก้ด้วย `e.preventDefault()` ใน `onPointerDown`/`onPointerMove`, `user-select: none` +
  `-webkit-user-drag: none` บน svg, และ `pointer-events: none` บน `<text>` (ให้คลิกทะลุ
  ไปโดน circle แทนเสมอ ไม่ใช่ text) ระวัง: เวลาเทสฟีเจอร์ลากด้วย synthetic PointerEvent
  ต้องอ่านค่าตำแหน่งหลังจาก dispatch ใน **tool call แยกต่างหาก** เพราะ React batch
  state update แบบ async - อ่านทันทีในบล็อกเดียวกันจะเห็นค่าเก่ายังไม่อัปเดต (หลอกว่าลาก
  ไม่ได้ทั้งที่จริง ๆ ทำงานถูกแล้ว)
- **ไม่ทำ**: ยังไม่เชื่อม "งานวิจัย" (general docs) เข้ากราฟ แม้ในเนื้อหาจะมี wikilink
  ไปยัง topic ผ่านหัวข้อ "## ประเด็นสิทธิที่เกี่ยวข้อง" อยู่แล้ว เพราะต้อง parse wikilink
  เพิ่ม (user เลือกสโคปที่ไม่ต้องทำแบบนี้) - ถ้าต้องการทีหลังคือจุดเริ่มที่ควรทำต่อ

### บั๊ก: หน้ารายละเอียด "งานวิจัย" โชว์ "รายงานปีอื่น" ผิดที่

`case/[id]/page.tsx` เดิมแยกสาขา sidebar แค่ 2 ทาง (`isCaseNote` / ไม่ใช่) แต่ "ไม่ใช่
case_note" ครอบคลุมทั้ง `situation_report` และ `general` (งานวิจัย) เอกสารทั้งสองแบบเลย
โดน sidebar เดียวกัน ("รายงานปีอื่น" ที่ query `docType: situation_report`) ทั้งที่
งานวิจัยควรโชว์งานวิจัยเรื่องอื่นที่เกี่ยวข้องกัน ไม่ใช่รายงานประจำปี

แก้โดยแยกเป็น 3 สาขา (`isCaseNote` / `isSituationReport` / `isGeneral`):
- เพิ่ม `repository.ts`'s `getRelatedDocuments(documentId, docType, limit)` — สรุป logic
  เดิมของ `getRelatedCases()` (คะแนนจาก area/keyword/year overlap) ให้ใช้กับ document_type
  ไหนก็ได้ ไม่ใช่แค่ case_note (`getRelatedCases()` ตอนนี้เป็นแค่ wrapper เรียกอันนี้)
  เอกสารงานวิจัยไม่มี area_code (เป็น None เสมอ) เลยจัดอันดับด้วย keyword overlap เป็นหลัก
- `case/[id]/page.tsx`: `isGeneral` เรียก `getRelatedDocuments(id, "general", 10)` แสดงเป็น
  "งานวิจัยที่เกี่ยวข้อง (คำสำคัญใกล้เคียง)" แทน "รายงานปีอื่น"
- `RelatedList` component เดิม fallback เป็น `พ.ศ. ${c.year_buddhist}` เวลาไม่มี case_id
  ซึ่งพัง (โชว์ "พ.ศ. undefined") เพราะ general docs ไม่มีทั้ง case_id และ year_buddhist —
  แก้ให้ไม่ render span นั้นเลยถ้าไม่มีทั้งคู่

### Ask NHRC (`/api/ask-nhrc`)
ถาม-ตอบแบบ grounded RAG บน index กสม. ของเราเอง (ไม่พึ่ง Supabase):
1. `repository.findRelevantCases()` — ให้คะแนนกรณีจาก keyword overlap กับคำถาม
   (นับจำนวน keyword ที่ curated ไว้แล้วที่ปรากฏในคำถาม) ไม่มี embeddings เพราะ
   ยังไม่ได้ต่อ ChromaDB (บั๊ก #6)
2. ส่ง excerpt ของกรณีที่ match ให้ **Claude Haiku 4.5** (`@anthropic-ai/sdk`)
   สรุปคำตอบภาษาไทยพร้อม citation [1][2] — เลือก Haiku เพราะถูกและเร็วพอสำหรับงาน
   สรุปสั้น ไม่ต้อง reasoning ซับซ้อน
3. ถ้าไม่มี `ANTHROPIC_API_KEY` หรือเรียก Claude แล้ว error (เช่น key ผิด) — **fallback
   เป็น evidence mode อัตโนมัติ** (โชว์กรณีที่ match พร้อมข้อความ ยังไม่เรียบเรียงวิเคราะห์
   แทนที่จะพังทั้งหมด)

**ต้องใส่ `ANTHROPIC_API_KEY` จริงใน `.env.local` ก่อนถึงจะได้คำตอบสรุปจาก AI จริง**
(ตอนนี้ยังเป็น placeholder `your-anthropic-api-key` — ทดสอบแล้วว่า flow ทำงานถูกต้อง
ทั้งหมด รอแค่ key)

### Supabase — เชื่อมต่อสำเร็จแล้ว
`.env.local` เดิมมี `NEXT_PUBLIC_SUPABASE_URL` เป็น placeholder `your-project.supabase.co`
ทำให้ `TypeError: fetch failed` ทุกครั้งที่ ChatWorkspace เดิมเรียกใช้ — ผู้ใช้ให้ URL/key จริงมา
(`wawskkgrsaszikfhejou.supabase.co`) ใส่แล้ว ทดสอบยิง query จริงได้ผลลัพธ์กลับมา (`mode: "cloud"`)
**แต่หน้า ChatWorkspace เดิม (`chat-workspace.tsx`) ไม่ได้ถูกเรียกใช้จากหน้าไหนแล้ว**
(ถูกแทนที่ด้วย `nhrc-workspace.tsx` ที่หน้าแรก) ไฟล์ยังอยู่เผื่ออนาคตอยากเอากลับมาใช้
กับคลังเอกสารชุดใหญ่ (Supabase `documents` table ที่ตั้งใจไว้สำหรับ กฎหมาย/คำพิพากษา/
เอกสาร UN ฯลฯ ซึ่งเป็นคนละชุดข้อมูลกับ Obsidian NHRC case notes)

---

## บั๊กที่รู้แล้ว

### #1 ✅ แก้แล้ว — path ของ index ผิด (ทำให้ API หาไฟล์ไม่เจอ → คืนผลลัพธ์ว่าง)
ทั้ง 3 API routes เขียนว่า:
```ts
path.join(process.cwd(), "../..", "data", "nhrc_index.json")
```
`process.cwd()` ของ Next.js คือโฟลเดอร์ `web/` ดังนั้น `../..` ขึ้นไป 2 ชั้น = `D:\`
**ที่ถูกคือ `".."` ชั้นเดียว** หรือดีกว่านั้นคือใช้ env var:
```ts
const indexPath = process.env.NHRC_INDEX_PATH
  ?? path.join(process.cwd(), "..", "data", "nhrc_index.json");
```

### #2 ✅ แก้แล้ว — Next.js 15+ เปลี่ยน `params` เป็น async
`src/app/api/case/[id]/route.ts` ใช้ `params.id` แบบ sync — โปรเจกต์นี้ใช้ Next 16 จะ error
ต้องแก้เป็น:
```ts
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
```

### #3 ✅ แก้แล้ว — `case_note` ทุกตัวมี `area_code = null`
เดิม parser ตั้ง `area_code: None` ไว้สำหรับ case note เสมอ ผลคือ filter
"กรณีตรวจสอบ + ประเด็นสิทธิ A" จะได้ 0 ผลลัพธ์เสมอ

วิธีแก้ที่ใช้จริง: แทนที่จะเดาจาก tags/เนื้อหาของ case note เอง ใช้การไขว้
(cross-reference) กับไฟล์ topic ใน `02 ประเด็นสิทธิ` แทน — แต่ละไฟล์ topic เก็บ
รายการ "กรณีตรวจสอบที่เกี่ยวข้อง" เป็น wikilink ไปหา case note อยู่แล้ว และ
wikilink target ตรงกับชื่อไฟล์ case แบบตรงตัว (ไม่ใช่ alias ที่แสดง จึงไม่มีปัญหา
เลขศูนย์นำหน้าหาย) → `ObsidianParser._build_case_area_index()` สแกน 25 ไฟล์ topic
ครั้งเดียวตอน init สร้าง `case_id -> [area_code, ...]` แล้ว `_parse_case_note` ก็
lookup ตรง ๆ ผลคือ 270/285 เคส (94.7%) มี area_code ถูกต้องแล้ว

### #4 ✅ แก้แล้ว — keyword extraction ยังหยาบมาก
เดิม `_extract_keywords()` ใช้ `text.split()` เฉย ๆ ทำให้ได้ขยะอย่าง `"---"`, `"tags"`,
และตัดคำไทยไม่ได้ (ภาษาไทยไม่มีเว้นวรรค)

วิธีแก้ที่ใช้จริง: แยก YAML frontmatter ออกจาก body ก่อนเสมอ (`_split_frontmatter`,
ใช้ `pyyaml`), ใช้ `tags:` ที่ผู้เขียนกำหนดไว้แล้วเป็น keyword หลัก (คุณภาพสูงกว่า
เดาจาก free text), แล้วเติมด้วย `pythainlp.tokenize.word_tokenize` (engine `newmm`)
บน title+body ที่ตัด markdown noise (`[[wikilink]]`, `#`, `|←` ฯลฯ) ออกแล้ว
กรอง stopword ด้วย `pythainlp.corpus.thai_stopwords()` รวมกับ list เดิม
ติดตั้ง dependency แล้ว: `pip install pythainlp` (อยู่ใน `requirements.txt` อยู่แล้ว
แต่ไม่เคยติดตั้งจริงในเครื่องนี้)

### #5 ✅ แก้แล้ว — index ใหญ่เกินจำเป็น (11 MB)
เดิม `nhrc_index.json` เก็บ `content` เต็มของทุกไฟล์ และเนื่องจาก TypeScript interface
ไม่ตัดข้อมูลจริงตอน runtime `content` เต็มรั่วออกไปกับ `/api/search/hybrid` และ
`/api/stats` ทุกครั้งด้วย (ไม่ใช่แค่โหลดเข้า memory เฉย ๆ)

วิธีแก้: `setup_obsidian_index.py` แยก `content` ของแต่ละเอกสารออกไปเป็นไฟล์เดี่ยว
`data/nhrc_content/<document_id>.txt` แล้วค่อยเขียน `nhrc_index.json` แบบไม่มี
`content` เลย → **ไฟล์เล็กลงจาก 11 MB เหลือ 1.17 MB** เฉพาะ `/api/case/[id]/route.ts`
เท่านั้นที่อ่านไฟล์ content แบบ lazy (อ่านทีละไฟล์ตอนมีคน request เคสนั้นจริง ๆ)

**สำคัญ:** `data/nhrc_index.json` และ `data/nhrc_content/` ถูกเพิ่มลง `.gitignore`
แล้ว เพราะเนื้อหา case note อาจมีข้อมูลส่วนบุคคลที่ยังไม่ผ่าน redaction (ดูคำเตือน
ด้านล่าง) —**ห้ามลบออกจาก .gitignore ก่อนทำ redaction**

### #6 ยังไม่มี semantic search จริง
`/api/search/hybrid` ตอนนี้เป็น **substring match ธรรมดา** (`title.includes(query)`)
ไม่ใช่ hybrid จริงตามชื่อ ยังไม่ได้แตะ ChromaDB เลย

---

## ลำดับงานที่แนะนำ

1. ✅ **ทำให้รันได้ก่อน** — `cd web && npm run dev` แก้ error จนหน้า
   `/knowledge/search` และ `/knowledge/dashboard` เปิดได้จริง (แก้บั๊ก #1, #2) — **เสร็จแล้ว**
2. ✅ **แก้ parser** — frontmatter + area_code ของ case note + keyword ภาษาไทย (บั๊ก #3, #4)
   แล้ว regenerate index — **เสร็จแล้ว** (`python setup_obsidian_index.py`)
3. ✅ **ลด index** — แยก metadata ออกจาก content (บั๊ก #5) — **เสร็จแล้ว**
4. **ต่อ semantic search จริง** — ให้ `/api/search/hybrid` เรียก ChromaDB
   ที่มีอยู่แล้วใน `data/chroma` ผ่าน Python API layer (FastAPI) หรือ port embedding ไป TS
   — ยังไม่ทำ (บั๊ก #6)
5. **ค่อยคิดเรื่อง deploy public** — ตอนนี้ยังไม่มี auth, ไม่มี rate limit,
   และ case note มีข้อมูลส่วนบุคคล → ต้องมี redaction ก่อนเปิดสาธารณะ — ยังไม่ทำ

---

## Deploy จริงขึ้น Vercel — บั๊กที่เจอหลัง deploy (2026-08-05)

Deploy ที่ https://human-rights-rag-enje-chi.vercel.app/ แล้วพบ 3 ปัญหา ตามที่ผู้ใช้แจ้ง
("ค้นแล้วให้ข้อมูลไม่ตรง / AI ใช้งานไม่ได้ / ดาวโหลดเอกสารต้นฉบับไม่ได้"):

1. **ค้นหาไม่ตรง** — reproduce ไม่ได้ในรอบแรก จนผู้ใช้ให้ตัวอย่างจริง
   ("เสรีภาพในการชุมนุมคืออะไร") ตามหัวข้อ "แก้ Ask NHRC ค้นไม่ตรง/ไม่ครบ" ด้านล่าง
2. **AI (Ask NHRC) ใช้งานไม่ได้** — สาเหตุ: ยังไม่ได้ตั้ง `ANTHROPIC_API_KEY` ใน Vercel
   Environment Variables ทำให้ `/api/ask-nhrc` fallback ไปโหมด evidence-only เงียบๆ
   (ดู [ask-nhrc/route.ts](web/src/app/api/ask-nhrc/route.ts) บรรทัด 75) — บอกขั้นตอนตั้งค่า
   ให้ผู้ใช้ไปทำเองแล้ว (ตั้งค่า env var + redeploy) ยังไม่ยืนยันว่าทำเสร็จ
3. **ดาวน์โหลด PDF ต้นฉบับไม่ได้** — สาเหตุ: `data/nhrc_documents/` (1.4GB, gitignored)
   ไม่ได้ deploy ไปด้วย → แก้ด้วย Google Drive ตามหัวข้อถัดไป

### PDF ต้นฉบับ (`data/nhrc_documents/`) → Google Drive

**Spot-check ความเป็นส่วนตัวก่อนทำ**: เปิดดู PDF ตัวอย่าง 4 ไฟล์ (case_186_2564,
case_221_2567, case_98_2567) ด้วย PyMuPDF render เป็นภาพ (ไฟล์เป็น scanned image
ล้วน ไม่มี text layer เลย - ต้อง render ดูด้วยตา ทำ regex ตรงๆ ไม่ได้) พบว่าเอกสาร
ต้นฉบับมีการปกปิดชื่อ (แถบดำ/"ปกปิดชื่อ") อยู่แล้วตั้งแต่ต้นทาง ตรงกับที่ผู้ใช้ยืนยัน
("เอกสารเหล่านี้มีการปกปิดตัวตนแล้ว และมีการเผยแพร่ในเว็บอยู่แล้วครับ") จึงไป
ต่อเรื่อง hosting ได้

**ทางเลือก storage**: Supabase (แผน Free ~1GB ไม่พอกับ 1.4GB), Vercel Blob, S3,
Google Drive — ผู้ใช้เลือก Google Drive (ฟรี บัญชีส่วนตัวมีอยู่แล้ว)

**บทเรียนสำคัญ - Service Account ใช้กับ Drive ส่วนตัวไม่ได้**:
ลองสร้าง Service Account ก่อน (`gen-lang-client-*.json`, gitignored) แชร์โฟลเดอร์
Drive ให้ (Viewer ก่อน แล้วเปลี่ยนเป็น Editor) แต่ยังอัปโหลดไม่ได้ - error สุดท้าย
คือ **"Service Accounts do not have storage quota. Leverage shared drives ...
or use OAuth delegation instead."** นี่คือข้อจำกัดของ Google เอง: service account
ไม่มีโควตาพื้นที่เก็บข้อมูลของตัวเอง อัปโหลดไฟล์เข้าไปเป็นเจ้าของไม่ได้ในบัญชี Drive
ส่วนตัว (@gmail.com) เว้นแต่จะเป็น Shared Drive (ฟีเจอร์ Google Workspace เท่านั้น)
→ **ต้องใช้ OAuth แบบ user-delegated แทนเสมอสำหรับ Drive บัญชีส่วนตัว**

**วิธีที่ใช้จริง (OAuth)**:
- สร้าง OAuth Client ID (Desktop app type) ในโปรเจกต์ GCP เดิม (`gen-lang-client-0228155967`)
- consent screen ต้อง **Publish เป็น Production** ไม่งั้น refresh token จะหมดอายุใน 7 วัน
  (scope `drive.file` ไม่ต้องผ่าน verification เต็มรูปแบบ เลย publish ได้เลยแม้ unverified)
- `scripts/gdrive_oauth_setup.py` — รันครั้งเดียว เปิด local server รอ redirect,
  ผู้ใช้เปิด URL ที่พิมพ์ออกมาในเบราว์เซอร์ตัวเองแล้วกด Allow → บันทึก refresh token
  ลง `google_drive_token.json` (gitignored)
- **ข้อจำกัดของ scope `drive.file`**: แอปเห็น "เฉพาะไฟล์/โฟลเดอร์ที่แอปสร้างเอง"
  เท่านั้น — โฟลเดอร์ "NHRC PDF Documents" ที่สร้างด้วยมือไว้ก่อน (ตอนจะใช้ service
  account) จะ**มองไม่เห็นเลย** ต้องให้สคริปต์สร้างโฟลเดอร์ใหม่ชื่อเดียวกันขึ้นมาเอง
  (`find_or_create_root_folder()` ใน `scripts/upload_pdfs_to_drive.py`) ผลคือ Drive
  ของผู้ใช้มีโฟลเดอร์ชื่อ "NHRC PDF Documents" ซ้ำกัน 2 อัน - อันเก่าว่างเปล่า ลบทิ้งได้
- `scripts/upload_pdfs_to_drive.py` อัปโหลด 287 ไฟล์ แยกปีเป็นโฟลเดอร์ย่อยตามชื่อไฟล์
  (`case_NNN_YYYY.pdf` → ปี YYYY) เขียน mapping `data/nhrc_pdf_drive_map.json`
  (document_id → Drive file ID, **ไม่มีข้อมูลลับ ปลอดภัย commit ได้**) — รันสำเร็จ
  287/287, 0 error, ตรวจ byte size ตัวอย่างตรงกับไฟล์ต้นฉบับ 100%
- ฝั่งเว็บ: `web/src/lib/nhrc/drive.ts` (ใหม่) ใช้ `google.auth.OAuth2` +
  refresh token จาก env vars `GOOGLE_DRIVE_CLIENT_ID/SECRET/REFRESH_TOKEN`,
  `repository.ts` เพิ่ม `getDrivePdfFileId()` อ่าน mapping,
  `/api/case/[id]/document` ลอง local disk ก่อน (dev) แล้ว fallback ไป Drive
  (production) — **ทดสอบจริงแล้ว**: ย้าย `data/nhrc_documents` ออกชั่วคราวเพื่อบังคับ
  ให้ใช้ path Drive, โหลดผ่าน route ได้ 200 OK, byte size ตรงกับต้นฉบับเป๊ะ

**ยังไม่เสร็จ**: ต้องตั้ง env vars 3 ตัวใน Vercel (`GOOGLE_DRIVE_CLIENT_ID`,
`GOOGLE_DRIVE_CLIENT_SECRET`, `GOOGLE_DRIVE_REFRESH_TOKEN` - ค่าจาก
`google_drive_token.json` ในเครื่อง, ห้าม commit ไฟล์นั้น) แล้ว redeploy,
จากนั้น commit+push โค้ด (`data/nhrc_pdf_drive_map.json` ปลอดภัย commit ได้
เพราะมีแค่ Drive file ID ไม่มีความลับ)

### แก้ปุ่ม PDF หายไปหลังผูก Drive

หลัง deploy โค้ด Drive แล้ว ผู้ใช้แจ้งว่าปุ่มดาวน์โหลดยังกดไม่ได้ - เจอว่า
`case/[id]/page.tsx` เช็ค `hasPdf` จาก `getSourcePdfPath()` (local disk) อย่างเดียว
เลยซ่อนปุ่มไปเลยในโปรดักชัน ทั้งที่ API เองทำงานถูกแล้ว (ทดสอบยิง API ตรงๆ ได้ 200
byte ตรงเป๊ะ) แก้โดยเช็ค `getDrivePdfFileId()` เพิ่มด้วย

### แก้ Ask NHRC ค้นไม่ตรง/ไม่ครบ (ตัวอย่างจริง: "เสรีภาพในการชุมนุมคืออะไร")

ผู้ใช้แจ้ง 2 ปัญหา หาสาเหตุจากโค้ด/ข้อมูลจริงได้ทั้งคู่ก่อน reproduce:

1. **ค้นไม่ครบทุกเอกสาร** — `findRelevantCases()` กรองเอาแค่ `document_type ===
   "case_note"` งานวิจัย (general, 90) กับรายงานประเมินสถานการณ์ (situation_report, 4)
   ไม่เคยถูกค้นเจอเลย → **แก้โดยลบ filter ประเภทเอกสารออกทั้งหมด** (ทั้งใน
   `findRelevantCases` และ fallback `search()` ที่มันเรียกต่อ) ค้นได้ทุก document_type
   ที่มีตอนนี้และที่จะเพิ่มในอนาคตโดยไม่ต้องแก้โค้ดซ้ำ (ตามที่ผู้ใช้ขอ)
2. **จับคู่คำสำคัญมั่ว** — วิธีให้คะแนน (`q.includes(kw)`, ยอมรับ keyword สั้นสุด 2
   ตัวอักษร) ปล่อยให้คำไทยทั่วไปมากๆ อย่าง "ทำ"/"ดี"/"แล" (คำจริงจาก
   `pythainlp.word_tokenize`, ไม่ใช่ garbage แต่ generic เกินจะเป็น "keyword" - ตรวจแล้ว
   ว่าไม่อยู่ใน stopword corpus ของ pythainlp เอง) หลุดเป็น keyword ของบางเอกสาร
   → **แก้โดยขยับ minimum length ใน `_tokenize_thai()` จาก 2 เป็น 3 ตัวอักษร**
   (`src/obsidian_parser.py`) ไม่กระทบ seed_tags/frontmatter tags ที่สั้นแต่ตั้งใจ
   (เช่น "ตร" = ตำรวจ) เพราะ tags พวกนั้น bypass tokenizer อยู่แล้ว

**re-run `setup_obsidian_index.py` แล้ว** (404 เอกสาร, keyword 2 ตัวอักษรเหลือ 0
ตัวสำหรับ case_note) **ตรวจข้อมูลส่วนบุคคลซ้ำ** ตามระเบียบเดิม แต่คราวนี้สแกน
**ทุกประเภทเอกสาร** (ก่อนหน้านี้ตรวจแค่ case_note) เจอชื่อบุคคลจริง ~130 จุด
ไล่ดู context ทีละจุดแล้วพบว่าทั้งหมดเป็น (ก) ชื่อผู้จัดทำงานวิจัยในฟิลด์ "ผู้จัดทำ:"
(byline ผู้เขียนรายงานตีพิมพ์ ปกติเปิดเผยได้) หรือ (ข) ชื่อกรรมการสิทธิมนุษยชนแห่งชาติ
ในหน้าปกรายงานประเมินสถานการณ์ 2564 (ข้าราชการที่ได้รับโปรดเกล้าฯ ชื่อ-ตำแหน่งเป็น
ข้อมูลสาธารณะ) - ไม่พบชื่อผู้ร้อง/ผู้ถูกร้องที่เป็นบุคคลธรรมดาหลุดเลย ที่เหลือเป็น false
positive ของ regex เอง (คำอย่าง "นายจ้าง"/"นายทะเบียน"/"นายกฯ" ขึ้นต้นด้วย นาย/นาง
แต่ไม่ใช่ชื่อคน)

**บทเรียนการเทส**: ตอนแรกทดสอบ query ภาษาไทยผ่าน `curl -d '{"question":"..."}'`
ในคำสั่ง Bash โดยตรงแล้วได้ผลลัพธ์ "ไม่พบ" ผิดๆ ทั้งที่โค้ด/ข้อมูลถูกต้องแล้ว - Git
Bash บน Windows เข้ารหัสสตริงไทยที่ฝังในคำสั่ง shell ผิดเพี้ยนได้ (ทั้ง
`--data-urlencode` และบางครั้ง `-d` ตรงๆ) วิธีทดสอบที่เชื่อถือได้คือเขียน JSON body
ลงไฟล์ UTF-8 ด้วย Python ก่อน (`json.dump(..., ensure_ascii=False)`) แล้วยิงด้วย
`curl --data-binary @file` แทน - หลังแก้วิธีเทส คำถาม "เสรีภาพในการชุมนุมคืออะไร"
เจอเอกสาร topic "เสรีภาพชุมนุมแสดงออกสื่อ" ตรงประเด็นทันที (เอกสารประเภท `topic`
ซึ่งก่อนแก้จะถูกกรองทิ้งไปเลย)

**ยังไม่ทำ**: การจับคู่ยังเป็น literal substring ล้วน ๆ ไม่ใช่ semantic search จริง
(บั๊ก #6 เดิม) - คำถามที่ไม่มี keyword ปรากฏเป็นข้อความย่อยตรงๆ เลยจะยังหาไม่เจอ
ต้องต่อ embeddings/ChromaDB จริงถึงจะแก้ขาดได้

---

## คำเตือนเรื่องข้อมูลส่วนบุคคล

เป้าหมายคือเปิดให้คนทั่วไปค้นได้ แต่ `03 กรณีตรวจสอบ` เป็นบันทึกเรื่องร้องเรียนที่
อาจมีชื่อผู้ร้อง / ผู้ถูกร้อง / รายละเอียดอ่อนไหว
**ห้าม deploy public ก่อนทำ redaction และผ่านการอนุมัติภายใน**
README เดิมของโปรเจกต์ก็ระบุไว้แล้วว่ายังไม่มี redaction อัตโนมัติ

---

## คำสั่งที่ใช้บ่อย

```powershell
# regenerate index (แก้ path ใน setup_obsidian_index.py ก่อน)
cd D:\human-rights-rag
python setup_obsidian_index.py

# รันเว็บ
cd D:\human-rights-rag\web
npm run dev          # http://localhost:3000/knowledge/search

# รัน Streamlit เดิม
cd D:\human-rights-rag
streamlit run app.py
```

---

## ไฟล์เอกสารอื่นใน repo

`PHASE1_SUMMARY.md`, `PHASE2_SUMMARY.md`, `HYBRID_RAG_SETUP.md`, `QUICK_START.md`,
`HOW_TO_RUN.md`, `README.md` — เขียนไว้ใน session เดียวกัน
**เนื้อหาบางส่วนมองโลกในแง่ดีเกินจริง** (เขียนว่า "COMPLETE / tested" ทั้งที่ฝั่งเว็บยังไม่เคยรัน)
ให้ยึดเอกสารฉบับนี้เป็นหลัก และแก้เอกสารอื่นให้ตรงความจริงเมื่อทำงานเสร็จ

ไฟล์ `START_WEB.cmd`, `START_WEB.ps1`, `CHECK_SETUP.cmd`, `run.sh`, `run.ps1`
เป็น wrapper ที่ไม่จำเป็น — ลบทิ้งได้ ใช้ `npm run dev` ตรง ๆ พอ
