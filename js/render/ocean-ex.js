// render/ocean-ex.js — MODO "OCEAN EX": o oceano com os gráficos detalhados (assets/ocean-ex)
// A lógica é a MESMA do Ocean (área de 240×320). O desenho é o vetorial do Ocean, mas cada
// função que desenha uma peça pergunta primeiro aqui se há uma imagem para ela: jato (5
// inclinações), navio (normal e disparando), porta-aviões, caças, helicóptero, balões,
// balsa de combustível, power-ups, os chefes, foguete, mina, tiro, míssil, nuvens e a
// textura do mar. Sem imagem (ou enquanto ela carrega), fica o desenho vetorial.
// Ilhas e explosões continuam vetoriais (são geradas/animadas pelo jogo).
//
// As imagens vêm de novos/ (versões redesenhadas do catálogo, mesmo enquadramento),
// preparadas por scripts/preparar-ocean-ex.py com EX_S pixels por unidade do jogo.
// Cada entrada de EX diz onde fica, dentro da imagem, o ponto (x, y) que a função vetorial
// recebe — a mesma chamada usada para capturar o PNG no catálogo (scripts/catalogo/render.js).
//
// Usa: state (mode), canvas (ctx), ocean/* (altT, AIRSHIP_TURRETS, BOSS_FALL…).
'use strict';

const isEx = () => mode === 'oceanex';
const EX_S = 3;                                        // pixels por unidade do jogo nas imagens
const EX_BASE = new URL('../../assets/ocean-ex/', document.currentScript.src).href;
// nome → âncora [ax, ay] em unidades do jogo (ponto que a função vetorial recebe)
const EX = {
  jato_vetor_esq_max: [13, 3], jato_vetor_esq: [13, 3], jato_vetor_nivel: [13, 3], jato_vetor_dir: [13, 3], jato_vetor_dir_max: [13, 3],
  navio_cima: [30, 2], navio_cima_disparo: [30, 2], porta_avioes: [32, 3], caca_vermelho: [1, 1],
  heli_cima: [4, 6], balao_cima_0: [4, 2], balao_cima_1: [4, 2], combustivel_cima: [1, 1],
  pu_shield: [10, 10], pu_triple: [10, 10], pu_rapid: [10, 10], pu_bomb: [10, 10], pu_life: [10, 10],
  chefe_bombardeiro: [100, 62], chefe_canhoneira: [100, 62], chefe_canhoneira_escudo: [100, 62],
  chefe_dirigivel: [100, 62], chefe_dirigivel_avariado: [100, 62], chefe_interceptador: [100, 62],
  foguete: [16, 8], mina: [10, 10], tiro_inimigo: [20, 8], missil: [3, 3],
  nuvem_puff: [0, 0], nuvem_bank: [0, 0], nuvem_wisp: [0, 0], nuvem_tower: [0, 0], mar_ondas: [0, 0],
};
const EX_IMG = {};
const exReady = Promise.all(Object.keys(EX).map(n => new Promise(ok => {
  const im = new Image(); im.onload = im.onerror = () => ok(); im.src = EX_BASE + n + '.png'; EX_IMG[n] = im;
})));
const exHas = n => { const im = EX_IMG[n]; return !!im && im.complete && im.naturalWidth > 0; };

// desenha a imagem `n` com a âncora em (x, y), na escala k. flipW > 0: espelha na horizontal
// em torno do centro do objeto, que ocupa [x, x + flipW·k] (o mesmo que o vetorial faz com dir).
function exDraw(n, x, y, k = 1, flipW = 0) {
  if (!exHas(n)) return false;
  const im = EX_IMG[n], [ax, ay] = EX[n], s = (n === 'mar_ondas' ? 2 : EX_S);
  if (flipW) { ctx.save(); ctx.translate(2 * x + flipW * k, 0); ctx.scale(-1, 1); }
  ctx.drawImage(im, x - ax * k, y - ay * k, im.naturalWidth / s * k, im.naturalHeight / s * k);
  if (flipW) ctx.restore();
  return true;
}
// realce de acerto: a mesma imagem somada por cima (fica clara sem sair do contorno)
function exFlash(n, x, y, a, k = 1, flipW = 0) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a; exDraw(n, x, y, k, flipW); ctx.restore();
}

