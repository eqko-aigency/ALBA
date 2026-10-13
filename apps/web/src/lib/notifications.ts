import type { CustodyEvent, Document, Expense, PensionPayment, VerbalAgreement } from "@alba/core";

export type NotificationItem = {
  id: string;
  icon: "gastos" | "pension" | "boveda" | "acuerdos" | "calendario";
  title: string;
  subtitle: string;
  href: string;
  createdAt: string;
};

/**
 * Arma el feed de notificaciones AL VUELO a partir de datos que ya tienen
 * timestamp confiable en sus propias tablas — no hay una tabla de
 * "notificaciones" aparte (ver 0018_notificaciones.sql). Solo incluye
 * eventos causados por el OTRO progenitor: nunca te notificamos de tus
 * propias acciones. Deliberadamente NO incluye mensajes de chat nuevos —
 * eso requeriría leer los mensajes de CADA hilo (N llamadas extra), el
 * mismo patrón de N+1 que ya causó la lentitud que se corrigió en
 * Calendario/Dashboard.
 */
export function buildNotifications({
  parentId,
  nameOf,
  childNameOf,
  expenses,
  pensionPayments,
  documents,
  verbalAgreements,
  custodyEvents,
}: {
  parentId: string;
  nameOf: (id: string) => string;
  childNameOf: (id: string | null) => string;
  expenses: Expense[];
  pensionPayments: PensionPayment[];
  documents: Document[];
  verbalAgreements: VerbalAgreement[];
  custodyEvents: CustodyEvent[];
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

  return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
