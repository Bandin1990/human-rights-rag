from __future__ import annotations

import argparse
import base64
import hashlib
import re
from pathlib import Path


THAI_DIGITS = str.maketrans("๐๑๒๓๔๕๖๗๘๙", "0123456789")


def encoded(value: str) -> str:
    data = base64.b64encode(value.encode("utf-8")).decode("ascii")
    return f"convert_from(decode('{data}','base64'),'UTF8')"


def clean_markdown(value: str) -> str:
    value = re.sub(r"<!--.*?-->", "", value, flags=re.S)
    value = value.replace("**", "").replace("\\-", "-")
    return re.sub(r"\n{3,}", "\n\n", value).strip()


def first_match(pattern: str, text: str, default: str = "") -> str:
    match = re.search(pattern, text, flags=re.M)
    return clean_markdown(match.group(1)).strip() if match else default


def main() -> None:
    parser = argparse.ArgumentParser(description="Prepare idempotent SQL for a public NHRC Markdown report")
    parser.add_argument("markdown", type=Path)
    parser.add_argument("--initialize", action="store_true")
    parser.add_argument("--page", type=int)
    args = parser.parse_args()
    raw = args.markdown.read_text(encoding="utf-8")
    checksum = hashlib.sha256(raw.encode("utf-8")).hexdigest()
    number_match = re.search(r"(\d{2})-2569", args.markdown.name)
    if not number_match:
        raise ValueError("Filename must begin with NN-2569")
    report_no = number_match.group(1)
    doc_id = f"nhrc-investigation-{report_no}-2569"
    subject = first_match(r"\*\*เรื่อง\s+(.+?)\*\*", raw, args.markdown.stem)
    title = f"รายงานผลการตรวจสอบที่ {int(report_no)}/2569: {subject}"
    published_at = first_match(r"\*\*วันที่\s+(.+?)\*\*", raw, "พ.ศ. 2569")
    categories = {
        "02": ["ความเสมอภาคและการไม่เลือกปฏิบัติ"],
        "03": ["สิทธิพลเมืองและการเมือง", "สิทธิในกระบวนการยุติธรรม"],
        "18": ["สิทธิชุมชนและสิ่งแวดล้อม"],
    }.get(report_no, ["สิทธิพลเมืองและการเมือง"])
    parts = re.split(r'<!--\s*PageNumber="(\d+)"\s*-->', raw)
    pages: list[tuple[int, str]] = []
    for index in range(1, len(parts), 2):
        pages.append((int(parts[index]), clean_markdown(parts[index + 1])))
    print("begin;")
    if args.initialize:
        category_sql = ",".join(f"{encoded(item)}" for item in categories)
        summary = subject[:700]
        print(
            "insert into public.documents (id,title,summary,document_type,document_number,publication_year,buddhist_year,published_at,source_organization,source_system,authority_level,language,rights_categories,file_formats,page_count,access_scope,status,featured,checksum,verified_at) values ("
            f"'{doc_id}',{encoded(title)},{encoded(summary)},'รายงานผลการตรวจสอบ','{int(report_no)}/2569',2026,2569,{encoded(published_at)},"
            f"'คณะกรรมการสิทธิมนุษยชนแห่งชาติ','กสม.','ความเห็น กสม.','th',array[{category_sql}],array['md'],{len(pages)},'public','published',true,'{checksum}',now()) "
            "on conflict (id) do update set title=excluded.title,summary=excluded.summary,published_at=excluded.published_at,rights_categories=excluded.rights_categories,page_count=excluded.page_count,checksum=excluded.checksum,verified_at=now(),updated_at=now();"
        )
        print(f"delete from public.document_sections where document_id='{doc_id}';")
    if args.page:
        matches = [item for item in pages if item[0] == args.page]
        if not matches:
            raise ValueError(f"Page {args.page} not found")
        page_number, content = matches[0]
        heading = first_match(r"^([^\n]{1,160})", content, f"หน้า {page_number}")
        print(
            "insert into public.document_sections (id,document_id,section_index,page_number,heading,content,language,metadata) values ("
            f"'{doc_id}-p{page_number}','{doc_id}',{page_number-1},{page_number},{encoded(heading)},{encoded(content)},'th',"
            f"jsonb_build_object('source_checksum','{checksum}','source_format','markdown','source_filename',{encoded(args.markdown.name)})) "
            "on conflict (id) do update set heading=excluded.heading,content=excluded.content,metadata=excluded.metadata;"
        )
    print("commit;")


if __name__ == "__main__":
    main()
