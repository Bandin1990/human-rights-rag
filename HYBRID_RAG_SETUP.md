# 🚀 Hybrid RAG Setup Guide

## What's New in Phase 1

Kami telah mengintegrasikan Obsidian vault NHRC ke dalam sistem RAG hybrid dengan kemampuan pencarian terstruktur + semantik.

### ✨ Fitur Baru
- 📊 **Structured Index**: Pencarian cepat berdasarkan tahun, area, tipe dokumen
- 🔗 **Hybrid Search**: Kombinasi structured + semantic search
- 📁 **Obsidian Parser**: Ekstraksi metadata otomatis dari markdown
- 📈 **Statistics**: Agregasi data (cases by year, area distribution, etc.)

---

## 📦 Quick Start

### 1. Setup Index
```bash
cd D:\human-rights-rag
python setup_obsidian_index.py
```

### 2. Check Index
```bash
ls -la data/nhrc_index.json
```

### 3. Use in Code

#### Python
```python
from src.json_index import JSONIndex

# Load index
index = JSONIndex('data/nhrc_index.json')

# Search cases
results = index.search_by_filters(
    area_code='A',              # Area A: สิทธิพลเมือง
    year_buddhist=2567,         # Year 2567
    doc_type='case_note',       # Only cases
    limit=10
)

# Get case by ID
case = index.search_case_by_id('103-2564')

# Get stats
stats = index.get_statistics()
print(f"Total: {stats['total_documents']}")
print(f"Cases by year: {stats['cases_by_year']}")
```

#### Streamlit (Existing App)
```python
from src.json_index import JSONIndex

index = JSONIndex('data/nhrc_index.json')

# Add to sidebar
area = st.selectbox("Area", ["All"] + list("ABCDE"))
year = st.selectbox("Year", [None, 2564, 2567, 2568])

results = index.search_by_filters(
    area_code=area if area != "All" else None,
    year_buddhist=year,
    doc_type='case_note'
)

# Display results
for doc in results:
    st.write(f"**{doc['case_id']}**: {doc['title']}")
```

---

## 📊 Index Structure

### Document Schema
```json
{
  "document_id": "case_103_2564",
  "case_id": "103-2564",
  "file_name": "103-2564_จนท.รัฐซ้อมทรมาน.md",
  "file_path": "D:\\...\\03 กรณีตรวจสอบ\\ปี 2564\\...",
  "document_type": "case_note",
  "area_code": "A",
  "area_name": "สิทธิพลเมืองและสิทธิทางการเมือง",
  "year": 2021,              # Gregorian
  "year_buddhist": 2564,     # Buddhist
  "title": "เจ้าหน้าที่รัฐซ้อมทรมาน...",
  "keywords": ["ทรมาน", "ยุติธรรม", ...],
  "page_count": 2,
  "uploaded_at": "2024-01-15T10:00:00Z"
}
```

---

## 🔍 Search Methods

### By Area & Year
```python
results = index.search_by_filters(
    area_code='B',           # สิทธิทางเศรษฐกิจ
    year_buddhist=2567,
    doc_type='case_note',
    limit=20
)
```

### By Year Range
```python
results = index.search_by_filters(
    year_range=(2020, 2024),  # Gregorian years
    limit=50
)
```

### By Keywords
```python
results = index.search_by_filters(
    keywords=['ทรมาน', 'เลือกปฏิบัติ'],
    limit=30
)
```

### Get Case by ID
```python
case = index.search_case_by_id('128-2563')
if case:
    print(case['title'])
    print(case['keywords'])
```

---

## 📈 Statistics

```python
stats = index.get_statistics()

# Total documents
print(stats['total_documents'])  # 410

# By type
print(stats['by_type'])
# {'case_note': 285, 'general': 99, 'topic': 25, 'project': 1}

# By area
print(stats['by_area'])
# {'A': 6, 'B': 6, 'C': 7, 'D': 3, 'E': 2}

# Cases by year
print(stats['cases_by_year'])
# {'2564': 60, '2567': 64, '2568': 68, ...}
```

---

## 🔄 Integration with Existing RAG

### Current Pipeline
```
Obsidian → Parser → Index → RAG (Ollama)
                      ↓
                   ChromaDB
```

