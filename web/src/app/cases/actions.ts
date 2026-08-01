"use server";

import { revalidatePath } from "next/cache";
import { getCaseActor } from "@/lib/cases/auth";
import { deleteComplaintCase } from "@/lib/cases/repository";

export async function deleteCaseAction(id: string) {
  const actor = await getCaseActor();
  if (!actor) throw new Error("Unauthorized");
  
  await deleteComplaintCase(id);
  revalidatePath("/cases");
}

import { updateScreening } from "@/lib/cases/repository";

export async function updateScreeningAction(
  complaintId: string, 
  screening: { factsComplete: boolean; requestClear: boolean; withinMandate: boolean; sufficientBasis: boolean; officerOpinion: string; legalBasis: string },
  allegations: string[]
) {
  const actor = await getCaseActor();
  if (!actor) throw new Error("Unauthorized");
  
  await updateScreening(complaintId, screening, allegations, actor.name);
  revalidatePath(`/cases/${complaintId}`);
}

import { addEvidenceItem, updateEvidenceVerification, type EvidenceCreateInput } from "@/lib/cases/repository";

export async function addEvidenceAction(complaintId: string, input: EvidenceCreateInput) {
  const actor = await getCaseActor();
  if (!actor) throw new Error("Unauthorized");
  
  await addEvidenceItem(complaintId, input, actor.name);
  revalidatePath(`/cases/${complaintId}`);
}

export async function updateEvidenceAction(complaintId: string, evidenceId: string, status: "pending" | "verified" | "disputed") {
  const actor = await getCaseActor();
  if (!actor) throw new Error("Unauthorized");

  await updateEvidenceVerification(complaintId, evidenceId, status, actor.name);
  revalidatePath(`/cases/${complaintId}`);
}

import { removeEvidenceItem, updateEvidenceItem } from "@/lib/cases/repository";

export async function removeEvidenceAction(complaintId: string, evidenceId: string) {
  const actor = await getCaseActor();
  if (!actor) throw new Error("Unauthorized");
  
  await removeEvidenceItem(complaintId, evidenceId, actor.name);
  revalidatePath(`/cases/${complaintId}`);
}

export async function editEvidenceAction(complaintId: string, evidenceId: string, input: EvidenceCreateInput) {
  const actor = await getCaseActor();
  if (!actor) throw new Error("Unauthorized");
  
  await updateEvidenceItem(complaintId, evidenceId, input, actor.name);
  revalidatePath(`/cases/${complaintId}`);
}
