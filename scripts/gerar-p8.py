#!/usr/bin/env python3
# gerar-p8.py — monta os cartuchos PICO-8 (pico8/river.p8 e pico8/ocean.p8)
# O código fica em pico8/river.lua e pico8/ocean.lua; este script junta o código com a
# folha de sprites (__gfx__) e os sons (__sfx__). Os sprites são a mesma pixel art de
# js/render/pico.js e js/render/pico-ocean.js (dígitos hexadecimais = índice da paleta,
# '.' = transparente, que no cartucho vira a cor 14). A linha "--#sprs" do código é
# trocada pela tabela "nome x y largura altura" de cada sprite na folha.
#
# Uso: python3 scripts/gerar-p8.py
import math
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'pico8')

# ---------- sprites comuns (pixel art de render/pico.js) ----------
COMMON = {
    'jet0': ['....a....', '....a....', '...aaa...', '...a1a...', '..aaaaa..', '.9aaaaaa.', '99aaaaaaa', '...aaa...', '..9aaa9..', '...8.8...'],
    'jet1': ['....a....', '....a....', '...aaa...', '...aa1...', '..aaaaa..', '.aaaaaa9.', 'aaaaaaa9.', '...aaa...', '..aaa9...', '...8.8...'],
    'jet2': ['....a....', '....a....', '...aaa...', '...aa1...', '.aaaaa9..', 'aaaaaa9..', 'aaaaaa9..', '...aa9...', '..aaa9...', '...8.8...'],
    'fuel': ['.8888.', '888888', '777777', '777777', '888888', '888888', '777777', '777777', '888888', '888888', '777777', '.7777.'],
    'bomb': ['...a.', '.888.', '87888', '88888', '.888.'],
}
PU_C = {'shield': ('c', '1'), 'triple': ('9', '4'), 'rapid': ('a', '9'), 'bomb': ('8', '2'), 'life': ('b', '3')}
PU_I = {
    'shield': ['.###.', '#####', '#####', '.###.', '..#..'], 'triple': ['#.#.#', '#.#.#', '#.#.#', '#.#.#', '#.#.#'],
    'rapid': ['..#..', '.###.', '#.#.#', '..#..', '.###.'], 'bomb': ['...#.', '.###.', '#####', '#####', '.###.'],
    'life': ['..#..', '..#..', '#####', '..#..', '..#..'],
}
for n, kind in enumerate(['shield', 'triple', 'rapid', 'bomb', 'life'], 1):
    c, d = PU_C[kind]
    COMMON['pu%d' % n] = ['.' + d * 5 + '.'] + [d + r.replace('#', '7').replace('.', c) + d for r in PU_I[kind]] + ['.' + d * 5 + '.']

# ---------- rio (CLASSIC e MODERN) ----------
RIVER = dict(COMMON)
RIVER.update({
    'ship': ['...........0......', '.........07770.....', '..5.....0777770....', '888888888888888888.', '.88222222222222888.', '..2222222222222288..'],
    'heli0': ['..aaaaaaaaaa..', '......0.......', '...11111......', '..1cc11111111a', '..1c11111111..', '...11111......', '...0...0......', '..0000000.....'],
    'heli1': ['.....aaaa.....', '......0.......', '...11111......', '..1cc11111111a', '..1c11111111..', '...11111......', '...0...0......', '..0000000.....'],
    'plane': ['...d........', '..dd........', 'd66666666667', 'd66666666667', '..dd........', '...d........'],
    'house1': ['......111.........', '....1111111.......', '..11111111111...3.', '.1111111111111.333', '..7777777776...333', '..7cc77c7776...333', '..7cc77c7776....4.', '..777774477.....4.', '..777774477.....4.'],
    'house2': ['......888.........', '....8888888.......', '..88888888888...3.', '.8888888888888.333', '..7777777776...333', '..7cc77c7776...333', '..7cc77c7776....4.', '..777774477.....4.', '..777774477.....4.'],
    'tank': ['...333....', '..3333300.', '.33333333.', '555555555.', '.0.0.0.0..'],
    'bal0': ['...8888...', '..877888..', '.88777888.', '.88777888.', '.88777888.', '..877888..', '...8778...', '....78....', '...5..5...', '...5..5...', '...4444...', '...4444...'],
    'bal1': ['...9999...', '..9aa999..', '.99aaa999.', '.99aaa999.', '.99aaa999.', '..9aa999..', '...9aa9...', '....a9....', '...5..5...', '...5..5...', '...4444...', '...4444...'],
    'tree': ['.b.', 'bbb', 'bbb', '.4.'],
    'pine': ['.b.', '.b.', 'bbb', 'bbb', '.4.'],
    'cow': ['777.', '707.', '.5.5'],
})


