/** null = todavía no eligió en el onboarding (W-xx). */
export type UsageMode = "unilateral" | "bilateral" | null;

export interface Parent {
  id: string;
  fullName: string;
  email: string;
  usageMode: UsageMode;
  /** Último momento en que el progenitor abrió /notificaciones — null = nunca. */
  lastNotificationsSeenAt: string | null;
  /** Placeholder para la Fase 4 (WhatsApp modo unilateral) — null = no lo ha dado todavía. */
  whatsappNumber: string | null;
  /** Marca que ya pasó por el paso "¿así está bien tu nombre?" del wizard — null = nunca. */
  onboardingNameConfirmedAt: string | null;
  /** Color elegido en Perfil, uno de PROFILE_COLORS. null = todavía no eligió uno. */
  color: string | null;
}

export interface Family {
  id: string;
}

export interface ChildContact {
  name: string;
  relation: string;
  phone: string;
}

/**
 * Profesional de salud del hijo/a — rubro libre ("Terapeuta", "Pediatra",
 * "Dentista"...), no un enum cerrado: la clienta pidió explícitamente poder
 * agregar cualquier especialidad, no solo terapeuta.
 */
export interface ChildHealthProvider {
  role: string;
  name: string;
  phone: string;
}

/**
 * Contacto de la escuela — rubro libre ("Maestra titular", "Dirección",
 * "Psicóloga escolar"...), mismo criterio que ChildHealthProvider: no
 * limitar a un único contacto fijo.
 */
export interface ChildSchoolContact {
  role: string;
  name: string;
  phone: string;
}

/**
 * Nota libre con etiqueta ("Rutina de sueño", "Miedo a los perros", "Comida
 * favorita"...) — reemplaza los campos fijos sleepRoutine/specialNotes por
 * el mismo motivo: la clienta no quiere estar limitada a conceptos
 * predefinidos en ninguna sección del perfil de hijo/a.
 */
export interface ChildNote {
  label: string;
  text: string;
}

/**
 * Campos de W-xx (perfil de hijo extendido) — pedido explícito de la
 * clienta: contactos, salud, escuela, alergias, notas especiales (ej.
 * "duerme con el conejo azul", rutina de sueño). Todos nullable/vacíos por
 * default porque se completan con el tiempo, no en el alta inicial.
 */
export interface Child {
  id: string;
  familyId: string;
  fullName: string;
  birthDate: string;
  contacts: ChildContact[];
  healthProviders: ChildHealthProvider[];
  schoolName: string | null;
  schoolContacts: ChildSchoolContact[];
  allergies: string | null;
  notes: ChildNote[];
  /** Mismo criterio que Parent.color. */
  color: string | null;
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
  /** Sellado (W-xx) — raíz Merkle sobre los hashes de los mensajes, null hasta el primer sellado. */
  merkleRoot: string | null;
  anchorReference: string | null;
  sealedAt: string | null;
  /** Cuántos mensajes cubre el sello vigente — compara contra el total actual para saber si hay mensajes nuevos sin sellar. */
  sealedMessageCount: number;
  /** Resumen de IA de un acuerdo detectado en los últimos mensajes — null si no hay ninguno pendiente. */
  pendingAgreementSuggestion: string | null;
  /** id del mensaje sobre el que se basó la última detección (o null). */
  pendingAgreementSuggestionBasedOn: string | null;
}

export interface Message {
  id: string;
  threadId: string;
  senderId: string;
  body: string;
  attachmentUrl: string | null;
  /** SHA-256 sobre thread_id|sender_id|body|created_at — para evidencia (W-xx). */
  sha256Hex: string;
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

/**
 * Pensión (W-xx) — pago fijo mensual recurrente (ej. pensión alimenticia),
 * distinto de Expense (ítems puntuales, 50/50, aprobar/rechazar). Un solo
 * progenitor de la familia es el pagador; monto y día de vencimiento se
 * configuran una vez (PensionSettings) y cada mes es un registro de pago
 * (PensionPayment) separado e inmutable, que el otro progenitor confirma.
 */
export interface PensionSettings {
  id: string;
  familyId: string;
  payerParentId: string;
  amountMxn: number;
  /** Día del mes en que vence (1-28, para que exista en todos los meses). */
  dueDay: number;
}

export interface PensionPayment {
  id: string;
  familyId: string;
  /** "YYYY-MM" */
  period: string;
  /** Snapshot del monto al momento de pagar — no cambia si luego se edita PensionSettings.amountMxn. */
  amountMxn: number;
  paidByParentId: string;
  paidAt: string;
  confirmedByParentId: string | null;
  confirmedAt: string | null;
  createdAt: string;
}

export type PensionPeriodStatus = "paid_confirmed" | "paid_unconfirmed" | "overdue" | "upcoming";

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
  /** Lugar de encuentro (de MeetingPlace) — null si no se especificó uno. */
  placeId: string | null;
}

