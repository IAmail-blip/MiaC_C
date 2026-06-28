/* ============================================================
   sw.js — La Compra Diaria  ·  Service Worker v2 FINAL
   Estrategia:
     • Assets propios  → Cache-First  (offline garantizado)
     • CDN externos    → Stale-While-Revalidate
     • Resto           → Network-First con fallback a caché
   ============================================================ */

const CACHE_CORE = 'lcd-core-v3';
const CACHE_CDN  = 'lcd-cdn-v3';
const CACHE_MISC = 'lcd-misc-v3';

const ALL_CACHES = [CACHE_CORE, CACHE_CDN, CACHE_MISC];

// Assets propios imprescindibles para funcionar offline
const CORE_URLS = [
  './',
  './index.html',
  './app.js',
  './tailwind.css',
  './favicon.svg',
  './manifest.json'
];

// CDN que queremos pre-warm (no bloquea install si fallan)
const CDN_URLS = [
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap'
];

// ── INSTALL ───────────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    (async () => {
      // 1. Cache-First: bloquear install hasta tener los assets core
      const core = await caches.open(CACHE_CORE);
      await core.addAll(CORE_URLS);

      // 2. CDN: intentar pre-caché pero sin bloquear
      caches.open(CACHE_CDN).then(cdn => {
        CDN_URLS.forEach(url =>
          fetch(url, { mode: 'no-cors' })
            .then(r => { if (r) cdn.put(url, r); })
            .catch(() => {/* offline en install — ok */})
        );
      });

      // Activar inmediatamente sin esperar a que se cierre la pestaña vieja
      await self.skipWaiting();
    })()
  );
});

// ── ACTIVATE ──────────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    (async () => {
      // Eliminar todas las cachés de versiones anteriores
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter(k => !ALL_CACHES.includes(k))
          .map(k => {
            console.log('[SW] Eliminando caché obsoleta:', k);
            return caches.delete(k);
          })
      );

      // Tomar el control inmediato de todos los clientes
      await self.clients.claim();
      console.log('[SW] Activado y en control — v2');
    })()
  );
});

// ── FETCH ─────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  // Ignorar no-GET y extensiones del navegador
  if (req.method !== 'GET') return;
  if (!['http:', 'https:'].includes(url.protocol)) return;

  // ── Assets propios: Cache-First ───────────────────────────
  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(req, CACHE_CORE));
    return;
  }

  // ── CDN conocidos: Stale-While-Revalidate ─────────────────
  const isCDN =
    url.hostname.includes('tailwindcss.com') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('gstatic.com') ||
    url.hostname.includes('fonts.gstatic.com');

  if (isCDN) {
    event.respondWith(staleWhileRevalidate(req, CACHE_CDN));
    return;
  }

  // ── Resto: Network-First con fallback a caché ─────────────
  event.respondWith(networkFirst(req, CACHE_MISC));
});

// ══════════════════════════════════════════════════════════════
// Estrategias de caché
// ══════════════════════════════════════════════════════════════

/**
 * Cache-First: sirve desde caché; si no existe, va a red y cachea.
 * Ideal para assets versionados o que raramente cambian.
 */
async function cacheFirst(req, cacheName) {
  const cached = await caches.match(req, { ignoreVary: true });
  if (cached) return cached;

  try {
    const fresh = await fetch(req);
    if (fresh && fresh.ok) {
      const cache = await caches.open(cacheName);
      cache.put(req, fresh.clone());
    }
    return fresh;
  } catch (err) {
    // Sin red y sin caché: página de fallback offline
    return offlineFallback(req);
  }
}

/**
 * Stale-While-Revalidate: devuelve caché inmediatamente
 * y actualiza en background.
 */
async function staleWhileRevalidate(req, cacheName) {
  const cache  = await caches.open(cacheName);
  const cached = await cache.match(req, { ignoreVary: true });

  // Actualizar en background (fire & forget)
  const fetchPromise = fetch(req)
    .then(fresh => {
      if (fresh && fresh.ok) cache.put(req, fresh.clone());
      return fresh;
    })
    .catch(() => null);

  // Servir caché si existe; si no, esperar a la red
  return cached || await fetchPromise || offlineFallback(req);
}

/**
 * Network-First: intenta red; si falla, sirve caché.
 * Con timeout de 3s para no dejar al usuario esperando.
 */
async function networkFirst(req, cacheName, timeoutMs = 3000) {
  const cache = await caches.open(cacheName);

  try {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), timeoutMs);

    const fresh = await fetch(req, { signal: controller.signal });
    clearTimeout(tid);

    if (fresh && fresh.ok) {
      cache.put(req, fresh.clone());
    }
    return fresh;
  } catch {
    const cached = await cache.match(req, { ignoreVary: true });
    return cached || offlineFallback(req);
  }
}

/**
 * Fallback offline: devuelve index.html para navegación SPA,
 * o un 503 minimal para otros recursos.
 */
async function offlineFallback(req) {
  const url = new URL(req.url);

  // Para navegación, devolver la app shell cacheada
  if (req.mode === 'navigate' || req.headers.get('accept')?.includes('text/html')) {
    const shell = await caches.match('./index.html');
    if (shell) return shell;
  }

  // Para el resto, 503 limpio
  return new Response(
    JSON.stringify({ error: 'offline', url: url.pathname }),
    {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'Content-Type': 'application/json' }
    }
  );
}

// ── MENSAJE desde la app (ej: forzar actualización) ───────────
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
