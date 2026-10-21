// sw.js — service worker do PWA: guarda os arquivos do jogo para jogar offline.
// Ao mudar o jogo, troque VERSION para os aparelhos baixarem a versão nova.
const VERSION = 'river-v40';
const FILES = ['./', 'index.html', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png',
  'js/config.js', 'js/util.js', 'js/audio.js', 'js/terrain.js', 'js/objects.js', 'js/cliffs.js', 'js/powerups.js', 'js/ocean/world.js', 'js/ocean/squads.js', 'js/ocean/bosses.js', 'js/ocean/altitude.js', 'js/ocean/bombs.js', 'js/ocean/update.js', 'js/state.js',
  'js/effects.js', 'js/gameover.js', 'js/update.js', 'js/render/canvas.js', 'js/render/terrain.js',
  'js/render/sprites.js', 'js/render/ocean.js', 'js/render/frame.js', 'js/render/retro.js', 'js/render/pico.js', 'js/render/pico-ocean.js', 'js/main.js', 'js/gamepad.js', 'js/touch.js'];
self.addEventListener('install', e => e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k))))));
self.addEventListener('fetch', e => e.respondWith(caches.match(e.request).then(r => r || fetch(e.request))));
