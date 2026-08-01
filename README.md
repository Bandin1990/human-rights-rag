# ต้นแบบเว็บแอป RAG สำหรับเอกสารสิทธิมนุษยชนภาษาไทย

โปรเจกต์นี้เป็นต้นแบบ RAG ที่ทำงานบนเครื่องผู้ใช้ทั้งหมดสำหรับอัปโหลด PDF หรือ Markdown, ค้นหาตามความหมาย และถามคำถามภาษาไทยจากเอกสารที่นำเข้า ระบบไม่ส่งเนื้อหาเอกสารไปยังบริการภายนอกโดยตั้งใจออกแบบให้ใช้เฉพาะไฟล์ในเครื่อง, embedding model ในเครื่อง, ChromaDB แบบ persistent และ Ollama ในเครื่อง

โปรเจกต์มีเว็บ Next.js ใน `web/` สำหรับคลังความรู้สาธารณะ และเพิ่มระบบงานเรื่องร้องเรียน/รายงานตรวจสอบที่ `/cases` ตาม [คู่มือระบบงานเรื่องร้องเรียน](docs/CASE_MANAGEMENT.md) ระบบส่วนนี้แยก private case store ออกจาก public RAG และให้ AI ช่วยค้น/ร่างโดยไม่เปลี่ยนสถานะหรือวินิจฉัยแทนผู้มีอำนาจ

## Architecture

- `app.py` เป็นหน้าเว็บ Streamlit มี 4 หน้า: อัปโหลด/จัดการเอกสาร, ค้นหาเอกสาร, ถามตอบด้วย RAG, และสถานะดัชนี
- `src/pdf_loader.py` อ่าน PDF ด้วย PyMuPDF แยกข้อความรายหน้าและตรวจ text layer ที่อ่านไม่ได้
- `src/markdown_loader.py` อ่านไฟล์ Markdown แบบ UTF-8 และนับเป็นหน้า 1 สำหรับการอ้างอิง
- `src/ocr.py` ตรวจและเรียก OCRmyPDF เพื่อแปลง PDF แบบสแกนเป็น searchable PDF ในเครื่อง
- `src/chunking.py` แบ่งข้อความโดยพยายามรักษาย่อหน้า ไม่ให้ chunk ข้ามเอกสาร และเก็บ metadata ทุก chunk
- `src/embeddings.py` ใช้ `sentence-transformers` โหลด multilingual embedding model ในเครื่อง
- `src/vector_store.py` ใช้ ChromaDB persistent ที่ `data/chroma`
- `src/retrieval.py` ทำ semantic search พร้อม filter
- `src/rag.py` เรียก Ollama และบังคับ prompt ให้ตอบจาก context เท่านั้น โดย citation สร้างจาก metadata ของระบบ
- `src/security.py` ตรวจชนิดไฟล์, ขนาดไฟล์, sanitize ชื่อไฟล์ และป้องกัน path traversal

## ค่าตั้งต้นที่เลือก

- Embedding model: `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` เพราะรองรับหลายภาษา รวมถึงภาษาไทย และมีขนาดเหมาะกับต้นแบบบนเครื่องผู้ใช้
- Ollama model: ค่าเริ่มต้นใน `.env.example` คือ `qwen2.5:7b` สำหรับเครื่องที่มี RAM เพียงพอ แต่ถ้าเครื่องมี RAM ประมาณ 8 GB ให้ใช้ `qwen2.5:0.5b` หรือ `qwen2.5:1.5b` เพื่อให้ต้นแบบใช้งานได้จริงกว่า
- `CHUNK_SIZE=1000` และ `CHUNK_OVERLAP=150` เพื่อให้ context มีความต่อเนื่องโดยไม่ใหญ่เกินไป
- เว็บ bind เฉพาะ localhost เป็นค่าเริ่มต้นผ่าน `.streamlit/config.toml`
- UI ใช้ฟอนต์ Bai Jamjuree จากไฟล์ local ใน `assets/fonts` จึงไม่ต้องดึงฟอนต์จากอินเทอร์เน็ตตอนใช้งาน

## ติดตั้ง

ต้องมี Python 3.11 ขึ้นไป

```powershell
cd D:\human-rights-rag
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
```

คัดลอกตัวอย่าง environment:

```powershell
Copy-Item .env.example .env
```

ถ้าต้องการเปลี่ยนโมเดล แก้ค่าใน `.env` หรือกำหนด environment variable ก่อนเปิดเว็บ

## ติดตั้งและเปิด Ollama

1. ติดตั้ง Ollama จากเว็บไซต์ทางการของ Ollama
2. เปิด Ollama ให้ทำงานในเครื่อง
3. ดาวน์โหลดโมเดลที่ต้องการ เช่น

```powershell
ollama pull qwen2.5:7b
```

