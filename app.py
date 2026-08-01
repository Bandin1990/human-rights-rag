from __future__ import annotations

import base64
import html
from pathlib import Path
from typing import Any

import streamlit as st

from src.config import get_config
from src.embeddings import SentenceTransformerEmbedder
from src.ingestion import delete_document, ingest_document_bytes, ocr_and_index_document, rebuild_index
from src.ocr import get_ocr_status
from src.rag import OllamaClient, RagService
from src.retrieval import DocumentRetriever
from src.security import SecurityError, safe_document_path
from src.vector_store import ChromaVectorStore, DocumentRegistry


ALL = "ทั้งหมด"
NEW_VALUE = "เพิ่มรายการใหม่..."
UNKNOWN = "ไม่ระบุ"
APP_TITLE = "ระบบสืบค้นเอกสารสิทธิมนุษยชนภาษาไทย"
FONT_DIR = Path(__file__).resolve().parent / "assets" / "fonts"


st.set_page_config(page_title=APP_TITLE, page_icon="HR", layout="wide")


def apply_theme() -> None:
    font_css = local_font_faces()
    st.markdown(
        "<style>"
        + font_css
        + """
        :root {
            --hr-border: #d8dee8;
            --hr-soft: #f6f8fb;
            --hr-accent: #1d5b79;
            --hr-accent-2: #b23a48;
            --hr-text: #1f2933;
        }
        html, body, [class*="css"], .stApp, .stMarkdown, .stTextInput, .stSelectbox,
        .stMultiSelect, .stTextArea, .stButton, .stNumberInput, .stFileUploader,
        [data-testid="stSidebar"], [data-testid="stWidgetLabel"] {
            font-family: "Bai Jamjuree", "Noto Sans Thai", "Segoe UI", Tahoma, sans-serif;
        }
        .stApp {
            background: linear-gradient(180deg, #f4f7fb 0%, #ffffff 280px);
            color: var(--hr-text);
        }
        [data-testid="stSidebar"] {
            background: #ffffff;
            border-right: 1px solid var(--hr-border);
        }
        h1, h2, h3 {
            letter-spacing: 0;
        }
        h1 {
            font-size: 2rem;
            font-weight: 750;
            color: #123042;
            margin-bottom: 0.15rem;
        }
        h2 {
            color: #18394f;
            font-size: 1.45rem;
            margin-top: 0.4rem;
        }
        h3 {
            color: #24465d;
            font-size: 1.05rem;
        }
        div[data-testid="stMetric"] {
            background: #ffffff;
            border: 1px solid var(--hr-border);
            border-radius: 8px;
            padding: 14px 16px;
        }
        div[data-testid="stExpander"] {
            background: #ffffff;
            border: 1px solid var(--hr-border);
            border-radius: 8px;
        }
        .hr-hero {
            border: 1px solid var(--hr-border);
            background: linear-gradient(135deg, #ffffff 0%, #eef6fa 100%);
            border-radius: 8px;
            padding: 24px 26px;
            margin-bottom: 18px;
        }
        .hr-hero p {
            margin: 6px 0 0 0;
            color: #52616f;
            max-width: 900px;
        }
        .hr-callout {
            border-left: 4px solid var(--hr-accent);
            background: #eef6fa;
            padding: 12px 14px;
            border-radius: 6px;
            margin: 10px 0 16px 0;
        }
        .hr-warning {
            border-left-color: var(--hr-accent-2);
            background: #fff4f4;
        }
        .hr-doc-row {
            border: 1px solid var(--hr-border);
            border-radius: 8px;
            padding: 12px 14px;
            background: #ffffff;
            margin-bottom: 10px;
        }
        .hr-pill {
            display: inline-block;
            border: 1px solid #c8d7e1;
            border-radius: 999px;
            padding: 2px 9px;
            margin: 2px 4px 2px 0;
            background: #f7fbfd;
            color: #24465d;
            font-size: 0.86rem;
        }
        .hr-ocr {
            border: 1px dashed #d6a2a8;
            background: #fff7f7;
            border-radius: 8px;
            padding: 10px 12px;
            margin-top: 8px;
        }
        .hr-muted {
            color: #667085;
            font-size: 0.92rem;
        }
        .stButton > button {
            border-radius: 6px;
        }
        </style>
        """,
        unsafe_allow_html=True,
    )


