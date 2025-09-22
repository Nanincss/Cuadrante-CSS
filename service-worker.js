const CACHE_NAME = 'cuadrante-planificador-cache-v4'; // Nueva versión para forzar la actualización
const urlsToCache = [
  './', // Guarda la página principal
  'index.html', // Y también explícitamente
  'cuadrante.css',
  'cuadrante.js',
  'manifest.json', // Importante cachear el manifiesto
  'icon-192.png',
  'icon-512.png'
];

// Paso 1: Instalar el Service Worker
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Abriendo caché y añadiendo archivos principales.');
        return cache.addAll(urlsToCache);
      })
      .catch(error => {
        console.error('[Service Worker] Fallo al cachear durante la instalación:', error);
      })
  );
});

// Paso 2: Activar el Service Worker y limpiar cachés viejas
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keyList => {
      return Promise.all(keyList.map(key => {
        if (key !== CACHE_NAME) {
          return caches.delete(key);
        }
      }));
    })
  );
});

// Paso 3: Interceptar peticiones (Estrategia: Cache, falling back to Network)
self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});