import { NextResponse } from "next/server";
import { clearAdminCookie, isAdmin, setAdminCookie, verifyAdminPassword } from "@/lib/admin-auth";

const noStore = { "Cache-Control": "no-store" };

function response(body: object, status = 200) {
  return NextResponse.json(body, { status, headers: noStore });
}

export async function GET() {
  return response({
    authenticated: await isAdmin(),
    configured: Boolean(process.env.ADMIN_IMPORT_SECRET),
    storageConfigured: Boolean(
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
        (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY),
    ),
    aiConfigured: Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY),
  });
}

export async function POST(request: Request) {
  let password = "";
  try {
    const body = (await request.json()) as { password?: unknown };
    password = typeof body.password === "string" ? body.password : "";
  } catch {
    return response({ error: "รูปแบบข้อมูลเข้าสู่ระบบไม่ถูกต้อง" }, 400);
  }

  if (!verifyAdminPassword(password)) {
    return response({ error: "รหัสผู้ดูแลไม่ถูกต้อง" }, 401);
  }
  await setAdminCookie();
  return response({ authenticated: true });
}

export async function DELETE() {
  await clearAdminCookie();
  return response({ authenticated: false });
}