def local_font_faces() -> str:
    weights = {
        "Regular": 400,
        "Medium": 500,
        "SemiBold": 600,
        "Bold": 700,
    }
    faces: list[str] = []
    for name, weight in weights.items():
        path = FONT_DIR / f"BaiJamjuree-{name}.ttf"
        if not path.exists():
            continue
        encoded = base64.b64encode(path.read_bytes()).decode("ascii")
        faces.append(
            f"""
            @font-face {{
                font-family: "Bai Jamjuree";
                src: url(data:font/truetype;charset=utf-8;base64,{encoded}) format("truetype");
                font-weight: {weight};
                font-style: normal;
                font-display: swap;
            }}
            """
        )
    return "\n".join(faces)


@st.cache_resource
def resources():
    config = get_config()
    registry = DocumentRegistry(config.metadata_path)
    store = ChromaVectorStore(config.chroma_dir, config.chroma_collection_name)
    embedder = SentenceTransformerEmbedder(config.embedding_model_name)
    retriever = DocumentRetriever(store, embedder)
    rag = RagService(OllamaClient(config.ollama_base_url, config.ollama_model_name))
    return config, registry, store, embedder, retriever, rag


def year_to_buddhist(year: int) -> int:
    return year + 543


def normalize_year(input_year: int, calendar: str) -> int:
    if calendar == "พ.ศ.":
        return input_year - 543
    return input_year


def year_label(year: int) -> str:
    return f"{year_to_buddhist(year)} (ค.ศ. {year})"


def clean_options(values: list[str], defaults: list[str] | None = None) -> list[str]:
    seen: set[str] = set()
    options: list[str] = []
    for value in (defaults or []) + values:
        normalized = value.strip()
        if not normalized or normalized == UNKNOWN or normalized in seen:
            continue
        seen.add(normalized)
        options.append(normalized)
    return options


def split_categories(value: str) -> list[str]:
    return [
        part.strip()
        for part in value.replace("|", ",").replace(";", ",").split(",")
        if part.strip() and part.strip() != UNKNOWN
    ]


def join_categories(values: list[str]) -> str:
    cleaned = clean_options(values)
    return ", ".join(cleaned) if cleaned else UNKNOWN


def reusable_value_input(
    label: str,
    existing_values: list[str],
    *,
    defaults: list[str],
    fallback: str,
    key_prefix: str,
) -> str:
    options = clean_options(existing_values, defaults)
    selected = st.selectbox(label, options + [NEW_VALUE], key=f"{key_prefix}-select")
    custom = st.text_input(
        f"{label}ใหม่",
        placeholder=f"พิมพ์เมื่อต้องการเพิ่ม{label}ใหม่",
        key=f"{key_prefix}-custom",
    )
    if custom.strip():
        return custom.strip()
    if selected == NEW_VALUE:
        return fallback
    return selected or fallback


def rights_categories_input(
    existing_values: list[str],
    *,
    defaults: list[str],
    key_prefix: str,
) -> str:
    options = clean_options(
        [category for value in existing_values for category in split_categories(value)],
        defaults,
    )
    selected = st.multiselect(
        "หมวดสิทธิ",
        options,
        default=[],
        placeholder="เลือกได้มากกว่า 1 หมวด",
        key=f"{key_prefix}-multi",
    )
    custom = st.text_input(
        "หมวดสิทธิใหม่",
        placeholder="พิมพ์เพิ่มได้ คั่นหลายหมวดด้วยเครื่องหมาย ,",
        key=f"{key_prefix}-custom",
    )
    custom_values = split_categories(custom)
    return join_categories(selected + custom_values)


