# คู่มือผู้ดูแลระบบ: การจัดการและนำเข้าข้อมูล (ค้นหาสิทธิ / NHRC RAG)

คู่มือนี้ครอบคลุมเฉพาะ pipeline ข้อมูลที่ระบบ "ค้นหาสิทธิ" ใช้งานจริงในปัจจุบัน
(Obsidian vault → ทำดัชนี → เว็บแอป) — คนละระบบกับ `docs/IMPORTING.md` ซึ่งอธิบาย
เส้นทางนำเข้าเอกสารแบบ Supabase-only ของ `ChatWorkspace`/`/admin/import` ที่ยังไม่ได้ใช้งานจริง

## 1. ภาพรวมของ pipeline

```
Obsidian vault (.md files)
        │  python setup_obsidian_index.py
        ▼
data/nhrc_index.json      ← metadata ของทุกเอกสาร (ใช้ทำตัวกรอง/browse)
data/nhrc_content/*.txt   ← เนื้อหาเต็มของแต่ละเอกสาร (ใช้แสดงผล + ป้อนให้ AI)
data/nhrc_graph.json      ← กราฟความสัมพันธ์ประเด็นสิทธิ (หน้า /knowledge/graph)
data/nhrc_documents/*.pdf ← ไฟล์ต้นฉบับที่คัดลอกมา (ถ้าเจอคู่กับโน้ต)
        │  node web/scripts/embed-nhrc-documents.mjs
        ▼
Supabase (nhrc_embeddings, halfvec) ← เปิดใช้ semantic search ใน Ask NHRC
```

