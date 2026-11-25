# Arte do jogo — primeiro passe visual

Pasta do projeto ativo: `/root/novo-hiper`. As referências em `art-master/`
foram preservadas. Os arquivos desta pasta são importados pelo Vite, que gera
URLs versionadas e inclui as imagens no cache offline.

## Arquivos usados

- `bernardo/blond-v2/bernardo-topdown.png`: versão loira atual; grade 5 × 4, quadros de 72 × 80,
  pés em (36, 72). Ordem: baixo, esquerda, direita, cima; idle + quatro passos.
- `bernardo/blond-v2/platform/`: idle, caminhada, pulo e comemoração. Quadros de
  160 × 180, pés em (80, 160), exibidos a 0,5. O pulo tem 12 quadros;
  os estados de subida, ápice e descida usam os quadros 1, 2, 4 e 7.
- `buildings/novo-hiper-depth-v1.png`: piloto da loja em perspectiva de cima em 3/4.
- `buildings/house-depth-v1.png`: piloto da casa do cliente na mesma perspectiva.
  Prévias, escala, ancoragem e prompts: `buildings/PERSPECTIVE_PREVIEW.md`.
- `buildings/houses.png` e `houses-north-v2.png`: quatro variantes em atlas 2 × 2,
  com vistas frontal e traseira. Telhados sempre acima das paredes;
  a versão antiga `houses-north.png` não é mais usada pelo jogo.
- `npcs/`: template de morador e moradora em quatro direções, com guia e prompts.
- `urban/urban-kit.png`: atlas 2 × 2 de árvores, banco e arbusto florido.
- `terrain/terrain-kit.jpg`: kit fornecido em art-master; o carregador recorta
  os interiores de grama, terra, calçada e asfalto, excluindo molduras.
- `previews/`: capturas locais da cena para revisão.

Os arquivos `*-master.png` são fontes geradas para reproduzir a normalização;
não são importados pelo jogo. Para gerar novamente as folhas do personagem:

```bash
node scripts/sprites/build-final-assets.cjs
```

Requer dependências do projeto e Chromium em `/usr/bin/google-chrome`, ou
`CHROME_PATH` configurado. O script apenas recorta, limpa componentes soltos,
espelha dois quadros invertidos e normaliza tamanho e âncora.

## Geração da arte

Modo usado: ferramenta integrada `image_gen`, com transparência real, usando
as referências locais. Especificações dos prompts finais:

1. Bernardo: preservar cabelo laranja, óculos verdes, camiseta vermelha,
   shorts azuis, tênis vermelhos e mochila amarela; grade 5 × 4 sem texto,
   divisórias ou sombras, quatro direções, idle e quatro passos, pés alinhados.
   Passe adicional: limpar franjas e corrigir direções. Dois quadros ainda
   invertidos foram espelhados na normalização (linha esquerda/última coluna;
   linha direita/segunda coluna).
2. Fachada: preservar madeira, paredes creme, toldo verde/creme, plantas e
   placa exata "NOVO HIPER"; retirar Bernardo, chão e fundo; porta no centro.
3. Casas: atlas 2 × 2, paredes creme, verde, rosa e azul; telhados de barro,
   porta central, janelas azuis e floreiras, sem chão nem personagens.
4. Casas ao norte: mesmas quatro variantes vistas por trás, com telhado acima
   das paredes, duas janelas e sem porta visível; sem rotação ou inversão.
5. Kit urbano: atlas 2 × 2 com árvore pequena, árvore média, banco de madeira
   e arbusto com flores brancas/amarelas; preservar estilo da referência,
   eliminar rótulos, fundo e sombras.
6. Pulo: derivado de `art-master/platform.jpg`; grade 4 × 3 com 12 poses,
   todas para a direita: preparação, impulso, subida, ápice, descida,
   aterrissagem e recuperação; sem fundo, rótulos ou sombras.
7. Comemoração: seis quadros de frente, sorriso, braço levantado, joinha,
   joinha sustentado, piscada e joinha final; mesma identidade do Bernardo.

## Escopo

Primeiro passe: chão do bairro, casas, fachada, árvores, bancos e personagem
nas duas modalidades. Colisões, mapa, entradas, física e regras de negócio
continuam definidos pelos dados e pelo backend. Interior, HUD, moradores,
fonte, utilidades, cercas e cenário de plataforma ainda têm arte provisória.
Nenhum deploy é feito pelo fluxo de preparação ou prévia.

Construções usam escala uniforme. A ocupação da Novo Hiper foi reduzida para
392 × 180, com a porta preservada em (1032, 1000), para acompanhar a fachada
panorâmica sem esticamento nem colisão no espaço vazio acima dela.


Atualização do cabelo: `bernardo/blond-v2/README.md` e `prompts.json`. Gerar os quadros atuais com `node scripts/sprites/build-final-assets.cjs --blond`; as folhas anteriores foram preservadas. O chão usa os recortes definidos em `src/phaser-game/config/terrainArt.ts`, com mosaicos reutilizáveis, caminhos, meios-fios e travessias.

## Cenário de plataforma da internet

`platform/tall-forest/`: oito PNGs do pacote SunnyLand Tall Forest, de Ansimuz / Luis Zuno (CC0), com licença original e procedência no README da pasta. Fundos, solo, pedras e vegetação preservados como referência; o jogo atual usa campinas abertas e texturas nativas leves.

## Distribuição leve e casa frontal

`runtime/` contém os nove WebP usados pelo jogo e os recortes em `world-art.json`. Gerador em `scripts/sprites/build-runtime-art.cjs`. A fachada frontal da plataforma foi criada com `image_gen`; fonte e prompt em `buildings/platform-house-front-master.png` e `buildings/platform-house-front-prompts.json`.
