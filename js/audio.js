// audio.js — SOM
// Bipes sintetizados com a Web Audio API (sem arquivos de áudio).
'use strict';

function beep(freq, dur, type = 'square', vol = 0.04) {
  try {
    if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
    const o = audio.createOscillator(), g = audio.createGain();
    o.type = type; o.frequency.value = freq; g.gain.value = vol;
    o.connect(g); g.connect(audio.destination);
    o.start(); g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + dur);
    o.stop(audio.currentTime + dur);
  } catch (e) { /* sem áudio */ }
}
