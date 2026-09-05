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
