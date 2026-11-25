# Jornada jogável — validação

## Comportamento entregue

- A orientação da Aventura apresenta cadastro, retirada, percurso, entrega e compra/instalação de melhorias conforme o estado real.
- Com um pedido retirado, “Partir para entrega” abre a plataforma com planta e cliente. Ao concluir, “Ir até o cliente” confere o pedido no servidor e posiciona Bernardo junto à casa oficial.
- A venda continua exigindo a confirmação de entrega. A chegada não altera caixa nem estoque.
- Abandonar preserva o pedido; falha de conexão permite repetir a conferência ou sair. Um pedido concluído em outra aba bloqueia a chegada.
- A conquista oficial `bairro_vivo` abre a celebração do primeiro arco. Confirmar salva um reconhecimento idempotente no servidor; recarregar não repete o aviso. Continuar jogando permanece disponível.
- Plataforma é o caminho principal sugerido; entrega direta pelo bairro permanece disponível. Sem pedido retirado, a plataforma é treino. Percursos variados e nova região continuam futuros.

## Verificação

TypeScript e 134 testes unitários passaram. A suíte completa do backend passou: 301 testes em 15 arquivos (inclui migrations, progressão e confirmação do arco).

Cinco cenários de navegador passaram em tela de 480 × 500 com toque: percurso real e venda única; abandono; pedido alterado em outra aba; falha de conexão com repetição; celebração com recarga. O cenário de outra aba excedeu o limite inicial durante a saída com compilações concorrentes; repetido isoladamente, passou em 35 segundos. O limite da suíte foi ajustado para o navegador WebGL por software.

Evidências: [entrega após plataforma](evidence/game-journey/entrega-apos-plataforma.png) e [primeiro arco](evidence/game-journey/primeiro-arco.png).

A validação usa bancos descartáveis. O teste físico no Android continua a cargo do usuário; câmera, teclado nativo e instalação no sistema não foram confirmados por emulação.

## Publicação e retorno

Backup consistente, integridade `ok`: `backups/game-journey/20261014T182957Z/`, com SQLite e uploads. Contagens no backup imediatamente anterior à publicação: 1 planta, 9 pedidos, 8 entregas e 9 transações. O primeiro backup da preparação permanece em `20261014T133333Z/`; como houve uso do jogo nesse intervalo, um novo backup foi feito antes de trocar o container.

Migration 7 adiciona apenas `story_acknowledgements`. Retorno à interface anterior: imagem `novo-hiper-rollback:before-game-journey-compatible`, que mantém backend compatível com schema 7 e os arquivos anteriores da interface. Não usar a imagem de schema 6 diretamente sobre o banco atualizado.

Publicado em 14/10/2026: https://novohiper.fluxos.dev.br . Imagem ativa `sha256:cd11bc66b82b133f1b0f4237beefc66561eac43a084e4eeae1321d2f00ff7fe4`, container saudável, API `ok`. HTML, scripts, CSS, service worker e 13 imagens públicas conferidos por hash. Banco na migration 7, integridade `ok`, contagens idênticas ao backup imediatamente anterior.
