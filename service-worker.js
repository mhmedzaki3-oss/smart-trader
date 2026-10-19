
const CACHE_NAME = "smart-trader-pro-v1";

const APP_FILES = [
  new URL("./", self.registration.scope).href,
  new URL("./index.html", self.registration.scope).href,
  new URL("./manifest.json", self.registration.scope).href,
  new URL("./icon.svg", self.registration.scope).href
];

// تثبيت التطبيق وتجهيز الملفات الأساسية
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(APP_FILES);
      await self.skipWaiting();
    })()
  );
});

// تفعيل النسخة الجديدة وتنظيف الذاكرة القديمة الخاصة بالتطبيق
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();

      await Promise.all(
        keys
          .filter(
            (key) =>
              key.startsWith("smart-trader-pro-") &&
              key !== CACHE_NAME
          )
          .map((key) => caches.delete(key))
      );

      await self.clients.claim();
    })()
  );
});

// الاتصال بالشبكة أولًا، والرجوع للنسخة المحفوظة عند انقطاعها
self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // لا نتدخل في طلبات واجهات API الخارجية
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      try {
        const response = await fetch(request);

        if (response && response.ok) {
          await cache.put(request, response.clone());
        }

        return response;
      } catch (error) {
        const saved = await cache.match(request);

        if (saved) return saved;

        if (request.mode === "navigate") {
          const offlinePage = await cache.match(
            new URL("./index.html", self.registration.scope).href
          );

          if (offlinePage) return offlinePage;
        }

        return new Response("غير متصل بالإنترنت", {
          status: 503,
          headers: { "Content-Type": "text/plain; charset=utf-8" }
        });
      }
    })()
  );
});

// استقبال إشعارات Push إذا تم إعداد خدمة إرسال فعلية
self.addEventListener("push", (event) => {
  let data = {};

  try {
    data = event.data ? event.data.json() : {};
  } catch (error) {
    data = {
      body: event.data ? event.data.text() : "لديك تنبيه جديد"
    };
  }

  const title = data.title || "Smart Trader Pro 2026";

  const options = {
    body: data.body || data.message || "لديك تنبيه جديد",
    icon: new URL("./icon.svg", self.registration.scope).href,
    data: {
      url: data.url || "./"
    }
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// فتح التطبيق عند الضغط على الإشعار
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  event.waitUntil(
    (async () => {
      const target = new URL(
        event.notification.data?.url || "./",
        self.registration.scope
      ).href;

      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true
      });

      for (const client of windows) {
        if ("focus" in client && client.url.startsWith(self.registration.scope)) {
          await client.focus();

          if ("navigate" in client) {
            await client.navigate(target);
          }

          return;
        }
      }

      if (self.clients.openWindow) {
        await self.clients.openWindow(target);
      }
    })()
  );
});
