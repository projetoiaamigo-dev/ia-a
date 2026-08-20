const CACHE_NAME = "ia-a-local-shell-v8";
const SCOPE_URL = self.registration.scope;
const INDEX_URL = new URL("./index.html", SCOPE_URL).href;
const SHELL_RESOURCES = [
  "./",
  "./index.html",
  "./styles.css?v=12-compact-mobile",
  "./app.js?v=11",
  "./browser-runtime.js?v=11",
  "./field-oauth.js?v=14-five-distinct",
  "./browser-core/android-experience.js",
  "./browser-core/audit-checkpoints.js",
  "./browser-core/brain-core.js",
  "./browser-core/brain-references.js",
  "./browser-core/brains.js",
  "./browser-core/official-brains.js",
  "./browser-core/channels.js",
  "./browser-core/core-validation.js",
  "./browser-core/crypto-browser.js",
  "./browser-core/field-connections.js",
  "./browser-core/mission.js",
  "./browser-core/project.js",
  "./browser-core/retention-plan.js",
  "./browser-core/scene-package.js",
  "./browser-core/software-progress.js",
  "./browser-core/strategy-briefing.js",
  "./browser-core/strategy-package.js",
  "./browser-core/text-package.js",
  "./browser-core/validation-safety.js",
  "./manifest.webmanifest",
  "./icons/ia-a.svg",
  "./icons/channels/web-radio-louvar.webp",
  "./icons/channels/fale-com-deus.webp",
  "./icons/channels/eu-oro-por-voce.webp",
  "./icons/channels/codigo-da-biblia.webp",
  "./icons/channels/palavra-que-desperta.webp"
].map((path) => new URL(path, SCOPE_URL).href);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_RESOURCES))
      .then(() => self.skipWaiting())
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

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(INDEX_URL))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => cached ?? fetch(event.request))
  );
});
