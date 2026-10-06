# Novo Hiper --- Game Design e Arquitetura da Aventura

## Objetivo

Este documento define a direção de gameplay, progressão e arquitetura da
Aventura do Novo Hiper. Deve ser analisado junto à aplicação atual, ao
jogo top-down antigo em `src/game/`, à implementação Phaser em
`src/phaser-game/`, ao sistema de plantas/pedidos/estoque/caixa e aos
upgrades existentes.

**Não implementar ainda.** Primeiro produzir proposta técnica/design
baseada nestas regras.

## 1. Conceito e core loop

Novo Hiper é uma pequena loja de plantas administrada por Bernardo, um
jogo de exploração e entregas em um bairro e um jogo de progressão no
qual a loja e o mundo crescem conforme Bernardo trabalha e amplia o
próprio catálogo.

Não há seleção tradicional de fases. Existe um mundo persistente que
cresce.

``` text
CADASTRAR/AMPLIAR CATÁLOGO
→ RECEBER PEDIDO
→ PREPARAR / PEGAR A PLANTA
→ SAIR DA NOVO HIPER
→ EXPLORAR O BAIRRO
→ ENCONTRAR O CLIENTE
→ EVENTUALMENTE ATRAVESSAR ÁREA DE PLATAFORMA
→ ENTREGAR
→ RECEBER DINHEIRO
→ DESBLOQUEAR PROGRESSO
→ COMPRAR ITENS / MELHORAR A LOJA
→ NOVOS PEDIDOS / CLIENTES / REGIÕES
```

Regras: sem cronômetro, ranking por velocidade, vidas ou Game Over
tradicional. Cair/errar retorna a checkpoint seguro. Exploração no
próprio ritmo. Sementes, cultivo e colecionáveis ficam fora da V1.

## 2. Novo Hiper como hub

A loja física é o centro da experiência. Bernardo pode ver plantas e
pedidos, pegar a planta de uma entrega, ver melhorias compradas,
organizar/personalizar a loja e sair para o bairro.

A loja muda visualmente com o progresso. Prateleiras, placas,
ventiladores, decoração e melhorias devem aparecer fisicamente.
Inventariar os upgrades visuais do jogo antigo para possível
reaproveitamento.

## 3. Mapa do bairro

O mapa começa pequeno de propósito: Novo Hiper, rua inicial, praça,
algumas casas/clientes e caminhos inicialmente bloqueados.

Áreas indisponíveis podem ser representadas naturalmente por rua em
obras, portão, ponte/passagem fechada, caminho ainda não descoberto etc.
O mapa pequeno atual deve ser tratado como o primeiro pedaço do mundo.

## 4. Progressão e expansão do mundo

O mapa NÃO cresce apenas com entregas. O crescimento real da Novo Hiper
também expande o mundo.

Usar gatilhos persistentes como: - quantidade de plantas cadastradas; -
variedade de produtos; - marcos históricos de plantas cadastradas; -
pedidos gerados; - entregas concluídas; - faturamento acumulado; - saldo
atual quando fizer sentido; - cliente/pedido específico; - item
comprado; - melhoria instalada; - região descoberta; - combinação de
requisitos.

Exemplos configuráveis: - 4 plantas cadastradas → nova rua; - 5
plantas + 3 entregas → novos clientes; - 5 entregas → Loja de
Utilidades; - 8 plantas + 10 entregas → nova região; - melhoria
específica → evento/local especial.

Não espalhar `if (plantCount >= 4)` etc. pelo código. Criar motor
centralizado/data-driven de regras com conceito de `id`, requisitos,
condições, desbloqueios/recompensas, evento opcional, `onceOnly` e
estado de conclusão.

## 5. Cadastrar plantas faz parte do gameplay

O cadastro de plantas não é só administrativo:

``` text
PLANTA CADASTRADA
→ CATÁLOGO CRESCE
→ NOVOS PEDIDOS POSSÍVEIS
→ MAIOR VARIEDADE DE CLIENTES
→ PODE ATIVAR GATILHOS
→ NOVAS REGIÕES / EVENTOS
```

Não criar catálogo paralelo no Phaser. O backend existente é a fonte de
verdade.

## 6. Geração dos pedidos

Pedidos usam SOMENTE plantas realmente cadastradas por Bernardo e devem
respeitar estoque/regras existentes. Ao cadastrar uma nova planta, ela
passa a poder aparecer em pedidos.

