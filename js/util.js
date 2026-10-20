// util.js — FUNÇÕES AUXILIARES
// mulberry32: gerador de números aleatórios com semente. Com a mesma semente, a mesma
//             sequência; é isso que faz cada bloco do mapa ser sempre igual ao voltar a ele.
// clamp:      limita um valor entre um mínimo e um máximo.
'use strict';

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
