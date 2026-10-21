#!/usr/bin/env python3
"""preparar-ocean-ex.py — prepara os gráficos do modo OCEAN EX a partir da pasta novos/.

A pasta novos/ tem versões redesenhadas dos PNGs do catálogo (docs/graficos/png), com o
mesmo enquadramento: cada imagem cobre a mesma caixa, na mesma escala do catálogo
(S pixels por unidade do jogo). Este script:

  1. reduz cada imagem usada para OUT_S pixels por unidade (3: nítido mesmo ampliado,
     e bem mais leve para o APK e o cache offline);
  2. nas nuvens, que vieram desenhadas sobre o mar, tira o azul do fundo e deixa só a
     nuvem com transparência (a sombra no mar continua sendo desenhada pelo jogo);
  3. grava tudo em assets/ocean-ex/<nome>.png.

As âncoras (onde fica o objeto dentro de cada imagem) estão em js/render/ocean-ex.js
(tabela EX). Para trocar um gráfico: substitua o PNG em novos/ e rode de novo.

Uso:  python3 scripts/preparar-ocean-ex.py      (requer Pillow)
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC, OUT = ROOT / 'novos', ROOT / 'assets' / 'ocean-ex'
OUT_S = 3

# nome → escala do catálogo (pixels por unidade do jogo) em que o PNG foi capturado
SCALE = {
    **{f'jato_vetor_{k}': 6 for k in ('esq_max', 'esq', 'nivel', 'dir', 'dir_max')},
    'navio_cima': 5, 'navio_cima_disparo': 5, 'porta_avioes': 4, 'caca_vermelho': 7,
    'heli_cima': 5, 'balao_cima_0': 5, 'balao_cima_1': 5, 'combustivel_cima': 6,
    **{f'pu_{k}': 6 for k in ('shield', 'triple', 'rapid', 'bomb', 'life')},
    **{f'chefe_{k}': 3 for k in ('bombardeiro', 'canhoneira', 'canhoneira_escudo', 'dirigivel', 'dirigivel_avariado', 'interceptador')},
    'foguete': 8, 'mina': 8, 'tiro_inimigo': 8, 'missil': 10,
    **{f'nuvem_{k}': 3 for k in ('puff', 'bank', 'wisp', 'tower')},
    'mar_ondas': 2,
}
CLOUDS = {'nuvem_puff', 'nuvem_bank', 'nuvem_wisp', 'nuvem_tower'}


def key_cloud(im):
    """Nuvem sobre o mar → nuvem com transparência. O mar tem vermelho baixo e a nuvem,
    alto: o canal vermelho vira a opacidade, e a cor é "des-misturada" do azul do fundo."""
    bg = im.getpixel((2, 2))[:3]
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, _ = px[x, y]
            a = min(1.0, max(0.0, (r - bg[0] - 25) / 150))
            if a <= 0:
                px[x, y] = (255, 255, 255, 0); continue
            un = [min(255, max(0, round((c - (1 - a) * c0) / a))) for c, c0 in zip((r, g, b), bg)]
            px[x, y] = (*un, round(a * 255))
    return im


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    total = 0
    for name, s in SCALE.items():
        im = Image.open(SRC / f'{name}.png').convert('RGBA')
        out_s = 2 if name == 'mar_ondas' else OUT_S                  # o mar é só textura de fundo
        if s != out_s:
            im = im.resize((max(1, round(im.width * out_s / s)), max(1, round(im.height * out_s / s))), Image.LANCZOS)
        if name in CLOUDS:
            im = key_cloud(im)
        dst = OUT / f'{name}.png'
        im.save(dst, optimize=True)
        total += dst.stat().st_size
    print(f'✔ {len(SCALE)} gráficos em {OUT.relative_to(ROOT)} ({total // 1024} KB)')


if __name__ == '__main__':
    main()