Não sabemos antecipadamente quais espécies Bernardo cadastrará. A
jornada deve adaptar-se ao catálogo real.

## 7. Marcos históricos e progresso permanente

Distinguir estado atual de marco histórico/acumulado.

Exemplo: ao atingir a 4ª planta, Rua Norte é desbloqueada. Se depois uma
planta for excluída, Rua Norte continua desbloqueada.

Analisar quais métricas usam valor atual, máximo histórico, contador
acumulado ou evento único. Desbloqueios importantes não regridem.

## 8. Eventos de desbloqueio

Desbloqueios devem ser percebidos. Ex.: "Novos clientes estão conhecendo
a Novo Hiper!" / "NOVA RUA DESBLOQUEADA!" ou "Tem uma loja nova perto da
praça!".

Persistir separadamente o conteúdo desbloqueado e se o anúncio já foi
visto. Não repetir toda vez.

## 9. Mundo data-driven

Evitar `mapa1`, `mapa2`, `mapa3`. Preferir mundo composto por regiões
bloqueadas/desbloqueadas.

Uma região pode ter: id, nome, requisitos, conexões, clientes,
estabelecimentos, pontos de interesse e entradas para áreas de
plataforma.

Adicionar regiões futuras sem reescrever o motor ou tornar `WorldScene`
monolítica.

## 10. Pedidos também podem descobrir o mundo

Nem todo desbloqueio é contador. Um pedido de cliente novo pode liberar
uma continuação do mapa. Crescimento pode vir de plantas, entregas,
pedido/cliente específico, melhoria ou combinações.

## 11. Exploração livre

Bernardo pode sair da Novo Hiper mesmo sem pedido. Pode caminhar,
visitar estabelecimentos/clientes, explorar regiões desbloqueadas, ir à
loja de itens e voltar. Pedido ativo pode orientar, sem obrigar.

## 12. Loja de itens no mundo

Deve existir um estabelecimento físico separado da Novo Hiper (nome
provisório: Loja de Utilidades/Decoração).

Fluxo: sair da Novo Hiper → andar pelo bairro → entrar → interagir com
vendedor → ver itens → comprar com dinheiro da Novo Hiper → voltar →
usar/colocar item.

A loja deve aparecer cedo para fechar o ciclo entrega → dinheiro →
desejo → compra → mudança visual.

## 13. Itens

Móveis: prateleira, balcão, mesa, expositor, armário.

Decoração: vaso decorativo, quadro, tapete, luminária, placa, plantas
decorativas.

Melhorias: ventilador, iluminação, fachada, placa externa, área de
estoque melhorada.

Sementes/cultivo continuam fora da V1.

## 14. Inventário e colocação

Para móveis/decoração: comprar → inventário → voltar à Novo Hiper → modo
de organização → escolher item → posição válida → colocar.

Preferir slots ou grade robusta para celular, não posicionamento pixel a
pixel. Algumas melhorias estruturais (ex.: fachada nível 2) podem ser
automáticas.

## 15. Economia

``` text
ENTREGAS → DINHEIRO → COMPRAS → NOVO HIPER MELHORA → NOVAS POSSIBILIDADES
```

Evitar grind. Itens iniciais devem ser acessíveis após poucas entregas,
com recompensas frequentes.

## 16. Clientes

Clientes pertencem ao mundo. Podem ter id, nome, região, casa/local,
posição, aparência, pedidos, diálogo e futuramente pequenas histórias.

## 17. Entregas simples e com aventura

Nem toda entrega vira plataforma.

Entrega simples: Novo Hiper → mapa → casa → entrega → joinha → mapa.

Entrega com aventura: Novo Hiper → mapa → local especial → PlatformScene
→ obstáculos → cliente → entrega → joinha → mapa.

Plataforma apenas quando fizer sentido (quintal, terreno, parque, obra,
acesso especial etc.).

## 18. Primeiras entregas

Entrega 1: próxima, sem plataforma; ensina pegar planta, sair,
localizar, entregar e receber dinheiro.

Entrega 2: mais distante, incentiva exploração.

Entrega 3: pode ativar expansão dependendo dos demais gatilhos.

Posteriores: introduzem primeira área de plataforma, novos
estabelecimentos e regiões.

Tudo adaptável ao catálogo real, sem depender de espécie específica.

## 19. Conclusão de entrega real