def filter_inputs(registry: DocumentRegistry, prefix: str = "") -> dict[str, Any]:
    docs = registry.list_documents()
    years = sorted({doc.year for doc in docs}, reverse=True)
    types = sorted({doc.document_type for doc in docs if doc.document_type}, key=str.casefold)
    categories = clean_options(
        [category for doc in docs for category in split_categories(doc.rights_category)]
    )

    cols = st.columns([1.2, 1.4, 1.8, 1])
    with cols[0]:
        year_options = [ALL] + [year_label(year) for year in years]
        selected_year = st.selectbox("ปีเอกสาร", year_options, key=f"{prefix}year")
    with cols[1]:
        document_type = st.selectbox("ประเภทเอกสาร", [ALL] + types, key=f"{prefix}type")
    with cols[2]:
        rights_category = st.multiselect(
            "หมวดสิทธิ",
            categories,
            key=f"{prefix}category",
            placeholder="เลือกได้มากกว่า 1 หมวด",
        )
    with cols[3]:
        top_k = st.slider("จำนวนผลลัพธ์", 1, 20, 5, key=f"{prefix}topk")

    year = ALL
    if selected_year != ALL:
        year = years[year_options.index(selected_year) - 1]

    return {
        "year": year,
        "document_type": document_type,
        "rights_category": rights_category,
        "top_k": top_k,
    }


def show_intro(page_description: str) -> None:
    st.markdown(
        f"""
        <div class="hr-hero">
            <h1>{APP_TITLE}</h1>
            <p>{html.escape(page_description)}</p>
        </div>
        """,
        unsafe_allow_html=True,
    )


def show_results(results) -> None:
    if not results:
        st.info("ไม่พบข้อความที่ตรงกับเงื่อนไข")
        return
    for index, item in enumerate(results, start=1):
        title = item.metadata.get("title", "ไม่ทราบชื่อเอกสาร")
        page = item.metadata.get("page_number", "")
        score = item.score
        with st.expander(f"{index}. {title} หน้า {page} · similarity {score:.3f}", expanded=index <= 3):
            st.write(item.text)
            st.caption(
                f"document_id: {item.metadata.get('document_id', '')} · "
                f"ประเภท: {item.metadata.get('document_type', '')} · "
                f"หมวดสิทธิ: {item.metadata.get('rights_category', '')} · "
                f"ปี: {year_label(int(item.metadata.get('year', 0) or 0)) if item.metadata.get('year') else '-'}"
            )


def pdf_link(config, file_name: str, label: str) -> None:
    try:
        path = safe_document_path(config.documents_dir, file_name)
    except SecurityError:
        return
    if path.exists():
        href = f"file:///{Path(path).as_posix()}"
        st.markdown(f"[{html.escape(label)}]({href})")


def ocr_next_steps() -> None:
    status = get_ocr_status()
    st.markdown(
        """
        <div class="hr-callout hr-warning">
        <strong>เอกสารนี้ยังค้นหาไม่ได้ เพราะไม่มีข้อความให้ระบบอ่าน</strong><br>
        PDF แบบสแกนเป็นรูปภาพต้องแปลงเป็น searchable PDF ด้วย OCR ก่อน ระบบจะพยายามช่วยทำให้ได้ในเครื่องนี้
        </div>
        """,
        unsafe_allow_html=True,
    )
    if status.available:
        st.info("พบ OCRmyPDF แล้ว สามารถกดทำ OCR จากรายการเอกสารด้านล่างได้")
    else:
        st.warning(status.message)
        st.markdown(
            """
            วิธีเปิดความสามารถ OCR อัตโนมัติแบบ local:
            1. ติดตั้ง Tesseract OCR และภาษาไทย (`tha`)
            2. ติดตั้ง OCRmyPDF
            3. เปิดเว็บใหม่ แล้วกดปุ่ม `ทำ OCR` ในรายการเอกสาร

            หากยังไม่ติดตั้ง สามารถใช้ Adobe Acrobat หรือเครื่องมือ OCR ภายในองค์กรแปลงเป็น searchable PDF แล้วอัปโหลดใหม่ได้
            """
        )


