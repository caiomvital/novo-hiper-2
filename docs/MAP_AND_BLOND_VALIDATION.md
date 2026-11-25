# Chão do bairro e Bernardo loiro

O tileset existente é `final-assets/terrain/terrain-kit.jpg`. O render anterior usava poucos recortes em repetição curta. O novo chão utiliza variações de grama, tufos, flores, terra, pedras, pavimento e asfalto; recortes internos evitam molduras e quadriculado da folha. Mosaicos de 256×256 reutilizados por material evitam criar um objeto por tile e conservam tamanho POT para o TileSprite.

O bairro ganhou meios-fios claros com sombra, faixas de pedestres e marcações de avenida interrompidas nos cruzamentos, caminhos de pedra das portas às calçadas, pátio diante da Novo Hiper e canteiros com borda na praça. Rachaduras e marcas gastas são esparsas para não transformar as ruas num padrão de manchas. Pequenas floreiras ficam ao lado dos caminhos. Casas, portas, destinos, colisões, cercas e barreiras não foram reposicionados.

O cabelo foi corrigido nas três folhas de origem do Bernardo com `image_gen`, preservando as poses. Sete folhas de runtime foram normalizadas em `final-assets/bernardo/blond-v2/`. Referências, comandos, dimensões e prompts em `final-assets/bernardo/blond-v2/README.md` e `prompts.json`. As versões anteriores permanecem preservadas.

Os 148 testes unitários em 20 arquivos passaram, incluindo recortes dentro do tileset, caminhos das casas fora do asfalto, meios-fios separados nas interseções, faixas sobre as ruas e os testes existentes de geometria/colisão. Nenhuma migration ou regra de negócio foi alterada.

Verificação no navegador: 1 teste passou em 1,6min (1,5min de execução), viewport 900×620 e plataforma 844×390 com toque. Conferidos corpo 32×44/escala 1 no bairro e 28×44/escala 0,5 na plataforma; colisão lateral da loja; retirada real; NPC na posição oficial; seis folhas de plataforma e folha top-down carregadas da versão loira; pulo, comemoração, retorno e uma venda de R$40 com baixa de uma unidade somente no finish.

Capturas finais: `docs/evidence/map-blond/loja.png`, `cruzamento.png`, `praca.png`, `plataforma-loiro.png` e `comemoracao-loiro.png`. A revisão visual corrigiu uma borda da folha que aparecia em alguns recortes floridos e rachados e reduziu a densidade de desgaste. Os mosaicos finais têm 256×256, reaproveitados entre os quarteirões. A espera de câmera do teste foi ajustada de 8 para 12px para respeitar o arredondamento de câmera com lerp; o comportamento da câmera do jogo não foi alterado.

TypeScript final passou. Os três testes específicos do plano do chão também foram repetidos após os ajustes finais dos recortes.

## Publicação

Builds host e Docker passaram, com 21 assets idênticos antes da publicação. Publicado em 17/10/2026 às 22:35 UTC em https://novohiper.fluxos.dev.br. Imagem `sha256:de6d14d0c99c3401733873c28ff38bf90ba9da8b2c241fe6be67f6654a785ca9`, container saudável.

No endereço público foram verificados health, index, JS/CSS, 15 imagens, dois atlas e service worker por hash. Os sete PNGs do Bernardo servidos correspondem byte a byte aos arquivos de `blond-v2`, e o JS publicado contém o novo render de chão. O cache offline inclui esses arquivos versionados.

Backup: `backups/map-and-blond/20261017T223514Z/`. Banco íntegro antes/depois: 1 planta, 18 pedidos, 17 entregas e 18 lançamentos preservados. Rollback: `novo-hiper-rollback:before-map-and-blond`.
