// config.js — CONSTANTES DO JOGO
// Tamanhos da tela, da grade do mapa e escalas dos objetos. Tudo aqui é fixo
// e serve de referência para os outros módulos (nenhum outro arquivo é necessário).
//
//   W × VIEW_H ........ área de jogo (304 × 320 px) + painel de PANEL_H px
//   LINE, LINES, BH ... um bloco do mapa tem 32 linhas de 2 px = 64 px de altura
//   BLOCKS_PER_SECTION  16 blocos por seção; o último é a ponte
//   SC, JET_SC ........ escalas dos sprites, tendo a casa como régua (parede 24 px ≈ 10 m)
'use strict';

const W = 304, VIEW_H = 320, PANEL_H = 48;

const LINE = 2, LINES = 32, BH = LINE * LINES;      // bloco: 32 linhas de 2px = 64px

const BLOCKS_PER_SECTION = 16;

const MAXD = 40;

const smooth = t => t * t * (3 - 2 * t);               // curva suave (sem degraus)

const PLAYER_Y = 6;                                   // jato rente ao painel de placar

const JET_SC = 1.25;                                  // escalas relativas à casa (parede de 24 px ≈ 10 m)

const SC = { ship: 1.2, heli: 1.35, tank: 0.68, balloon: 1.5, plane: 1.25, cow: 0.65, tree: 1.25 };

const PW = Math.round(15 * JET_SC), PH = Math.round(16 * JET_SC);

const WATER = '#2d32b8', LAND_DARK = '#355f18', LAND_LIGHT = '#6e9c42';
