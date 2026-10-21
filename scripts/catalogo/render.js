// scripts/catalogo/render.js — DESENHA TODOS OS GRÁFICOS DO JOGO PARA O CATÁLOGO
// Carregado por render.html (que carrega os módulos do jogo). Cada elemento é desenhado com as
// próprias funções do jogo, isolado num canvas, e exportado como PNG (base64). O resultado vai
// como JSON para <pre id="out">, que scripts/gerar-catalogo.py lê e transforma em arquivos .png
// e no relatório docs/graficos/index.html.
//
// Para incluir um gráfico novo no catálogo: acrescente um item() no grupo certo abaixo.
'use strict';

const OUT = [];
const GROUPS = [];                                   // [id, título, descrição]
const group = (id, title, desc) => GROUPS.push([id, title, desc]);
// item(grupo, id, nome, descrição, modos, png)
const item = (g, id, name, desc, modes, png) => OUT.push({ g, id, name, desc, modes, png });

// ---------- utilidades de captura ----------
// vetorial: desenha numa área lógica w×h, ampliada S vezes, fundo transparente (ou bg)
function cap(w, h, S, fn, bg) {
  cv.width = Math.round(w * S); cv.height = Math.round(h * S);
  ctx.setTransform(S, 0, 0, S, 0, 0); ctx.imageSmoothingEnabled = true; ctx.globalAlpha = 1;
  if (bg) { ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h); }
  fn();
  return cv.toDataURL('image/png');
}
// pixel art: amplia um canvas de sprite por vizinho mais próximo
function pix(src, S, bg) {
  const c = document.createElement('canvas'); c.width = src.width * S; c.height = src.height * S;
  const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
  if (bg) { x.fillStyle = bg; x.fillRect(0, 0, c.width, c.height); }
  x.drawImage(src, 0, 0, c.width, c.height);
  return c.toDataURL('image/png');
}
// recorte do canvas do jogo depois de um draw() (coordenadas lógicas da área de jogo)
function crop(x, y, w, h, up = 1) {
  const f = cv.width / W;                            // pixels do canvas por unidade lógica
  x = Math.max(0, x); y = Math.max(0, y); w = Math.min(w, W - x); h = Math.min(h, VIEW_H - y);
  const c = document.createElement('canvas'); c.width = Math.round(w * f * up); c.height = Math.round(h * f * up);
  const g = c.getContext('2d'); g.imageSmoothingEnabled = up === 1;
  g.drawImage(cv, x * f, y * f, w * f, h * f, 0, 0, c.width, c.height);
  return c.toDataURL('image/png');
}
function wholeCanvas(up = 1) {
  const c = document.createElement('canvas'); c.width = cv.width * up; c.height = cv.height * up;
  const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(cv, 0, 0, c.width, c.height);
  return c.toDataURL('image/png');
}
const quiet = () => { for (const b of blocks) { b.objs = []; b.clouds = []; b.deck = []; } fliers = []; boss = null; squadT = 1e9; shells = []; missiles = []; fx = []; };
const sim = (n, fire = true) => { for (let k = 0; k < n; k++) { keys = { ' ': fire && k % 30 < 15 }; lives = 99; fuel = 100; hp = 100; safeT = 999; update(); } keys = {}; };
const SEA = '#1d5fae', RIVER = '#2b44c2', LANDD = '#2f7a3a', NIGHT = '#0c0f1c';
const fake = (o) => Object.assign({ x: 0, Y: 0, phase: 0, alive: true }, o);

