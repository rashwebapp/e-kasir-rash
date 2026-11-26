/**
 * ============================================================================
 * E-Kasir By Rash Studio - Service Worker (PWA Engine)
 * ============================================================================
 * Strategi:
 * 1. Cache-First untuk App Shell (HTML, CSS, JS, Ikon)
 * 2. Network-First untuk permintaan API ke Google Apps Script (Backend)
 * 3. Graceful Offline Fallback & Background Sync Protection
 * ============================================================================
 */

const CACHE_NAME = 'ekasir-rash-v1.3.0';
const STATIC_ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon.svg',
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/lucide@latest',
  'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js',
  'https://unpkg.com/html5-qrcode'
];

// Tahap 1: Install - Cache Seluruh App Shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Memasang App Shell E-Kasir ke Cache...');
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[Service Worker] Gagal menyimpan beberapa aset statis:', err);
      });
    })
  );
  self.skipWaiting();
});

// Tahap 2: Activate - Bersihkan Cache Lama
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            console.log('[Service Worker] Menghapus Cache Usang:', name);
            return caches.delete(name);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Tahap 3: Fetch - Bedakan Aset Statis vs Panggilan API
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // Jika permintaan mengarah ke Google Apps Script / script.google.com -> Gunakan Network-First
  if (requestUrl.hostname.includes('script.google.com') || requestUrl.searchParams.has('action')) {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          return new Response(
            JSON.stringify({
              success: false,
              offline: true,
              message: 'Perangkat sedang luring (Offline). Data transaksi lokal tetap tersimpan di memori perangkat.'
            }),
            {
              headers: { 'Content-Type': 'application/json' }
            }
          );
        })
    );
    return;
  }

  // Aset Statis (App Shell) -> Cache-First, fallback ke Jaringan
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((networkResponse) => {
        // Simpan aset baru ke cache jika respons valid
        if (
          networkResponse &&
          networkResponse.status === 200 &&
          event.request.method === 'GET' &&
          !requestUrl.protocol.startsWith('chrome-extension')
        ) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        // Fallback jika offline dan aset belum ada di cache
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
