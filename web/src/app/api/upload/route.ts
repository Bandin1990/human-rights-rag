import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';

let uploadClient: SupabaseClient | null = null;

function getUploadClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  if (!uploadClient) {
    uploadClient = createSupabaseClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return uploadClient;
}

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'audio/mpeg',
  'audio/wav',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB

export async function POST(request: Request) {
  try {
    const supabase = getUploadClient();
    if (!supabase) {
      return NextResponse.json(
        { error: 'Storage is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY.' },
        { status: 503 },
      );
    }
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const complaintId = formData.get('complaintId') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json({ error: 'File too large' }, { status: 400 });
    }

    // Generate Checksum
    const buffer = Buffer.from(await file.arrayBuffer());
    const hash = crypto.createHash('sha256').update(buffer).digest('hex');

    // Upload to Supabase Storage
    const bucketName = 'complaint_files'; // Assuming a bucket named complaint_files
    const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;
    const storagePath = complaintId ? `${complaintId}/${fileName}` : `intake/${fileName}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('Supabase upload error:', uploadError);
      return NextResponse.json({ error: 'Failed to upload to storage' }, { status: 500 });
    }

    // We don't automatically insert into source_files here,
    // the client should take the storagePath and checksum and create the DB record via another action,
    // or we can do it here if we have a valid case_id.
    // For separation of concerns, we just return the storage info.

    return NextResponse.json({
      success: true,
      storage_path: uploadData.path,
      file_name: file.name,
      file_size: file.size,
      mime_type: file.type,
      checksum: hash,
    });
  } catch (error: unknown) {
    console.error('Upload handler error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