def page_documents(config, registry, store, embedder) -> None:
    show_intro("นำเข้า PDF ที่มี text layer หรือไฟล์ Markdown, เก็บ metadata, และจัดทำดัชนีสำหรับค้นหาตามความหมายบนเครื่องนี้")

    docs = registry.list_documents()
    existing_types = [doc.document_type for doc in docs]
    existing_categories = [doc.rights_category for doc in docs]

    st.subheader("นำเอกสารเข้าระบบ")
    with st.form("upload_form"):
        uploaded = st.file_uploader("เลือกไฟล์ PDF หรือ Markdown", type=["pdf", "md", "markdown"])
        title = st.text_input("ชื่อเอกสาร", placeholder="เช่น รายงานผลการตรวจสอบเรื่อง...")

        cols = st.columns([1.3, 1.3, 1, 1])
        with cols[0]:
            document_type = reusable_value_input(
                "ประเภทเอกสาร",
                existing_types,
                defaults=["รายงานตรวจสอบ", "รายงานประจำปี", "คำวินิจฉัย", "ข้อเสนอแนะ", "คู่มือ"],
                fallback=UNKNOWN,
                key_prefix="doc-type",
            )
        with cols[1]:
            rights_category = rights_categories_input(
                existing_categories,
                defaults=[
                    "สิทธิชุมชน",
                    "สิทธิในกระบวนการยุติธรรม",
                    "สิทธิแรงงาน",
                    "สิทธิเด็ก",
                    "สิทธิผู้สูงอายุ",
                    "สิทธิคนพิการ",
                ],
                key_prefix="rights-category",
            )
        with cols[2]:
            calendar = st.segmented_control("รูปแบบปี", ["พ.ศ.", "ค.ศ."], default="พ.ศ.")
        with cols[3]:
            default_year = 2567 if calendar == "พ.ศ." else 2024
            min_year = 2400 if calendar == "พ.ศ." else 1900
            max_year = 2700 if calendar == "พ.ศ." else 2100
            input_year = st.number_input("ปีเอกสาร", min_value=min_year, max_value=max_year, value=default_year)

        chunk_cols = st.columns(2)
        chunk_size = chunk_cols[0].number_input("ขนาด chunk", 200, 4000, config.chunk_size, step=100)
        chunk_overlap = chunk_cols[1].number_input("ข้อความซ้อนทับ", 0, 1000, config.chunk_overlap, step=50)
        submitted = st.form_submit_button("นำเอกสารเข้าระบบ", type="primary", use_container_width=True)

    if submitted:
        if uploaded is None:
            st.warning("กรุณาเลือกไฟล์ PDF หรือ Markdown")
        else:
            year = normalize_year(int(input_year), str(calendar))
            try:
                with st.spinner("กำลังอ่านเอกสารและจัดทำดัชนีในเครื่อง..."):
                    result = ingest_document_bytes(
                        content=uploaded.getvalue(),
                        original_file_name=uploaded.name,
                        title=title or uploaded.name,
                        document_type=document_type,
                        year=year,
                        rights_category=rights_category,
                        config=config,
                        registry=registry,
                        store=store,
                        embedder=embedder,
                        chunk_size=int(chunk_size),
                        chunk_overlap=int(chunk_overlap),
                    )
                if result.duplicate:
                    st.info("เอกสารนี้เคยถูกนำเข้าแล้ว จึงไม่ทำดัชนีซ้ำ")
                elif result.needs_ocr:
                    st.warning("อ่าน text layer ไม่พบหรือพบน้อยมาก")
                    ocr_next_steps()
                else:
                    st.success(f"นำเข้าเอกสารแล้ว สร้าง {result.chunk_count} chunks")
            except Exception as exc:
                st.error(str(exc))

    st.subheader("เอกสารในระบบ")
    docs = registry.list_documents()
    if not docs:
        st.info("ยังไม่มีเอกสาร")
        return

    for doc in docs:
        st.markdown('<div class="hr-doc-row">', unsafe_allow_html=True)
        cols = st.columns([3, 1.5, 1.5, 1.4, 0.8])
        cols[0].markdown(f"**{html.escape(doc.title)}**")
        cols[0].caption(doc.file_name)
        cols[1].write(doc.document_type)
        cols[2].markdown(
            " ".join(
                f'<span class="hr-pill">{html.escape(category)}</span>'
                for category in split_categories(doc.rights_category)
            )
            or UNKNOWN,
            unsafe_allow_html=True,
        )
        cols[3].write(year_label(doc.year))
        if cols[4].button("ลบ", key=f"delete-{doc.document_id}", use_container_width=True):
            delete_document(doc.document_id, config=config, registry=registry, store=store)
            st.rerun()
        pdf_link(config, doc.file_name, "เปิดไฟล์ต้นฉบับ")
        if doc.ocr_required:
            st.markdown(
                '<div class="hr-ocr"><strong>เอกสารนี้ยังต้องทำ OCR</strong><br>'
                "ยังไม่มี text layer เพียงพอ จึงยังค้นหา/ถามตอบจากเอกสารนี้ไม่ได้</div>",
                unsafe_allow_html=True,
            )
            status = get_ocr_status()
            ocr_cols = st.columns([1.2, 3])
            if status.available:
                if ocr_cols[0].button("ทำ OCR", key=f"ocr-{doc.document_id}", use_container_width=True):
                    with st.spinner("กำลังทำ OCR ในเครื่องและสร้างดัชนีใหม่..."):
                        result = ocr_and_index_document(
                            doc.document_id,
                            config=config,
                            registry=registry,
                            store=store,
                            embedder=embedder,
                            chunk_size=config.chunk_size,
                            chunk_overlap=config.chunk_overlap,
                        )
                    if result.needs_ocr:
                        st.warning("ทำ OCR แล้ว แต่ยังอ่านข้อความได้น้อยมาก กรุณาตรวจไฟล์ต้นฉบับหรือภาษา OCR")
                    else:
                        st.success(f"ทำ OCR และสร้างดัชนีแล้ว {result.chunk_count} chunks")
                        st.rerun()
            else:
                ocr_cols[0].button("ทำ OCR", disabled=True, key=f"ocr-disabled-{doc.document_id}", use_container_width=True)
                ocr_cols[1].caption("ยังไม่พบ OCRmyPDF/Tesseract ในเครื่อง จึงยังทำ OCR อัตโนมัติไม่ได้")
        st.markdown("</div>", unsafe_allow_html=True)


