export interface Parent {
  id: string;
  fullName: string;
  email: string;
}

export interface Family {
  id: string;
}

export interface Child {
  id: string;
  familyId: string;
  fullName: string;
  birthDate: string;
}

export type InvitationStatus = "pending" | "accepted" | "expired";

export interface Invitation {
  id: string;
  token: string;
  familyId: string;
  createdByParentId: string;
  status: InvitationStatus;
  expiresAt: string;
}

export interface ChatThread {
  id: string;
  familyId: string;
  topic: string;
  /** Hijo al que aplica el hilo — null para hilos generales de la familia. */
  childId: string | null;
  createdAt: string;
}

export interface Message {
  id: string;
  threadId: string;
  senderId: string;
  body: string;
  createdAt: string;
}

export type ToneLevel = "neutral" | "tenso" | "hostil";

export interface ToneAnalysis {
  level: ToneLevel;
  /** Reformulación sugerida — null cuando level es "neutral". */
  suggestion: string | null;
}

export interface Expense {
  id: string;
  childId: string;
  paidByParentId: string;
  amountMxn: number;
  description: string;
  receiptUrl: string | null;
  status: "pending_approval" | "approved" | "rejected" | "countered";
  createdAt: string;
}

/**
 * Balance 50/50 de gastos aprobados entre el caller y el otro progenitor de
 * su familia — agregado para W-xx (Gastos básicos). `otherParentId` es null
 * cuando el caller todavía no tiene un segundo progenitor emparejado (no
 * hay con quién calcular un balance). `amountMxnOwedByCaller` positivo
 * significa que el caller le debe ese monto al otro progenitor; negativo,
 * que el otro progenitor le debe ese monto (en valor absoluto) al caller;
 * cero, que están a mano.
 */
export interface ExpenseBalance {
  otherParentId: string | null;
  amountMxnOwedByCaller: number;
}

export type CustodyEventType = "checkin" | "checkout";

export interface CustodyEvent {
  id: string;
  childId: string;
  parentId: string;
  type: CustodyEventType;
  scheduledAt: string;
  confirmedAt: string | null;
  location: { lat: number; lng: number } | null;
}

export interface CustodySlot {
  childId: string;
  parentId: string;
  /** 0 = domingo ... 6 = sábado */
  weekday: number;
  startTime: string;
  endTime: string;
}

export interface CustodyAgreement {
  id: string;
  childId: string;
  slots: CustodySlot[];
  /** minutos de tolerancia antes de considerar un check-in tardío como incumplimiento */
  toleranceMinutes: number;
}
