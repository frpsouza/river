#!/usr/bin/env python3
"""gerar-catalogo.py — gera o catálogo de gráficos do jogo (HTML + PNGs).

Abre scripts/catalogo/render.html no Chrome sem janela; a página desenha cada gráfico com
as próprias funções do jogo e devolve os PNGs. Este script grava:

    docs/graficos/png/<grupo>/<elemento>.png
    docs/graficos/index.html        (relatório agrupado, com nomes, modos e links para os PNGs)

Uso:  python3 scripts/gerar-catalogo.py
Requer: google-chrome ou chromium. Só usa a biblioteca padrão do Python.
Para incluir um gráfico novo, acrescente um item() em scripts/catalogo/render.js.
"""
import base64, html, json, os, re, shutil, struct, subprocess, sys, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'docs' / 'graficos'


def find_chrome():
    for name in ('google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'):
        p = shutil.which(name)
        if p:
            return p
    sys.exit('erro: Chrome/Chromium não encontrado')


def png_size(data):
    return struct.unpack('>II', data[16:24])


def main():
    page = (ROOT / 'scripts' / 'catalogo' / 'render.html').as_uri()
    cmd = [find_chrome(), '--headless=new', '--no-sandbox', '--disable-gpu', '--allow-file-access-from-files',
           '--virtual-time-budget=60000', '--dump-dom', page]
    dom = subprocess.run(cmd, capture_output=True, text=True, timeout=300).stdout
    m = re.search(r'<pre id="out">(.*?)</pre>', dom, re.S)
    if not m or not m.group(1).strip():
        sys.exit('erro: a página de render não devolveu dados')
    data = json.loads(html.unescape(m.group(1)))
    if 'error' in data:
        sys.exit('erro no render: ' + data['error'] + '\n' + data.get('stack', ''))

    if (OUT / 'png').exists():
        shutil.rmtree(OUT / 'png')
    groups = {g[0]: g for g in data['groups']}
    by_group = {}
    for it in data['items']:
        raw = base64.b64decode(it['png'].split(',', 1)[1])
        path = OUT / 'png' / it['g'] / (it['id'] + '.png')
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(raw)
        it['file'] = path.relative_to(OUT).as_posix()
        it['size'] = '%d×%d' % png_size(raw)
        it['pixel'] = any(k in it['modes'] for k in ('Retro', 'PICO')) and 'tela' not in it['id']
        by_group.setdefault(it['g'], []).append(it)

    total = sum(len(v) for v in by_group.values())
    nav = ''.join(f'<a href="#{gid}">{html.escape(groups[gid][1])} <span>{len(by_group.get(gid, []))}</span></a>'
                  for gid in groups if by_group.get(gid))
    sections = []
    for gid, (_, title, desc) in groups.items():
        items = by_group.get(gid, [])
        if not items:
            continue
        cards = []
        for it in items:
            cls = 'pix' if it['pixel'] else ''
            cards.append(f'''<figure class="card">
  <a class="img {cls}" href="{it['file']}" target="_blank"><img src="{it['file']}" alt="{html.escape(it['name'])}" loading="lazy"></a>
  <figcaption><b>{html.escape(it['name'])}</b>
    <code>{html.escape(it['id'])}.png</code> <small>{it['size']} px</small>
    <span class="modes">{html.escape(it['modes'])}</span>
    {('<p>' + html.escape(it['desc']) + '</p>') if it['desc'] else ''}</figcaption>
</figure>''')
        sections.append(f'<section id="{gid}"><h2>{html.escape(title)}</h2><p class="lead">{html.escape(desc)}</p>'
                        f'<div class="grid">{"".join(cards)}</div></section>')

    now = datetime.datetime.now().strftime('%Y-%m-%d %H:%M')
    page_html = f'''<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Catálogo de gráficos</title>
<style>
  :root {{ --bg:#f4f5f8; --fg:#1b2033; --muted:#5d6475; --card:#fff; --line:#dfe2ea; --accent:#2c4bb5; --chk1:#e8eaf0; --chk2:#f7f8fb; }}
  @media (prefers-color-scheme: dark) {{ :root {{ --bg:#0f1220; --fg:#e8ecf5; --muted:#9aa3b8; --card:#181c2e; --line:#2a3048; --accent:#9fb7ff; --chk1:#22273b; --chk2:#2b3148; }} }}
  * {{ box-sizing:border-box }}
  body {{ margin:0; font:15px/1.5 system-ui, -apple-system, Segoe UI, Roboto, sans-serif; background:var(--bg); color:var(--fg) }}
  header {{ padding:28px 20px 8px; max-width:1200px; margin:0 auto }}
  h1 {{ margin:0 0 4px; font-size:26px }}
  header p {{ margin:0; color:var(--muted) }}
  nav {{ position:sticky; top:0; z-index:2; background:var(--bg); border-bottom:1px solid var(--line); padding:10px 20px; display:flex; gap:8px; flex-wrap:wrap; justify-content:center }}
  nav a {{ color:var(--fg); text-decoration:none; padding:4px 10px; border:1px solid var(--line); border-radius:999px; font-size:13px; background:var(--card) }}
  nav a span {{ color:var(--muted) }}
  main {{ max-width:1200px; margin:0 auto; padding:0 20px 60px }}
  h2 {{ margin:36px 0 2px; font-size:20px }}
  .lead {{ margin:0 0 14px; color:var(--muted) }}
  .grid {{ display:grid; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); gap:14px }}
  .card {{ margin:0; background:var(--card); border:1px solid var(--line); border-radius:12px; overflow:hidden; display:flex; flex-direction:column }}
  .img {{ display:flex; align-items:center; justify-content:center; min-height:150px; padding:12px;
          background:repeating-conic-gradient(var(--chk1) 0 25%, var(--chk2) 0 50%) 0 0/16px 16px }}
  .img img {{ max-width:100%; max-height:260px; object-fit:contain }}
  .img.pix img {{ image-rendering:pixelated }}
  figcaption {{ padding:10px 12px 12px; font-size:13px; display:flex; flex-direction:column; gap:3px }}
  figcaption b {{ font-size:14px }}
  code {{ font-size:12px; color:var(--accent) }}
  small, .modes {{ color:var(--muted); font-size:12px }}
  figcaption p {{ margin:4px 0 0; color:var(--muted) }}
  #telas .grid {{ grid-template-columns:repeat(auto-fill,minmax(260px,1fr)) }}
</style></head>
<body>
<header><h1>Catálogo de gráficos — River Raid (clone)</h1>
<p>{total} gráficos em {len(by_group)} grupos, desenhados pelas próprias funções do jogo. Clique numa imagem para abrir o PNG.
Gerado em {now} por <code>scripts/gerar-catalogo.py</code>.</p></header>
<nav>{nav}</nav>
<main>{"".join(sections)}</main>
</body></html>'''
    (OUT / 'index.html').write_text(page_html, encoding='utf-8')
    print(f'✔ catálogo: {total} gráficos em {len(by_group)} grupos → {OUT / "index.html"}')


if __name__ == '__main__':
    main()
