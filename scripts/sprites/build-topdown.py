#!/usr/bin/env python3
"""
Gera o spritesheet top-down do Bernardo para o jogo a partir da folha de apresentação original.

ENTRADA : design-assets/bernardo-sprites/source/bernardo-topdown-spritesheet.png  (1536x1024, fora do bundle e do git)
SAÍDA   : public/assets/bernardo-sprites/topdown/bernardo-topdown.png             (5 colunas x 4 linhas de 72x80)

Processamento DETERMINÍSTICO, sem retoque criativo (nada é redesenhado):
  1. recorte por células fixas (acima dos rótulos impressos; painéis laterais ficam de fora);
  2. alpha binarizado (>=128 -> 255): elimina halo e o alpha 253 "quase opaco" do original;
  3. remoção da sombra embutida por MÁSCARA DE COR (cinza-lilás claro) + componente conexo grande na parte baixa;
  4. limpeza: tira o contorno claro residual da sombra e componentes minúsculos soltos;
  5. âncora: x = centro da CABEÇA (estável no ciclo de passos; a sombra do original não acompanha o corpo de forma consistente);
     y = base do pé (pixel mais baixo do maior componente do personagem);
  6. uma única redução Lanczos (fator 0,375; o original NÃO é pixel art de grade exata), pés ancorados em (36, 72).

Linhas da saída (mesma ordem da folha): 0 = baixo, 1 = esquerda, 2 = direita, 3 = cima.
Colunas: 0 = idle, 1..4 = caminhada.

Uso:  python3 scripts/sprites/build-topdown.py [--src ARQ] [--out ARQ] [--qa ARQ.png] [--keep-shadow]
Requer Pillow. Sai com código 1 se algum controle de qualidade falhar.
"""
import argparse
import json
import os
import sys
from collections import deque

from PIL import Image

SCALE = 0.375
CELL_W, CELL_H = 72, 80
ANCHOR = (36, 72)  # (x, y): x = centro da cabeça; y = base do pé, dentro da célula de saída
COL_CENTERS = [294, 517, 740, 966, 1192]  # centros das 5 colunas na folha original
COL_HALF = 112  # meia largura da janela de recorte
# (y0, y1, nome) de cada linha na folha original; y0 já fica abaixo do texto "Idle/Walk n"
ROWS = [(38, 232, 'down'), (284, 484, 'left'), (538, 738, 'right'), (791, 991, 'up')]

SHADOW_MIN_AREA = 300


def is_shadow_color(r, g, b):
    # cinza-lilás claro, pouco saturado, ligeiramente azulado (a sombra elíptica do original)
    return 185 <= r <= 232 and 185 <= g <= 232 and 200 <= b <= 238 and abs(r - g) <= 12 and 0 <= b - r <= 24


def connected_components(mask, w, h):
    seen = [[False] * w for _ in range(h)]
    comps = []
    for y in range(h):
        for x in range(w):
            if mask[y][x] and not seen[y][x]:
                q = deque([(x, y)])
                seen[y][x] = True
                pts = []
                while q:
                    cx, cy = q.popleft()
                    pts.append((cx, cy))
                    for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                        if 0 <= nx < w and 0 <= ny < h and mask[ny][nx] and not seen[ny][nx]:
                            seen[ny][nx] = True
                            q.append((nx, ny))
                comps.append(pts)
    return comps


