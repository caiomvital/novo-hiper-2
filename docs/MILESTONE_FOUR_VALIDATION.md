# Marco 4 — Primeira venda no bairro

Data: 13/10/2026. Escopo: G01–G07, I01–I08 e K01–K05.
**Concluído na validação técnica: 20/20 itens.**

## Correções

- O histórico do caixa inclui apenas créditos de vendas. Comprar uma melhoria
  diminui o saldo, preserva o total vendido e não aumenta o contador de vendas.
- Cada venda identifica os itens e suas quantidades, cliente, destino congelado
  no pedido, valor recebido e data. Os preços dos itens vêm do pedido original.
- O caixa vazio orienta retirar e entregar a planta na Aventura e explica que
  o dinheiro é de brincadeira, sem cobrança real.
- Finalizar uma entrega tem limite de espera e mensagem de conexão em português.
  A confirmação aparece imediatamente após a resposta oficial; consultar o
  próximo pedido não atrasa a confirmação da venda já registrada.
- Se o servidor gravou a venda e a resposta se perdeu, o jogo consulta o pedido
  oficial e recupera a confirmação. A repetição do endpoint continua idempotente.
- Perder foco ou ocultar a janela cancela movimento e ações pendentes, evitando
  continuar andando depois de alternar para outro aplicativo.

## Limites

A revisão usa navegador automatizado e bancos descartáveis. Não substitui uma
rodada de uso com Bernardo nem a validação final no celular físico do marco 9.
Fotos e nomes das plantas no histórico refletem o cadastro atual; quantidade,
preço recebido, destino e crédito permanecem associados ao pedido original.

## Evidências por item

| Itens | Cenário executado |
| --- | --- |
| G01/G02 | Bernardo, orientação do pedido e animações; setas e WASD nas quatro direções. Toque inicia/solta movimento; perda de foco cancela teclas. Interação por teclado e botão de toque. |
| G03 | Câmera segue e respeita limites; redimensionamento e entrada/saída de tela cheia preservam instância, posição, escala e pedido. |
| G04 | Paredes da loja e de casa, árvore sólida da praça, fonte, margens e barreira impedem atravessar. |
| G05 | Percurso caminhando da loja até a casa do cliente; três destinos com destaque e ação na calçada correta. Revisão das capturas do bairro e do resultado. |
| G06 | Ciclos de entrada/saída e troca rápida de aba conservam uma instância, um canvas e a contagem de listeners; fora do jogo o teclado volta ao uso da página. |
| G07 | Bairro sem pedido continua explorável; não inicia nem finaliza entrega. |
| I01/I02 | Indicador e metros correspondem à casa do cliente em três destinos; casa errada não apresenta entrega nem finaliza o pedido. |
| I03/I04 | Venda de R$ 20 leva estoque 5 → 4, crédito único, pedido/entrega concluídos. Alterar preço para 99 não muda a venda recebida. Resposta lenta, tecla repetida e repetição do finish não duplicam os efeitos. |
| I05 | HUD confirma conclusão/valor, cliente agradece e caixa apresenta resultado legível. |
| I06 | Estoque insuficiente e conexão interrompida antes da gravação preservam pedido/estoque/caixa e permitem repetir; resposta perdida após gravação recupera confirmação oficial. |
| I07 | Destino moderno inexistente não aparece como casa válida, não entrega no ponto antigo e mantém exploração disponível. |
| I08 | Pedidos, Catálogo, Caixa e Entregas refletem a conclusão; recarga conserva estoque e histórico. |
| K01 | API vazia devolve saldo zero; interface vazia orienta como fazer a primeira venda e esclarece dinheiro fictício. |
| K02/K03 | Saldo, total vendido e contagem correspondem aos créditos; histórico identifica planta/quantidade, cliente, destino, valor e data. API também cobre pedido com dois itens. |
| K04 | Compra oficial de melhoria por R$ 60 reduz somente o saldo; não aumenta vendas nem altera faturamento. |
| K05 | Recarga, contexto novo do navegador e saída/login recuperam saldo e histórico sem novo crédito. |

Capturas: [caixa após a venda](evidence/milestone-four/venda-confirmada.png) e
[bairro e colisão](evidence/milestone-four/bairro-validado.png).

## Verificação

- Playwright: **28 cenários distintos aprovados** em seis arquivos, com Chrome,
  API real e bancos descartáveis. As falhas de rede e os atrasos são simulados
  nas requisições do navegador. O caixa vazio usa resposta vazia controlada.
- Backend: **36 testes aprovados** de caixa e transações de entrega.
- Lógica e controles: **47 testes aprovados** em quatro arquivos.
- Tipagem: `npm run lint` aprovado.
- `npm run build` aprovado, com PWA gerado. Permanece somente o aviso de
  tamanho dos bundles.

A suíte ampla usa dados cumulativos e compara os saldos antes/depois de cada
operação. A captura da primeira venda foi registrada em uma rodada nova com
loja vazia. O percurso principal anda pelas ruas; testes de destinos e colisões
posicionam Bernardo por diagnóstico e usam os controles/ações reais a seguir.
A compra de melhoria nesta rodada usa a API oficial para conferir o caixa;
a jornada visual completa de compra e instalação continua no marco 6.

## Publicação

Backup íntegro do banco e das fotos em
`backups/milestone-four/20261013T151220Z/`. Imagem anterior guardada como
`novo-hiper-rollback:before-milestone-four`.

Publicado em https://novohiper.fluxos.dev.br em 13/10/2026. Container saudável;
saúde pública e hashes dos dois bundles JavaScript e de 13 imagens conferidos
contra a compilação local. Service worker contém os assets esperados.

Imagem ativa: `sha256:dfcac80f56b0605eaab72db63f5e3e8e593ec0e6cb80a4a43394b2d552ce46af`.
Banco permaneceu íntegro e com as contagens do backup: 1 planta, 4 pedidos,
3 entregas e 4 transações. Não houve migração de esquema nem operações de teste
no banco de produção.
