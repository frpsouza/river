// render/terrain.js — DESENHO DO CENÁRIO
// Água, margens, ilhas e ponte, mais a decoração das margens (bosques, campos com
// vacas e árvores soltas, gerada uma vez por bloco em getDeco).
// O terreno é desenhado em 3 passadas (água/sombras → terra → luz e detalhes) para
// não aparecerem emendas entre blocos.
// Usa: render/canvas.js, terrain.js.
'use strict';

function shoreStroke(pts, w, color) {
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k][0], pts[k][1]);
  ctx.lineWidth = w; ctx.strokeStyle = color; ctx.lineJoin = 'round'; ctx.lineCap = 'butt'; ctx.stroke();
}

function drawTerrain(blk, phase) {        // fase 0: água/sombras, 1: terra, 2: luz, arbustos e ilha
  const yAt = i => VIEW_H - (blk.g * BH + i * LINE + LINE / 2 - scroll);
  const yBot = VIEW_H - (blk.g * BH - scroll) + 1, yTop = VIEW_H - ((blk.g + 1) * BH - scroll) - 1;
  const pal = blk.land === LAND_LIGHT ? PAL.light : PAL.dark;
  const edge = (arr, ext) => {                    // ext: sobreposição só para o preenchimento opaco
    const pts = [[arr[0], yBot - 1 + ext]];
    for (let i = 0; i < LINES; i++) pts.push([arr[i], yAt(i)]);
    pts.push([arr[LINES - 1], yTop + 1 - ext]);
    return pts;
  };
  const eL = edge(blk.L, 1), eR = edge(blk.R, 1), sL = edge(blk.L, 0), sR = edge(blk.R, 0);
  const bankPoly = (pts, wall) => {
    ctx.beginPath(); ctx.moveTo(wall, pts[0][1]);
    pts.forEach(p => ctx.lineTo(p[0], p[1]));
    ctx.lineTo(wall, pts[pts.length - 1][1]); ctx.closePath();
  };
  if (phase === 0) {
  // água rasa + sombra na beirada
  for (const pts of [sL, sR]) {
    shoreStroke(pts, 12, 'rgba(120,170,255,.20)');
    shoreStroke(pts, 6, 'rgba(8,12,70,.38)');
  }
  // ondas animadas: pequenas senoides que correm e pulsam, em posições estáveis por bloco
  const r = mulberry32(blk.seed ^ 0x51ed27);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = 1.1;
  for (let k = 0; k < 9; k++) {
    const i = 1 + Math.floor(r() * (LINES - 2)), len = 10 + r() * 10, x0 = r() * W, ph = r() * 6.28, sp = 0.6 + r() * 0.6;
    const t = frame * 0.03 * sp + ph, x = x0 + Math.sin(t * 0.7) * 5;
    if (x < blk.L[i] + 10 || x + len > blk.R[i] - 10) continue;
    if (blk.IL[i] >= 0 && x + len > blk.IL[i] - 10 && x < blk.IR[i] + 10) continue;
    const a = 0.07 + 0.12 * (0.5 + 0.5 * Math.sin(t));
    ctx.strokeStyle = 'rgba(255,255,255,' + a.toFixed(3) + ')';
    const y = yAt(i);
    ctx.beginPath();
    for (let u = 0; u <= 1.0001; u += 0.125) {
      const yy = y + Math.sin(u * Math.PI * 3 - frame * 0.12 * sp + ph) * 1.1;
      if (u === 0) ctx.moveTo(x + u * len, yy); else ctx.lineTo(x + u * len, yy);
    }
    ctx.stroke();
  }
  return;
  }
  if (phase === 1) {
    for (const [pts, wall] of [[eL, 0], [eR, W]]) { bankPoly(pts, wall); ctx.fillStyle = pal.land; ctx.fill(); }
    return;
  }
  // margens
  for (const [pts, sp, wall] of [[eL, sL, 0], [eR, sR, W]]) {
    ctx.save(); bankPoly(pts, wall); ctx.clip();
    shoreStroke(sp, 13, 'rgba(255,255,255,.10)');         // faixa de luz junto à água
    shoreStroke(sp, 5, 'rgba(255,255,255,.14)');
    ctx.restore();
  }
  // bosques, campos com vacas e árvores soltas (vista de lado, como as casas)
  const deco = getDeco(blk);
  for (const f of deco.fields) drawField(f.x0, yAt(f.b), f.x1 - f.x0, yAt(f.a) - yAt(f.b), pal);
  for (const d of deco.items) {
    const y = yAt(d.i);
    if (d.kind === 'cow') drawCow(d.x, y, d.dir, d.phase);
    else drawTree(d.x, y, d.s, d.kind === 'pine', pal);
  }
  // ilha
  if (blk.IL[15] >= 0) {
    let first = -1, last = -1;
    for (let i = 0; i < LINES; i++) if (blk.IL[i] >= 0) { if (first < 0) first = i; last = i; }
    const pts = [];
    for (let i = first; i <= last; i++) pts.push([blk.IL[i], yAt(i)]);
    for (let i = last; i >= first; i--) pts.push([blk.IR[i], yAt(i)]);
    const ring = pts.concat([pts[0]]);
    shoreStroke(ring, 12, 'rgba(120,170,255,.20)');
    shoreStroke(ring, 6, 'rgba(8,12,70,.38)');
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); pts.forEach(q => ctx.lineTo(q[0], q[1])); ctx.closePath();
    ctx.fillStyle = PAL.dark.land; ctx.fill();
    ctx.save(); ctx.clip();
    shoreStroke(ring, 12, 'rgba(255,255,255,.10)');
    shoreStroke(ring, 4, 'rgba(255,255,255,.14)');
    ctx.restore();
    const cx = (blk.IL[15] + blk.IR[15]) / 2, wI = blk.IR[15] - blk.IL[15], mid = (first + last) / 2;
    const trees = wI > 40 ? [[-0.22, 1.5, 0.9, true], [0.18, 0.5, 0.8, false], [0, -2.5, 1, false]]
      : wI > 24 ? [[-0.15, 0.5, 0.75, true], [0.15, -1.5, 0.8, false]] : [[0, -1.5, 0.7, false]];
    for (const [dx, dy, sc, pine] of trees) drawTree(cx + dx * wI, yAt(mid + dy), sc, pine, PAL.dark);
  }
}