// ---------- peças ----------
function exJet(cx, top, bk, s) {                        // 5 quadros de inclinação
  const n = ['jato_vetor_esq_max', 'jato_vetor_esq', 'jato_vetor_nivel', 'jato_vetor_dir', 'jato_vetor_dir_max'][clamp(Math.round(bk * 2) + 2, 0, 4)];
  return exDraw(n, cx, top, s / JET_SC);
}
function exCarrier(x, y, dir, o) {
  const k = o.w / 96;
  if (!exDraw('porta_avioes', x, y, k, dir < 0 ? 96 : 0)) return false;
  if (o.flash > 0) exFlash('porta_avioes', x, y, 0.6, k, dir < 0 ? 96 : 0);
  if (o.hp < o.maxHp) {                                 // vida do porta-aviões (igual ao vetorial)
    const L = o.w;
    rrect(x + L * 0.2, y - 5, L * 0.6, 2.5, 1.2); ctx.fillStyle = 'rgba(12,15,28,.6)'; ctx.fill();
    rrect(x + L * 0.2, y - 5, L * 0.6 * o.hp / o.maxHp, 2.5, 1.2); ctx.fillStyle = '#ff8a3d'; ctx.fill();
  }
  return true;
}
function exBoss(B) {
  let n = { bomber: 'chefe_bombardeiro', gunship: 'chefe_canhoneira', airship: 'chefe_dirigivel', interceptor: 'chefe_interceptador' }[B.kind];
  if (B.kind === 'gunship' && B.shield > 0 && (B.shield > 40 || frame % 8 < 4)) n = 'chefe_canhoneira_escudo';
  const alive = B.kind === 'airship' ? B.turrets.filter(t => t.hp > 0).length : 0;
  if (B.kind === 'airship' && alive === 0) n = 'chefe_dirigivel_avariado';
  if (!exHas(n)) return false;
  if (B.kind === 'interceptor') {
    if (B.mode === 'dash' || B.mode === 'back')          // rastro da investida
      B.trail.forEach(([x, y], k) => { ctx.globalAlpha = 0.08 + 0.05 * k; exDraw(n, x, y); ctx.globalAlpha = 1; });
    if (B.mode === 'aim') {                              // aviso: linha tracejada até o alvo
      ctx.strokeStyle = 'rgba(229,72,77,' + (0.4 + 0.4 * Math.sin(B.modeT * 0.6)).toFixed(2) + ')'; ctx.lineWidth = 1.2; ctx.setLineDash([5, 4]);
      ctx.beginPath(); ctx.moveTo(B.x, B.y); ctx.lineTo(B.tx, B.ty); ctx.stroke(); ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(B.tx, B.ty, 10, 0, Math.PI * 2); ctx.stroke();
    }
  }
  exDraw(n, B.x, B.y);
  if (B.kind === 'airship' && alive > 0)                 // torres já destruídas: marcas queimadas
    for (const t of B.turrets) if (t.hp <= 0) { ell(B.x + t.dx, B.y + t.dy, 4.5, 4.5, '#26334f'); ell(B.x + t.dx, B.y + t.dy, 2.5, 2.5, '#0c0f1c'); }
  if (B.flash > 0) exFlash(n, B.x, B.y, 0.55);
  return true;
}
function exShell(sh, sy) {
  const a = Math.atan2(-sh.vy, sh.vx);
  if (sh.kind === 'mine') return exDraw('mina', sh.x, sy);
  const n = sh.kind === 'rocket' ? 'foguete' : 'tiro_inimigo';
  if (!exHas(n)) return false;
  ctx.save(); ctx.translate(sh.x, sy); ctx.rotate(a); exDraw(n, 0, 0); ctx.restore();
  return true;
}
// nuvem: a imagem do seu tipo, esticada até a caixa dos flocos (mesma conta do catálogo)
function exCloud(c, y, alpha) {
  const n = 'nuvem_' + (c.kind || 'puff');
  if (!exHas(n)) return false;
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const [dx, dy, r, st] of c.puffs) { x0 = Math.min(x0, dx - r); x1 = Math.max(x1, dx + r); y0 = Math.min(y0, dy - r * st); y1 = Math.max(y1, dy + r * st + r * 0.3); }
  ctx.globalAlpha = alpha;
  ctx.drawImage(EX_IMG[n], c.x + x0 - 20, y + y0 - 20, x1 - x0 + 40, y1 - y0 + 50);
  ctx.globalAlpha = 1;
  return true;
}
// mar: textura que rola com o mundo; ladrilhos espelhados (na vertical e na horizontal) em vez
// de repetidos, para não aparecer emenda (cada ladrilho tem 240×160; o padrão se repete a cada 2)
function exSea(ext) {
  if (!exHas('mar_ondas')) return false;
  const im = EX_IMG.mar_ondas, tw = 240, th = 160, top = -ext - 10, bot = VIEW_H + ext + 10, left = -ext - 10, right = W + ext + 10;
  const off = ((scroll % (2 * th)) + 2 * th) % (2 * th);   // o mar desce junto com a rolagem
  const odd = v => ((v % 2) + 2) % 2 === 1;
  for (let ky = Math.floor((top - off) / th); ky * th + off < bot; ky++) {
    const y = ky * th + off;
    for (let kx = Math.floor(left / tw); kx * tw < right; kx++) {
      const x = kx * tw, fx = odd(kx), fy = odd(ky);
      ctx.save(); ctx.translate(fx ? 2 * x + tw : 0, fy ? 2 * y + th : 0); ctx.scale(fx ? -1 : 1, fy ? -1 : 1);
      ctx.drawImage(im, x, y, tw + 0.5, th + 0.5); ctx.restore();
    }
  }
  return true;
}
