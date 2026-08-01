from __future__ import annotations

import argparse
import base64
import hashlib
from pathlib import Path

import fitz


def encoded(value: str) -> str:
    data = base64.b64encode(value.encode("utf-8")).decode("ascii")
    return f"convert_from(decode('{data}','base64'),'UTF8')"


def main() -> None:
    parser = argparse.ArgumentParser(description="Prepare a reviewable SQL seed for the 2569 NHRC regulation")
    parser.add_argument("pdf", type=Path)
    parser.add_argument("--initialize", action="store_true")
    parser.add_argument("--page", type=int, help="One-based page number to emit")
    args = parser.parse_args()
    payload = args.pdf.read_bytes()
    checksum = hashlib.sha256(payload).hexdigest()
    document = fitz.open(stream=payload, filetype="pdf")
    doc_id = "nhrc-regulation-2569"
    title = "ระเบียบคณะกรรมการสิทธิมนุษยชนแห่งชาติว่าด้วยการตรวจสอบการละเมิดสิทธิมนุษยชนและการจัดทำข้อเสนอแนะ พ.ศ. 2569"
    summary = "หลักเกณฑ์การยื่นและกลั่นกรองเรื่องร้องเรียน การประสานความช่วยเหลือ การตรวจสอบ การจัดทำรายงาน การยุติเรื่อง และการจัดทำข้อเสนอแนะ"
    print("begin;")
    if args.initialize:
        print(
        "insert into public.documents "
        "(id,title,summary,document_type,publication_year,buddhist_year,published_at,source_organization,source_system,source_url,authority_level,language,rights_categories,file_formats,page_count,access_scope,status,featured,checksum,verified_at) values ("
        f"'{doc_id}',{encoded(title)},{encoded(summary)},'กฎหมายและระเบียบ',2026,2569,'14 พฤษภาคม 2569',"
        f"'คณะกรรมการสิทธิมนุษยชนแห่งชาติ','ราชกิจจานุเบกษา','https://ratchakitcha.soc.go.th/','กฎหมาย','th',"
        f"array['สิทธิในกระบวนการยุติธรรม'],array['pdf'],{len(document)},'public','published',true,'{checksum}',now()) "
        "on conflict (id) do update set title=excluded.title,summary=excluded.summary,page_count=excluded.page_count,checksum=excluded.checksum,verified_at=now(),updated_at=now();"
        )
        print(f"delete from public.document_sections where document_id='{doc_id}';")
    pages = [(args.page - 1, document[args.page - 1])] if args.page else []
    for index, page in pages:
        text = page.get_text("text").strip()
        print(
            "insert into public.document_sections "
            "(id,document_id,section_index,page_number,heading,content,language,metadata) values ("
            f"'{doc_id}-p{index + 1}','{doc_id}',{index},{index + 1},{encoded(f'หน้า {index + 1}')},{encoded(text)},'th',"
            f"jsonb_build_object('source_checksum','{checksum}','extraction_method','pymupdf-text-layer'));"
        )
    print("commit;")


if __name__ == "__main__":
    main()