``` text
CLIENTE RECEBE
→ ANIMAÇÃO / JOINHA
→ BACKEND CONCLUI ENTREGA
→ ESTOQUE DIMINUI UMA VEZ
→ CAIXA RECEBE UMA VEZ
→ PROGRESSO É ATUALIZADO
→ MOTOR AVALIA GATILHOS
→ EVENTUAL DESBLOQUEIO
```

Phaser não implementa lógica financeira. Backend é fonte de verdade.
Idempotência obrigatória.

## 20. Persistência

Progresso importante deve sobreviver a navegador, dispositivo, PWA,
reinício e deploy.

Backend/SQLite deve persistir: regiões, gatilhos, eventos vistos,
clientes/estabelecimentos desbloqueados, marcos históricos, itens
comprados, inventário, itens posicionados, upgrades e progresso
relevante.

`localStorage` apenas para preferências/cache não crítico (controles,
volume, visual etc.).

## 21. Jogo top-down antigo

`src/game/` possui aproximadamente 4.000 linhas com mapa de Olinda,
loja, casas, clientes, colisão, câmera, bússola, missões, partículas,
natureza, arquitetura, upgrades, controles e persistência.

Não deletar e não portar tudo de uma vez.

Classificar cada sistema: - A --- reaproveitar conceito e código; - B
--- reaproveitar conceito, reimplementar em Phaser; - C --- manter
temporariamente; - D --- descartar futuramente.

## 22. Phaser como direção futura

Avaliar Phaser como motor único para top-down, interiores, plataforma,
sprites, câmera, input, efeitos e transições. Migração deve ser gradual,
preservando sistemas úteis do Canvas antigo.

## 23. Primeiro mapa Phaser

Deliberadamente pequeno: Novo Hiper + rua inicial + praça + algumas
casas + loja de itens + uma ou mais saídas bloqueadas.

A primeira expansão deve ser adicionável sem reconstruir o mapa inicial.

## 24. Exemplo de crescimento

``` text
INÍCIO
├── Novo Hiper
├── rua inicial
├── praça
└── primeiros clientes
      ↓ cadastro + entregas
NOVA RUA
      ↓ progresso
LOJA DE UTILIDADES
      ↓ compras/melhorias
ÁREA COMERCIAL
      ↓
PARQUE / NOVA REGIÃO
      ↓
...
```

Não deve ser linha rígida: diferentes gatilhos podem abrir conteúdos
diferentes.

## 25. Princípios de design

Prioridades: fácil de entender, agradável de explorar, recompensas
frequentes, pouca punição, progressão visível, mundo crescente, Novo
Hiper cada vez mais bonita e ações reais do Bernardo influenciando o
jogo.

Evitar: grind, menus excessivos, sistemas sem função, muitas
moedas/recursos, punições, cronômetros, ranking por velocidade, excesso
de texto e complexidade de MMORPG/simulador.

# Tarefa para o Claude Code

**Não escrever código ainda.**

Analisar esta especificação e o projeto atual e produzir documento
técnico/design contendo:

1.  Core loop definitivo.
2.  Jornada dos primeiros 10--15 minutos.
3.  Jornada das primeiras 5 entregas, adaptável ao catálogo real.
4.  Modelo de geração de pedidos pelo catálogo real.
5.  Motor centralizado de gatilhos.
6.  Métricas atuais vs. históricas vs. acumuladas.
7.  Expansão do mapa.
8.  Regiões e conexões.
9.  Clientes/destinos.
10. Loja de Utilidades.
11. Catálogo de itens.
12. Inventário.
13. Colocação de móveis/decoração.
14. Economia inicial.
15. Eventos/anúncios de desbloqueio.
16. Progressão persistente.
17. Integração pedidos reais ↔ Phaser.
18. Integração `PlatformScene` apenas com destinos apropriados.
19. Reação a nova planta cadastrada com jogo já avançado.
20. Inventário técnico do jogo antigo e classificação A/B/C/D.
21. Estratégia gradual Canvas → Phaser.
22. Entidades/tabelas adicionais necessárias no backend, sem migrations
    ainda.
23. Estrutura de arquivos Phaser evitando `WorldScene` monolítica.
24. Sistemas que exigem testes antes da implementação.
25. Escopo exato da V1 jogável.
26. Itens explicitamente destinados à V2.
27. Diagrama textual do fluxo completo.
28. Sequência de implementação em pequenos marcos verificáveis.

## Restrições finais