Vault ต้นทางอยู่ที่ `D:\back up\รายงานและข้อเสนอแนะ กสม` (พาธถูกกำหนดใน
`setup_obsidian_index.py`'s `vault_path` — เปลี่ยนได้ถ้าย้ายเครื่อง)

## 2. โครงสร้างโฟลเดอร์ในวอลต์และการเพิ่มเอกสารใหม่

แต่ละหมวดหมู่เอกสาร (`DOCUMENT_CATEGORIES` ใน `web/src/lib/nhrc/types.ts`) ผูกกับ
โฟลเดอร์ที่มีตัวเลขนำหน้าคนละโฟลเดอร์ในวอลต์ (`01 ...` ถึง `10 ...`) มีเทมเพลตพร้อมใช้
สำหรับหมวดที่ยังว่าง/เพิ่งเปิดอยู่ที่ `docs/vault-templates/*.md` — เปิดไฟล์เทมเพลตของ
หมวดที่ต้องการ คัดลอกโครงสร้าง (frontmatter, หัวข้อ `##` ที่กำหนด) แล้วเขียนเนื้อหาจริงทับ

ข้อควรระวังเวลาเขียนโน้ตใหม่:

- **ชื่อไฟล์** กลายเป็นส่วนหนึ่งของ `document_id` โดยตรง — หลีกเลี่ยงอักขระที่ Windows
  ห้ามใช้ (`: / \ * ? " < > |`) และไฟล์เนมที่ยาวเกินไป (ดู commit "Fix filename length
  issues for cross-platform compatibility" ถ้าเจอปัญหา path ยาวเกิน)
- **Frontmatter `tags`** ควรใส่แท็กที่มีความหมายจริง (ไม่ใช่แค่ `["ประเด็นสิทธิ"]` ที่เป็น
  ป้ายหมวดหมู่กว้าง ๆ) เพราะกลายเป็นคำสำคัญ (keywords) ที่ใช้ค้นหา
- เอกสารประเภท "งานวิจัย"/"กฎหมาย"/"ตราสาร" ควรมีหัวข้อ `## สาระสำคัญ` เพราะระบบใช้ส่วนนี้
  เป็นบทสรุปที่ป้อนให้ AI แทนการตัดสุ่มจากตัวเอกสาร (ดู `src/obsidian_parser.py`)
- เนื้อหาที่เขียน/สรุปด้วย AI ต้องมีบรรทัดกำกับความไม่แน่นอนและลิงก์แหล่งทางการเสมอ
  (ดู memory "Legal content accuracy convention" — เช่นบรรทัด "ควรตรวจสอบวันที่/มาตราละเอียด
  กับต้นฉบับทางการก่อนอ้างอิงจริง")

## 3. การรีเซ็ตดัชนี (รันทุกครั้งหลังแก้/เพิ่มไฟล์ในวอลต์)

```bash
python setup_obsidian_index.py
```

สคริปต์นี้จะ: parse วอลต์ทั้งหมดใหม่ → เขียน `data/nhrc_index.json`,
`data/nhrc_content/`, `data/nhrc_graph.json` → คัดลอก PDF ต้นฉบับที่หาเจอไปไว้
`data/nhrc_documents/` → รันชุดทดสอบค้นหาแบบง่ายให้ดูท้ายสุด

**บน Windows** ถ้าเจอ `UnicodeEncodeError` ตอน print (เพราะ terminal เป็น cp1252)
ให้สั่งรันด้วย:

```bash
PYTHONIOENCODING=utf-8 python setup_obsidian_index.py
```

ขั้นตอนนี้ไม่แตะ Supabase/embeddings เลย — เป็นการรีเซ็ตเฉพาะไฟล์ JSON ในเครื่อง/repo
เท่านั้น ปลอดภัยที่จะรันบ่อย ๆ

## 4. การอัปเดต embeddings สำหรับ semantic search (Ask NHRC)

Ask NHRC ต้องการ Gemini embeddings ที่เก็บใน Supabase (`public.nhrc_embeddings`)
เพื่อค้นแบบเข้าใจความหมาย (ไม่ใช่แค่จับคำตรงตัว) หลังเพิ่มเอกสารใหม่/แก้ไขเนื้อหาแล้ว
รีเซ็ตดัชนีตามข้อ 3 ต้องรันคำสั่งนี้ต่อเพื่อ backfill embedding ของเอกสารใหม่:

```bash
cd web
node scripts/embed-nhrc-documents.mjs
```

ต้องมี `GEMINI_API_KEY` และค่า Supabase (`NEXT_PUBLIC_SUPABASE_URL`,
`SUPABASE_SECRET_KEY`) ตั้งไว้ใน `web/.env.local` ก่อน สคริปต์นี้จะข้ามเอกสารที่มี
embedding อยู่แล้ว (เขียนซ้ำเฉพาะที่จำเป็น) เพราะฉะนั้นรันซ้ำได้อย่างปลอดภัย

**ถ้าลืมรันขั้นตอนนี้** ระบบไม่ error แต่ Ask NHRC จะเงียบ ๆ fallback ไปใช้การค้นหาแบบ
จับคำตรงตัวแบบเดิม (`repository.ts`'s `findRelevantCases`) ซึ่งด้อยกว่ามาก
เอกสารใหม่จะแทบไม่ถูกดึงมาตอบเลยถ้าคำถามไม่ได้ใช้คำเดียวกับในเอกสารเป๊ะ ๆ —
เป็นสาเหตุของบั๊ก "AI มีความรู้จำกัด" ที่เคยเจอมาแล้วครั้งหนึ่ง

## 5. ตัวแปรแวดล้อมที่เกี่ยวข้อง (`web/.env.local`)

ดูรายละเอียดเต็มใน `web/.env.example` สรุปเฉพาะที่เกี่ยวกับ pipeline นี้:

| ตัวแปร | จำเป็นสำหรับ |
|---|---|
| `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` | AI สรุปคำตอบใน Ask NHRC และ "กฎหมาย/ตราสารที่เกี่ยวข้อง" ในหน้ากรณี (ไม่ตั้งไว้ = ระบบยังใช้ได้แต่ไม่มี AI สรุป) |
| `GEMINI_API_KEY` | สร้าง embeddings สำหรับ semantic search (ข้อ 4) |
| `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SECRET_KEY` | เก็บ embeddings |
| `IAPP_API_KEY` | ยืนยันมาตรากฎหมายไทยจริงจากฐานข้อมูล OpenThai 2.0 Legal (ไม่ตั้งไว้ = ใช้ความจำ AI ล้วน ต้องระวังความแม่นยำมากกว่า) |
| `GOOGLE_DRIVE_CLIENT_ID/SECRET/REFRESH_TOKEN` | เสิร์ฟไฟล์ PDF ต้นฉบับจาก Google Drive ในโปรดักชัน (`data/nhrc_documents/` ไม่ได้ขึ้นไปกับ deploy เพราะไฟล์ใหญ่/gitignored) |

## 6. การ deploy ขึ้นโปรดักชัน (Vercel)

```bash
cd web
npx vercel --prod --yes --scope bandits-projects-111dbe2a
```

**ต้องระบุ `--scope`** แม้ `.vercel/project.json` จะผูก project ไว้แล้วก็ตาม — เคยเจอปัญหา
`{"status":"error","reason":"deploy_failed","message":"Not authorized"}` เพราะ token
ที่ login อยู่คนละ team scope กับที่ project ผูกไว้ ถ้าเจอปัญหานี้อีก รัน
`npx vercel teams ls` เพื่อดู scope slug ที่ถูกต้อง

## 7. ปัญหาที่พบบ่อยระหว่างพัฒนา/ทดสอบ

- **Dev server ชน port กับโปรเจกต์อื่นบนเครื่องเดียวกัน** — ถ้าเปิด `npm run dev` แล้ว
  เจอพฤติกรรมแปลก ๆ (API คืนหน้าเว็บผิด/ข้อมูลหน้าอื่น) ให้ตรวจว่ามี process อื่นถือ
  port 3000 ค้างอยู่หรือไม่ (`Get-NetTCPConnection -LocalPort 3000` ใน PowerShell)
  ก่อนไล่หาบั๊กในโค้ด — เคยเสียเวลาไปมากกับกรณีนี้เพราะมี dev server ของอีกโปรเจกต์
  (`thailand-human-rights-monitor`) ค้างอยู่บน port เดียวกัน
- **หน้าเว็บ error `LegalRefsBox is defined multiple times`** หรือ error คล้ายกันตอนแก้
  ไฟล์ — เป็น Turbopack fast-refresh ชั่วคราวระหว่างบันทึกไฟล์ กด reload อีกครั้งหลัง
  บันทึกเสร็จมักหายเอง ถ้าไม่หายให้ตรวจว่ามีการประกาศฟังก์ชัน/คอมโพเนนต์ชื่อซ้ำจริงในไฟล์
- **กราฟ (`/knowledge/graph`) ไม่มีข้อมูล** — ต้องรัน `python setup_obsidian_index.py`
  อย่างน้อยหนึ่งครั้งก่อน (สร้าง `data/nhrc_graph.json`)
