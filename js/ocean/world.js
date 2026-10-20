// ocean/world.js — MODO OCEANO: estado compartilhado e o mar com ilhas
// O jato sobrevoa o mar aberto: não há margens nem pontes, só ilhas (cenário que se
// sobrevoa), navios, porta-aviões que lançam aviões e esquadrilhas que entram em formação
// fazendo acrobacias. No fim de cada seção chega um CHEFE (quatro tipos, cada um com ataque
// e defesa próprios); derrotá-lo é o checkpoint. Aqui não há vidas extras: só a barra de vida.
// O voo alterna entre RASANTE (perto do mar: navios atiram, postos curam) e ALTO (acima das
// nuvens: só o combate aéreo importa); as lutas com chefes são lá em cima.
//
// Os aviões das esquadrilhas, os lançados e o chefe vivem em COORDENADAS DE TELA (voam
// em relação à câmera); para colidir com coisas do mundo, worldY() converte.
//
// O modo oceano está dividido em arquivos (carregados nesta ordem):
//   ocean/world.js .... estado do modo, conversão tela ↔ mundo, genOceanBlock() (mar + ilhas)
//   ocean/squads.js ... esquadrilhas acrobáticas, navios e helicópteros, oceanMissileHit()
//   ocean/bosses.js ... os quatro chefes: ataques, defesas e a queda no mar
//   ocean/altitude.js . voo rasante × alto e as manobras (looping / mergulho)
//   ocean/bombs.js .... a bomba (onda de choque) e os power-ups de recompensa
//   ocean/update.js ... updateOcean(): o passo do modo, chamado pelo update
//   render/ocean.js ... desenho: aviões, chefes, porta-aviões e nuvens
//
// Usa: config, util, state, effects, audio, powerups (pw), terrain (blocks, getBlock).
'use strict';

const OCEAN_WATER = '#1d5fae';
const FLIER_W = 20 * SC.plane, FLIER_H = 10 * SC.plane;
const BOSS_AT = 11;                                   // bloco da seção em que o chefe aparece
const bossSection = s => s % 2 === 1;                 // chefe a cada duas seções (2ª, 4ª, …): ~25 s de viagem entre eles
let fliers = [], squadT = 0, squadId = 0, squads = {}, boss = null, bossDone = {};
let camSp = 0;                                        // velocidade da câmera no passo atual (update.js)

const worldY = sy => scroll + VIEW_H - sy;            // tela → mundo
const screenY = Y => VIEW_H - (Y - scroll);           // mundo → tela

function resetOcean() { maneuver = null; bombQueue = []; fliers = []; boss = null; squadT = 240; squads = {}; altT = 0; altTarget = 0; altTimer = ALT_LOW; altMsg = 0; }
function newOceanGame() { resetOcean(); bossDone = {}; }

// ---------- terreno: mar aberto com ilhas ----------
// As ilhas podem ser bem mais compridas que um bloco: o estado da ilha em curso passa de um
// bloco para o seguinte (blk.isle), então ela continua sem emenda. Tipos:
//   longa ...... comprida no sentido do voo (2 a 5 blocos), espinha sinuosa e largura que respira
//   arquipélago  cadeia de ilhotas em zigue-zague, separadas por canais de água
//   atol ....... anel de areia e mato com uma lagoa turquesa no meio
//   redonda .... ilha pequena e arredondada
// Cada linha guarda um só trecho de ilha (IL/IR), o mesmo formato das ilhas do rio.
const ISLE_TYPES = {
  long:  { len: [70, 160], w: [40, 90] },
  chain: { len: [90, 150], w: [26, 46] },
  atoll: { len: [40, 64],  w: [80, 130] },
  round: { len: [22, 40],  w: [40, 100] },
};
function isleHalf(st, u, t) {                          // meia-largura e centro da ilha no ponto u (0→1)
  const env = Math.pow(Math.max(0, 1 - Math.abs(2 * u - 1) ** 2.2), 0.6);   // pontas ovais (começa estreita)
  let half, c = st.cx;
  if (st.kind === 'long') { half = st.w / 2 * env * (0.72 + 0.28 * Math.sin(u * 7 + st.ph)); c += Math.sin(u * 3.2 + st.ph) * 26; }
  else if (st.kind === 'chain') { const s = Math.abs(Math.sin(u * Math.PI * st.k)); half = st.w / 2 * Math.max(0, (s - 0.28) / 0.72) * (0.6 + 0.4 * env); c += Math.sin(u * Math.PI * st.k * 0.5 + st.ph) * 34; }
  else if (st.kind === 'atoll') { half = st.w / 2 * env; c += Math.sin(u * 2 + st.ph) * 6; }
  else { half = st.w / 2 * env * (1 + 0.12 * Math.sin(t * 0.35 + st.ph)); }
  return [half, c];
}

function genOceanBlock(blk) {
  for (let i = 0; i < LINES; i++) { blk.L[i] = -400; blk.R[i] = W + 400; } // margens bem fora da tela (mesmo com o zoom do voo alto)
  blk.endC = W / 2; blk.endW = W + 800;
  blk.LG = new Float32Array(LINES);                                         // meia-largura da lagoa (atol)
  const prev = blk.g > 0 ? blocks[blk.g - 1] : null;
  let st = prev && prev.isle ? Object.assign({}, prev.isle) : null;         // ilha que vem do bloco anterior
  // começar uma ilha nova neste bloco? (fora da zona de respiro e se nenhuma estiver em curso)
  let startAt = -1;
  if (!st && blk.g >= 2 && blk.b >= CALM_BLOCKS && rng() < 0.42) startAt = Math.floor(rng() * LINES);
  for (let i = 0; i < LINES; i++) {
    if (!st && i === startAt) {
      const kinds = ['long', 'long', 'chain', 'atoll', 'round', 'round'], kind = kinds[Math.floor(rng() * kinds.length)], T = ISLE_TYPES[kind];
      const w = T.w[0] + rng() * (T.w[1] - T.w[0]);
      blk.isleKind = kind;                                                  // (usado pelo catálogo de gráficos)
      st = { kind, t: 0, len: Math.round(T.len[0] + rng() * (T.len[1] - T.len[0])), w,
        cx: w / 2 + 6 + rng() * (W - w - 12), ph: rng() * 6.28, k: 3 + Math.floor(rng() * 3) };
    }
    if (!st) continue;
    const u = st.t / st.len, [half, c] = isleHalf(st, u, st.t);
    if (half > 1.5) {
      blk.IL[i] = c - half; blk.IR[i] = c + half;
      if (st.kind === 'atoll') blk.LG[i] = Math.max(0, half * 0.62 - st.w * 0.1);   // lagoa afina junto com o anel
    }
    if (++st.t > st.len) st = null;
  }
  blk.isle = st;                                                            // continua no próximo bloco
}