def page_search(registry, retriever) -> None:
    show_intro("ค้นหาข้อความจากเอกสารด้วย semantic search พร้อมดูข้อความต้นฉบับและคะแนน similarity ก่อนนำไปใช้")
    filters = filter_inputs(registry, "search-")
    query = st.text_area("คำค้นภาษาไทย", height=110, placeholder="เช่น ข้อเสนอแนะเกี่ยวกับสิทธิชุมชน")
    if st.button("ค้นหา", type="primary"):
        with st.spinner("กำลังค้นหาตามความหมาย..."):
            results = retriever.search(query, top_k=filters.pop("top_k"), filters=filters)
        show_results(results)


def page_rag(config, registry, retriever, rag) -> None:
    show_intro("ถามคำถามภาษาไทยและให้ระบบตอบจากเอกสารที่นำเข้าเท่านั้น พร้อม citation จาก metadata จริง")
    filters = filter_inputs(registry, "rag-")
    question = st.text_area("คำถามภาษาไทย", height=110, placeholder="เช่น เอกสารเสนอให้หน่วยงานดำเนินการอย่างไร")
    if st.button("ถามจากเอกสาร", type="primary"):
        with st.spinner("กำลังค้น context..."):
            results = retriever.search(question, top_k=filters.pop("top_k"), filters=filters)
        st.subheader("ข้อความที่ค้นพบก่อนเรียก LLM")
        show_results(results)
        with st.spinner("กำลังให้ Ollama ตอบจาก context..."):
            answer = rag.answer(question, results)
        st.subheader("คำตอบ")
        if not answer.ollama_available:
            st.warning("Ollama ยังไม่พร้อมใช้งาน จึงยังไม่เรียก LLM")
        st.write(answer.answer)
        st.subheader("แหล่งอ้างอิง")
        if not answer.citations:
            st.info("ไม่มีแหล่งอ้างอิง")
        for index, citation in enumerate(answer.citations, start=1):
            with st.expander(f"{index}. {citation.title} หน้า {citation.page_number}", expanded=True):
                st.write(citation.text)
                pdf_link(config, citation.file_name, "เปิดไฟล์ต้นฉบับที่เกี่ยวข้อง")


