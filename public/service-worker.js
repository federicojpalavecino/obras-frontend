// Service worker mínimo: solo push notifications, sin cache offline (eso es
// otro proyecto). Si el día de mañana hace falta cachear para que ande sin
// señal, esto es el lugar, pero hoy alcanza con esto.

self.addEventListener('push', (event) => {
  let data = { titulo: 'FAIM OBRAS', cuerpo: 'Tenés un mensaje nuevo', url: '/mensajes' };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch (e) { /* si no vino JSON, se usa el default */ }

  event.waitUntil(
    self.registration.showNotification(data.titulo, {
      body: data.cuerpo,
      icon: '/logo192.png',
      badge: '/logo192.png',
      data: { url: data.url || '/mensajes' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/mensajes';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
