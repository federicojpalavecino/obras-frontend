// Notificaciones push para el panel /bot (chat del bot de WhatsApp). Mismo
// mecanismo que src/push.js (mismo service worker, mismas VAPID keys del
// backend) pero con fetch + token de admin en vez del axios de tenant — el
// panel del bot no tiene sesión de tenant.
const API = process.env.REACT_APP_API_URL || "https://obras-backend-production.up.railway.app";

const urlBase64ToUint8Array = (base64) => {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const base64Safe = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64Safe);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
};

export const pushSoportado = () =>
  "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

export const pushEstado = () => (pushSoportado() ? Notification.permission : "unsupported");

export async function activarPushAdmin(token) {
  if (!pushSoportado()) return { ok: false, motivo: "no_soportado" };
  const permiso = await Notification.requestPermission();
  if (permiso !== "granted") return { ok: false, motivo: "sin_permiso" };
  try {
    const reg = await navigator.serviceWorker.register("/service-worker.js");
    await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      const r = await fetch(`${API}/push/vapid-public-key`);
      const data = await r.json();
      if (!data?.public_key) return { ok: false, motivo: "sin_vapid" };
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(data.public_key),
      });
    }
    const json = sub.toJSON();
    await fetch(`${API}/whatsapp/admin/push/suscribir`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, motivo: "error", error: e };
  }
}

export async function desactivarPushAdmin(token) {
  if (!pushSoportado()) return;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await fetch(`${API}/whatsapp/admin/push/desuscribir`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      });
      await sub.unsubscribe();
    }
  } catch (e) { /* no romper la UI por esto */ }
}
