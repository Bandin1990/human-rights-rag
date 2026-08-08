# 🚀 วิธีเปิดใช้งาน NHRC Hybrid RAG

## ⚡ เริ่มต้นเร็ว (3 ขั้น)

### 1️⃣ เปิด Command Prompt หรือ PowerShell
```bash
cd D:\human-rights-rag
```

### 2️⃣ รันเว็บแอพ
**Windows:**
```bash
START_WEB.cmd
```

**หรือ PowerShell:**
```powershell
.\START_WEB.ps1
```

**หรือ Manual:**
```bash
cd web
npm run dev
```

### 3️⃣ เปิดเบราว์เซอร์
- 🔍 Search: http://localhost:3000/knowledge/search
- 📊 Dashboard: http://localhost:3000/knowledge/dashboard

---

## ✅ ตรวจสอบการติดตั้ง

### Node.js พร้อมใช้งานไหม?
```bash
node --version    # ต้องเป็น v18.0.0 ขึ้นไป
npm --version     # ต้องเป็น 8.0.0 ขึ้นไป
```

### Index file มีไหม?
```bash
ls -la data/nhrc_index.json
# ต้องขนาดประมาณ 11MB
```

### Dependencies พร้อมไหม?
```bash
cd web
ls node_modules | wc -l
# ต้องมีหลายโฟลเดอร์ (500+)
```

---

## 🔧 แก้ปัญหาทั่วไป

### ❌ Port 3000 ถูกใช้งาน
```bash
cd web
npm run dev -- -p 3001
# แล้วไปที่ http://localhost:3001/knowledge/search
```

### ❌ Dependencies หาย
```bash
cd web
rm -r node_modules package-lock.json
npm install
```

### ❌ Index file หาย
```bash
cd D:\human-rights-rag
python setup_obsidian_index.py
```

---

## 📚 Features

### 🔍 Search Page
- ค้นหาด้วยข้อความ
- กรองตามพื้นที่ (A-E)
- กรองตามปี (2563-2568)
- กรองตามประเภทเอกสาร

### 📊 Dashboard
- สถิติทั้งหมด (410 documents)
- กราฟ: ประเภท, พื้นที่, ปี
- คำสำคัญที่บ่อย
- กรณีล่าสุด

---

## 🌐 API Endpoints

```bash
# ค้นหา
curl "http://localhost:3000/api/search/hybrid?q=ทรมาน&limit=10"

# ข้อมูลกรณี
curl "http://localhost:3000/api/case/103-2564"

# สถิติ
curl "http://localhost:3000/api/stats"
```

---

## 📁 โครงสร้างโปรเจกต์

```
D:\human-rights-rag\
├── web/                          # Next.js web app
│   ├── src/app/
│   │   ├── api/                  # API routes
│   │   │   ├── search/hybrid
│   │   │   ├── case/[id]
│   │   │   └── stats
│   │   ├── knowledge/
│   │   │   ├── search/page.tsx   # Search page
│   │   │   └── dashboard/page.tsx # Dashboard
│   │   └── components/           # React components
│   ├── package.json
│   └── .env.local               # Configuration
│
├── src/                          # Python modules
│   ├── obsidian_parser.py
│   ├── json_index.py
│   └── hybrid_search.py
│
├── data/
│   └── nhrc_index.json          # Generated index (410 docs)
│
├── START_WEB.cmd                # Windows batch script
├── START_WEB.ps1                # PowerShell script
├── QUICK_START.md               # Quick reference
├── PHASE1_SUMMARY.md            # Backend documentation
├── PHASE2_SUMMARY.md            # Frontend documentation
└── HOW_TO_RUN.md                # This file
```

---

## 💡 ถัดไป

1. ✅ เปิดเว็บแอพ
2. 📚 ลอง Search ด้วยคำสำคัญต่างๆ
3. 📊 ดู Dashboard สำหรับสถิติ
4. 🔧 อ่าน documentation files

---

## 📞 ต้องความช่วยเหลือ?

ดู:
- `QUICK_START.md` - เริ่มต้นเร็ว
- `PHASE1_SUMMARY.md` - ข้อมูล Python backend
- `PHASE2_SUMMARY.md` - ข้อมูล Next.js frontend
- `HYBRID_RAG_SETUP.md` - Integration guide

---

**Ready to go!** 🎉

```bash
cd D:\human-rights-rag
./START_WEB.cmd
# จากนั้นไปที่ http://localhost:3000/knowledge/search
```