-   Não implementar nada.
-   Não criar migrations.
-   Não alterar banco ou produção.
-   Não apagar o jogo antigo.
-   Não fazer commit/push/deploy nesta tarefa.
-   Não assumir espécies específicas.
-   Não criar catálogo paralelo de plantas.
-   Não depender de `localStorage` para progresso importante.
-   Desbloqueios permanentes não regridem se planta for excluída.
-   Backend continua fonte de verdade de plantas, pedidos, estoque,
    caixa e progressão importante.

Pare após entregar o documento para revisão.

# 26. Olinda real como base do mundo

O mundo deve suportar regiões inspiradas na geografia real de Olinda, sem funcionar como GPS nem reproduzir residências privadas de forma identificável.

A abordagem desejada é híbrida:

```text
DADOS GEOGRÁFICOS REAIS
(ruas, cruzamentos, bairros, áreas públicas)
        +
LANDMARKS PÚBLICOS CURADOS
        +
CONTEÚDO PROCEDURAL DETERMINÍSTICO
(casas fictícias, vegetação, NPCs, decoração)
        +
CONTEÚDO MANUAL
(Novo Hiper, clientes importantes, eventos, plataformas)
        =
OLINDA DE VIDEOGAME
```

Fontes de dados geográficos podem incluir OpenStreetMap e dados públicos do IBGE/Prefeitura, respeitando licenças e atribuições aplicáveis. A etapa técnica deve documentar a origem e licença de cada dataset antes de incorporá-lo ao projeto.

## 26.1 Não depender de mapas online em runtime

Não quero que o jogo dependa de chamadas a APIs de mapas enquanto Bernardo joga.

Preferir pipeline de geração offline/build-time:

```text
OpenStreetMap / IBGE / outras fontes públicas aprovadas
        ↓
importador/processador offline
        ↓
simplificação para gameplay
        ↓
regiões/tiles/JSON próprios do jogo
        ↓
Phaser
```

Isso deve permitir PWA, cache local, carregamento rápido e mundo estável.

## 26.2 Geografia real não significa cópia literal

Preservar quando útil:

- traçado geral de ruas;
- cruzamentos importantes;
- identidade de bairros/regiões;
- praças e espaços públicos;
- landmarks públicos;
- características reconhecíveis como ladeiras, orla ou áreas históricas.

Simplificar para gameplay:

- distâncias;
- número de ruas;
- quarteirões;
- acessos;
- dimensões;
- densidade de construções.

Não reproduzir moradores reais ou transformar casas privadas reais em clientes identificáveis. Casas de clientes e NPCs devem ser fictícias.

## 26.3 Landmarks

O sistema deve permitir landmarks públicos manualmente curados, com representação estilizada, e não necessariamente réplica arquitetônica exata.

Exemplos futuros possíveis incluem pontos públicos reconhecíveis de Olinda, especialmente áreas históricas, praças, orla e outros pontos de referência adequados.

Landmarks devem ser conteúdo especial, não apenas objetos procedurais aleatórios.

## 26.4 Procedural determinístico

O conteúdo procedural não deve mudar a cada abertura do jogo.

Cada região deve poder usar seed/versionamento determinístico, conceitualmente:

```text
seed da região + dados geográficos + versão do gerador
= mesma região gerada
```

Casas fictícias, vegetação, decoração, NPCs ambientais e outros elementos podem ser gerados proceduralmente.

Conteúdo importante deve poder receber overrides manuais.

## 26.5 Regiões reais e progressão

O sistema de regiões deve aceitar metadados opcionais de inspiração geográfica real, sem obrigar todas as regiões a serem literais.

Exemplo conceitual:

```json
{
  "id": "regiao_bairro_novo",
  "realWorld": {
    "municipality": "Olinda",
    "name": "Bairro Novo"
  },
  "unlockRule": "unlock_bairro_novo"
}
```

A ordem de desbloqueio não precisa reproduzir perfeitamente a geografia real. É uma Olinda adaptada para videogame.

## 26.6 Gerador não deve ser construído cedo demais

Não criar agora um grande gerador procedural de Olinda.

Primeiro provar a arquitetura com uma região pequena feita/curada manualmente e uma segunda expansão. Somente depois construir pipeline geográfico/procedural incremental.

---

# 27. Fases de desenvolvimento

Esta seção é obrigatória para controle de escopo.

**Regra geral: executar UMA fase por vez.**

Ao terminar cada fase:

1. executar os testes pertinentes;
2. apresentar o que foi alterado;
3. informar limitações/dívida técnica;
4. parar;
5. aguardar aprovação explícita antes de iniciar a fase seguinte.

Não antecipar trabalho de fases futuras apenas porque a arquitetura já está clara.

