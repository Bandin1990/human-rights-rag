"""
One-time OAuth consent flow for the NHRC PDF Drive sync (upload script +
production web app). Run once locally; produces google_drive_token.json
(gitignored) holding a refresh token that doesn't expire (app is published,
non-sensitive `drive.file` scope) so this never needs to be re-run unless
the token file is lost or access is revoked.

Usage:
    .venv/Scripts/python.exe scripts/gdrive_oauth_setup.py
Then open the printed URL in your own browser and approve access.
"""
import json
import logging
import sys
from pathlib import Path

from google_auth_oauthlib.flow import InstalledAppFlow

logging.basicConfig(level=logging.INFO, format="%(message)s")

CLIENT_SECRET_FILE = "client_secret_100867396104-4mu76onj0i7b412po2gk9h7mic238jf1.apps.googleusercontent.com.json"
SCOPES = ["https://www.googleapis.com/auth/drive.file"]
TOKEN_FILE = Path("google_drive_token.json")


def main():
    if not Path(CLIENT_SECRET_FILE).exists():
        print(f"ERROR: {CLIENT_SECRET_FILE} not found in repo root", file=sys.stderr)
        sys.exit(1)

    flow = InstalledAppFlow.from_client_secrets_file(CLIENT_SECRET_FILE, SCOPES)
    creds = flow.run_local_server(
        port=0,
        open_browser=False,
        access_type="offline",
        prompt="consent",
    )

    data = {
        "refresh_token": creds.refresh_token,
        "client_id": creds.client_id,
        "client_secret": creds.client_secret,
        "token_uri": creds.token_uri,
    }
    TOKEN_FILE.write_text(json.dumps(data, indent=2), encoding="utf-8")
    print(f"\nSaved refresh token to {TOKEN_FILE}")
    print("(this file is gitignored - do not commit it)")


if __name__ == "__main__":
    main()