function getDeco(blk) {
  if (blk.deco) return blk.deco;
  const r = mulberry32(blk.seed ^ 0x2b7e15), fields = [], items = [];
  const road = i => blk.bridge && i >= 7 && i <= 27;            // não decorar a estrada da ponte
  for (const left of [true, false]) {
    const lo = i => left ? 4 : blk.R[i] + 10;                     // faixa de terra livre na linha i
    const hi = i => left ? blk.L[i] - 10 : W - 4;
    const tree = (x, i, sc) => {
      i = clamp(Math.round(i), 1, LINES - 2);
      if (road(i) || x - 6 * sc < lo(i) || x + 6 * sc > hi(i)) return;
      items.push({ kind: r() < 0.45 ? 'pine' : 'tree', x, i, s: sc });
    };
    const z = r();
    if (z < 0.4) {
      // bosque: várias árvores juntas
      const ci = 6 + r() * 20, i0 = clamp(Math.round(ci), 0, LINES - 1);
      if (hi(i0) - lo(i0) < 14) continue;
      const cx = lo(i0) + r() * (hi(i0) - lo(i0)), spread = Math.min(hi(i0) - lo(i0), 60);
      const n = 8 + Math.floor(r() * 9);
      for (let k = 0; k < n; k++) tree(cx + (r() - 0.5) * spread, ci + (r() - 0.5) * 16, 0.8 + r() * 0.45);
    } else if (z < 0.72) {
      // campo cercado com vacas
      const a = 2 + Math.floor(r() * 12), bTop = Math.min(LINES - 3, a + 8 + Math.floor(r() * 7));
      let x0 = -1e9, x1 = 1e9, ok = true;
      for (let i = a; i <= bTop; i++) { if (road(i)) ok = false; x0 = Math.max(x0, lo(i)); x1 = Math.min(x1, hi(i)); }
      const w = Math.min(x1 - x0, 34 + r() * 56);
      if (!ok || w < 30) continue;
      const fx = x0 + r() * (x1 - x0 - w);
      fields.push({ x0: fx, x1: fx + w, a, b: bTop });
      const cows = 1 + Math.floor(r() * Math.min(4, w / 16));
      for (let k = 0; k < cows; k++)
        items.push({ kind: 'cow', x: fx + 6 + r() * (w - 16), i: a + 1.5 + r() * (bTop - a - 4), dir: r() < 0.5 ? -1 : 1, phase: r() * 100 });
      tree(fx - 4, bTop + 0.5, 1); tree(fx + w + 4, a + 2, 0.9);
    } else {
      // árvores soltas
      const n = 2 + Math.floor(r() * 4);
      for (let k = 0; k < n; k++) { const i = 1 + r() * 29, j = Math.round(i); tree(lo(j) + r() * Math.max(0, hi(j) - lo(j)), i, 0.85 + r() * 0.35); }
    }
  }
  items.sort((p, q) => q.i - p.i);                                // de cima para baixo: os da frente cobrem os de trás
  return (blk.deco = { fields, items });
}

function drawTree(x, y, sc, pine, pal) {
  sc *= SC.tree;
  ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc);
  ell(1.5, 0.3, 4.6, 1.2, 'rgba(0,0,0,.18)');
  ctx.fillStyle = '#7a5a3c'; ctx.fillRect(-0.8, -3.6, 1.6, 3.8);
  const shade = mix(pal.bush, '#000000', 0.2);
  if (pine) {
    poly([0, -15, 5, -2.6, -5, -2.6], pal.bushHi);
    poly([0, -15, 5, -2.6, 0, -2.6], shade);
  } else {
    ell(0, -8, 5, 5, pal.bushHi);
    ctx.save(); ctx.beginPath(); ctx.ellipse(0, -8, 5, 5, 0, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = shade; ctx.fillRect(0, -14, 6, 12); ctx.restore();
  }
  ctx.restore();
}