## Fase 0 — Documento e inventário técnico

Objetivo: entender antes de alterar.

Entregáveis:

- documento técnico/design solicitado neste arquivo;
- inventário de `src/game/`;
- classificação A/B/C/D dos sistemas antigos;
- inventário de `src/phaser-game/`;
- proposta de modelo de progressão;
- proposta de persistência/backend;
- proposta de regiões;
- proposta de integração Phaser ↔ pedidos;
- proposta de pipeline geográfico futuro;
- lista das fontes geográficas candidatas e suas licenças/atribuições;
- plano de testes;
- divisão refinada das próximas fases.

**Não escrever código de gameplay, migrations ou gerador geográfico nesta fase.**

PARAR PARA REVISÃO.

## Fase 1 — Segurança e testes do backend existente

Objetivo: garantir que a base financeira/transacional esteja segura antes de conectar o jogo real.

Entregáveis mínimos:

- testes de conclusão idempotente de entrega;
- estoque decrementado exatamente uma vez;
- caixa creditado exatamente uma vez;
- rollback em falha parcial;
- banco temporário/isolado para testes;
- revisão da autenticação/senha exibida sem quebrar produção.

Não implementar progressão do mapa ainda.

PARAR PARA REVISÃO.

## Fase 2 — Fundação da progressão persistente

Objetivo: criar apenas o motor de progresso, sem construir o mundo grande.

Implementar, após aprovação do modelo:

- métricas atuais/históricas/acumuladas necessárias;
- regras/gatilhos centralizados;
- desbloqueios `onceOnly`;
- persistência de desbloqueios;
- persistência de eventos vistos;
- API mínima de progresso;
- testes do motor de regras.

Provar com poucos gatilhos de teste, por exemplo cadastro de plantas e entregas, sem criar dezenas de regiões.

PARAR PARA REVISÃO.

## Fase 3 — Primeiro bairro Phaser pequeno

Objetivo: provar o mundo top-down definitivo em Phaser.

Escopo máximo:

- Novo Hiper;
- rua inicial;
- praça;
- 2–3 destinos fictícios;
- uma saída bloqueada;
- Bernardo top-down;
- colisão;
- câmera;
- controles mobile/teclado;
- entrada/saída da loja quando necessário.

Reaproveitar conceitos úteis do Canvas antigo conforme plano aprovado.

Não criar Olinda inteira. Não criar gerador procedural completo.

PARAR PARA TESTE NO CELULAR E REVISÃO.

## Fase 4 — Primeira entrega real ponta a ponta

Objetivo: conectar um pedido real ao jogo.

Fluxo:

```text
pedido real
→ pegar planta
→ sair da Novo Hiper
→ navegar no mapa
→ cliente
→ entregar
→ joinha
→ backend /finish
→ estoque/caixa atualizados uma vez
→ progresso avaliado
```

A primeira entrega deve ser simples, sem plataforma.

Testar idempotência também pela interface/jogo.

PARAR PARA REVISÃO.

## Fase 5 — Primeira expansão do mapa por gatilho

Objetivo: provar que o mundo cresce de verdade.

Implementar somente uma expansão.

Exemplo aprovado posteriormente:

```text
atingiu marco de plantas cadastradas
OU combinação de plantas + entregas
→ evento de desbloqueio
→ nova rua/região torna-se acessível
→ desbloqueio permanece mesmo se planta for excluída
```

Testar persistência após reload/reinício.

PARAR PARA REVISÃO.

## Fase 6 — Loja de Utilidades e economia de itens

Objetivo: dar função ao dinheiro.

Escopo inicial:

- estabelecimento físico no mapa;
- vendedor/interação simples;
- pequeno catálogo de itens;
- compra usando caixa real do Novo Hiper;
- inventário persistente;
- proteção contra compra duplicada/falhas transacionais quando aplicável.

Não criar catálogo enorme.

PARAR PARA REVISÃO.

## Fase 7 — Personalização da Novo Hiper

Objetivo: transformar compras em mudança visual.

Implementar inicialmente poucos itens:

- 1–2 itens posicionáveis;
- 1 melhoria automática/estrutural;
- slots ou grade simples adequada ao celular;
- persistência das posições;
- restauração correta ao abrir em outro dispositivo.

Não construir editor complexo.

PARAR PARA REVISÃO.

## Fase 8 — Primeira entrega com PlatformScene

Objetivo: integrar o protótipo de plataforma ao loop real.

