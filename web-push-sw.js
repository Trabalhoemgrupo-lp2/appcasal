self.addEventListener("push", (event) => {
  const payload = event.data ? event.data.json() : {};
  const title = payload.title || "Caderno de Dois";
  const options = {
    body: payload.body || "A escuta de vocês está chegando.",
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    data: { url: payload.url || "/?tab=musica" },
    tag: payload.tag || "music-reminder",
    renotify: false,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data?.url || "/?tab=musica"));
});
