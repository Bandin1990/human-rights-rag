/**
 * Fetches source PDFs from Google Drive for documents that don't ship in the
 * git repo (data/nhrc_documents/ is 1.4GB of raw scans, excluded from git -
 * see .gitignore). Files were uploaded by scripts/upload_pdfs_to_drive.py
 * into the user's own Drive (not a service account - see note below) and
 * are addressed by the mapping repository.getDrivePdfFileId() reads.
 *
 * Auth is OAuth (refresh token), not a service account: Google service
 * accounts have no storage quota of their own and can't own files in a
 * personal (non-Workspace) Drive, so scripts/gdrive_oauth_setup.py runs a
 * one-time user consent flow instead. GOOGLE_DRIVE_CLIENT_ID/SECRET/
 * REFRESH_TOKEN below are the same three fields that flow writes to
 * google_drive_token.json - see HANDOFF.md for the full story.
 *
 * Local dev still prefers the local file if present (see repository.ts /
 * the document API route) - this module is only reached when that's absent.
 */
import { google } from "googleapis";
import { Readable } from "stream";

let driveClient: ReturnType<typeof google.drive> | null = null;

function getDriveClient() {
  if (driveClient) return driveClient;

  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_DRIVE_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) return null;

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  driveClient = google.drive({ version: "v3", auth: oauth2Client });
  return driveClient;
}

// Returns null (not an error) when Drive isn't configured or the fetch
// fails - callers should treat that the same as "no PDF available".
export async function fetchDrivePdf(fileId: string): Promise<Buffer | null> {
  const drive = getDriveClient();
  if (!drive) return null;

  try {
    const res = await drive.files.get(
      { fileId, alt: "media" },
      { responseType: "stream" }
    );
    const chunks: Buffer[] = [];
    const stream = res.data as Readable;
    await new Promise<void>((resolve, reject) => {
      stream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      stream.on("end", () => resolve());
      stream.on("error", reject);
    });
    return Buffer.concat(chunks);
  } catch (error) {
    console.error(`Drive fetch failed for file ${fileId}`, error);
    return null;
  }
}
