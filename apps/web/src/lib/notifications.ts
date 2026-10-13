import type { CustodyEvent, Document, Expense, Message, PensionPayment, VerbalAgreement } from "@alba/core";

export type NotificationItem = {
  id: string;
  icon: "gastos" | "pension" | "boveda" | "acuerdos" | "calendario" | "chat";
  title: string;
  subtitle: string;
  href: string;
  createdAt: string;
};

/** Compartido entre /notificaciones (feed completo) y /dashboard (adelanto
 * de los últimos ítems) — mismo ícono/color por tipo en ambos lugares. */
export const NOTIFICATION_ICON_CLASS: Record<NotificationItem["icon"], string> = {
  gastos: "bg-dawn",
  pension: "bg-sky",
  boveda: "bg-purple",
  acuerdos: "bg-purple",
  calendario: "bg-salmon",
  chat: "bg-salmon",
};

export const NOTIFICATION_ICON_SYMBOL: Record<NotificationItem["icon"], string> = {
  gastos: "$",
  pension: "$",
  boveda: "🔒",
  acuerdos: "✎",
  calendario: "📅",
  chat: "💬",
};

export function formatRelativeTime(iso: string, now: Date): string {
  const diffMs = now.getTime() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "ahora";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.round(hours / 24);
  if (days === 1) return "ayer";
  if (days < 7) return `hace ${days} días`;
  return new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short" });
}

/**
 * Arma el feed de notificaciones AL VUELO a partir de datos que ya tienen
 * timestamp confiable en sus propias tablas — no hay una tabla de
 * "notificaciones" aparte (ver 0018_notificaciones.sql). Solo incluye
 * eventos causados por el OTRO progenitor: nunca te notificamos de tus
 * propias acciones.
 *
 * Los mensajes de chat (`messages`) llegan YA resueltos en una sola
 * consulta por el caller (ChatRepository.listRecentMessages) — este
 * archivo nunca lee hilo por hilo, ese fue justo el patrón N+1 que hizo
 * lenta la app antes.
 */
export function buildNotifications({
  parentId,
  nameOf,
  childNameOf,
  threadTopicOf,
  expenses,
  pensionPayments,
  documents,
  verbalAgreements,
  custodyEvents,
  messages,
}: {
  parentId: string;
  nameOf: (id: string) => string;
  childNameOf: (id: string | null) => string;
  threadTopicOf: (threadId: string) => string;
  expenses: Expense[];
  pensionPayments: PensionPayment[];
  documents: Document[];
  verbalAgreements: VerbalAgreement[];
  custodyEvents: CustodyEvent[];
  messages: Message[];
}): NotificationItem[] {
  const MXN = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });
  const items: NotificationItem[] = [];

  for (const e of expenses) {
    if (e.paidByParentId === parentId) continue;
    items.push({
      id: `expense-${e.id}`,
      icon: "gastos",
      title: "Nuevo gasto por aprobar",
      subtitle: `${childNameOf(e.childId)} · ${MXN.format(e.amountMxn)} — ${nameOf(e.paidByParentId)}`,
      href: "/gastos",
      createdAt: e.createdAt,
    });
  }

  for (const p of pensionPayments) {
    if (p.paidByParentId !== parentId) {
      items.push({
        id: `pension-paid-${p.id}`,
        icon: "pension",
        title: "Pago de pensión registrado",
        subtitle: `${p.period} · ${MXN.format(p.amountMxn)} — ${nameOf(p.paidByParentId)}`,
        href: "/gastos?tab=pension",
        createdAt: p.paidAt,
      });
    } else if (p.confirmedAt) {
      items.push({
        id: `pension-confirmed-${p.id}`,
        icon: "pension",
        title: "Confirmaron tu pago de pensión",
        subtitle: `${p.period} · ${MXN.format(p.amountMxn)}`,
        href: "/gastos?tab=pension",
        createdAt: p.confirmedAt,
      });
    }
  }

  for (const d of documents) {
    if (d.uploadedByParentId === parentId) continue;
    items.push({
      id: `document-${d.id}`,
      icon: "boveda",
      title: "Nuevo documento en Bóveda",
      subtitle: `${d.title} — ${nameOf(d.uploadedByParentId)}`,
      href: "/boveda",
      createdAt: d.createdAt,
    });
  }

  for (const a of verbalAgreements) {
    if (a.createdByParentId !== parentId) {
      items.push({
        id: `agreement-${a.id}`,
        icon: "acuerdos",
        title: "Nuevo acuerdo verbal registrado",
        subtitle: `${a.description.slice(0, 80)} — ${nameOf(a.createdByParentId)}`,
        href: "/boveda/acuerdos",
        createdAt: a.createdAt,
      });
    } else if (a.confirmedAt) {
      items.push({
        id: `agreement-confirmed-${a.id}`,
        icon: "acuerdos",
        title: "Confirmaron tu acuerdo verbal",
        subtitle: a.description.slice(0, 80),
        href: "/boveda/acuerdos",
        createdAt: a.confirmedAt,
      });
    }
  }

  for (const ev of custodyEvents) {
    if (ev.parentId === parentId || !ev.confirmedAt) continue;
    items.push({
      id: `custody-${ev.id}`,
      icon: "calendario",
      title: ev.type === "checkin" ? "Check-in confirmado" : "Check-out confirmado",
      subtitle: `${childNameOf(ev.childId)} — ${nameOf(ev.parentId)}`,
      href: "/calendario",
      createdAt: ev.confirmedAt,
    });
  }

  for (const m of messages) {
    if (m.senderId === parentId) continue;
    items.push({
      id: `message-${m.id}`,
      icon: "chat",
      title: `Nuevo mensaje — ${threadTopicOf(m.threadId)}`,
      subtitle: `${nameOf(m.senderId)}: ${m.body.slice(0, 80)}`,
      href: `/chat/${m.threadId}`,
      createdAt: m.createdAt,
    });
  }

  return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
