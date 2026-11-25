# Da planta cadastrada ao bairro — 18/10/2026

A primeira sessão começa no catálogo da própria loja. O cartão de jornada mostra cadastro, pedido, preparo, entrega e cuidado da loja, com uma ação contextual. O nome, a foto, a quantidade e o total do pedido aparecem na Aventura. A vitrine do interior usa as plantas cadastradas, seus preços e seu estoque atual.

A seta indica a Novo Hiper antes da retirada. O resultado da entrega permanece visível durante a orientação de retorno, mesmo quando outro pedido chega. A última entrega também aparece no catálogo, com acesso ao caixa e incentivo a cadastrar outra planta. O botão de continuar abre a Aventura e traz o jogo para a área visível da página.

A sequência é uma orientação de interface derivada dos dados oficiais, sem contadores paralelos, novos marcos, recompensas, bloqueios ou migrações. A retirada e a plataforma não movimentam estoque nem caixa. Confirmar no morador continua sendo a única conclusão financeira do fluxo; pedidos já retirados retomam da entrega após recarregar. O painel explica os efeitos no mesmo estoque e caixa virtual e a ausência de pagamento real.

## Validação executada

- TypeScript: passou antes da compilação.
- 160 testes unitários em 23 arquivos: passaram. Incluem catálogo vazio, estoque vazio, pedido em andamento com catálogo editado, retomada da retirada e orientação pós-entrega.
- `store-journey.orders.isolated.spec.ts`: passou em 2,5 min, com banco descartável e geração automática habilitada. Cadastro via formulário com upload real, nome Manjericão do Bernardo, preço R$ 150 e três unidades; pedido automático para a planta; mesma foto na orientação e na vitrine; retirada sem movimentação; recarga mantendo a entrega; percurso completo por teclado; chegada sem crédito; confirmação no morador; repetição da interação sem duplicar a venda; estoque final de duas unidades; compra de placa por R$ 60, instalação e saldo de R$ 90; registro da venda no catálogo e abertura do caixa. Nenhum erro de JavaScript. Uma primeira execução foi interrompida pelo terminal antes do final; a repetição completa passou.
- Regressão `shop-guide.routes.isolated.spec.ts` e `startup.routes.isolated.spec.ts`: três testes passaram em 2,4 min. Compra e instalação com orientação, cancelamento restaurando o cliente, abandono da plataforma preservando pedido/estoque e abertura com CDNs bloqueados, incluindo mapa sob demanda.
- Evidências: `docs/evidence/store-journey/01-comeco.png` até `05-loja-melhorada.png`.

Os testes usam navegador com toque emulado; câmera física, Android real e avaliação da clareza com Bernardo continuam sendo verificações manuais.

## Publicação conferida

- URL: https://novohiper.fluxos.dev.br
- Imagem saudável: `sha256:6af2c457452967a3455091c07eda8ca0295a9aaab168a7278c882c847a31900a`.
- Backup: `backups/store-journey/20261018T171745Z/`.
- Reversão: `novo-hiper-rollback:before-store-journey`.
- Integridade SQLite ok; antes/depois: 1 planta, 21 pedidos, 20 entregas, 22 transações de caixa.
- Índice, service worker e 32 assets públicos conferidos byte a byte; nove bundles com compressão gzip/Brotli verificada; marcadores da jornada, vitrine, foto e resultado da entrega presentes.
- Compilações local e Docker passaram, com 50 arquivos idênticos. TypeScript final passou após a compilação.
- Precache: 51 entradas, 4966,72 KiB. Código inicial: 394,52 kB sem compressão, aproximadamente 114,24 kB gzip. Fontes locais e mapa sob demanda preservados.
- Abertura pública no Chrome desktop, perfil novo e sem service worker: login visível em 1153 ms com rede normal; 483 ms abortando CDNs; 573 ms com atraso simulado de 8 s nos CDNs, que já não são solicitados na abertura. Medições são amostras, não garantia de tempo para todos os dispositivos.
- Abas antigas podem precisar de **Atualizar aplicativo**. Nenhum dado foi reiniciado e não houve migração de banco.
