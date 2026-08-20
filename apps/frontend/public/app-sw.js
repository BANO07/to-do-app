/**
 * App Service Worker — caching layer for Todo AI Planner.
 * Separate from push-sw.js which handles Web Push notifications.
 *
 * Strategy:
 * - App shell (HTML/CSS/JS) — cache-first after first load
 * - /graphql API — network-first (freshness), fallback cached
 * - Images/assets — cache-first
 */

const CACHE_NAME = 'todo-ai-v1';
const OFFLINE_URL = '/offline.html';

const APP_SHELL_ASSETS = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.webmanifest',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL_ASSETS)),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and cross-origin
  if (request.method !== 'GET' || url.origin !== location.origin) return;

  // GraphQL — network first
  if (url.pathname === '/graphql') {
    event.respondWith(networkFirst(request));
    return;
  }

  // Navigation requests — network first, fallback offline page
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE_URL)),
    );
    return;
  }

  // Static assets — cache first
  event.respondWith(cacheFirst(request));
});

async function networkFirst(request) {
  try {
    const response = await fetch(request.clone());
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached ?? new Response('{"errors":[{"message":"Offline"}]}', {
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Not available offline', { status: 503 });
  }
}
