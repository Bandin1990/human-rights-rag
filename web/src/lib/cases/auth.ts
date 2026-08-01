import { createClient } from "@/lib/supabase/server";
import type { CaseActor, CaseRole } from "@/types/case";

const CASE_ROLES: CaseRole[] = [
  "intake_officer",
  "screening_officer",
  "supervisor",
  "case_officer",
  "report_screener",
  "commissioner",
  "committee_secretariat",
  "privacy_officer",
  "auditor",
  "system_admin",
];

export function isCaseDemoMode() {
  if (process.env.CASE_DEMO_MODE === "true") return true;
  if (process.env.CASE_DEMO_MODE === "false") return false;
  return process.env.NODE_ENV !== "production";
}

export async function getCaseActor(): Promise<CaseActor | null> {
  if (isCaseDemoMode()) {
    return {
      id: "demo-case-officer",
      name: "สุภาวดี วัฒนกิจ",
      role: "case_officer",
      demo: true,
    };
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) return null;

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) return null;

  const { data: roleRow, error: roleError } = await supabase
    .schema("case_management")
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (roleError || !roleRow || !CASE_ROLES.includes(roleRow.role as CaseRole)) return null;

  const displayName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : user.email || "ผู้ใช้งานระบบ";

  return {
    id: user.id,
    name: displayName,
    role: roleRow.role as CaseRole,
    demo: false,
  };
}

export function canCreateComplaint(actor: CaseActor) {
  return actor.demo || ["intake_officer", "screening_officer", "supervisor"].includes(actor.role);
}

export function canEditReport(actor: CaseActor) {
  return ["case_officer", "supervisor", "report_screener"].includes(actor.role);
}
