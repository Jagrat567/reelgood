const VERSION = 'reelgood-v1';
const APP_CACHE = `${VERSION}-app`;
const DATA_CACHE = `${VERSION}-data`;
const IMAGE_CACHE = `${VERSION}-images`;
const OFFLINE_URL = '/offline.html';
const APP_SHELL = [
  '/',
  OFFLINE_URL,
  '/manifest.webmanifest',
  '/favicon.svg',
  '/icons/icon-180.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(APP_CACHE).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => !key.startsWith(VERSION)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

function normalizedDataKey(request) {
  const url = new URL(request.url);
  url.searchParams.delete('seed');
  return new Request(url.toString(), { method: 'GET' });
}

async function trimCache(cacheName, maximumEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - maximumEntries)).map((key) => cache.delete(key)));
}

async function networkFirst(request, cacheName, cacheKey = request) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(cacheKey, response.clone());
    return response;
  } catch {
    const cached = await cache.match(cacheKey);
    if (cached) return cached;
    throw new Error('OFFLINE_AND_NOT_CACHED');
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok || response.type === 'opaque') {
    await cache.put(request, response.clone());
    void trimCache(cacheName, 80);
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  if (request.mode === 'navigate') {
    event.respondWith(
      networkFirst(request, APP_CACHE)
        .catch(() => caches.match('/'))
        .then((response) => response || caches.match(OFFLINE_URL)),
    );
    return;
  }

  if (url.origin === self.location.origin && url.pathname === '/api/tmdb') {
    event.respondWith(networkFirst(request, DATA_CACHE, normalizedDataKey(request)));
    return;
  }

  if (url.hostname === 'image.tmdb.org') {
    event.respondWith(cacheFirst(request, IMAGE_CACHE));
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(request, APP_CACHE));
  }
});