# ---------- oceano (vistos de cima, de render/pico-ocean.js) ----------
def heli_top(f):
    g = [['.'] * 11 for _ in range(11)]

    def s(x, y, c):
        if 0 <= x < 11 and 0 <= y < 11:
            g[y][x] = c
    for r in range(-4, 5):
        if f:
            s(5 + r, 5 - r, 'a'); s(5 + r, 5 + r, 'a')
        else:
            s(5 + r, 5, 'a'); s(5, 5 + r, 'a')
    for x in range(3, 8):
        s(x, 5, '1')
    for x in range(4, 7):
        s(x, 4, '1'); s(x, 6, '1')
    s(3, 5, 'c'); s(4, 5, 'c')
    for x in range(8, 11):
        s(x, 5, '1')
    s(10, 4, '5'); s(10, 6, '5')
    s(5, 5, '0')
    return [''.join(r) for r in g]


def balloon_top(hue, f):
    rows = []
    for y in range(7):
        row = ''
        for x in range(7):
            if math.hypot(x - 3, y - 3) > 3.4:
                row += '.'
                continue
            gore = int((math.atan2(y - 3, x - 3) + f * math.pi / 4 + math.pi * 4) // (math.pi / 4)) % 2
            if x == 3 and y == 3:
                row += '4'
            elif x + y >= 8:
                row += '6' if gore else ('4' if hue else '2')
            else:
                row += '7' if gore else ('9' if hue else '8')
        rows.append(row)
    return rows


def rotated(rows, k, n=16):
    """Gira a pixel art (base virada para a direita) em k/n voltas, vizinho mais próximo,
    com a convenção do PICO-8: a direção (cos a, sin a) do PICO-8 na tela, y para baixo."""
    w, h = len(rows[0]), len(rows)
    a = 2 * math.pi * k / n
    c, s = math.cos(a), math.sin(a)
    q = w // 2 + 1
    out = []
    for y in range(-q, q + 1):
        row = ''
        for x in range(-q, q + 1):
            u, v = c * x + s * y + w / 2, c * y - s * x + h / 2
            row += rows[int(v)][int(u)] if 0 <= u < w and 0 <= v < h else '.'
        out.append(row)
    return out


FIGHTER = ['...8.....', '....88...', '5..8888..', '58888c887', '5..2222..', '....22...', '...2.....']
OCEAN = dict(COMMON)
OCEAN.update({'f%d' % k: rotated(FIGHTER, k) for k in range(16)})
OCEAN.update({
    'shipt': ['.8888888888...', '8666666776688.', '86666667766888', '8666666776688.', '.2222222222...'],
    'bul0': ['.9.', '979', '.9.'],
    'bul1': ['.8.', '878', '.8.'],
    'htop0': heli_top(0), 'htop1': heli_top(1),
    'bt00': balloon_top(0, 0), 'bt01': balloon_top(0, 1), 'bt10': balloon_top(1, 0), 'bt11': balloon_top(1, 1),
})


def sheet(sprites):
    """Empacota os sprites em prateleiras numa folha 128×128; devolve (linhas hex, tabela)."""
    grid = [['e'] * 128 for _ in range(128)]
    x = y = shelf = 0
    table = []
    for name, rows in sprites.items():
        w, h = max(len(r) for r in rows), len(rows)
        if x + w > 128:
            x, y, shelf = 0, y + shelf + 1, 0
        for ry, r in enumerate(rows):
            for rx, ch in enumerate(r.ljust(w, '.')):
                grid[y + ry][x + rx] = 'e' if ch == '.' else ch
        table.append('%s %d %d %d %d' % (name, x, y, w, h))
        x += w + 1
        shelf = max(shelf, h)
    assert y + shelf <= 128, 'folha de sprites cheia'
    return [''.join(r) for r in grid], '|'.join(table)


# ---------- sons ----------
# cada nota: (altura 0–63, onda 0–7, volume 0–7, efeito 0–7)
#   ondas: 0 triângulo, 1 serra inclinada, 2 serra, 3 quadrada, 4 pulso, 5 órgão, 6 ruído, 7 fase
#   efeitos: 1 deslize, 2 vibrato, 3 queda, 4 sobe volume, 5 desce volume, 6/7 arpejo
SFX = [
    (1, [(44, 3, 3, 0), (38, 3, 2, 3)]),                                              # 0 tiro
    (3, [(30 - 3 * k, 6, max(1, 5 - k // 2), 0) for k in range(8)]),                  # 1 explosão
    (5, [(26 - 2 * k, 6, max(1, 7 - k // 2), 0) for k in range(12)]),                 # 2 explosão grande
    (1, [(40, 0, 3, 0)]),                                                             # 3 combustível / reparo
    (4, [(26, 3, 3, 0), (0, 0, 0, 0)]),                                               # 4 alarme de combustível
    (3, [(24, 0, 4, 0), (28, 0, 4, 0), (31, 0, 4, 0), (36, 0, 4, 5)]),                 # 5 power-up
    (4, [(36, 0, 5, 0), (43, 0, 5, 0), (48, 0, 5, 0), (55, 0, 5, 5)]),                 # 6 vida extra / bônus
    (2, [(22, 3, 2, 3)]),                                                             # 7 tiro inimigo
    (2, [(14, 3, 5, 0), (10, 3, 4, 3)]),                                              # 8 dano
    (12, [(19, 2, 4, 0), (16, 2, 4, 0), (19, 2, 4, 0), (16, 2, 4, 5)]),               # 9 alarme do chefe
    (9, [(22 - k, 6, 7 if k < 6 else 6 - (k - 6) // 2, 0) for k in range(16)]),       # 10 bomba
    (6, [(24, 0, 3, 1), (36, 0, 3, 1), (40, 0, 2, 5)]),                               # 11 troca de altitude
    (1, [(52, 3, 2, 0)]),                                                             # 12 tiro rebatido
]


def sfx_lines():
    out = []
    for n in range(64):
        if n < len(SFX):
            speed, notes = SFX[n]
        else:
            speed, notes = 16, []
        s = '00%02x0000' % speed
        for k in range(32):
            p, w, v, e = notes[k] if k < len(notes) else (0, 0, 0, 0)
            s += '%02x%x%x%x' % (p, w, v, e)
        out.append(s)
    return out


def build(name, sprites):
    gfx, table = sheet(sprites)
    with open(os.path.join(OUT, name + '.lua'), encoding='utf-8') as f:
        code = f.read().replace('--#sprs', 'sprs="%s"' % table)
    cart = ['pico-8 cartridge // http://www.pico-8.com', 'version 43', '__lua__', code.rstrip('\n'),
            '__gfx__'] + gfx + ['__sfx__'] + sfx_lines()
    with open(os.path.join(OUT, name + '.p8'), 'w', encoding='utf-8') as f:
        f.write('\n'.join(cart) + '\n')
    print(name + '.p8 ok')


if __name__ == '__main__':
    build('river', RIVER)
    build('ocean', OCEAN)
