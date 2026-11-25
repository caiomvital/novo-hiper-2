# Percursos procedurais — registro do primeiro passe de cenário

Atualização posterior: o jogo agora usa campinas abertas, fachada frontal e um parque alternativo maior. Veja `JUMP_PARK_VALIDATION.md`. O registro abaixo descreve a versão anterior publicada às 03:04 UTC.

O mapa da plataforma passa a ser criado ao entrar na fase. Um RNG determinístico recebe uma semente de 32 bits e produz as ilhas de chão, larguras das valas e posições do conteúdo opcional. Cair, mudar o zoom ou girar o celular conserva essa composição; sair e entrar cria outra semente. O bairro permanece estável entre visitas.

## Regras de composição

- Mundo com 2400 × 720 px, chão em y=620 e física original de movimento e pulo.
- Duas valas no percurso inicial; três nos outros percursos, liberados pelos marcos oficiais existentes.
- Valas de 84–112 px no percurso inicial e até 120 px nos demais. Validação usa o menor alcance entre cálculo analítico e simulação do pulo, incluindo as margens de segurança existentes.
- Trechos de chão de pelo menos 360 px. Início com espaço para aprender e fim com a casa de chegada sobre chão firme.
- Degraus opcionais com altura alcançável, três flores, bandeiras e carrinho afastado das bordas e dos pontos de resgate.
- Uma semente reproduz o mesmo mapa, objetos e decoração. Diagnóstico de desenvolvimento expõe semente e versão do gerador para reproduzir problemas.
- Mudanças nos parâmetros passam pelo validador; composição inválida usa o percurso curado existente como alternativa.

O fluxo continua: pegar a planta → atravessar a fase → confirmar chegada → entregar na casa oficial. Crédito e baixa de estoque continuam pertencendo à entrega; flores de treino continuam locais à visita.

## Arte obtida na internet

Aplicado o pacote **SunnyLand Tall Forest Environment**, de **Luis Zuno / Ansimuz**, publicado sob **CC0** na [página do autor no OpenGameArt](https://opengameart.org/content/sunnyland-tall-forest-environment). [Download original](https://opengameart.org/sites/default/files/tall_forest_files.zip). Os termos originais também estão preservados em `final-assets/platform/tall-forest/LICENSE.txt`.

Três fundos em velocidades de parallax diferentes, peças de solo e quatro tipos de vegetação/pedra são empacotados no jogo. Nenhuma imagem depende de carregamento externo durante uma partida. A chegada usa a casa em perspectiva já existente. Personagem e controles continuam os mesmos.

## Bairro menos repetitivo

Lotes residenciais variam largura, recuo e leve deslocamento lateral sem alterar os identificadores das casas ou suas orientações. O catálogo recalcula portas e entregas a partir dos novos retângulos. Pátios de descanso a oeste, hortas no centro e jardins a leste variam os espaços entre fileiras; a praça ganha canteiros assimétricos e um terraço mais aberto. As ruas principais e os pontos da loja continuam reconhecíveis.

## Validação

TypeScript aprovado. 153 testes unitários em 21 arquivos aprovados, incluindo 400 sementes por percurso (1.200 no total), reprodução determinística, margens dos saltos, objetivos sobre chão firme, degraus alcançáveis, carrinho e resgates afastados das valas. Os testes de geometria e navegação do bairro verificam acesso às casas e ausência de sobreposição após variar os lotes.

Teste de navegador procedural aprovado (1,7 minuto, viewport touch 760×440 e 844×390): floresta local com oito imagens carregadas; percurso completo com controles reais; queda recuperada; semente e chão preservados com zoom/resize; nova entrada com outro mapa; treino sem crédito em caixa e sem erros JavaScript. Sementes observadas: 1267108436 e 1144376901. Capturas em `docs/evidence/procedural-platform/`.

Regressão adicional aprovada: seis testes de navegador em 7,6 minutos. Cobertura de colisão da loja, retirada real, carregamento dos sprites loiros, subida real dos dois degraus gerados e flor alta, carrinho e resgate, zoom, resize e orientação simulada com alternativa manual. Os três percursos oficiais foram atravessados com controles reais, recuperação de queda e entrega no destino correto; cada entrega gerou um único crédito e débito de estoque. Somando o teste procedural separado, sete testes de navegador aprovados. Validação em aparelho Android físico permanece necessária para avaliar fluidez e orientação nativa.

## Publicação

Publicado em 18/10/2026 às 03:04 UTC em https://novohiper.fluxos.dev.br. Imagem `sha256:941d1eea13eb45089858c66fe55f7a7d85c8aee4c86308b9646697c5931189a7`, contêiner healthy. Build local e imagem Docker com 23 arquivos de produção idênticos. Verificação pública aprovada de HTML, JS/CSS, 17 imagens externas, dois atlas e service worker. As oito imagens novas foram conferidas byte a byte: duas como arquivos externos e seis PNGs pequenos embutidos no JavaScript pelo Vite, também coberto pelo cache PWA.

Backup `backups/procedural-platform/20261018T030414Z/`; rollback `novo-hiper-rollback:before-procedural-platform`. Integridade do banco aprovada antes e depois, com os mesmos totais: 1 planta, 20 pedidos, 19 entregas e 20 transações. Não houve alteração do esquema nem das regras financeiras.

Abrir uma aba antiga pode conservar o código anterior até aceitar **Atualizar aplicativo**.
