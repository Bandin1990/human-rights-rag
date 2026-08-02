# 🚀 NHRC Hybrid RAG System

ระบบค้นหาฐานความรู้สิทธิมนุษยชนแบบ Hybrid (Structured + Semantic)

**Status**: ✅ Complete | **Phase**: 2/2 | **Documents**: 410

---

## ⚡ Quick Start

### 1. Verify Setup
```bash
cd D:\human-rights-rag
CHECK_SETUP.cmd
```

### 2. Run Web App
```bash
START_WEB.cmd
```

### 3. Open Browser
- 🔍 Search: http://localhost:3000/knowledge/search
- 📊 Dashboard: http://localhost:3000/knowledge/dashboard

---

## 🎯 Features

### ✨ Search Page
- Full-text search
- Filter by area (A-E)
- Filter by year (2563-2568)
- Filter by document type
- Pagination support

### 📊 Dashboard
- Total documents: 410
- Statistics by type
- Distribution by area
- Trends by year
- Top keywords
- Recent cases

---

## 📊 Index Summary

**Total**: 410 documents
- Case Notes: 285
- General: 99
- Topics: 25
- Projects: 1

**By Area**:
- A (สิทธิพลเมือง): 6 topics
- B (สิทธิทางเศรษฐกิจ): 6 topics
- C (สิทธิของกลุ่มบุคคล): 7 topics
- D (สถานการณ์พื้นที่): 3 topics
- E (เพิ่มเติม): 2 topics

**By Year (B.E.)**:
2563: 3 | 2564: 60 | 2565: 20 | 2566: 62 | 2567: 64 | 2568: 68 | 2569: 8

---

## 🛠️ Stack

**Backend**: Python (Obsidian Parser, JSON Index)
**Frontend**: Next.js 16 + React 19 + Tailwind CSS
**Data**: 410 documents, JSON index (11MB)
**Performance**: <100ms search response

---

## 📚 Documentation

| File | Purpose |
|------|---------|
| `QUICK_START.md` | 5-minute quick start |
| `HOW_TO_RUN.md` | Detailed instructions |
| `PHASE1_SUMMARY.md` | Backend docs |
| `PHASE2_SUMMARY.md` | Frontend docs |
| `HYBRID_RAG_SETUP.md` | Integration guide |

---

## 🔧 Troubleshooting

### Port 3000 in use?
```bash
cd web && npm run dev -- -p 3001
```

### Dependencies missing?
```bash
cd web && npm install
```

### Index not found?
```bash
python setup_obsidian_index.py
```

---

## 🚀 Ready to Go!

```bash
START_WEB.cmd
# Open http://localhost:3000/knowledge/search
```

**Happy searching!** 🔍