def page_status(config, registry, store, embedder) -> None:
    show_intro("ตรวจจำนวนเอกสาร จำนวน chunks สถานะ Ollama และ rebuild index จากไฟล์ที่เก็บไว้ในเครื่อง")
    docs = registry.list_documents()
    col1, col2, col3 = st.columns(3)
    col1.metric("เอกสาร", len(docs))
    try:
        chunk_count = store.count()
    except Exception as exc:
        chunk_count = 0
        st.warning(f"ยังอ่านสถานะ Chroma ไม่ได้: {exc}")
    col2.metric("Chunks", chunk_count)
    col3.metric("โมเดลตอบคำถาม", config.ollama_model_name)
    st.caption(f"Embedding model: {config.embedding_model_name}")
    st.caption(f"Ollama URL: {config.ollama_base_url}")

    cols = st.columns(2)
    if cols[0].button("ตรวจสถานะ Ollama", use_container_width=True):
        rag = RagService(OllamaClient(config.ollama_base_url, config.ollama_model_name))
        st.write("พร้อมใช้งาน" if rag.ollama.is_available() else "ยังไม่พร้อมใช้งาน")
    if cols[1].button("Rebuild index", use_container_width=True):
        with st.spinner("กำลังสร้างดัชนีใหม่จากเอกสารที่เก็บในเครื่อง..."):
            total = rebuild_index(
                config=config,
                registry=registry,
                store=store,
                embedder=embedder,
                chunk_size=config.chunk_size,
                chunk_overlap=config.chunk_overlap,
            )
        st.success(f"rebuild แล้ว {total} chunks")


def main() -> None:
    apply_theme()
    config, registry, store, embedder, retriever, rag = resources()
    st.sidebar.title("เมนู")
    st.sidebar.caption("เอกสารและดัชนีทั้งหมดอยู่บนเครื่องนี้")
    page = st.sidebar.radio(
        "เลือกหน้า",
        ["อัปโหลดและจัดการเอกสาร", "ค้นหาเอกสาร", "ถามตอบด้วย RAG", "สถานะการจัดทำดัชนี"],
    )
    if page == "อัปโหลดและจัดการเอกสาร":
        page_documents(config, registry, store, embedder)
    elif page == "ค้นหาเอกสาร":
        page_search(registry, retriever)
    elif page == "ถามตอบด้วย RAG":
        page_rag(config, registry, retriever, rag)
    else:
        page_status(config, registry, store, embedder)


if __name__ == "__main__":
    main()
