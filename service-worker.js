const CACHE_NAME = "ia-a-local-shell-v3";
const SHELL_RESOURCES = [
  "/",
  "/index.html",
  "/styles.css?v=8",
  "/app.js?v=8",
  "/browser-runtime.js?v=8",
  "/field-oauth.js?v=8-chrome",
  "/browser-core/android-experience.js",
  "/browser-core/audit-checkpoints.js",
  "/browser-core/brain-core.js",
  "/browser-core/brain-references.js",
  "/browser-core/brains.js",
  "/browser-core/channels.js",
  "/browser-core/core-validation.js",
  "/browser-core/crypto-browser.js",
  "/browser-core/field-connections.js",
  "/browser-core/mission.js",
  "/browser-core/project.js",
  "/browser-core/retention-plan.js",
  "/browser-core/scene-package.js",
  "/browser-core/software-progress.js",
  "/browser-core/strategy-briefing.js",
  "/browser-core/strategy-package.js",
  "/browser-core/text-package.js",
  "/browser-core/validation-safety.js",
  "/manifest.webmanifest",
  "/icons/ia-a.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_RESOURCES))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => name.startsWith("ia-a-local-shell-") && name !== CACHE_NAME)
            .map((name) => caches.delete(name))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;

  if (requestUrl.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(event.request).catch(
        () =>
          new Response(
            JSON.stringify({
              error: "O núcleo local está indisponível. Alterações offline permanecem bloqueadas."
            }),
            {
              status: 503,
              headers: { "content-type": "application/json; charset=utf-8" }
            }
          )
      )
    );
    return;
  }

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => caches.match("/index.html"))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => cached ?? fetch(event.request))
  );
});