function run() {
  frame = 0; altT = 0; scroll = 0; px = 100; py = 40;

  // ======================= JATO DO JOGADOR =======================
  group('jato', 'Jato do jogador', 'O caça do jogador em cada estilo, com os quadros de inclinação das asas usados ao virar.');
  for (const [b, nome] of [[-1, 'inclinado à esquerda (máx.)'], [-0.5, 'inclinado à esquerda'], [0, 'nivelado'], [0.5, 'inclinado à direita'], [1, 'inclinado à direita (máx.)']])
    item('jato', 'jato_vetor_' + (b < 0 ? 'esq' : b > 0 ? 'dir' : 'nivel') + (Math.abs(b) === 1 ? '_max' : ''), 'Jato flat — ' + nome,
      'Asa que desce encurta e escurece; a cabine desliza para o lado da curva. drawJet(bank = ' + b + ').', 'Classic, Modern, Ocean',
      cap(26, 28, 6, () => { frame = 1; drawJet(13, 3, b, JET_SC, true); }));
  for (let l = -4; l <= 4; l++)
    item('jato', 'jato_retro_' + (l < 0 ? 'm' + -l : 'p' + l), 'Jato pixel — quadro de inclinação ' + l,
      'Um dos 9 quadros intermediários de inclinação (−4 a +4). jetSprite(' + l + ').', 'Retro Ocean', pix(jetSprite(l, 1), 8));
  for (let l = -2; l <= 2; l++)
    item('jato', 'jato_pico_' + (l < 0 ? 'm' + -l : 'p' + l), 'Jato PICO-8 — inclinação ' + l, 'Um dos 5 quadros de inclinação, paleta de 16 cores. jetP8(' + l + ').', 'CLASSIC - PICO-8', pix(jetP8(l), 12));

  // ======================= NAVIOS =======================
  group('navios', 'Navios e porta-aviões', 'Embarcações inimigas: vista de lado (rio) e vista de cima (oceano).');
  item('navios', 'navio_lado_esq', 'Navio de patrulha — de lado, proa à esquerda', 'Casco vermelho em dois tons, cabine creme e chaminé. drawShip(dir = −1).', 'Classic, Modern', cap(46, 17, 6, () => drawShip(1, 1, -1)));
  item('navios', 'navio_lado_dir', 'Navio de patrulha — de lado, proa à direita', 'Mesmo navio espelhado. drawShip(dir = 1).', 'Classic, Modern', cap(46, 17, 6, () => drawShip(1, 1, 1)));
  item('navios', 'navio_cima', 'Navio de patrulha — visto de cima', 'Proa afilada, ponte de comando, canhão giratório e esteira. drawShipTop().', 'Ocean', cap(80, 18, 5, () => drawShipTop(30, 2, 1, Math.PI / 2, 0)));
  item('navios', 'navio_cima_disparo', 'Navio de patrulha — disparando', 'Canhão mirando o jato com clarão na boca. drawShipTop(flash).', 'Ocean', cap(80, 26, 5, () => drawShipTop(30, 2, 1, Math.PI / 3, 5)));
  for (const [a, n] of [[0, 'rumo 0°'], [0.4, 'rumo 23°'], [Math.PI / 2, 'rumo 90°']])
    item('navios', 'navio_pixel_' + Math.round(a * 57.3), 'Navio pixel — ' + n, 'Um dos 32 rumos pré-girados. shipSprite().', 'Retro Ocean', pix(shipSprite(-a), 6));
  item('navios', 'navio_pico', 'Navio PICO-8', 'Navio de lado em pixel, 18×6. SHIP_P8.', 'CLASSIC - PICO-8', pix(p8('ship', SHIP_P8), 12));
  for (const [a, n] of [[0, 'rumo 0°'], [Math.PI / 4, 'rumo 45°'], [Math.PI / 2, 'rumo 90°']])
    item('navios', 'navio_pico_cima_' + Math.round(a * 57.3), 'Navio PICO-8 de cima — ' + n, 'Uma das 16 rotações (vizinho mais próximo). SHIPTOP_P8 + p8rot().', 'OCEAN - PICO-8', pix(p8rot('shipT', SHIPTOP_P8, -a), 12));
  item('navios', 'porta_avioes', 'Porta-aviões', 'Casco cinza, convés com pista tracejada, ilha de comando e caças estacionados; lança caças. drawCarrier().', 'Ocean', cap(130, 34, 4, () => drawCarrier(32, 3, 1, { w: 96, h: 28, hp: 10, maxHp: 10, flash: 0 })));
  item('navios', 'porta_avioes_avariado', 'Porta-aviões — avariado', 'Com barra de vida (4 de 10). drawCarrier(hp = 4).', 'Ocean', cap(130, 40, 4, () => drawCarrier(32, 9, 1, { w: 96, h: 28, hp: 4, maxHp: 10, flash: 0 })));

  // ======================= HELICÓPTEROS =======================
  group('helis', 'Helicópteros', 'Helicópteros inimigos; a hélice gira em quadros e a altitude muda o tamanho.');
  for (const f of [0, 3]) item('helis', 'heli_lado_q' + f, 'Helicóptero — de lado, hélice quadro ' + (f ? 2 : 1), 'Cabine azul com vidro, cauda e esquis. drawHeli().', 'Classic, Modern', cap(30, 34, 6, () => { frame = f; drawHeli(1, 2, -1, 1); }));
  item('helis', 'heli_cima', 'Helicóptero — visto de cima', 'Cabine em gota e disco do rotor girando. drawHeliTop(alt = 1).', 'Ocean', cap(44, 44, 5, () => { frame = 2; drawHeliTop(4, 6, -1, 1); }));
  item('helis', 'heli_cima_baixo', 'Helicóptero — de cima, voando baixo', 'Menor e com sombra mais perto. drawHeliTop(alt = 0,6).', 'Ocean', cap(44, 44, 5, () => { frame = 2; drawHeliTop(8, 10, -1, 0.6); }));
  for (let f = 0; f < 4; f++) item('helis', 'heli_pixel_q' + f, 'Helicóptero pixel — rotor quadro ' + (f + 1), 'Um dos 4 quadros do rotor. heliSprite().', 'Retro Ocean', pix(heliSprite(-1, f), 6));
  for (let f = 0; f < 2; f++) item('helis', 'heli_pico_q' + f, 'Helicóptero PICO-8 — rotor quadro ' + (f + 1), 'HELI_P8 + HELI_BODY.', 'CLASSIC - PICO-8', pix(p8('heli' + f, HELI_P8[f].concat(HELI_BODY)), 12));
  for (let f = 0; f < 2; f++) item('helis', 'heli_pico_cima_q' + f, 'Helicóptero PICO-8 de cima — rotor ' + (f ? '+' : '×'), 'heliTopP8().', 'OCEAN - PICO-8', pix(heliTopP8(-1, f), 12));

  // ======================= AVIÕES =======================
  group('avioes', 'Aviões e caças', 'Aviões que cruzam a tela e os caças das esquadrilhas.');
  item('avioes', 'aviao_azul', 'Avião de travessia', 'Flecha azul-clara que cruza o rio. drawPlane().', 'Classic, Modern', cap(27, 15, 7, () => drawPlane(1, 1, 1)));
  item('avioes', 'caca_vermelho', 'Caça de esquadrilha', 'Flecha vermelha que voa em formação e atira. drawPlane(FLIER_PAL).', 'Ocean', cap(27, 15, 7, () => drawPlane(1, 1, 1, FLIER_PAL)));
  for (const [a, n] of [[0, '0°'], [Math.PI / 4, '45°'], [Math.PI / 2, '90°'], [Math.PI * 3 / 4, '135°']])
    item('avioes', 'caca_pixel_' + Math.round(a * 57.3), 'Caça pixel — rotação ' + n, 'Uma das 32 rotações pré-calculadas. fighterSprite().', 'Retro Ocean', pix(fighterSprite(a, 0), 6));
  for (let r = 1; r <= 4; r++) item('avioes', 'caca_pixel_parafuso' + r, 'Caça pixel — parafuso, quadro ' + r, 'Quadros do giro no próprio eixo. fighterSprite(roll = ' + r + ').', 'Retro Ocean', pix(fighterSprite(Math.PI / 2, r), 6));
  item('avioes', 'aviao_pico', 'Avião PICO-8', 'PLANE_P8.', 'CLASSIC - PICO-8', pix(p8('plane', PLANE_P8), 12));
  for (const [a, n] of [[0, '0°'], [Math.PI / 4, '45°'], [Math.PI / 2, '90°']])
    item('avioes', 'caca_pico_' + Math.round(a * 57.3), 'Caça PICO-8 — rotação ' + n, 'Uma das 16 rotações. FIGHTER_P8 + p8rot().', 'OCEAN - PICO-8', pix(p8rot('fighter', FIGHTER_P8, a), 12));

  // ======================= TANQUES =======================
  group('tanques', 'Tanques', 'Tanques de guerra vistos de lado, na margem ou atravessando a ponte.');
  item('tanques', 'tanque_dir', 'Tanque — canhão à direita', 'Esteira com rodas, casco oliva, cúpula e canhão. drawTank(aim = 1).', 'Classic, Modern', cap(24, 14, 8, () => { frame = 0; drawTank(2, 2, 1, 1); }));
  item('tanques', 'tanque_esq', 'Tanque — canhão à esquerda', 'drawTank(aim = −1).', 'Classic, Modern', cap(24, 14, 8, () => { frame = 0; drawTank(2, 2, -1, 1); }));
  item('tanques', 'tanque_pico', 'Tanque PICO-8', 'TANK_P8.', 'CLASSIC - PICO-8', pix(p8('tank', TANK_P8), 12));

  // ======================= BALÕES =======================
  group('baloes', 'Balões', 'Balões de ar quente que flutuam devagar.');
  for (const [h, c] of [[0, 'vermelho e branco'], [1, 'amarelo']]) {
    item('baloes', 'balao_lado_' + h, 'Balão ' + c + ' — de lado', 'Envelope listrado, cordas e cesto. drawBalloon().', 'Classic, Modern', cap(34, 52, 5, () => { frame = 0; drawBalloon(2, 2, h, 0); }));
    item('baloes', 'balao_cima_' + h, 'Balão ' + c + ' — visto de cima', 'Gomos e cesto no centro; sombra longe. drawBalloonTop().', 'Ocean', cap(48, 50, 5, () => { frame = 0; drawBalloonTop(4, 2, h, 0); }));
    item('baloes', 'balao_pixel_' + h, 'Balão ' + c + ' — pixel', 'Um dos quadros de gomos girando. balloonSprite().', 'Retro Ocean', pix(balloonSprite(h, 0), 6));
    item('baloes', 'balao_pico_' + h, 'Balão ' + c + ' — PICO-8', 'BALLOON_P8.', 'CLASSIC - PICO-8', pix(p8('bal' + h, BALLOON_P8[h]), 12));
    item('baloes', 'balao_pico_cima_' + h, 'Balão ' + c + ' — PICO-8 de cima', 'Gomos girando (2 quadros). balloonTopP8().', 'OCEAN - PICO-8', pix(balloonTopP8(h, 0), 14));
  }

  // ======================= CHEFES =======================
  group('chefes', 'Chefes (aviões gigantes)', 'Os quatro chefes do oceano, com as variações de defesa.');
  const B = o => Object.assign({ x: 100, y: 62, t: 400, flash: 0, dying: 0, atk: 0, mode: 'hover', modeT: 0, shield: 0, trail: [], hp: 50, maxHp: 80, sec: 1 }, o);
  const bossCap = (b) => cap(200, 150, 3, () => { altT = 0; frame = 3; drawBoss(b); });
  item('chefes', 'chefe_bombardeiro', 'Bombardeiro', 'Quatro motores com hélices, asas com pontas laranja, nariz de vidro.', 'Ocean, Retro Ocean', bossCap(B({ kind: 'bomber' })));
  item('chefes', 'chefe_canhoneira', 'Canhoneira', 'Asa delta escura, motores de brilho ciano e pods de foguete.', 'Ocean, Retro Ocean', bossCap(B({ kind: 'gunship' })));
  item('chefes', 'chefe_canhoneira_escudo', 'Canhoneira — com escudo frontal', 'Arco de energia que rebate tiros vindos de baixo.', 'Ocean, Retro Ocean', bossCap(B({ kind: 'gunship', shield: 120 })));
  const T4 = AIRSHIP_TURRETS.map(([dx, dy]) => ({ dx, dy, hp: 8, cool: 99, flash: 0 }));
  item('chefes', 'chefe_dirigivel', 'Dirigível — blindado', 'Envelope listrado, gôndola com hélices e 4 torres; anel dourado = núcleo blindado.', 'Ocean, Retro Ocean', bossCap(B({ kind: 'airship', turrets: T4 })));
  item('chefes', 'chefe_dirigivel_avariado', 'Dirigível — torres destruídas', 'Sem torres, o núcleo fica vulnerável.', 'Ocean, Retro Ocean', bossCap(B({ kind: 'airship', turrets: T4.map(t => Object.assign({}, t, { hp: 0 })) })));
  item('chefes', 'chefe_interceptador', 'Interceptador', 'Caça enflechado preto e vermelho com pós-combustão.', 'Ocean, Retro Ocean', bossCap(B({ kind: 'interceptor' })));
  item('chefes', 'chefe_interceptador_mira', 'Interceptador — mirando a investida', 'Linha tracejada vermelha até o alvo antes do mergulho.', 'Ocean, Retro Ocean', bossCap(B({ kind: 'interceptor', mode: 'aim', modeT: 10, tx: 120, ty: 140 })));

  // ======================= ITENS =======================
  group('itens', 'Itens e power-ups', 'Combustível (postos de abastecimento) e os power-ups coletáveis.');
  item('itens', 'combustivel_lado', 'Tambor de combustível — de lado', 'Galão vermelho com faixa "FUEL". drawFuel().', 'Classic, Modern', cap(22, 32, 6, () => drawFuel(1, 1)));
  item('itens', 'combustivel_cima', 'Balsa de combustível — de cima', 'Dois tanques redondos marcados "F". drawFuelTop().', 'Ocean', cap(22, 32, 6, () => drawFuelTop(1, 1)));
  item('itens', 'combustivel_pixel', 'Balsa de combustível — pixel', 'fuelSprite().', 'Retro Ocean', pix(fuelSprite(), 6));
  item('itens', 'combustivel_pico', 'Tambor de combustível — PICO-8', 'FUEL_P8.', 'CLASSIC - PICO-8', pix(p8('fuel', FUEL_P8), 12));
  item('itens', 'bomba_hud_pico', 'Bomba do HUD — PICO-8', 'Acesa e gasta. bombP8().', 'OCEAN - PICO-8', cap(14, 7, 12, () => { ctx.drawImage(bombP8(true), 1, 1); ctx.drawImage(bombP8(false), 8, 1); }, '#000000'));
  const PUN = { shield: 'Escudo', triple: 'Tiro triplo', rapid: 'Tiro rápido', bomb: 'Bomba', life: 'Vida extra / reparo' };
  for (const k of Object.keys(PUN)) {
    item('itens', 'pu_' + k, 'Power-up: ' + PUN[k], 'Quadrado com ícone e halo pulsando. drawPowerup().', 'Modern, Ocean', cap(34, 34, 6, () => { frame = 0; drawPowerup(fake({ x: 10, kind: k }), 10); }));
    item('itens', 'pu_pixel_' + k, 'Power-up pixel: ' + PUN[k], 'puSprite().', 'Retro Ocean', pix(puSprite(k, false), 8));
    item('itens', 'pu_pico_' + k, 'Power-up PICO-8: ' + PUN[k], 'Caixa 7×7 com ícone. puP8().', 'MODERN / OCEAN - PICO-8', pix(puP8(k, false), 12));
  }

  // ======================= PROJÉTEIS =======================
  group('projeteis', 'Projéteis', 'Tiros do jogador e dos inimigos.');
  item('projeteis', 'missil', 'Míssil do jogador', 'Cápsula amarela com ponta branca (sai em rajadas de 10).', 'todos', cap(8, 14, 10, () => { rrect(2.7, 3, 2.6, 8, 1.2); ctx.fillStyle = '#ffd23a'; ctx.fill(); ell(4, 4, 1.3, 1.6, '#ffffff'); }));
  item('projeteis', 'tiro_inimigo', 'Tiro inimigo', 'Rastro amarelo→vermelho, halo vermelho, corpo laranja e núcleo branco. drawShell().', 'todos', cap(30, 16, 8, () => { frame = 3; drawShell({ x: 20, vx: 1.6, vy: 0 }, 8); }));
  item('projeteis', 'foguete', 'Foguete teleguiado', 'Persegue o jato (canhoneira). drawShell(kind = rocket).', 'Ocean', cap(30, 16, 8, () => { frame = 1; drawShell({ x: 16, vx: 1.6, vy: 0, kind: 'rocket' }, 8); }));
  item('projeteis', 'mina', 'Mina flutuante', 'Esfera com espetos e luz piscando (dirigível). drawShell(kind = mine).', 'Ocean', cap(20, 20, 8, () => { frame = 3; drawShell({ x: 10, vx: 0, vy: 0, kind: 'mine' }, 10); }));
  item('projeteis', 'tiro_pico', 'Tiro inimigo — PICO-8', 'Cruz 3×3 piscando (2 quadros). BULLET_P8.', 'OCEAN - PICO-8', pix(p8('bul0', BULLET_P8[0]), 14));
  item('projeteis', 'tiro_pixel', 'Tiro inimigo — pixel', 'bulletSprite().', 'Retro Ocean', pix(bulletSprite(0), 10));

  // ======================= CENÁRIO =======================
  group('cenario', 'Construções e cenário', 'Casas, árvores, campos e animais das margens e ilhas.');
  item('cenario', 'casa_telhado_escuro', 'Casa — telhado escuro', 'Parede creme, porta e janela. drawHouse(house1).', 'Classic, Modern', cap(38, 25, 6, () => drawHouse(1, 1, 'house1')));
  item('cenario', 'casa_telhado_vermelho', 'Casa — telhado vermelho', 'Variação espelhada. drawHouse(house2).', 'Classic, Modern', cap(38, 25, 6, () => drawHouse(1, 1, 'house2')));
  for (const [pine, n] of [[false, 'copa redonda'], [true, 'pinheiro']]) for (const [pal, pn] of [[PAL.dark, 'margem escura'], [PAL.light, 'margem clara']])
    item('cenario', 'arvore_' + (pine ? 'pinheiro' : 'redonda') + '_' + (pal === PAL.dark ? 'escura' : 'clara'), 'Árvore de ' + n + ' — ' + pn, 'Vista de lado. drawTree().', 'Classic, Modern', cap(16, 24, 8, () => drawTree(8, 22, 1, pine, pal), pal.land));
  item('cenario', 'arvore_cima', 'Árvore vista de cima', 'Copa redonda das ilhas do oceano. drawTreeTop().', 'Ocean', cap(18, 18, 8, () => drawTreeTop(9, 9, 1.1, PAL.dark), PAL.dark.land));
  item('cenario', 'pasto_com_vacas', 'Pasto cercado com vacas', 'Campo com cerca fina. drawField() + drawCow().', 'Classic, Modern', cap(62, 36, 5, () => { frame = 0; drawField(3, 5, 56, 26, PAL.dark); drawCow(18, 24, 1, 0); drawCow(42, 28, -1, 0); }, PAL.dark.land));
  item('cenario', 'vaca', 'Vaca', 'Malhada, vista de lado. drawCow().', 'Classic, Modern', cap(14, 11, 10, () => { frame = 0; drawCow(6, 9, 1, 0); }, PAL.dark.land));
  item('cenario', 'vaca_pastando', 'Vaca pastando', 'Cabeça baixa. drawCow().', 'Classic, Modern', cap(14, 11, 10, () => { frame = 0; drawCow(6, 9, 1, 30); }, PAL.dark.land));
  for (const [pine, n] of [[false, 'redonda'], [true, 'pinheiro']]) for (const land of [LAND_DARK, LAND_LIGHT])
    item('cenario', 'arvore_pico_' + (pine ? 'pinheiro' : 'redonda') + (land === LAND_DARK ? '_escura' : '_clara'), 'Árvore PICO-8 — ' + n + (land === LAND_DARK ? ' (margem escura)' : ' (margem clara)'), 'treeP8().', 'CLASSIC - PICO-8', pix(treeP8(pine, land), 14, land === LAND_LIGHT ? P8[11] : P8[3]));
  item('cenario', 'vaca_pico', 'Vaca PICO-8', 'COW_P8.', 'CLASSIC - PICO-8', pix(p8('cow', COW_P8), 14, P8[3]));
  item('cenario', 'casa_pico_1', 'Casa PICO-8 — telhado escuro', 'HOUSE_P8.house1.', 'CLASSIC - PICO-8', pix(p8('house1', HOUSE_P8.house1), 12, P8[3]));
  item('cenario', 'casa_pico_2', 'Casa PICO-8 — telhado vermelho', 'HOUSE_P8.house2.', 'CLASSIC - PICO-8', pix(p8('house2', HOUSE_P8.house2), 12, P8[3]));

  // ======================= NUVENS =======================
  group('nuvens', 'Nuvens', 'Os quatro tipos de nuvem do oceano (recortes desenhados sobre o mar).');
  mode = 'ocean'; newGame(); getBlock(16 * 8);
  const NUV = { puff: 'Flocos', bank: 'Faixa comprida', wisp: 'Fiapos', tower: 'Torre (cúmulo)' };
  for (const k of Object.keys(NUV)) {
    let c = null; for (const b of blocks) { const cl = getClouds(b).find(x => x.kind === k); if (cl) { c = cl; break; } }
    if (!c) continue;
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const [dx, dy, r, st] of c.puffs) { x0 = Math.min(x0, dx - r); x1 = Math.max(x1, dx + r); y0 = Math.min(y0, dy - r * st); y1 = Math.max(y1, dy + r * st + r * 0.3); }
    const w = x1 - x0 + 40, h = y1 - y0 + 50;
    item('nuvens', 'nuvem_' + k, 'Nuvem: ' + NUV[k], 'Base sombreada e flocos brancos, com a sombra projetada no mar. getClouds().', 'Ocean, Retro Ocean', cap(w, h, 3, () => {
      const cx = 20 - x0, cy = 20 - y0;
      for (const [dx, dy, r, st] of c.puffs) ell(cx + dx + 14, cy + dy + 20, r, r * 0.8 * st, 'rgba(0,0,40,.10)');
      ctx.globalAlpha = c.alpha;
      for (const [dx, dy, r, st] of c.puffs) ell(cx + dx, cy + dy + r * 0.25, r, r * 0.85 * st, '#d6e2f0');
      for (const [dx, dy, r, st] of c.puffs) ell(cx + dx - r * 0.12, cy + dy - r * 0.08, r * 0.9, r * 0.78 * st, '#ffffff');
      ctx.globalAlpha = 1;
    }, SEA));
  }

  // ======================= ILHAS =======================
  group('ilhas', 'Ilhas', 'Ilhas do rio e os quatro tipos de ilha do oceano (recortes do jogo).');
  const ISN = { long: 'Ilha longa', chain: 'Arquipélago', atoll: 'Atol (com lagoa)', round: 'Ilha redonda' };
  for (const k of Object.keys(ISN)) {
    let found = false;
    for (let t = 0; t < 30 && !found; t++) {
      mode = 'ocean'; newGame(); getBlock(16 * 8); quiet();
      const g = blocks.findIndex((b, i) => i > 3 && b.isleKind === k);
      if (g < 0) continue;
      // linhas da ilha a partir do bloco onde ela começa
      let Ya = -1, Yb = -1, xa = 1e9, xb = -1e9;
      for (let Y = g * BH; Y < g * BH + 6 * BH; Y += LINE) {
        const { b, i } = lineAt(Y), on = b.IR[i] > b.IL[i];
        if (on) { if (Ya < 0) Ya = Y; Yb = Y; xa = Math.min(xa, b.IL[i]); xb = Math.max(xb, b.IR[i]); } else if (Ya >= 0) break;
      }
      if (Ya < 0) continue;
      state = 'play'; altT = 0; altTarget = 0; scroll = Ya - 50; px = -100; draw();
      const top = VIEW_H - (Yb - scroll) - 14, bot = VIEW_H - (Ya - scroll) + 14;
      item('ilhas', 'ilha_oceano_' + k, ISN[k], 'Gerada pelo mapa do oceano: praia de areia, mato e árvores vistas de cima.', 'Ocean', crop(xa - 14, Math.max(0, top), xb - xa + 28, Math.min(VIEW_H - 40, bot) - Math.max(0, top)));
      found = true;
    }
  }
  for (let t = 0; t < 20; t++) {
    mode = 'classic'; newGame(); getBlock(16 * 8); quiet();
    const g = blocks.findIndex((b, i) => i > 3 && islandRuns(b).length);
    if (g < 0) continue;
    const [a, b2] = islandRuns(blocks[g])[0];
    state = 'play'; scroll = g * BH + a * LINE - 80; px = -100; draw();
    const xa = Math.min(...Array.from(blocks[g].IL).filter(v => v > -1)), xb = Math.max(...blocks[g].IR);
    item('ilhas', 'ilha_rio', 'Ilha do rio', 'Ilha oval no meio do rio, com pontas arredondadas e árvores de lado.', 'Classic, Modern', crop(xa - 20, VIEW_H - ((g * BH + (b2 + 1) * LINE) - scroll) - 26, xb - xa + 40, (b2 - a) * LINE + 52));
    break;
  }

  // ======================= TERRENO =======================
  group('terreno', 'Terreno: rio, margens, paredões e pontes', 'Recortes do mapa gerado.');
  mode = 'classic'; newGame(); getBlock(16 * 4); quiet();
  state = 'play'; scroll = 4 * BH; px = -100; draw();
  item('terreno', 'rio_margens', 'Rio com margens, bosques e pastos', 'Rio simétrico com água rasa, sombra na beira e decoração das margens.', 'Classic, Modern', crop(0, 60, W, 200));
  const gb = 16 + 15; scroll = gb * BH + 16 * LINE - 160; draw();
  item('terreno', 'ponte', 'Ponte com estrada', 'Estrada com faixa amarela tracejada e deck de madeira sobre o rio.', 'Classic, Modern', crop(0, 110, W, 100));
  blocks[gb].broken = true; draw();
  item('terreno', 'ponte_destruida', 'Ponte destruída', 'Só as pontas quebradas; a água aparece no vão.', 'Classic, Modern', crop(0, 110, W, 100));
  for (let t = 0; t < 20; t++) {
    mode = 'modern'; newGame(); getBlock(16 * 8); quiet();
    const g = blocks.findIndex((b, i) => i > 3 && b.cliffL.some(v => v > 6) && b.cliffR.some(v => v > 6));
    if (g < 0) continue;
    state = 'play'; scroll = g * BH - 120; px = -100; draw();
    item('terreno', 'paredoes', 'Paredões de rocha (cânion)', 'Rocha clara com face para o rio, pedras salientes e sombra.', 'Modern', crop(0, 60, W, 220));
    break;
  }
  mode = 'ocean'; newGame(); getBlock(20); quiet(); for (const b of blocks) { b.IL.fill(-1); b.IR.fill(-1); }
  state = 'play'; scroll = 3 * BH; px = -100; draw();
  item('terreno', 'mar_ondas', 'Mar aberto com ondas', 'Água azul-oceano com marolas animadas.', 'Ocean', crop(0, 60, W, 160));

  // ======================= EXPLOSÕES E EFEITOS =======================
  group('efeitos', 'Explosões e efeitos', 'Cada explosão em 4 quadros (da esquerda para a direita), como no jogo.');
  mode = 'ocean'; newGame(); quiet(); scroll = 0;
  const strip = (e, cell, S, ages) => {
    const c = document.createElement('canvas'); c.width = cell * S * ages.length; c.height = cell * S;
    const g = c.getContext('2d'); fx = [e]; let age = 0;
    ages.forEach((a, k) => {
      while (age < a) { stepFx(); age++; }
      cap(cell, cell, S, () => { if (fx.length) drawExplosion(fx[0]); }, SEA);
      g.drawImage(cv, k * cell * S, 0);
    });
    return c.toDataURL('image/png');
  };
  const EXN = { ship: 'navio', heli: 'helicóptero', plane: 'avião', fuel: 'combustível', tank: 'tanque', balloon: 'balão (estouro)', bridge: 'ponte', carrier: 'porta-aviões', player: 'jato do jogador' };
  for (const k of Object.keys(EXN)) {
    const def = FX[k]({ dir: 1, hue: 0 }), cell = k === 'carrier' || k === 'bridge' ? 140 : 90;
    const e = Object.assign({ x: cell / 2, y: VIEW_H - cell / 2, t: def.life, kind: k }, def);
    const ages = [2, Math.round(def.life * 0.2), Math.round(def.life * 0.45), Math.round(def.life * 0.75)];
    item('efeitos', 'explosao_' + k, 'Explosão de ' + EXN[k], 'Receita FX.' + k + ' — quadros ' + ages.join(', ') + '.', 'Classic, Modern, Ocean (o Retro pixeliza)', strip(e, cell, 2, ages));
  }
  pickupFx(45, VIEW_H - 45, PU.triple); const pe = fx[fx.length - 1];
  item('efeitos', 'coleta_powerup', 'Coleta de power-up', 'Anéis na cor do item, estrelinhas e o nome subindo.', 'Modern, Ocean', strip(pe, 90, 2, [3, 12, 24, 40]));
  mode = 'ocean'; newGame(); quiet(); bombs = 1; state = 'play'; px = 100; py = 40; scroll = 0; useBomb(); freezeT = 0; shakeT = 0;
  const be = fx.find(e => e.kind === 'bomb'); be.x = 110; be.y = VIEW_H - 110;
  item('efeitos', 'bomba', 'Bomba (oceano)', 'Clarão, três ondas de choque, raios de luz, fumaça e faíscas.', 'Ocean, Retro Ocean', strip(be, 220, 1, [4, 14, 28, 50]));

  // ======================= TELAS COMPLETAS =======================
  group('telas', 'Telas completas', 'Uma captura de cada modo, com HUD.');
  mode = 'classic'; state = 'title'; blocks = null; draw();
  item('telas', 'tela_titulo', 'Tela de título', 'Escolha dos 8 modos.', '—', wholeCanvas(1));
  const shot = (m, id, name, setup, up = 1) => { mode = m; newGame(); state = 'play'; sim(240); if (setup) setup(); state = 'play'; draw(); item('telas', id, name, '', name.split(' — ')[0], wholeCanvas(up)); };
  shot('classic', 'tela_classic', 'CLASSIC — rio com combustível e painel embaixo');
  shot('modern', 'tela_modern', 'MODERN — voo livre e HUD no topo');
  shot('ocean', 'tela_ocean_rasante', 'OCEAN — voo rasante, HUD embaixo', () => { altT = 0; altTarget = 0; });
  shot('ocean', 'tela_ocean_alto', 'OCEAN — acima das nuvens', () => { altT = 1; altTarget = 1; });
  shot('retro', 'tela_retro', 'RETRO OCEAN — pixel art 240×320', null, 2);
  shot('pico', 'tela_pico', 'CLASSIC - PICO-8 — 128×128, 16 cores', null, 4);
  shot('oceanex', 'tela_oceanex_rasante', 'OCEAN EX — gráficos detalhados, voo rasante', () => { altT = 0; altTarget = 0; });
  shot('oceanex', 'tela_oceanex_alto', 'OCEAN EX — acima das nuvens', () => { altT = 1; altTarget = 1; });
  shot('pmodern', 'tela_pmodern', 'MODERN - PICO-8 — paredões, power-ups e vida', null, 4);
  shot('pocean', 'tela_pocean_rasante', 'OCEAN - PICO-8 — rasante, HUD na coluna da direita', () => { altT = 0; altTarget = 0; }, 4);
  shot('pocean', 'tela_pocean_alto', 'OCEAN - PICO-8 — acima das nuvens', () => { altT = 1; altTarget = 1; }, 4);

  document.getElementById('out').textContent = JSON.stringify({ groups: GROUPS, items: OUT });
}

// espera as imagens do OCEAN EX (assets/ocean-ex) carregarem antes de desenhar
setTimeout(() => exReady.then(() => { try { run(); } catch (e) { document.getElementById('out').textContent = JSON.stringify({ error: String(e), stack: e.stack }); } }), 300);
