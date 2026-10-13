"use client";

import { useEffect, useState } from "react";
import { subscribePushAction, unsubscribePushAction } from "./pushActions";

type Status = "checking" | "unsupported" | "needs-install" | "off" | "on" | "denied";

// El tipo de retorno de pushManager.subscribe() exige un ArrayBuffer "real"
// como backing store (no ArrayBufferLike) — Uint8Array.from() en TS 5.7+
// infiere un buffer más genérico que no encaja ahí, por eso se arma a mano
// sobre un ArrayBuffer explícito.
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; i++) bytes[i] = rawData.charCodeAt(i);
  return bytes;
}

/**
 * En iPhone, Safari SOLO permite suscribirse a push desde una PWA ya
 * instalada (agregada a la pantalla de inicio) — nunca desde una pestaña
 * normal, aunque el usuario haya dado permiso. `navigator.standalone` es
 * la señal (no estándar, pero es lo único que expone iOS para esto) de
 * que la app corre instalada así.
 */
function isIosSafariNotStandalone(): boolean {
  const ua = window.navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua);
  const isStandalone = (window.navigator as any).standalone === true || window.matchMedia("(display-mode: standalone)").matches;
  return isIos && !isStandalone;
}

export function PushToggle() {
  const [status, setStatus] = useState<Status>("checking");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function check() {
      // En iPhone, "PushManager" directamente NO existe en window dentro
      // de una pestaña normal de Safari — WebKit solo lo expone una vez
      // que la app está instalada en la pantalla de inicio. Por eso este
      // chequeo va ANTES del feature-detection genérico: si no, una
      // pestaña normal de Safari en iPhone (que sí podría soportar push
      // una vez instalada) se reportaba como "unsupported" sin más,
      // cuando el mensaje correcto es "instálala primero".
      if (isIosSafariNotStandalone()) {
        setStatus("needs-install");
        return;
      }
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setStatus("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        setStatus("denied");
        return;
      }
      const registration = await navigator.serviceWorker.getRegistration();
      const existing = await registration?.pushManager.getSubscription();
      setStatus(existing ? "on" : "off");
    }
    check().catch(() => setStatus("unsupported"));
  }, []);

  async function enable() {
    setBusy(true);
    setError(null);
    try {
      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) throw new Error("not-configured");

      const registration = await navigator.serviceWorker.register("/sw.js");
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus("denied");
        setBusy(false);
        return;
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      const result = await subscribePushAction(JSON.stringify(subscription.toJSON()));
      if (result.error) throw new Error(result.error);
      setStatus("on");
    } catch {
      setError("No se pudo activar — intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setError(null);
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await unsubscribePushAction(subscription.endpoint);
        await subscription.unsubscribe();
      }
      setStatus("off");
    } catch {
      setError("No se pudo desactivar — intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  if (status === "checking") return null;

  return (
    <div>
      {status === "unsupported" && (
        <p className="mt-2 text-sm text-ink-soft">Este navegador no soporta notificaciones push.</p>
      )}
      {status === "needs-install" && (
        <p className="mt-2 text-sm text-ink-soft">
          En iPhone, primero agrega ALBA a tu pantalla de inicio (compartir → "Agregar a inicio") — Safari solo manda
          notificaciones a apps instaladas así.
        </p>
      )}
      {status === "denied" && (
        <p className="mt-2 text-sm text-ink-soft">
          Bloqueaste las notificaciones para este sitio — actívalas desde los ajustes del navegador para este sitio.
        </p>
      )}
      {status === "off" && (
        <>
          <p className="mt-2 text-sm text-ink-soft">
            Recibe un aviso en este dispositivo cuando el otro progenitor registre algo (gasto, pago, mensaje...).
          </p>
          <button
            type="button"
            onClick={enable}
            disabled={busy}
            className="mt-3 rounded-full bg-orange px-4 py-2 text-sm font-semibold text-ink disabled:opacity-60"
          >
            {busy ? "Activando…" : "Activar en este dispositivo"}
          </button>
        </>
      )}
      {status === "on" && (
        <>
          <p className="mt-2 text-sm text-success">✓ Notificaciones activadas en este dispositivo.</p>
          <button
            type="button"
            onClick={disable}
            disabled={busy}
            className="mt-3 rounded-full border border-subtle bg-card px-4 py-2 text-sm font-medium text-ink disabled:opacity-60"
          >
            {busy ? "Desactivando…" : "Desactivar"}
          </button>
        </>
      )}
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
    </div>
  );
}
