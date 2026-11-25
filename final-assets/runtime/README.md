# Arte leve de distribuição

Gerada por `node scripts/sprites/build-runtime-art.cjs`, usando Chromium apenas para redução, encoding WebP e cálculo dos recortes. Os originais continuam nas pastas de origem. `world-art.json` registra dimensões de origem, dimensões de distribuição e frames pré-calculados.

NPCs mantêm o tamanho original do atlas, sem mudar coordenadas ou escala de renderização. Construções, terreno e kit urbano são reduzidos ao tamanho necessário pelo jogo. A casa frontal foi criada com `image_gen`; prompt e fonte em `../buildings/platform-house-front-prompts.json`.