def process_cell(sheet, col, row, keep_shadow):
    cx = COL_CENTERS[col]
    y0, y1, _ = ROWS[row]
    crop = sheet.crop((cx - COL_HALF, y0, cx + COL_HALF, y1)).convert('RGBA')
    w, h = crop.size
    px = crop.load()
    # 2. alpha binário
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            px[x, y] = (r, g, b, 255 if a >= 128 else 0)
    # 3. sombra: máscara de cor -> componentes grandes na metade de baixo
    mask = [[px[x, y][3] == 255 and is_shadow_color(*px[x, y][:3]) for x in range(w)] for y in range(h)]
    shadow_pts = []
    for comp in connected_components(mask, w, h):
        if len(comp) >= SHADOW_MIN_AREA and sum(1 for _, y in comp if y > h // 2) > len(comp) * 0.8:
            shadow_pts.extend(comp)
    if not shadow_pts:
        raise RuntimeError(f'sombra não encontrada na célula col={col} row={row}')
    sxs = [p[0] for p in shadow_pts]
    shadow_cx = (min(sxs) + max(sxs)) / 2.0
    if not keep_shadow:
        removed = set(shadow_pts)
        for x, y in shadow_pts:
            px[x, y] = (0, 0, 0, 0)
        # 4a. contorno claro residual: pixels pálidos a até 2px da sombra removida
        def pale(r, g, b):
            return min(r, g, b) >= 165 and max(r, g, b) - min(r, g, b) <= 45
        near = []
        for (x, y) in removed:
            for dy in range(-2, 3):
                for dx in range(-2, 3):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < w and 0 <= ny < h and px[nx, ny][3] == 255 and pale(*px[nx, ny][:3]):
                        near.append((nx, ny))
        for x, y in set(near):
            px[x, y] = (0, 0, 0, 0)
    # 4a'. restos da sombra que ficaram fora do 1º corte: componentes de cor de sombra (a) grandes, ou (b) pequenos
    #      MAS acima da altura da sola (entre as pernas). Lilás junto à sola (<14px da base) é parte do tênis: mantém.
    if not keep_shadow:
        m2 = [[px[x, y][3] == 255 and is_shadow_color(*px[x, y][:3]) for x in range(w)] for y in range(h)]
        c2 = connected_components(m2, w, h)
        yb = max((y for y in range(h) for x in range(w) if px[x, y][3] == 255), default=0)
        for comp in c2:
            low = max(p[1] for p in comp)
            if len(comp) >= 100 or (len(comp) >= 12 and yb - low >= 14):
                for x, y in comp:
                    px[x, y] = (0, 0, 0, 0)
    # 4b. componentes minúsculos soltos
    amask = [[px[x, y][3] == 255 for x in range(w)] for y in range(h)]
    comps = connected_components(amask, w, h)
    comps.sort(key=len, reverse=True)
    main = comps[0]
    for comp in comps[1:]:
        if len(comp) < 400:
            for x, y in comp:
                px[x, y] = (0, 0, 0, 0)
    # 5. âncoras a partir do maior componente
    ys = [p[1] for p in main]
    xs_all = [p[0] for p in main]
    top, bottom = min(ys), max(ys)
    head_rows = [p for p in main if p[1] <= top + (bottom - top) * 0.32]
    hx = [p[0] for p in head_rows]
    head_cx = (min(hx) + max(hx)) / 2.0
    foot_y = bottom if not keep_shadow else max(y for x, y in shadow_pts)
    shadow_cx = head_cx
    char_top = top
    return crop, shadow_cx, foot_y, char_top, (min(xs_all), max(xs_all))


def build(src, out, qa, keep_shadow):
    sheet = Image.open(src).convert('RGBA')
    result = Image.new('RGBA', (CELL_W * 5, CELL_H * 4), (0, 0, 0, 0))
    report = {'frames': [], 'scale': SCALE, 'cell': [CELL_W, CELL_H], 'anchor': list(ANCHOR), 'keepShadow': keep_shadow}
    problems = []
    for row in range(4):
        for col in range(5):
            crop, scx, foot_y, top_y, (minx, maxx) = process_cell(sheet, col, row, keep_shadow)
            sw, sh = round(crop.size[0] * SCALE), round(crop.size[1] * SCALE)
            small = crop.resize((sw, sh), Image.LANCZOS)
            # alpha binário também depois da redução (bordas nítidas, como nos sprites da plataforma)
            sp = small.load()
            for y in range(sh):
                for x in range(sw):
                    r, g, b, a = sp[x, y]
                    sp[x, y] = (r, g, b, 255 if a >= 128 else 0)
            ox = round(ANCHOR[0] - scx * SCALE)
            oy = round(ANCHOR[1] - foot_y * SCALE)
            cell = Image.new('RGBA', (CELL_W, CELL_H), (0, 0, 0, 0))
            cell.alpha_composite(small, (ox, oy)) if (ox >= 0 and oy >= 0 and ox + sw <= CELL_W and oy + sh <= CELL_H) else None
            if not (ox >= 0 and oy >= 0 and ox + sw <= CELL_W and oy + sh <= CELL_H):
                # a janela pode ser maior que a célula; cola recortando (só se a parte VISÍVEL do personagem cabe)
                cell = Image.new('RGBA', (CELL_W, CELL_H), (0, 0, 0, 0))
                canvas = Image.new('RGBA', (CELL_W + 200, CELL_H + 200), (0, 0, 0, 0))
                canvas.alpha_composite(small, (ox + 100, oy + 100))
                cell = canvas.crop((100, 100, 100 + CELL_W, 100 + CELL_H))
            bb = cell.getchannel('A').getbbox()
            if bb is None:
                problems.append(f'frame vazio ({row},{col})')
            else:
                if bb[0] <= 0 or bb[1] <= 0 or bb[2] >= CELL_W or bb[3] >= CELL_H:
                    problems.append(f'personagem encosta/sai da célula ({row},{col}) bbox={bb}')
            result.alpha_composite(cell, (col * CELL_W, row * CELL_H))
            report['frames'].append({'row': ROWS[row][2], 'col': col, 'bbox': list(bb) if bb else None,
                                     'shadowCx': round(scx, 1), 'footY': foot_y})
    # controle de qualidade: base do pé idêntica (±1px) em todos os frames; centro horizontal estável por linha
    bottoms = [f['bbox'][3] for f in report['frames'] if f['bbox']]
    if bottoms and max(bottoms) - min(bottoms) > 2:
        problems.append(f'base do pé varia {max(bottoms)-min(bottoms)}px entre frames (esperado <= 2)')
    os.makedirs(os.path.dirname(out), exist_ok=True)
    result.save(out, optimize=True)
    if qa:
        grounds = [(58, 98, 34), (86, 82, 76), (40, 40, 44)]
        qa_img = Image.new('RGBA', (CELL_W * 5 * 3 + 40, CELL_H * 4 + 0), (0, 0, 0, 255))
        for i, g in enumerate(grounds):
            bg = Image.new('RGBA', result.size, g + (255,))
            bg.alpha_composite(result)
            qa_img.paste(bg, (i * (CELL_W * 5 + 20), 0))
        qa_img = qa_img.resize((qa_img.size[0] * 3, qa_img.size[1] * 3), Image.NEAREST)
        qa_img.convert('RGB').save(qa)
    report['problems'] = problems
    return report


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--src', default='design-assets/bernardo-sprites/source/bernardo-topdown-spritesheet.png')
    ap.add_argument('--out', default='public/assets/bernardo-sprites/topdown/bernardo-topdown.png')
    ap.add_argument('--qa', default=None, help='gera uma imagem de conferência visual (não versionada)')
    ap.add_argument('--keep-shadow', action='store_true', help='mantém a sombra original (fallback)')
    a = ap.parse_args()
    rep = build(a.src, a.out, a.qa, a.keep_shadow)
    print(json.dumps({k: v for k, v in rep.items() if k != 'frames'}, indent=1))
    for f in rep['frames']:
        print(f"{f['row']:>5} col{f['col']} bbox={f['bbox']} shadowCx={f['shadowCx']} footY={f['footY']}")
    if rep['problems']:
        print('FALHAS:', *rep['problems'], sep='\n  ', file=sys.stderr)
        sys.exit(1)
