const CACHE_NAME = 'cuadrante-planificador-cache-v5'; // Nueva versión para forzar la actualización
const urlsToCache = [
  './', // Guarda la página principal
  'index.html', // Y también explícitamente
  'cuadrante.css',
  'cuadrante.js',
  'manifest.json', // Importante cachear el manifiesto
  'icon-192.png',
  'icon-512.png'
];

// Paso 1: Instalar - Se descarga y guarda el "esqueleto" de la app.
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Abriendo caché y añadiendo archivos principales.');
        return cache.addAll(urlsToCache).catch(error => {
          console.error('[Service Worker] Fallo al añadir archivos a la caché durante la instalación:', error);
        });
      })
  );
});

// Paso 2: Activar - Se toma el control y se limpia la basura vieja.
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keyList => {
      return Promise.all(keyList.map(key => {
        if (key !== CACHE_NAME) {
          console.log('[Service Worker] Eliminando caché antigua:', key);
          return caches.delete(key);
        }
      }));
    }).then(() => self.clients.claim()) // ¡Toma el control de inmediato!
  );
});

// Paso 3: Fetch - Decide si mostrar la versión de internet o la guardada.
self.addEventListener('fetch', event => {
  // Estrategia: "Network first". Siempre intenta buscar la versión más nueva en internet.
  // Si no hay internet, entonces usa la "foto" guardada.
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});