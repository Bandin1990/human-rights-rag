"""
One-time (re-runnable) uploader: pushes data/nhrc_documents/*.pdf into the
user's Google Drive, organized into year subfolders under a root folder ID,
using the OAuth refresh token from scripts/gdrive_oauth_setup.py (a service
account can't own files in a personal Drive - see HANDOFF.md). Builds
data/nhrc_pdf_drive_map.json mapping document_id -> Google Drive file ID,
which the web app's /api/case/[id]/document route reads at request time to
fetch the PDF via the Drive API instead of the local filesystem (which
isn't available on Vercel - see .gitignore's note on data/nhrc_documents/).

Re-running is safe: existing year subfolders and already-uploaded files
(matched by name) are reused instead of duplicated, so an interrupted run
can just be started again.

Usage:
    .venv/Scripts/python.exe scripts/upload_pdfs_to_drive.py
    (run scripts/gdrive_oauth_setup.py first if google_drive_token.json is missing)
"""
import json
import re
import sys
from pathlib import Path

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

SCOPES = ["https://www.googleapis.com/auth/drive.file"]
TOKEN_FILE = Path("google_drive_token.json")
ROOT_FOLDER_NAME = "NHRC PDF Documents"
DOCUMENTS_DIR = Path("data/nhrc_documents")
MAP_FILE = Path("data/nhrc_pdf_drive_map.json")

# drive.file scope only grants access to files/folders THIS app creates (or
# ones the user picks via Google Picker) - it can't see the folder you
# created by hand earlier and shared with the service account. So instead
# of a fixed folder ID, the script finds-or-creates its own root folder by
# name; after the first run that folder is app-owned and searchable again.

# case_11_2568.pdf -> year 2568; situation_report_2566.pdf -> year 2566
YEAR_PATTERN = re.compile(r"_(\d{4})\.pdf$", re.IGNORECASE)


def get_service():
    if not TOKEN_FILE.exists():
        print(
            f"ERROR: {TOKEN_FILE} not found - run scripts/gdrive_oauth_setup.py first",
            file=sys.stderr,
        )
        sys.exit(1)
    token_data = json.loads(TOKEN_FILE.read_text(encoding="utf-8"))
    creds = Credentials(
        token=None,
        refresh_token=token_data["refresh_token"],
        client_id=token_data["client_id"],
        client_secret=token_data["client_secret"],
        token_uri=token_data["token_uri"],
        scopes=SCOPES,
    )
    return build("drive", "v3", credentials=creds, cache_discovery=False)


def find_or_create_root_folder(service) -> str:
    query = (
        f"name = '{ROOT_FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder' "
        "and trashed = false and 'me' in owners"
    )
    res = service.files().list(q=query, fields="files(id,name)").execute()
    existing = res.get("files", [])
    if existing:
        return existing[0]["id"]
    meta = {"name": ROOT_FOLDER_NAME, "mimeType": "application/vnd.google-apps.folder"}
    folder = service.files().create(body=meta, fields="id").execute()
    print(f"Created root folder '{ROOT_FOLDER_NAME}' -> {folder['id']}")
    return folder["id"]


def find_or_create_year_folder(service, root_folder_id: str, year: str, cache: dict) -> str:
    if year in cache:
        return cache[year]
    query = (
        f"'{root_folder_id}' in parents and name = '{year}' "
        "and mimeType = 'application/vnd.google-apps.folder' and trashed = false"
    )
    res = service.files().list(q=query, fields="files(id,name)").execute()
    existing = res.get("files", [])
    if existing:
        folder_id = existing[0]["id"]
    else:
        meta = {
            "name": year,
            "mimeType": "application/vnd.google-apps.folder",
            "parents": [root_folder_id],
        }
        folder = service.files().create(body=meta, fields="id").execute()
        folder_id = folder["id"]
        print(f"  created year folder {year} -> {folder_id}")
    cache[year] = folder_id
    return folder_id


def find_existing_file(service, folder_id: str, filename: str) -> str | None:
    query = f"'{folder_id}' in parents and name = '{filename}' and trashed = false"
    res = service.files().list(q=query, fields="files(id,name)").execute()
    files = res.get("files", [])
    return files[0]["id"] if files else None


def main():
    if not DOCUMENTS_DIR.exists():
        print(f"ERROR: {DOCUMENTS_DIR} not found - run from repo root", file=sys.stderr)
        sys.exit(1)

    service = get_service()
    root_folder_id = find_or_create_root_folder(service)
    year_folder_cache: dict = {}

    mapping = {}
    if MAP_FILE.exists():
        mapping = json.loads(MAP_FILE.read_text(encoding="utf-8"))
        print(f"Loaded existing mapping with {len(mapping)} entries (resuming)")

    pdfs = sorted(DOCUMENTS_DIR.glob("*.pdf"))
    print(f"Found {len(pdfs)} PDF files to process")

    uploaded, skipped, failed = 0, 0, 0
    for i, pdf_path in enumerate(pdfs, 1):
        document_id = pdf_path.stem  # e.g. "case_11_2568"

        if document_id in mapping:
            skipped += 1
            continue

        m = YEAR_PATTERN.search(pdf_path.name)
        year = m.group(1) if m else "unknown"

        try:
            folder_id = find_or_create_year_folder(service, root_folder_id, year, year_folder_cache)

            existing_id = find_existing_file(service, folder_id, pdf_path.name)
            if existing_id:
                mapping[document_id] = existing_id
                print(f"[{i}/{len(pdfs)}] {pdf_path.name} -> already in Drive ({existing_id}), reused")
            else:
                media = MediaFileUpload(str(pdf_path), mimetype="application/pdf", resumable=True)
                file_meta = {"name": pdf_path.name, "parents": [folder_id]}
                request = service.files().create(body=file_meta, media_body=media, fields="id")
                response = None
                while response is None:
                    status, response = request.next_chunk()
                file_id = response["id"]
                mapping[document_id] = file_id
                print(f"[{i}/{len(pdfs)}] {pdf_path.name} -> uploaded ({file_id})")

            uploaded += 1
            # Persist after every file so an interruption never loses progress.
            MAP_FILE.write_text(json.dumps(mapping, ensure_ascii=False, indent=2), encoding="utf-8")
        except Exception as e:
            failed += 1
            print(f"[{i}/{len(pdfs)}] {pdf_path.name} -> FAILED: {e}", file=sys.stderr)

    print(f"\nDone. uploaded/reused={uploaded} skipped(already-mapped)={skipped} failed={failed}")
    print(f"Mapping written to {MAP_FILE} ({len(mapping)} total entries)")


if __name__ == "__main__":
    main()
