from __future__ import annotations

import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class OcrToolStatus:
    available: bool
    executable: str | None
    message: str


def get_ocr_status() -> OcrToolStatus:
    executable = shutil.which("ocrmypdf")
    if executable:
        return OcrToolStatus(True, executable, "พบ OCRmyPDF พร้อมใช้งาน")
    return OcrToolStatus(
        False,
        None,
        "ยังไม่พบ OCRmyPDF ในเครื่อง จึงยังทำ OCR อัตโนมัติไม่ได้",
    )


def run_ocrmypdf(input_pdf: Path, output_pdf: Path, languages: str = "tha+eng") -> None:
    status = get_ocr_status()
    if not status.available or not status.executable:
        raise RuntimeError(status.message)
    output_pdf.parent.mkdir(parents=True, exist_ok=True)
    command = [
        status.executable,
        "--skip-text",
        "--deskew",
        "--clean",
        "-l",
        languages,
        str(input_pdf),
        str(output_pdf),
    ]
    completed = subprocess.run(
        command,
        check=False,
        capture_output=True,
        text=True,
        timeout=1800,
    )
    if completed.returncode != 0:
        details = (completed.stderr or completed.stdout or "").strip()
        raise RuntimeError(f"OCR ไม่สำเร็จ: {details}")