export interface CustodyAgreement {
  id: string;
  childId: string;
  slots: CustodySlot[];
  /** minutos de tolerancia antes de considerar un check-in tardío como incumplimiento */
  toleranceMinutes: number;
}

/**
 * Lugar habitual de encuentro/entrega (ej. "Casa de Progenitor A", "Parque",
 * "Cine") — catálogo reutilizable por FAMILIA (mismo criterio que
 * CustodyAgreement), que un slot del convenio puede referenciar via
 * CustodySlot.placeId.
 */
export interface MeetingPlace {
  id: string;
  name: string;
  /** Dirección libre, para el botón "Ver en mapa" — null si no se especificó. */
  address: string | null;
  /** "YYYY-MM-DD" — null si este lugar no es una vacación con hotel. */
  hotelCheckIn: string | null;
  hotelCheckOut: string | null;
  /** Texto libre — mismo criterio que Child.notes. */
  contacts: string | null;
  itinerary: string | null;
}

export interface ImportantDate {
  id: string;
  title: string;
  /** null = recordatorio libre, no ligado a un hijo en particular. */
  childId: string | null;
  /** "YYYY-MM-DD", fecha local. */
  startDate: string;
  /** "YYYY-MM-DD", fecha local, >= startDate. Igual a startDate = evento de 1 día. */
  endDate: string;
  createdByParentId: string;
}

/**
 * Visita puntual (W-xx) — ej. "Ir al cine" un domingo específico — a
 * diferencia de CustodySlot (patrón semanal recurrente: "todos los
 * domingos"), una Visit vive en UNA fecha exacta y no se repite. Pedido
 * explícito de la clienta: agregar algo como "ir al cine" el 18 de un mes
 * no debía marcarse como custodia recurrente todos los domingos.
 */
export interface Visit {
  id: string;
  childId: string;
  parentId: string;
  title: string;
  /** "YYYY-MM-DD", fecha local — no un patrón semanal. */
  date: string;
  startTime: string;
  endTime: string;
  placeId: string | null;
}

export type AnchorStatus = "pending" | "anchored";

/**
 * Documento de Bóveda (W-xx) — combina "Documentos y acuerdos básicos" y
 * "Evidencia digital" de la cotización en una sola entidad. Cuelga de la
 * FAMILIA (familyId), no de un hijo ni solo del progenitor que lo subió —
 * ambos progenitores deben poder verlo, mismo criterio que
 * CustodyAgreement. sha256Hex se calcula en el servidor sobre los bytes
 * reales del archivo en el momento de la subida (ver README.md, "Reglas de
 * arquitectura no negociables") — nunca en el cliente. merkleRoot y
 * anchorReference son null hasta que anchorPendingDocuments (ver
 * DocumentRepository) ancla el documento junto con el resto de los
 * documentos "pending" de la familia en ese momento.
 */
/**
 * Acuerdo verbal (W-xx) — pedido explícito de la clienta: un registro
 * liviano de algo que los progenitores acordaron de palabra (teléfono,
 * en persona), sin archivo ni firma. A diferencia de CustodyAgreement
 * (slots recurrentes estructurados) o Document (archivo con hash), esto es
 * solo texto + fecha. Igual que Document, es INMUTABLE una vez creado —
 * tiene valor como registro solo si nadie puede editarlo después. El otro
 * progenitor puede "confirmarlo" (confirmedByParentId/confirmedAt), lo que
 * refuerza que ambos lo recuerdan igual — pero no puede editarlo tampoco.
 */
export interface VerbalAgreement {
  id: string;
  familyId: string;
  createdByParentId: string;
  /** Hijo al que aplica — null si es un acuerdo general de la familia. */
  childId: string | null;
  description: string;
  /** Fecha en que se acordó (no necesariamente la fecha en que se registró), "YYYY-MM-DD". */
  agreedAt: string;
  confirmedByParentId: string | null;
  confirmedAt: string | null;
  createdAt: string;
}

export interface Document {
  id: string;
  familyId: string;
  uploadedByParentId: string;
  /** Hijo al que aplica el documento — null para documentos de la familia en general (ej. convenio). */
  childId: string | null;
  title: string;
  fileUrl: string;
  sha256Hex: string;
  merkleRoot: string | null;
  anchorStatus: AnchorStatus;
  anchorReference: string | null;
  createdAt: string;
}
