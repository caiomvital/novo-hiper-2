# Piloto de perspectiva em 3/4

Dois exemplos para avaliação no bairro antes de refazer todas as construções:

- `novo-hiper-depth-v1.png`: Novo Hiper com telhado profundo, parede lateral,
  beirais e entrada preservada em (1032, 1000).
- `house-depth-v1.png`: casa do cliente legado, com entrada em (2560, 1750).

Referência de linguagem: cidades de JRPGs de 16 bits, como Chrono Trigger;
vista ortográfica elevada em 3/4 com a fachada voltada para o sul.
As imagens são arte original gerada pela ferramenta integrada `image_gen`.
Os prompts exatos estão em `perspective-prompts.json`.

A escala é uniforme e definida pela largura. A altura visual inclui o telhado
projetado acima da ocupação física: o desenho não é comprimido para caber no
retângulo de colisão. A soleira, e não o centro da silhueta assimétrica, ancora
o prédio ao mapa. As posições das portas e os colliders foram preservados.

Personagens, moradores ambientais, copas da praça e os dois prédios piloto
são ordenados pela altura dos pés no mapa. Bernardo fica atrás dos volumes
quando passa ao fundo; nomes, marcadores e HUD ficam em camadas acima.
Sombras frias usam o alpha da silhueta, com deslocamento para baixo e à direita.

## Prévias dentro do jogo

- `../previews/novo-hiper-depth.png`: loja e Bernardo, em escala de jogo.
- `../previews/house-depth.png`: casa nova junto de casas do passe anterior.
- `../previews/novo-hiper-behind.png`: Bernardo encoberto pelo telhado ao fundo.
- `../previews/bairro-before-depth.png`: panorama anterior para comparação.

As demais casas mantêm a arte anterior para comparação. Este é um piloto de
perspectiva e escala; ainda falta aplicar a linguagem ao restante do cenário.
