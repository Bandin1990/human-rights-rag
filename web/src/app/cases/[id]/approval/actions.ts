"use server";

import { revalidatePath } from "next/cache";
import { getCaseActor } from "@/lib/cases/auth";
import { submitApprovalDecision } from "@/lib/cases/repository";

export async function handleApprovalAction(
  complaintId: string,
  action: 'approve' | 'reject' | 'send_committee',
  opinion: string
) {
  const actor = await getCaseActor();
  if (!actor) {
    return { error: "ไม่พบสิทธิ์ผู้ใช้งาน กรุณาเข้าสู่ระบบใหม่" };
  }
  
  if (!opinion || opinion.trim() === "") {
    return { error: "กรุณาระบุความเห็น" };
  }

  try {
    await submitApprovalDecision(
      complaintId,
      actor.id,
      actor.name,
      action,
      opinion
    );

    revalidatePath(`/cases/${complaintId}`);
    revalidatePath(`/cases/${complaintId}/approval`);
    
    return { success: true };
  } catch (err: any) {
    console.error("Failed to submit approval:", err);
    return { error: err.message || "เกิดข้อผิดพลาดในการบันทึกข้อมูล" };
  }
}
