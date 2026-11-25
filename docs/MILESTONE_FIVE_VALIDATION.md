# Marco 5 — Continuidade e recuperação

Data: 13/10/2026. Escopo: P01–P07 da [checklist](USER_JOURNEY_CHECKLIST.md).
**Concluído na validação técnica: 7/7 itens.**

## Correções

- Plantas, pedidos, caixa e entregas passam a ser publicados juntos após as
  quatro consultas oficiais. Uma consulta incompleta conserva a última versão
  inteira; uma resposta iniciada antes de uma escrita é descartada.
- A loja atualiza ao reconectar, retornar à janela e receber aviso de outra aba.
  Enquanto visível, verifica os dados a cada 10 segundos. Abas compartilham
  somente um aviso de mudança; os dados continuam vindo da API.
- Leituras têm limite de espera. A faixa de conexão informa que os dados podem
  estar desatualizados quando não puderem ser conferidos. Offline permite
  consultar a sessão já aberta; salvar, entregar e comprar dependem do servidor.
- A sincronização limpa listas locais quando o servidor devolve listas vazias.
- No mapa clássico, a confirmação e os efeitos de sucesso aguardam a API.
  A interface não cria venda, baixa estoque ou credita caixa antecipadamente.
  Valor e quantidade vêm do pedido confirmado, inclusive após editar a planta.
- O antigo mini-jogo 2D também aguarda a confirmação antes de celebrar e retirar
  o vaso das mãos; a Aventura atual continua sendo o caminho principal.
- Na Loja de Utilidades, perda de resposta após gravar compra/instalação é
  conferida no servidor. Falhas permitem repetir e usam mensagem de conexão
  em português. Estado e saldo se atualizam ao retornar ou mudar em outra aba.
- A consulta periódica da Aventura não sobrescreve uma retirada confirmada com
  uma resposta anterior. Consultas de pedidos são coordenadas com a leitura
  compartilhada das outras telas.

## Evidências por item

| Item | Cenário |
| --- | --- |
| P01 | Compra recusada e entrega pelo mapa recusada conservam dados e permitem repetir. Cadastro com resposta perdida conserva o formulário e a mesma identificação. Preparo/retirada recusados e entrega recusada continuam recuperáveis. |
| P02 | Cadastro repetido após resposta perdida gera uma planta; compra após gravação sem resposta recupera confirmação e um débito. Venda lenta e falha antes/depois da gravação não deixam baixa/crédito duplicados. Atualização incompleta não publica estado parcial. |
| P03 | Consulta offline conserva catálogo; salvar falha sem mudar o servidor. Alteração feita enquanto o navegador está offline aparece após reconectar, sem recarga manual. |
| P04 | Servidor realmente vazio substitui cache antigo de plantas, pedidos, entregas e caixa; dados obsoletos não voltam a aparecer. |
| P05 | Duas abas refletem edição do catálogo. Retirada, finalização e compra simultâneas usam o mesmo registro, um crédito/débito e uma baixa. A conferência visual do caixa ocorre separadamente da conferência pela API. |
| P06 | Contexto novo, sem armazenamento anterior, recupera planta, fotografia, pedido, histórico, saldo e melhoria instalada. |
| P07 | Novo processo recupera todos os dados. Backup de SQLite e uploads é restaurado após alteração e remoção de foto no ambiente descartável; igualdade dos dados, integridade, hash da foto e idempotência continuam válidos. |

## Ensaio de reinício e restauração

Executado com `node scripts/verify-recovery.mjs`, exclusivamente em um diretório
novo de `/tmp`, removido ao terminar. O script sobe e encerra processos reais da
API, cria fotografia/pedidos/venda/melhoria, usa o backup consistente do SQLite,
copia os uploads e restaura ambos com o processo encerrado.

Resultado: estoque 3, saldo R$ 40, total vendido R$ 100, pedido pronto pendente
preservado, melhoria instalada preservada e fotografia idêntica antes/depois.
Repetir a venda restaurada devolve `alreadyApplied: true` sem alterar os dados.
Hash da fotografia:
`8c8b2ca78707700750e4e1a9913d7e0384abadc3a1d2bd5d587237b22aa09eaf`.

## Limites

A validação usa Chrome automatizado, API real e bancos/arquivos descartáveis.
As falhas de requisição e os atrasos são controlados no navegador. Não houve
rodada de uso com Bernardo nem restauração sobre a loja de produção.

A atualização entre abas não é instantânea por WebSocket: usa aviso local,
retorno à janela e consultas a cada 10 segundos. Em outro dispositivo, os dados
oficiais são recuperados pela API. Sem conexão, uma sessão já aberta mantém
consulta; recarregar exige que o servidor confirme novamente a sessão.
Endereços personalizados do mapa continuam locais, conforme o marco 7.

## Verificação

- **38 cenários distintos de navegador aprovados**, entre recuperação, mapa,
  sessão, catálogo, retirada, venda e ciclo de entrada/saída da Aventura.
  Os seis novos cenários de recuperação também passaram com banco próprio,
  sem interferir nos testes de compras da loja.
- **299 cenários do backend aprovados**. Um teste de inicialização excedeu os
  20 segundos ao competir com o navegador; repetido sozinho, passou em 3,6 s,
  sem alteração do teste ou do código de autenticação. Os outros 298 passaram
  na rodada ampla.
- **28 testes de lógica/controles/sincronização aprovados**. Cobrem consulta
  incompleta, resposta anterior à escrita, resposta após logout e desmontagem.
- Ensaio real de reinício/restauração aprovado.
- `npm run lint` e `npm run build` aprovados, com PWA gerado.
  Permanece o aviso de tamanho dos bundles.

Captura: [consulta offline e aviso de conexão](evidence/milestone-five/consulta-offline.png).

## Publicação

Backup íntegro do banco e uploads em
`backups/milestone-five/20261013T171743Z/`.
Imagem anterior preservada como `novo-hiper-rollback:before-milestone-five`.

Publicado em https://novohiper.fluxos.dev.br em 13/10/2026. Container saudável;
HTML, dois bundles JavaScript, CSS, service worker e 13 imagens conferidos por
hash contra a compilação local.

Imagem ativa:
`sha256:f1f5c9388b9cdb72393761aa1f0b22088683569bc9faf2c4987ae95e4ab8cd09`.
Banco permaneceu íntegro, com as contagens do backup: 1 planta, 4 pedidos,
3 entregas e 4 transações. Não houve migração de esquema nem operações de teste
no banco de produção.