ตรวจสอบว่า Ollama พร้อมใช้งาน:

```powershell
ollama list
```

ถ้า Ollama ยังไม่พร้อม หน้า search ยังทำงานได้ตามปกติ แต่หน้า RAG จะไม่เรียก LLM และจะแสดง context ที่ค้นพบแทน

## เปิดเว็บ

```powershell
streamlit run app.py
```

เปิดหน้าเว็บที่ Streamlit แสดงใน terminal โดยปกติคือ `http://127.0.0.1:8501`

ถ้าใช้ runtime local ที่เตรียมไว้ในโปรเจกต์นี้ สามารถเปิดผ่าน:

```powershell
.\scripts\run_app.ps1
```

## วิธีเปิดด้วย runtime ที่เตรียมไว้ในโปรเจกต์นี้

ในสภาพแวดล้อมที่ไม่ได้ติดตั้ง Python/Ollama แบบ global สามารถใช้ runtime แบบ local ในโฟลเดอร์ `.tools` และ `.venv` ได้

เปิด Ollama server และค้างหน้าต่างนี้ไว้:

```powershell
.\scripts\ollama_server.cmd
```

จากนั้นเปิดอีก terminal เพื่อเปิดเว็บ:

```powershell
.\scripts\run_app.ps1
```

เครื่องที่ใช้เตรียมต้นแบบนี้มี RAM ประมาณ 8 GB จึงตั้ง `.env` ให้ใช้ `qwen2.5:0.5b` เพื่อให้ทดสอบ RAG ได้จริงบน CPU หากต้องการคำตอบภาษาไทยที่ดีกว่าและมี RAM มากพอ ให้แก้ `OLLAMA_MODEL_NAME` เป็น `qwen2.5:1.5b` หรือ `qwen2.5:7b` แล้ว pull โมเดลนั้นใน Ollama

ถ้าเปิดผ่าน in-app browser ของ Codex แล้วเจอ `ERR_CONNECTION_REFUSED` ทั้งที่ server รันอยู่ อาจเป็นข้อจำกัด loopback ของ Windows packaged app ให้เปิด PowerShell แบบ Administrator แล้วรัน:

```powershell
cd D:\human-rights-rag
.\scripts\enable_codex_loopback_admin.ps1
```

หรือใช้เบราว์เซอร์ภายนอก เช่น Edge/Chrome เปิด `http://127.0.0.1:8501`

## วิธีนำเอกสารเข้าระบบ

1. ไปที่หน้า "อัปโหลดและจัดการเอกสาร"
2. เลือก PDF ที่มี text layer หรือไฟล์ Markdown (`.md`, `.markdown`) แบบ UTF-8
3. ระบุชื่อเอกสาร, ประเภทเอกสาร, ปี, และหมวดสิทธิ
4. ปีเลือกกรอกได้ทั้ง พ.ศ. และ ค.ศ. โดยระบบจะแปลงไปเก็บเป็น ค.ศ. ภายในเพื่อใช้ filter ให้สม่ำเสมอ
5. ประเภทเอกสารจะมีรายการที่เคยกรอกไว้ให้เลือกซ้ำได้ในการนำเข้าครั้งถัดไป
6. หมวดสิทธิเลือกได้มากกว่า 1 หมวด และสามารถพิมพ์หมวดใหม่โดยคั่นหลายหมวดด้วยเครื่องหมายจุลภาค
7. ปรับ `Chunk size` และ `Overlap` ได้ถ้าต้องการ
8. กดนำเอกสารเข้าระบบ

ระบบจะตรวจชนิดไฟล์, ตรวจขนาดไฟล์, sanitize ชื่อไฟล์, บันทึกไว้ที่ `data/documents`, อ่านข้อความรายหน้าในกรณี PDF หรืออ่านทั้งไฟล์เป็นหน้า 1 ในกรณี Markdown, สร้าง chunks, ฝัง embedding และเก็บลง ChromaDB ที่ `data/chroma`

ถ้าระบบแจ้งว่าไม่พบ text layer หรือพบน้อยมาก แปลว่า PDF นั้นน่าจะเป็นไฟล์สแกนแบบรูปภาพ ระบบจะตรวจว่าเครื่องมี OCRmyPDF หรือไม่ หากมีจะมีปุ่ม `ทำ OCR` ในรายการเอกสารเพื่อแปลงเป็น searchable PDF และสร้างดัชนีใหม่ในเครื่อง หากยังไม่มีเครื่องมือ OCR ให้ติดตั้ง OCRmyPDF และ Tesseract ภาษาไทย หรือใช้ Adobe Acrobat/เครื่องมือ OCR ภายในองค์กรแปลงไฟล์ก่อนนำเข้าใหม่

## OCR ในเครื่อง

ระบบช่วยทำ OCR อัตโนมัติได้แบบ local เมื่อเครื่องมีเครื่องมือครบ:

- OCRmyPDF
- Tesseract OCR
- ชุดภาษาไทยของ Tesseract (`tha`)

ตัวอย่างการติดตั้งส่วน Python:

```powershell
pip install -r requirements-ocr.txt
```

บน Windows ยังต้องติดตั้ง Tesseract OCR แยกต่างหาก และตั้งค่าให้ `tesseract.exe` อยู่ใน `PATH` พร้อมภาษาไทย เมื่อพร้อมแล้วให้เปิดเว็บใหม่และกด `ทำ OCR` ที่เอกสารซึ่งระบบแจ้งว่าต้อง OCR

## Metadata ที่เก็บ

ทุก chunk มี metadata อย่างน้อย:

- `document_id`
- `title`
- `document_type`
- `year`
- `rights_category`
- `file_name`
- `page_number`
- `uploaded_at`

## ค้นหาและถามตอบ

หน้า "ค้นหาเอกสาร" รองรับ:

- semantic search
- filter ตามปี, ประเภทเอกสาร และหมวดสิทธิ โดยเลือกหมวดสิทธิได้มากกว่า 1 หมวด
- ตั้งค่า `top_k`
- แสดง similarity score
- แสดงข้อความต้นฉบับก่อนเรียก LLM

หน้า "ถามตอบด้วย RAG" จะ:

- ค้น context จาก ChromaDB ก่อน
- แสดงข้อความที่ค้นพบ
- ส่งเฉพาะ context ที่ค้นพบไปยัง Ollama ในเครื่อง
- สั่งให้ตอบจาก context เท่านั้น
- หากไม่มีคำตอบ ให้ตอบว่าไม่พบข้อมูลจากเอกสารที่นำเข้า
- สร้าง citation จาก metadata ของระบบ ไม่ให้ LLM แต่งแหล่งอ้างอิงเอง

## การลบและ rebuild index

- ลบเอกสารได้จากหน้า "อัปโหลดและจัดการเอกสาร"
- เมื่อลบ ระบบจะลบไฟล์ต้นฉบับใน `data/documents`, metadata registry และ chunks ใน ChromaDB
- Rebuild index ได้จากหน้า "สถานะการจัดทำดัชนี" โดยระบบจะอ่านไฟล์ PDF/Markdown ที่ยังอยู่ใน `data/documents` ใหม่

## ความปลอดภัยและข้อมูลส่วนบุคคล

- ห้ามนำ PDF/Markdown จริง, vector database, secrets หรือข้อมูลผู้ใช้เข้า git
- `.gitignore` ตั้งค่าให้ ignore `data/documents`, `data/chroma`, `data/document_index.json` และ `.env`
- ระบบไม่ execute เนื้อหาในเอกสาร
- ระบบป้องกัน path traversal และ sanitize ชื่อไฟล์
- ควรเปิดเว็บเฉพาะ `127.0.0.1` เว้นแต่เข้าใจความเสี่ยงของ network exposure
- เอกสารสิทธิมนุษยชนอาจมีข้อมูลส่วนบุคคลหรือข้อมูลอ่อนไหว ควรจำกัดสิทธิ์เครื่องและโฟลเดอร์ที่เก็บไฟล์

## ข้อจำกัดของต้นแบบ

- รองรับ PDF ที่มี text layer และ Markdown แบบ UTF-8
- Markdown ไม่มีเลขหน้าจริง ระบบจึงแสดง citation เป็นหน้า 1
- OCR อัตโนมัติทำงานเมื่อเครื่องติดตั้ง OCRmyPDF และ Tesseract ภาษาไทยแล้วเท่านั้น
- คุณภาพคำตอบขึ้นกับ embedding model, Ollama model และคุณภาพ text layer
- ปุ่มเปิด PDF ใช้ file link ในเครื่อง บาง browser หรือ policy อาจบล็อกการเปิดจากหน้าเว็บ
- ยังไม่มีระบบผู้ใช้, audit log, encryption at rest หรือ redaction อัตโนมัติ
- การ rebuild จะข้ามเอกสารที่ยังอ่าน text layer ไม่ได้

## ทดสอบ

```powershell
python -m pytest -q
python -m compileall app.py src tests
```

ชุดทดสอบใช้เอกสาร PDF จำลองที่สร้างขึ้นเองใน runtime และไม่ดาวน์โหลดหรือรวมเอกสารจริงของ กสม. หรือหน่วยงานใด

## โครงสร้างไฟล์

```text
app.py
src/
  config.py
  pdf_loader.py
  chunking.py
  embeddings.py
  vector_store.py
  retrieval.py
  rag.py
  models.py
  security.py
  ingestion.py
tests/
data/
  documents/
  chroma/
  samples/sample_metadata.json
requirements.txt
requirements-ocr.txt
.env.example
.gitignore
README.md
```