Somente um destino deve usar plataforma inicialmente.

Fluxo:

```text
mapa top-down
→ entrada especial
→ PlatformScene
→ obstáculos sem punição severa
→ cliente
→ entrega real
→ joinha
→ retorno ao mundo
```

Não transformar todas as entregas em plataforma.

PARAR PARA REVISÃO.

## Fase 9 — Pipeline geográfico de Olinda (prova de conceito)

Objetivo: provar a abordagem realista/procedural sem gerar a cidade inteira.

Escopo:

- escolher UMA pequena região pública de Olinda;
- documentar fonte/licença/atribuição dos dados;
- importar ruas/cruzamentos relevantes offline;
- simplificar geometria para gameplay;
- converter para formato interno do jogo;
- adicionar conteúdo procedural determinístico básico;
- permitir overrides manuais;
- comparar resultado com uma região totalmente manual.

Não conectar API de mapas em runtime.

Não gerar Olinda inteira.

PARAR PARA REVISÃO VISUAL E TÉCNICA.

## Fase 10 — Regiões inspiradas em Olinda

Somente se a Fase 9 for aprovada.

Objetivo: usar o pipeline validado para produzir novas regiões progressivamente.

Cada região deve passar por curadoria manual antes de entrar no jogo.

Possíveis elementos:

- traçado simplificado de ruas;
- praças/espaços públicos;
- identidade visual local;
- landmarks públicos selecionados;
- casas/clientes fictícios;
- vegetação e decoração procedural;
- pontos manuais de gameplay.

Adicionar uma região por vez, ligada ao motor de progressão.

PARAR APÓS CADA REGIÃO RELEVANTE.

## Fase 11 — Polimento e conteúdo adicional

Somente após o core loop estar comprovadamente divertido no celular.

Possíveis trabalhos:

- diálogos melhores;
- NPCs ambientais;
- mais itens;
- mais clientes;
- mais eventos;
- melhorias visuais;
- sons/música;
- landmarks adicionais;
- novas PlatformScenes;
- balanceamento econômico;
- otimizações PWA/mobile.

Não usar esta fase para introduzir sistemas fundamentais que deveriam ter sido validados antes.

## V2 — Fora do escopo atual

Continuam explicitamente fora da V1:

- sementes/cultivo complexo;
- sistema profundo de colecionáveis;
- multiplayer;
- economia complexa;
- geração integral de Olinda de uma vez;
- editor livre pixel a pixel;
- dezenas de lojas/sistemas paralelos;
- combate;
- vidas/Game Over;
- cronômetros/ranking por velocidade.

---

# 28. Regra operacional para o Claude Code

Antes de qualquer implementação, informar claramente:

```text
FASE ATUAL:
OBJETIVO:
ARQUIVOS QUE PRETENDE ALTERAR:
TESTES QUE SERÃO EXECUTADOS:
O QUE NÃO SERÁ FEITO NESTA FASE:
```

Depois executar somente a fase aprovada.

Ao terminar, informar:

```text
FASE CONCLUÍDA:
ALTERAÇÕES:
TESTES:
LIMITAÇÕES:
PRÓXIMA FASE PROPOSTA:
```

**Não iniciar a próxima fase sem aprovação explícita.**

---

# 29. Atualização da tarefa de análise

Além dos itens já solicitados anteriormente, o documento técnico da Fase 0 deve responder:

1. Como representar regiões inspiradas em bairros reais de Olinda sem acoplar o jogo a mapas online?
2. Quais dados podem vir de OpenStreetMap, IBGE e outras fontes públicas adequadas?
3. Quais licenças/atribuições precisam ser respeitadas?
4. Qual formato intermediário interno deve representar ruas, cruzamentos e regiões?
5. Como simplificar coordenadas/geometria real para coordenadas de jogo?
6. Como garantir geração procedural determinística?
7. Como aplicar overrides manuais a uma região gerada?
8. Como manter casas/clientes fictícios e evitar reproduzir residências privadas de forma identificável?
9. Como representar landmarks públicos como conteúdo manual/curado?
10. Como uma região gerada entra no mesmo sistema de gatilhos/desbloqueios já especificado?
11. Como versionar uma região gerada para que uma mudança no algoritmo não destrua progresso salvo?
12. Que partes do pipeline podem ser ferramentas de desenvolvimento/build-time e quais realmente precisam existir no runtime?

A resposta deve continuar respeitando a regra principal: **Fase 0 é análise/documentação. Não implementar ainda.**
