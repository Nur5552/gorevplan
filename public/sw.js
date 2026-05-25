/* Minimal service worker: bildirimler sekme arka plandayken daha güvenilir görünsün. */
self.addEventListener('install', function (e) {
    self.skipWaiting();
});

self.addEventListener('activate', function (e) {
    e.waitUntil(self.clients.claim());
});

self.addEventListener('notificationclick', function (e) {
    e.notification.close();
    e.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
            for (var i = 0; i < list.length; i++) {
                var c = list[i];
                if (c.url && 'focus' in c) return c.focus();
            }
            if (self.clients.openWindow) return self.clients.openWindow('/panel');
        })
    );
});
