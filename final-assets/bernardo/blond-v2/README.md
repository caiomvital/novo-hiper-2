# Bernardo loiro — versão 2

Edição de cor realizada com a ferramenta integrada `image_gen` sobre as três folhas originais. O cabelo usa loiro claro de trigo, luzes creme e sombras em areia, com menos laranja/cobre. Roupa, óculos, mochila, expressões, poses e ordem das animações foram preservados na edição. Prompts completos em `prompts.json`.

Fontes preservadas nesta pasta: `walk-master.png`, `platform/jump-master.png` e `platform/celebration-master.png`. Os originais anteriores continuam fora desta pasta.

Normalização: `node scripts/sprites/build-final-assets.cjs --blond`. O Chromium aplica a mesma limpeza, recorte, redução nearest-neighbor, espelhamento dos dois quadros legados e alinhamento pelos pés usados na versão anterior. Sem recoloração procedural ou filtro aplicado ao personagem inteiro.

Arquivos consumidos pelo jogo:

- `bernardo-topdown.png`: 20 quadros de 72×80, pés em (36,72), quatro direções.
- `platform/idle-left.png` e `idle-right.png`: quatro quadros cada, de 160×180.
- `platform/walk-left.png` e `walk-right.png`: oito quadros cada.
- `platform/jump.png`: 12 quadros.
- `platform/thumbs-up-front.png`: seis quadros.

Todos os quadros de plataforma mantêm 160×180 e pés em (80,160). As chaves de textura, escalas, colisores e regras de animação continuam iguais. Os sete PNGs de runtime são importados pelo Vite e recebem URLs versionadas/cache offline. As folhas `-master.png` não são importadas e continuam excluídas do Docker.