### Planned Integration
1. **Ingestion**: Use `ObsidianParser` in `src/ingestion.py`
2. **Retrieval**: Use `HybridSearch` in `src/retrieval.py`
3. **Ranking**: Combine structured filters + semantic similarity

### Example
```python
from src.obsidian_parser import ObsidianParser
from src.json_index import JSONIndex

# Parse & Index
parser = ObsidianParser(vault_path)
docs = parser.parse_vault()

index = JSONIndex()
index.add_documents_batch(docs)

# Use in RAG
results = index.search_by_filters(
    year_buddhist=2567,
    area_code='A',
    limit=10
)

# Pass to ChromaDB for semantic search
for doc in results:
    chunks = split_document(doc['content'])
    # Store in ChromaDB...
```

---

## 📁 File Structure

```
D:\human-rights-rag\
├── src/
│   ├── obsidian_parser.py    ✨ NEW: Parse Obsidian vault
│   ├── json_index.py         ✨ NEW: Structured index
│   ├── structured_index.py   ✨ NEW: SQL-based index (optional)
│   ├── hybrid_search.py      ✨ NEW: Hybrid search interface
│   ├── pdf_loader.py
│   ├── markdown_loader.py
│   ├── chunking.py
│   ├── embeddings.py
│   ├── vector_store.py
│   ├── retrieval.py
│   └── rag.py
│
├── data/
│   ├── documents/            # Uploaded PDFs/MDs
│   ├── chroma/               # ChromaDB vector store
│   └── nhrc_index.json       ✨ NEW: Generated index
│
├── setup_obsidian_index.py   ✨ NEW: Setup script
├── PHASE1_SUMMARY.md         ✨ NEW: Detailed summary
└── HYBRID_RAG_SETUP.md       ✨ NEW: This file
```

---

## ⚙️ Configuration

### Update .env (if needed)
```env
# Obsidian Vault Path
OBSIDIAN_VAULT_PATH=D:\back up\รายงานและข้อเสนอแนะ กสม

# Index Path
INDEX_DB_PATH=data/nhrc_index.db
INDEX_JSON_PATH=data/nhrc_index.json
```

### Update app.py (Streamlit)
```python
from src.json_index import JSONIndex

# In your Streamlit app
index = JSONIndex('data/nhrc_index.json')

# Add filters to search page
col1, col2, col3 = st.columns(3)
with col1:
    area = st.selectbox("Area", ["All"] + list("ABCDE"))
with col2:
    year = st.number_input("Year (B.E.)", min_value=2563, max_value=2569)
with col3:
    results = index.search_by_filters(
        area_code=area if area != "All" else None,
        year_buddhist=year if year else None,
        limit=20
    )
```

---

## 🧪 Testing

### Run Tests
```bash
cd D:\human-rights-rag

# Test parser
python -c "from src.obsidian_parser import ObsidianParser; parser = ObsidianParser(...); print(len(parser.parse_vault()))"

# Test index
python -c "from src.json_index import JSONIndex; index = JSONIndex(); print(index.get_statistics())"

# Full setup
python setup_obsidian_index.py
```

### Expected Output
```
🚀 NHRC Hybrid RAG Setup

📚 Step 1: Parsing Obsidian vault...
   ✅ Parsed 410 documents

📝 Step 2: Creating structured index...
   ✅ Added: 410, Skipped: 0

💾 Step 3: Exporting metadata...
   ✅ Exported to: data/nhrc_index.json

📊 Step 4: Index Statistics
   Total documents: 410
   By type: {'case_note': 285, 'general': 99, 'topic': 25, 'project': 1}
   ...
```

---

## 🚀 Next: Phase 2

### Planned for Phase 2
1. **Web UI (Next.js)**
   - Advanced search interface
   - Statistics dashboard
   - Case comparison view
   - Export functionality

2. **Semantic Search Integration**
   - ChromaDB integration
   - Embedding-based similarity
   - Hybrid ranking

3. **Additional Features**
   - Auto-sync Obsidian updates
   - Full-text search
   - Related cases recommendation
   - AI summarization

---

## 📞 Support

- Check `PHASE1_SUMMARY.md` for detailed info
- Run `setup_obsidian_index.py` to test
- Review `src/` files for implementation details
- Check `data/nhrc_index.json` for index content

---

**Status**: ✅ Phase 1 Complete - Ready for Phase 2 Integration
