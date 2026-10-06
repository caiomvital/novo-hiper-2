# Bernardo Sprites — pacote inicial

Pacote preparado para o protótipo Phaser do Novo Hiper.

## Formato
- PNG RGBA com fundo transparente.
- Cada frame ocupa 160 × 180 px.
- Os frames de cada animação estão dispostos horizontalmente.
- Origem visual: pés alinhados aproximadamente na mesma linha.
- Pixel art deve ser renderizada sem suavização (`pixelArt: true` / nearest-neighbor).

## Platform
- `idle-right.png`: 4 frames
- `idle-left.png`: 4 frames
- `walk-right.png`: 8 frames
- `walk-left.png`: 8 frames
- `jump.png`: 6 frames (sequência completa de salto; pode ser subdividida em subida/ápice/queda)
- `thumbs-up-front.png`: 8 frames, animação frontal de comemoração

## Top-down
- `walk-down.png`: 8 frames
- `walk-up.png`: 8 frames
- `walk-right.png`: 8 frames
- `walk-left.png`: 8 frames

## Integração Phaser
Use `frameWidth: 160` e `frameHeight: 180` ao carregar as spritesheets.

A caixa de colisão NÃO deve usar os 160 × 180 px inteiros. Mantenha o collider pequeno,
centrado nos pés/corpo, para não alterar a física já validada pelos testes.

Ao substituir o placeholder:
1. não altere gravidade, velocidade, jump velocity, largura dos buracos ou checkpoints;
2. ajuste somente escala visual, offset e body size/offset;
3. preserve os testes existentes;
4. a animação `thumbs-up-front` é indicada para conclusão de entrega/destino.

## Observação
Este é um pacote inicial derivado das referências visuais fornecidas. Antes de tratá-lo como
arte final, confira visualmente os recortes e a consistência dos frames em movimento.
`reference/generated-master-sheet.png` foi incluído para comparação.
