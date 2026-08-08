# ⚡ Quick Start: NHRC Hybrid RAG System

## 🎯 สิ่งที่ได้ในโปรเจกต์นี้

Hybrid RAG system ที่รวม:
- 📚 **Phase 1**: Obsidian Parser + Structured Index (Python)
- 🌐 **Phase 2**: Web UI + API Routes (Next.js)
- 🔍 **Hybrid Search**: Structured filtering + Semantic ready
- 📊 **Dashboard**: Statistics and insights

---

## ✅ Phase 1 Status: COMPLETE

### ✨ Obsidian Parser
```bash
cd D:\human-rights-rag

# Generate index from Obsidian vault
python setup_obsidian_index.py
```

**Output**: `data/nhrc_index.json` (410 documents)

### Files Created
- ✅ `src/obsidian_parser.py` - Parse Obsidian vault
- ✅ `src/json_index.py` - Structured index (JSON-based)
- ✅ `data/nhrc_index.json` - Generated index
- ✅ `PHASE1_SUMMARY.md` - Full documentation

---

## ✅ Phase 2 Status: COMPLETE

### 🌐 Web Application
```bash
cd D:\human-rights-rag\web

# Install dependencies
npm install

# Run development server
npm run dev
```

**Access**:
- Search: http://localhost:3000/knowledge/search
- Dashboard: http://localhost:3000/knowledge/dashboard

### Files Created
- ✅ API Routes (search, case details, stats)
- ✅ React Components (SearchUI, Dashboard)
- ✅ Custom Hooks (useHybridSearch)
- ✅ Pages (search, dashboard)
- ✅ `PHASE2_SUMMARY.md` - Full documentation

---

## 🚀 Deployment

### Option 1: Local Development
```bash
# Terminal 1: Python (if using with Streamlit)
cd D:\human-rights-rag
streamlit run app.py

# Terminal 2: Node.js
cd D:\human-rights-rag\web
npm run dev
```

### Option 2: Docker (Production)
```bash
# Build and run with Docker
docker-compose up
```

### Option 3: Cloud (Vercel)
```bash
# Deploy Next.js app to Vercel
cd web
vercel deploy
```

---

## 📋 API Endpoints

All endpoints return JSON responses.

### Search
```bash
# Full-text search
GET /api/search/hybrid?q=ทรมาน&limit=20

# Filter by area
GET /api/search/hybrid?area=A&type=case_note

# Filter by year
GET /api/search/hybrid?year=2567&type=case_note

# POST with advanced filters
POST /api/search/hybrid
Body: {
  "query": "ทรมาน",
  "areaCode": "A",
  "yearBuddhist": 2567,
  "docType": "case_note",
  "limit": 20
}
```

### Case Details
```bash
# Get case by ID with related cases
GET /api/case/103-2564
```

### Statistics
```bash
# Get overall statistics
GET /api/stats

# Get area-specific statistics
GET /api/stats?area=A
```

---

## 📚 Documentation Files

| File | Purpose |
|------|---------|
| `PHASE1_SUMMARY.md` | Python backend, indexing, metadata |
| `PHASE2_SUMMARY.md` | Next.js app, API routes, components |
| `HYBRID_RAG_SETUP.md` | Integration guide, usage examples |
| `QUICK_START.md` | This file - get started fast |

---

## 🔧 Configuration

### Python (.env)
```env
OBSIDIAN_VAULT_PATH=D:\back up\รายงานและข้อเสนอแนะ กสม
INDEX_JSON_PATH=data/nhrc_index.json
```

### Node.js (.env.local)
```env
NEXT_PUBLIC_API_URL=http://localhost:3000/api
```

---

## 📊 Index Structure (410 documents)

```
By Type:
  - Case Notes: 285 (70%)
  - General: 99 (24%)
  - Topics: 25 (6%)
  - Projects: 1 (<1%)

By Area:
  - A (สิทธิพลเมือง): 6 topics
  - B (สิทธิทางเศรษฐกิจ): 6 topics
  - C (สิทธิของกลุ่มบุคคล): 7 topics
  - D (สถานการณ์พื้นที่): 3 topics
  - E (เพิ่มเติม): 2 topics

By Year (B.E.):
  2563: 3, 2564: 60, 2565: 20, 2566: 62, 2567: 64, 2568: 68, 2569: 8
```

---

## 🎯 Key Features

### ✨ Search
- Full-text search in titles & keywords
- Filter by area (A-E)
- Filter by year (2563-2568)
- Filter by document type
- Pagination support
- Fast (<100ms)

### 📊 Dashboard
- Total document statistics
- Documents by type (pie chart)
- Cases by area (bar chart)
- Cases by year (trend chart)
- Top keywords
- Recent cases

### 🔍 Case Details
- Full case information
- Related cases by keywords
- Cases in same area
- Metadata display

---

## 💻 System Requirements

### Python (Phase 1)
- Python 3.11+
- 2GB RAM minimum
- ~500MB disk space

### Node.js (Phase 2)
- Node.js 18+
- npm or yarn
- 500MB disk space

### Browser (Frontend)
- Chrome/Firefox/Safari/Edge (modern versions)
- JavaScript enabled

---

## 🐛 Troubleshooting

### Index not loading
```bash
# Regenerate index
python setup_obsidian_index.py

# Verify index exists
ls -la data/nhrc_index.json
```

### Web app won't start
```bash
# Clear cache
cd web
rm -rf .next node_modules
npm install
npm run dev
```

### Search returns no results
- Check filters (area, year, type)
- Try broader query
- Check if index is loaded

---

## 📞 Support

1. Check documentation files for detailed info
2. Review API response status codes
3. Check browser console for errors
4. Verify index file exists and is valid JSON

---

## 🚀 Next Features (Phase 3)

- [ ] ChromaDB semantic search integration
- [ ] AI case summarization
- [ ] Export to CSV/PDF
- [ ] Case comparison view
- [ ] Advanced analytics
- [ ] Auto-sync Obsidian
- [ ] User authentication

---

## 📄 License

NHRC Human Rights RAG System - Internal Use

---

**Ready to use!** Start with Phase 1 setup, then explore the web UI. 🎉

For detailed documentation, see:
- Phase 1: `PHASE1_SUMMARY.md`
- Phase 2: `PHASE2_SUMMARY.md`
- Integration: `HYBRID_RAG_SETUP.md`
