import type { CustodyAgreement, CustodyEvent, CustodySlot } from "../domain/entities";

/**
 * Motor 100% determinístico: compara eventos de check-in/check-out contra el
 * convenio estructurado. Nunca usa IA — la IA solo participa, en otro flujo,
 * para ayudar a estructurar el convenio con confirmación humana de ambos
 * progenitores. Esto evita que una alucinación del modelo se traduzca en un
 * "incumplimiento" reportado como evidencia.
 */

export type ComplianceIssueType = "missed_checkin" | "late_checkin" | "missed_checkout";

export interface ComplianceIssue {
  type: ComplianceIssueType;
  childId: string;
  parentId: string;
  slot: CustodySlot;
  event: CustodyEvent | null;
  minutesLate: number | null;
}

export function findComplianceIssues(
  agreement: CustodyAgreement,
  events: CustodyEvent[],
  referenceDate: Date
): ComplianceIssue[] {
  const issues: ComplianceIssue[] = [];
  const weekday = referenceDate.getDay();

  for (const slot of agreement.slots) {
    if (slot.weekday !== weekday) continue;

    const scheduledStart = combineDateAndTime(referenceDate, slot.startTime);
    const checkin = events.find(
      (e) =>
        e.type === "checkin" &&
        e.childId === slot.childId &&
        e.parentId === slot.parentId &&
        isSameDay(new Date(e.scheduledAt), referenceDate)
    );

    if (!checkin || !checkin.confirmedAt) {
      issues.push({
        type: "missed_checkin",
        childId: slot.childId,
        parentId: slot.parentId,
        slot,
        event: checkin ?? null,
        minutesLate: null,
      });
      continue;
    }

    const minutesLate = minutesBetween(scheduledStart, new Date(checkin.confirmedAt));
    if (minutesLate > agreement.toleranceMinutes) {
      issues.push({
        type: "late_checkin",
        childId: slot.childId,
        parentId: slot.parentId,
        slot,
        event: checkin,
        minutesLate,
      });
    }
  }

  return issues;
}

function combineDateAndTime(date: Date, time: string): Date {
  const [hours, minutes] = time.split(":").map(Number);
  const result = new Date(date);
  result.setHours(hours ?? 0, minutes ?? 0, 0, 0);
  return result;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function minutesBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 60_000);
}