function drawField(x, y, w, h, pal) {
  rrect(x, y, w, h, 3); ctx.fillStyle = pal === PAL.light ? '#9fd36a' : '#5fa346'; ctx.fill();
  ctx.strokeStyle = 'rgba(122,90,60,.8)'; ctx.lineWidth = 0.8; ctx.stroke();
}

function drawCow(x, y, dir, phase) {
  const graze = Math.sin((frame + phase) * 0.03) > 0.3;          // às vezes abaixa a cabeça para pastar
  ctx.save(); ctx.translate(x, y); ctx.scale(dir < 0 ? -SC.cow : SC.cow, SC.cow);
  ctx.fillStyle = '#26334f'; ctx.fillRect(-3, -2.2, 1, 2.2); ctx.fillRect(2.2, -2.2, 1, 2.2);
  rrect(-4.2, -5.6, 8.4, 3.6, 1.6); ctx.fillStyle = '#f5f2ea'; ctx.fill();
  ell(-1, -4, 1.6, 1.1, '#26334f');
  const hy = graze ? -2.6 : -6;
  rrect(3.6, hy, 2.8, 2.4, 0.9); ctx.fillStyle = '#f5f2ea'; ctx.fill();
  ctx.fillStyle = '#f2a6a0'; ctx.fillRect(5.4, hy + 1.2, 1, 1.2);
  ctx.restore();
}

function drawMountains(blk) {
  // picos de trás primeiro; cada pico: rocha em dois tons, neve no topo, sombra no chão
  for (const p of [...blk.mtns].sort((a, b) => (b.back ? 1 : 0) - (a.back ? 1 : 0))) {
    const yb = VIEW_H - (p.Y - scroll), yt = yb - p.h;
    ell(p.x + p.hw * 0.25, yb + 1, p.hw * 1.05, 2.4, 'rgba(0,0,30,.22)');
    const rock = p.back ? '#7d8394' : '#9097a8', rockSh = p.back ? '#5f6577' : '#6f7588';
    poly([p.x - p.hw, yb, p.x, yt, p.x + p.hw, yb], rock);
    poly([p.x, yt, p.x + p.hw, yb, p.x + p.hw * 0.15, yb], rockSh);
    const s = 0.34, sx = p.hw * s, sy = yt + p.h * s;                       // neve: terço de cima
    poly([p.x, yt, p.x + sx, sy, p.x + sx * 0.35, sy - 2.2, p.x - sx * 0.2, sy + 1.2, p.x - sx, sy], '#f5f2ea');
    poly([p.x, yt, p.x + sx, sy, p.x + sx * 0.35, sy - 2.2, p.x + 0.4, sy - 1], '#ddd8cc');
  }
}

function drawBridge(blk) {
  const yTop = VIEW_H - ((blk.g * BH + 22 * LINE) - scroll), yBot = yTop + 12 * LINE;
  const Lm = blk.L[16], Rm = blk.R[16], h = yBot - yTop;
  const road = (x0, x1) => {
    if (x1 <= x0) return;
    ctx.fillStyle = '#6b7280'; ctx.fillRect(x0, yTop, x1 - x0, h);
    ctx.fillStyle = '#9aa1ad'; ctx.fillRect(x0, yTop, x1 - x0, 3);
    ctx.fillStyle = '#4a5060'; ctx.fillRect(x0, yBot - 3, x1 - x0, 3);
    ctx.fillStyle = '#f5c542';
    for (let x = x0 - ((x0 % 18) + 18) % 18; x < x1; x += 18) ctx.fillRect(Math.max(x, x0), yTop + h / 2 - 0.7, Math.min(10, x1 - Math.max(x, x0)), 1.4);
  };
  road(0, Lm); road(Rm, W);
  if (!blk.broken) {
    ctx.fillStyle = 'rgba(8,12,70,.35)'; ctx.fillRect(Lm - 2, yTop + 5, Rm - Lm + 4, h);   // sombra na água
    ctx.fillStyle = '#8f6c3b'; ctx.fillRect(Lm - 3, yTop, Rm - Lm + 6, h);
    ctx.fillStyle = '#a98450'; ctx.fillRect(Lm - 3, yTop, Rm - Lm + 6, 3);
    ctx.fillStyle = '#6a4d27'; ctx.fillRect(Lm - 3, yBot - 3, Rm - Lm + 6, 3);
    ctx.fillStyle = '#3a2b17'; ctx.fillRect(Lm - 3, yTop, Rm - Lm + 6, 1); ctx.fillRect(Lm - 3, yBot - 1, Rm - Lm + 6, 1);
  } else {
    ctx.fillStyle = '#3a2b17';
    poly([Lm, yTop, Lm + 6, yTop + h / 2, Lm, yBot], '#3a2b17');
    poly([Rm, yTop, Rm - 6, yTop + h / 2, Rm, yBot], '#3a2b17');
  }
}
