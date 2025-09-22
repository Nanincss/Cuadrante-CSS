const CACHE_NAME = 'cuadrante-planificador-cache-v2'; // Versión actualizada de la caché
const urlsToCache = [
  './', // Guarda la página principal
  'index.html', // Y también explícitamente
  'cuadrante.css',
  'cuadrante.js',
  'manifest.json', // Importante cachear el manifiesto
  'icon-192.png',
  'icon-512.png'
];

// Instalar el Service Worker y cachear los archivos principales de la app
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Cache abierto. Cacheando archivos principales...');
        return cache.addAll(urlsToCache);
      })
      .catch(error => {
        console.error('[Service Worker] Fallo al cachear archivos durante la instalación:', error);
      })
  );
});

// Activar el Service Worker y limpiar cachés antiguas
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keyList => {
      return Promise.all(keyList.map(key => {
        if (key !== CACHE_NAME) {
          console.log('[Service Worker] Eliminando caché antigua:', key);
          return caches.delete(key);
        }
      }));
    })
  );
});

// Interceptar las peticiones y servir desde la caché primero
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Si está en caché, lo devuelve. Si no, lo busca en la red.
        return response || fetch(event.request);
      })
  );
});