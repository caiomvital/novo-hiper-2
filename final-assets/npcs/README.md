# Template de NPCs

Base visual para moradores adultos do bairro, no estilo do Bernardo.

## Folha normalizada

`npc-template.png`: PNG transparente, 288 × 192 px, grade de 4 colunas × 2 linhas.
Cada quadro ocupa 72 × 96 px. Pés ancorados em (36, 88).

| Linha | Base | Coluna 0 | Coluna 1 | Coluna 2 | Coluna 3 |
|---|---|---|---|---|---|
| 0 | Morador | Frente/baixo | Esquerda | Direita | Costas/cima |
| 1 | Moradora | Frente/baixo | Esquerda | Direita | Costas/cima |

São poses paradas de referência, ainda sem ciclo de caminhada. O template
não substitui automaticamente os moradores do jogo.

## Como derivar um morador

Trocar cabelo, tom de pele, roupa e acessórios preservando escala, perspectiva
e âncora dos pés em todas as direções. Luz no alto à esquerda, contorno escuro
colorido, três a cinco tons por material. Exportar PNG RGBA sem rótulos,
quadriculado ou sombra embutida; a sombra de chão fica a cargo do Phaser.

Para animar, preparar idle e quatro passos por direção, conferir os perfis e
manter a mesma âncora. Usar collider separado do tamanho da imagem.

`npc-template-v2-master.png` é a fonte de alta resolução usada pela normalização.
O arquivo anterior registra a primeira proposta com fundo e não deve ser usado
como sprite. Os prompts exatos estão em `prompts.json`; geração feita com a
ferramenta integrada `image_gen`.

Normalização: `node scripts/sprites/build-final-assets.cjs`.

## Moradores do primeiro arco — v1

`moradores-v1-master.png` é a nova folha RGBA transparente (887 × 1774 px), com oito moradores e quatro poses paradas por morador: baixo/frente, esquerda, direita e cima/costas.

Ordem das linhas: Dona Maria, Seu João, Ana, Carlos, Dona Lúcia, representante da Floricultura, Seu Antônio e Bia. Cada identidade mantém cabelo, roupas e acessórios nas quatro direções.

Use `moradores-v1-atlas.json` para os 32 recortes reais, com pivô junto aos pés. O catálogo `moradores-v1-catalog.json` associa os quadros aos IDs oficiais de clientes. A folha gerada não tem células com espaçamento perfeitamente uniforme; o atlas conserva cada personagem inteiro. Escala inicial sugerida: 0,36, a conferir no mapa junto ao Bernardo.

Validação: 32 personagens separados, transparência real (981.867 pixels totalmente transparentes) e imagem original preservada. `node scripts/sprites/catalog-npcs.cjs` reconstrói os índices por leitura da transparência, sem editar o PNG.

São poses paradas, sem ciclo de caminhada. A folha e os índices foram criados nesta etapa; a integração usa os IDs oficiais nas entregas, uma aparência estável para clientes personalizados e três poses nos vizinhos ambientais. Os templates anteriores continuam preservados.

`moradores-v1.png` é a cópia idêntica usada pelo jogo. O master é preservado como fonte e fica fora do pacote Docker, conforme a regra geral de fontes `*-master.png`.
