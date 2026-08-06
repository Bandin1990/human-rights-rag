"""
Obsidian Parser for NHRC Human Rights Knowledge Base

Extracts metadata from NHRC Obsidian vault structure:
- Case Notes (03 กรณีตรวจสอบ): Case ID, Year, Title
- Topics/Areas (02 ประเด็นสิทธิ): Area Code, Category
- Projects (01 โปรเจกต์): Project info

Returns standardized metadata dict for indexing.
"""

import re
import yaml
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from datetime import datetime

try:
    from pythainlp.tokenize import word_tokenize
    from pythainlp.corpus import thai_stopwords
except ImportError:
    word_tokenize = None
    thai_stopwords = None


class ObsidianParser:
    """Parser for NHRC Obsidian vault structure"""

    AREA_MAPPING = {
        "A": "สิทธิพลเมืองและสิทธิทางการเมือง",
        "B": "สิทธิทางเศรษฐกิจ สังคม และวัฒนธรรม",
        "C": "สิทธิของกลุ่มบุคคล",
        "D": "สถานการณ์เชิงพื้นที่-เฉพาะ",
        "E": "เพิ่มเติมจากแท็กซอนอมีเดิม"
    }

    # Buddhist year to Gregorian offset
    BUDDHIST_OFFSET = 543

    # Frontmatter tag values that are category markers, not real keywords
    GENERIC_TAGS = {"กรณีตรวจสอบ", "ประเด็นสิทธิ", "โปรเจกต์"}

    # Loose root-level notes that are navigational/planning, not case content
    EXCLUDED_TITLES = {"00 หน้าแรก", "README - เริ่มต้นใช้งาน", "โจทย์วิจัยภาคใต้"}

    # Document-category taxonomy shown in the web UI's document-type filter.
    # "06"-"10" have no vault content yet - see docs/vault-templates/ for the
    # note templates that seed each one once files exist under these folder
    # names (any file there falls through to _parse_generic, same as "04").
    CATEGORY_BY_FOLDER_PREFIX = {
        "03": "รายงานตรวจสอบ/ข้อเสนอแนะ กสม.",
        "04": "งานวิจัย",
        "06": "กฎหมายไทย",
        "07": "กฎหมายสิทธิมนุษยชนระหว่างประเทศและเอกสารตีความ",
        "08": "คลังความรู้ด้านสิทธิมนุษยชน",
        "09": "คำพิพากษาศาลไทย",
        "10": "คำพิพากษาศาลต่างประเทศ",
    }

    # Extra Thai stopwords beyond pythainlp's corpus (filler/structural words
    # that show up constantly in NHRC case notes but carry no search signal)
    EXTRA_STOPWORDS = {
        "กรณี", "เรื่อง", "บันทึก", "รายงาน", "ฉบับ", "หน้า", "ข้อ",
        "และ", "ที่", "จาก", "เป็น", "ว่า", "มี", "ให้", "ได้",
        "เขา", "โดย", "นี้", "เรา", "คน", "ตาม", "ใน", "ของ",
        "ถึง", "จะ", "ยัง", "อื่น", "ๆ", "กับ", "ฉัน", "คุณ",
        "ผู้", "เมื่อ", "มา", "ไป", "ส่วน",
    }

    # [[123-2564_some title - บันทึก|1/2564]] -> captures ("123", "2564")
    # [[79-80-2568_some title - บันทึก|79-80/2568]] -> captures ("79-80", "2568")
    # Must match _parse_case_note's case_id format exactly ("<case_num>-<year>")
    # or joint-case topic backlinks silently fail to resolve (they did, before
    # this was added to match the compound-case-number fix there).
    CASE_REF_PATTERN = re.compile(r'\[\[((?:\d+-)*\d+)-(\d{4})[^\|\]]*\|')
    AREA_FOLDER_PATTERN = re.compile(r'^([A-E])\.\s*(.+)$')
    FRONTMATTER_PATTERN = re.compile(r'^---\s*\n(.*?)\n---\s*\n?', re.DOTALL)
    NON_KEYWORD_TOKEN = re.compile(r'^[0-9๐-๙\.\-_/]+$')
    MARKDOWN_NOISE = re.compile(r'\[\[.*?\]\]|[#>*`_~|←→›»«]+')

    def __init__(self, vault_path: str):
        """
        Initialize parser with vault path

        Args:
            vault_path: Path to Obsidian vault root
        """
        self.vault_path = Path(vault_path)
        if not self.vault_path.exists():
            raise FileNotFoundError(f"Vault path not found: {vault_path}")

        self._stopwords = set(self.EXTRA_STOPWORDS)
        if thai_stopwords is not None:
            self._stopwords |= set(thai_stopwords())

        # case_id -> [area_code, ...] / case_id -> [topic_document_id, ...],
        # both derived from the same backlinks each topic note keeps to the
        # case notes filed under it.
        self.case_area_index, self.case_topic_index = self._build_case_area_index()

    def _build_case_area_index(self) -> Tuple[Dict[str, List[str]], Dict[str, List[str]]]:
        """
        Scan "02 ประเด็นสิทธิ" topic notes and build two indexes:
          - case_id -> area_codes (used for the case detail page / search filter)
          - case_id -> topic document_ids (finer-grained; used to build the
            topic map graph - see setup_obsidian_index.py's _export_graph)

        Each topic note lists the case notes filed under it as wikilinks, e.g.
        "- [[18-2569_สิทธิชุมชน_โรงไฟฟ้าหงสา-น่าน - บันทึก|18/2569]] — ...".
        The wikilink target (not the display alias) always matches the case
        file's own "NUM-YEAR..." naming, so it round-trips exactly with the
        case_id built in _parse_case_note. The topic document_id built here
        must match _parse_topic_area's exactly, since both derive from the
        same folder/filename.
        """
        area_index: Dict[str, List[str]] = {}
        topic_index: Dict[str, List[str]] = {}

        area_root = next(
            (p for p in self.vault_path.iterdir() if p.is_dir() and p.name.startswith("02")),
            None,
        )
        if area_root is None:
            return area_index, topic_index

        for area_folder in area_root.iterdir():
            if not area_folder.is_dir():
                continue
            match = self.AREA_FOLDER_PATTERN.match(area_folder.name)
            if not match:
                continue
            area_code = match.group(1)

            for topic_file in area_folder.glob("*.md"):
                try:
                    text = topic_file.read_text(encoding="utf-8")
                except (UnicodeDecodeError, OSError):
                    continue

                topic_doc_id = f"topic_{area_code}_{topic_file.stem.replace(' ', '_')}"

                for ref in self.CASE_REF_PATTERN.finditer(text):
                    case_id = f"{ref.group(1)}-{ref.group(2)}"
                    areas = area_index.setdefault(case_id, [])
                    if area_code not in areas:
                        areas.append(area_code)
                    topics = topic_index.setdefault(case_id, [])
                    if topic_doc_id not in topics:
                        topics.append(topic_doc_id)

        return area_index, topic_index

    def parse_vault(self) -> List[Dict]:
        """
        Parse entire Obsidian vault and extract metadata

        Returns:
            List of metadata dicts for each document
        """
        documents = []

        # Find all markdown files
        md_files = list(self.vault_path.glob("**/*.md"))

        for md_file in md_files:
            try:
                metadata = self.parse_file(md_file)
                if metadata:
                    documents.append(metadata)
            except Exception as e:
                print(f"Warning: Failed to parse {md_file}: {e}")
                continue

        return documents

    def parse_file(self, file_path: Path) -> Optional[Dict]:
        """
        Parse a single markdown file and extract metadata

        Args:
            file_path: Path to markdown file

        Returns:
            Metadata dict or None if not parseable
        """
        file_path = Path(file_path)

        # Skip non-markdown and special files
        if file_path.suffix.lower() not in ['.md', '.markdown']:
            return None
        if file_path.name.startswith('.'):
            return None

        # Read file
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                raw = f.read()
        except UnicodeDecodeError:
            return None

        frontmatter, content = self._split_frontmatter(raw)

        # Determine document type based on folder structure
        relative_path = file_path.relative_to(self.vault_path)
        path_parts = relative_path.parts

        # Route to appropriate parser
        if path_parts[0].startswith("03"):
            doc = self._parse_case_note(file_path, frontmatter, content, relative_path)
        elif path_parts[0].startswith("02"):
            doc = self._parse_topic_area(file_path, frontmatter, content, relative_path)
        elif path_parts[0].startswith("01") or path_parts[0].startswith("05"):
            # "01 โปรเจกต์" (research-agenda notes) and "05 แม่แบบ" (Obsidian note
            # templates) are internal planning/scaffolding, not case content -
            # keep them out of the search index. The vault files themselves are
            # untouched, so Obsidian's own template picker still works fine.
            return None
        elif path_parts[0] == "human-rights-platform":
            # An entire unrelated software project (node_modules and all -
            # ~370 stray .md files: package READMEs, AGENTS.md, docs/*) ended
            # up copied inside the vault root at some point. Not case
            # content in any sense - exclude outright rather than let it
            # into the public search index as fake "research documents".
            return None
        elif path_parts[0] == "รายงานประเมินสถานการณ์":
            doc = self._parse_situation_report(file_path, frontmatter, content, relative_path)
        elif path_parts[0].startswith("ปี") and re.search(r'\d+', path_parts[0]):
            # Top-level "ปี XXXX" folders are documented (see _find_case_pdf)
            # as the PDF-scan home for every year - .md files aren't
            # supposed to live here at all. For 2569, some raw/duplicate
            # .md source dumps got saved here alongside the PDFs, but the
            # real curated case note for each of those cases already exists
            # under "03 กรณีตรวจสอบ (Case Notes)/ปี XXXX/...- บันทึก.md" with
            # the same case_id - routing these to _parse_case_note too would
            # collide on document_id and risk silently overwriting the good
            # version with the raw one depending on filesystem glob order
            # (verified this almost happened). Exclude outright instead.
            return None
        else:
            doc = self._parse_generic(file_path, frontmatter, content, relative_path)

        if doc is not None and "category" not in doc:
            doc["category"] = self.CATEGORY_BY_FOLDER_PREFIX.get(path_parts[0][:2])
        return doc

    def _split_frontmatter(self, raw: str) -> Tuple[Dict, str]:
        """Split a leading YAML frontmatter block off from the note body."""
        if not raw.startswith("---"):
            return {}, raw

        match = self.FRONTMATTER_PATTERN.match(raw)
        if not match:
            return {}, raw

        try:
            data = yaml.safe_load(match.group(1))
        except yaml.YAMLError:
            data = None

        body = raw[match.end():]
        return (data if isinstance(data, dict) else {}), body

    def _parse_case_note(self, file_path: Path, frontmatter: Dict, content: str, relative_path: Path) -> Optional[Dict]:
        """
        Parse case note from 03 กรณีตรวจสอบ folder

        Expected format: "ID-YEAR_title - บันทึก.md", where ID is usually one
        number but is sometimes several joint case numbers chained with
        dashes for a combined investigation, e.g. "79-80-2568_..." (cases 79
        and 80 filed together) or "203-214-2564_..." (a 12-case batch). The
        (\d{4}) for year relies on Buddhist years always being 4 digits and
        case numbers in this vault never reaching 1000 - true as of writing.
        Example: "128-2563_เลือกปฏิบัติรับผู้ติดเชื้อ HIV - บันทึก.md"
                 "79-80-2568_รัฐค้นจับกุมมิชอบและละเมิดข้อมูลผู้เสียหาย - บันทึก.md"
        """
        filename = file_path.stem  # Remove .md

        match = re.match(r'^((?:\d+-)*\d+)-(\d{4})[_\s](.+?)(?:\s*-\s*บันทึก)?$', filename)

        if not match:
            return None

        case_num = match.group(1)  # e.g. "128" or "79-80"
        year_buddhist = int(match.group(2))
        title = match.group(3).strip()
        case_id = f"{case_num}-{year_buddhist}"

        # Convert Buddhist year to Gregorian
        year_gregorian = year_buddhist - self.BUDDHIST_OFFSET

        # Extract year from folder path (ปี XXXX)
        path_parts = relative_path.parts
        folder_year = None
        for part in path_parts:
            if part.startswith("ปี"):
                try:
                    folder_year = int(re.search(r'\d+', part).group())
                except:
                    pass

        # Verify year consistency
        if folder_year and folder_year != year_buddhist:
            print(f"Warning: Year mismatch in {filename}: {folder_year} vs {year_buddhist}")

        # Area code: cross-referenced from the topic notes' backlinks (bug #3
        # fix) rather than left null / guessed from unstructured content.
        area_codes = self.case_area_index.get(case_id, [])
        area_code = area_codes[0] if area_codes else None
        area_name = self.AREA_MAPPING.get(area_code) if area_code else None

        seed_tags = [t for t in (frontmatter.get("tags") or []) if t not in self.GENERIC_TAGS]
        keywords = self._extract_keywords(title, content, seed_tags=seed_tags)

        # Estimate page count (roughly 1 page per 1000 characters)
        page_count = max(1, len(content) // 1000)

        return {
            # Core identifiers - document_id keeps the underscore convention
            # of every other case_note ("case_01_2566"), so a joint case
            # becomes "case_79_80_2568" rather than mixing in a dash.
            "document_id": f"case_{case_num.replace('-', '_')}_{year_buddhist}",
            "case_id": case_id,
            "file_name": file_path.name,
            "file_path": str(file_path),

            # Classification
            "document_type": "case_note",
            "area_code": area_code,
            "area_name": area_name,
            "topic_ids": self.case_topic_index.get(case_id, []),

            # Temporal
            "year": year_gregorian,
            "year_buddhist": year_buddhist,
            "uploaded_at": datetime.fromtimestamp(file_path.stat().st_mtime).isoformat(),

            # Content
            "title": title,
            "summary": content.strip()[:500] if content else "",
            "keywords": keywords,
            "content": content,

            # Embedding info
            "page_count": page_count,
            "page_number": 1,
            "chunk_index": 0,

            # Relations
            "related_cases": [],
            "related_topics": keywords[:3],  # Top keywords as related topics

            # Internal only - stripped before the JSON index is written; tells
            # setup_obsidian_index.py which source PDF (if any) to copy into
            # data/nhrc_documents/<document_id>.pdf.
            "_pdf_source": self._find_case_pdf(filename, folder_year or year_buddhist),
        }

    def _find_case_pdf(self, filename_stem: str, year_buddhist: int) -> Optional[str]:
        """
        Case note scans live in a parallel root-level "ปี XXXX" folder, not
        alongside the .md file itself, e.g.:
          03 กรณีตรวจสอบ (Case Notes)/ปี 2563/68-2563_ผลกระทบเขื่อนปากแบง - บันทึก.md
          ปี 2563/68-2563_ผลกระทบเขื่อนปากแบง.pdf
        """
        stem = filename_stem
        if stem.endswith(" - บันทึก"):
            stem = stem[: -len(" - บันทึก")]
        pdf_path = self.vault_path / f"ปี {year_buddhist}" / f"{stem}.pdf"
        return str(pdf_path) if pdf_path.exists() else None

    def _extract_section(self, content: str, heading: str) -> Optional[str]:
        """Return the body text under a "## <heading>" markdown section, if present."""
        pattern = re.compile(rf'##\s*{re.escape(heading)}\s*\n(.*?)(?=\n##\s|\Z)', re.DOTALL)
        match = pattern.search(content)
        return match.group(1).strip() if match else None

    # "รายงานผลการประเมินสถานการณ์-YYYY.md" -> YYYY
    SITUATION_REPORT_YEAR_PATTERN = re.compile(r'(\d{4})\s*$')

    def _parse_situation_report(self, file_path: Path, frontmatter: Dict, content: str, relative_path: Path) -> Optional[Dict]:
        """
        Parse an annual situation-assessment report from "รายงานประเมินสถานการณ์".

        These are PDF-to-text dumps of full published books (100+ pages, cover
        page, publisher info, no YAML frontmatter, no "## heading" structure,
        and visibly mangled Thai text from the OCR/extraction step - nothing
        like the clean, structured case notes). Skip files without a
        confidently-extractable year rather than indexing garbage.
        """
        stem = file_path.stem
        match = self.SITUATION_REPORT_YEAR_PATTERN.search(stem)
        if not match:
            return None
        year_buddhist = int(match.group(1))
        year_gregorian = year_buddhist - self.BUDDHIST_OFFSET

        title = f"รายงานผลการประเมินสถานการณ์ด้านสิทธิมนุษยชนของประเทศไทย ปี {year_buddhist}"
        # The OCR'd body is unreliable for keywords/summary - use a clean,
        # hand-written description instead of the garbled extracted text.
        summary = (
            f"รายงานประจำปีด้านสิทธิมนุษยชนของประเทศไทย ปี พ.ศ. {year_buddhist} "
            "จัดทำโดยคณะกรรมการสิทธิมนุษยชนแห่งชาติ (กสม.)"
        )
        keywords = ["รายงานประเมินสถานการณ์", "สิทธิมนุษยชน", f"พ.ศ. {year_buddhist}"]

        pdf_path = file_path.with_suffix(".pdf")

        return {
            "document_id": f"situation_report_{year_buddhist}",
            "case_id": None,
            "file_name": file_path.name,
            "file_path": str(file_path),

            "document_type": "situation_report",
            "category": "รายงานประเมินสถานการณ์",
            "area_code": None,
            "area_name": None,

            "year": year_gregorian,
            "year_buddhist": year_buddhist,
            "uploaded_at": datetime.fromtimestamp(file_path.stat().st_mtime).isoformat(),

            "title": title,
            "summary": summary,
            "keywords": keywords,
            "content": content,

            "page_count": max(1, len(content) // 1000),
            "page_number": 1,
            "chunk_index": 0,

            "related_cases": [],
            "related_topics": [],

            "_pdf_source": str(pdf_path) if pdf_path.exists() else None,
        }

    def _parse_topic_area(self, file_path: Path, frontmatter: Dict, content: str, relative_path: Path) -> Optional[Dict]:
        """
        Parse topic/area from 02 ประเด็นสิทธิ folder

        Expected folder: "02 ประเด็นสิทธิ/A. สิทธิพลเมือง.../file.md"
        """
        path_parts = relative_path.parts

        # Extract area code from folder name
        # Format: "A. สิทธิพลเมือง..." or "B. สิทธิเศรษฐกิจ..."
        area_code = None
        area_name = None

        if len(path_parts) >= 2:
            area_folder = path_parts[1]
            match = self.AREA_FOLDER_PATTERN.match(area_folder)
            if match:
                area_code = match.group(1)
                area_name = match.group(2)

        title = file_path.stem
        seed_tags = [t for t in (frontmatter.get("tags") or []) if t not in self.GENERIC_TAGS]
        keywords = self._extract_keywords(title, content, seed_tags=seed_tags)

        return {
            # Core identifiers
            "document_id": f"topic_{area_code}_{title.replace(' ', '_')}",
            "case_id": None,
            "file_name": file_path.name,
            "file_path": str(file_path),

            # Classification
            "document_type": "topic",
            "area_code": area_code,
            "area_name": area_name,

            # Temporal
            "year": None,
            "year_buddhist": None,
            "uploaded_at": datetime.fromtimestamp(file_path.stat().st_mtime).isoformat(),

            # Content
            "title": title,
            "summary": content.strip()[:500] if content else "",
            "keywords": keywords,
            "content": content,

            # Embedding info
            "page_count": max(1, len(content) // 1000),
            "page_number": 1,
            "chunk_index": 0,

            # Relations
            "related_cases": [],
            "related_topics": keywords[:3]
        }

    def _parse_generic(self, file_path: Path, frontmatter: Dict, content: str, relative_path: Path) -> Optional[Dict]:
        """
        Parse file that doesn't fit main categories
        """
        filename_stem = file_path.stem
        if filename_stem in self.EXCLUDED_TITLES:
            return None  # Navigational/meta notes, not case content

        # Many of these filenames were hard-truncated to ~40 characters
        # (mid-word) at some point before this vault existed - the full title
        # survives as the note's leading "# heading" line, so prefer that for
        # display. document_id keeps using the (filesystem-safe) truncated
        # filename stem: it doubles as the on-disk content/PDF filename, and
        # the full title can contain characters Windows won't allow in one
        # (":", "/", etc).
        title = filename_stem
        stripped_content = content.strip()
        if stripped_content:
            first_line = stripped_content.splitlines()[0]
            h1_match = re.match(r'^#\s+(.+)', first_line)
            if h1_match:
                title = h1_match.group(1).strip()

        seed_tags = [t for t in (frontmatter.get("tags") or []) if t not in self.GENERIC_TAGS]
        keywords = self._extract_keywords(title, content, seed_tags=seed_tags)

        # Research notes all carry a "## สาระสำคัญ" (key findings) section -
        # a proper hand-written abstract, unlike the raw "# title / **bold
        # metadata**" text that precedes it. Prefer that; fall back to a raw
        # slice only for the rare file that doesn't have the section.
        summary = self._extract_section(content, "สาระสำคัญ")
        if not summary:
            summary = content.strip()[:500] if content else ""

        return {
            # Core identifiers
            "document_id": f"doc_{filename_stem.replace(' ', '_')}",
            "case_id": None,
            "file_name": file_path.name,
            "file_path": str(file_path),

            # Classification
            "document_type": "general",
            "area_code": None,
            "area_name": None,

            # Temporal
            "year": None,
            "year_buddhist": None,
            "uploaded_at": datetime.fromtimestamp(file_path.stat().st_mtime).isoformat(),

            # Content
            "title": title,
            "summary": summary,
            "keywords": keywords,
            "content": content,

            # Embedding info
            "page_count": max(1, len(content) // 1000),
            "page_number": 1,
            "chunk_index": 0,

            # Relations
            "related_cases": [],
            "related_topics": keywords[:3]
        }

    def _extract_keywords(
        self,
        title: str,
        body: str,
        seed_tags: Optional[List[str]] = None,
        max_keywords: int = 8,
    ) -> List[str]:
        """
        Extract keywords for a document.

        Frontmatter tags (already curated by whoever wrote the note) are used
        first since they're higher-signal than anything derived from free
        text. The remainder is filled in with Thai-tokenized words from the
        title/body (pythainlp.word_tokenize), falling back to whitespace
        splitting only if pythainlp isn't installed.

        Args:
            title: Document title
            body: Note body with any YAML frontmatter already stripped
            seed_tags: Curated tags to prioritize as keywords
            max_keywords: Maximum number of keywords to return

        Returns:
            List of keywords
        """
        keywords: List[str] = []
        seen = set()

        def add(word: str):
            w = word.strip()
            if w and w not in seen:
                seen.add(w)
                keywords.append(w)

        for tag in (seed_tags or []):
            add(tag)

        for token in self._tokenize_thai(f"{title} {body[:1000]}"):
            if len(keywords) >= max_keywords:
                break
            add(token)

        return keywords[:max_keywords]

    def _tokenize_thai(self, text: str) -> List[str]:
        """Tokenize Thai (and mixed Thai/English) text into candidate keywords."""
        text = self.MARKDOWN_NOISE.sub(' ', text)
        if word_tokenize is not None:
            raw_tokens = word_tokenize(text, engine="newmm", keep_whitespace=False)
        else:
            raw_tokens = text.split()

        tokens = []
        for raw in raw_tokens:
            token = raw.strip().strip('.,!?;:()[]{}"\'“”‘’')
            # 2-char cutoff let through common, low-signal Thai words the
            # stopword corpus doesn't cover ("ทำ" do, "ดี" good, "แล" look) -
            # they're real newmm tokens, just too generic to be a "keyword".
            # 3 chars filters those out while keeping real content words.
            # Curated frontmatter tags (seed_tags, added separately in
            # _extract_keywords) aren't affected - short abbreviations like
            # "ตร" (police) still work since they skip this tokenizer path.
            if len(token) < 3:
                continue
            if token in self._stopwords:
                continue
            if self.NON_KEYWORD_TOKEN.match(token):
                continue
            tokens.append(token.lower())
        return tokens


# Example usage
if __name__ == "__main__":
    import json

    vault_path = r"D:\back up\รายงานและข้อเสนอแนะ กสม"
    parser = ObsidianParser(vault_path)

    # Parse all documents
    documents = parser.parse_vault()

    print(f"Parsed {len(documents)} documents\n")

    # Show statistics
    doc_types = {}
    area_counts = {}
    year_counts = {}

    for doc in documents:
        doc_type = doc.get("document_type")
        doc_types[doc_type] = doc_types.get(doc_type, 0) + 1

        area = doc.get("area_code")
        if area:
            area_counts[area] = area_counts.get(area, 0) + 1

        year = doc.get("year")
        if year:
            year_counts[year] = year_counts.get(year, 0) + 1

    print("📊 Statistics:")
    print(f"  Document Types: {doc_types}")
    print(f"  By Area Code: {area_counts}")
    print(f"  By Year: {sorted(year_counts.items())}\n")

    # Show sample documents
    print("📄 Sample Documents:")
    for i, doc in enumerate(documents[:3]):
        print(f"\n[{i+1}] {doc['document_type'].upper()}: {doc['title']}")
        print(f"    ID: {doc['document_id']}")
        print(f"    Year: {doc['year_buddhist']}")
        print(f"    Keywords: {', '.join(doc['keywords'])}")

    # Save to JSON for inspection
    output_file = "obsidian_metadata.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(documents, f, ensure_ascii=False, indent=2)

    print(f"\n✅ Full metadata saved to: {output_file}")
