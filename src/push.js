// Notificaciones push del navegador — solo funcionan si la app está agregada
// a la pantalla de inicio (iOS) o instalada/permitida (Android, desktop). Sin
// eso el permiso de notificaciones ni siquiera aparece: es una limitación del
// navegador, no de acá.
import api from "./cotizador/api";

const urlBase64ToUint8Array = (base64) => {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const base64Safe = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64Safe);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
};

export const pushSoportado = () =>
  "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

export const pushEstado = () => (pushSoportado() ? Notification.permission : "unsupported");

export async function activarPush() {
  if (!pushSoportado()) return { ok: false, motivo: "no_soportado" };
  const permiso = await Notification.requestPermission();
  if (permiso !== "granted") return { ok: false, motivo: "sin_permiso" };
  try {
    const reg = await navigator.serviceWorker.register("/service-worker.js");
    await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      const { data } = await api.get("/push/vapid-public-key");
      if (!data?.public_key) return { ok: false, motivo: "sin_vapid" };
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(data.public_key),
      });
    }
    const json = sub.toJSON();
    await api.post("/push/suscribir", { endpoint: json.endpoint, keys: json.keys });
    return { ok: true };
  } catch (e) {
    return { ok: false, motivo: "error", error: e };
  }
}

export async function desactivarPush() {
  if (!pushSoportado()) return;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await api.post("/push/desuscribir", { endpoint: sub.endpoint });
      await sub.unsubscribe();
    }
  } catch (e) { /* no romper la UI por esto */ }
}
