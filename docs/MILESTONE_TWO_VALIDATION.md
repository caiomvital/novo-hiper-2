# Marco 2 — Catálogo, fotos e estoque

Data: 12/10/2026. **Implementado e validado tecnicamente: 20 dos 21 itens**.
D02 permanece aberto para conferência da câmera em um celular físico.
Escopo: C01–C07, D01–D06 e E01–E08 da [checklist](USER_JOURNEY_CHECKLIST.md).

## Comportamento resultante

Cadastro e edição só alteram o catálogo e mostram sucesso depois de a API
confirmar. Falhas mantêm o formulário preenchido para nova tentativa. Durante
o envio, os campos e botões ficam bloqueados; envios repetidos são ignorados.

Cada novo formulário tem um identificador estável. Se o servidor salvar uma
planta e a resposta se perder, repetir o mesmo cadastro retorna a planta já
criada. Reutilizar o identificador com dados diferentes retorna 409, sem
sobrescrever ou recriar uma planta removida.

Formulário e servidor compartilham as regras de preço e quantidade: vírgula ou
ponto para centavos, até duas casas decimais e estoque inteiro não negativo.
Preço zero e estoque zero são válidos; valores inválidos não são truncados.

Fotos escolhidas no dispositivo são verificadas antes do upload. Formatos
aceitos: JPG, PNG e WEBP, até 5 MB. O servidor também verifica formato e cabeçalho
do arquivo. Uma falha no envio não é substituída silenciosamente por uma cópia
local. A imagem só entra no formulário após confirmação do upload. Fechar o
formulário impede que uma resposta antiga substitua a foto de um novo cadastro.

Trocar a foto abre a galeria; as ações da foto ficam visíveis em telas pequenas.
Escolher uma imagem do acervo preserva a quantidade já informada. Foto
indisponível mostra uma alternativa legível no catálogo, formulário e detalhes.

Excluir aguarda confirmação do servidor, bloqueia repetições e informa recusas.
Cancelar mantém a planta. Pedidos abertos impedem exclusão; o formulário explica
que o preço de pedidos recebidos é preservado e que falta de estoque exige
reposição. Remover uma planta preserva vendas, entregas e histórico. As cargas
do catálogo respeitam listas vazias do servidor.

## Execução por item

| Itens | Resultado e evidência |
| --- | --- |
| C01/C02 | Cadastro com nome, foto, preço e estoque; campos opcionais preenchidos e vazios persistem. |
| C03 | Nome vazio, preço inválido/negativo, estoque inválido/negativo e ausência de foto recusados com mensagem específica. |
| C04/C05 | Centavos com vírgula/ponto, valores zero e rejeição de quantidade fracionária conferidos no formulário e API. |
| C06 | Resposta lenta, envio repetido, falha antes de salvar e resposta perdida após salvar; catálogo só confirma sucesso após API e não duplica plantas. |
| C07 | Cancelar/fechar não cadastra uma planta; upload atrasado não invade outro formulário. |
| D01 | Botões de galeria/troca de foto abrem o seletor; upload, prévia e bytes da imagem salva conferidos. |
| D02 | **Pendente no aparelho físico.** Emulação validou captura traseira, seletor, cancelamento e cadastro com arquivo fornecido. |
| D03 | Acervo associa a URL da imagem e a espécie escolhidas; seleção preserva estoque e preço zero. |
| D04 | Arquivo inválido/falso, limite de 5 MB e falha de envio orientam recuperação; orientação de permissões disponível junto à câmera. |
| D05 | Upload recusado não preenche foto falsa; selecionar novamente permite salvar uma imagem persistida. |
| D06 | Fotos carregam após recarga e nova sessão; arquivo continua após reiniciar a API; imagem indisponível não quebra catálogo/detalhes. |
| E01/E02 | Busca por nome e espécie, resultado vazio, limpeza da busca e detalhes coerentes com preço, foto, cuidados e estoque. |
| E03 | Nome, preço, foto e estoque editados persistem após recarga e saída/entrada; edição recusada mantém a versão confirmada. |
| E04/E05 | Estoque zero/baixo identificado; orientação para editar e repor; reposição libera pedido antes bloqueado, sem aceitar valores negativos. |
| E06/E07 | Cancelar exclusão mantém planta; servidor bloqueia pedido aberto; falha não remove visualmente; venda/histórico preservados após remoção permitida. |
| E08 | Remover a última planta deixa catálogo vazio após recarregar, sem recuperar cópia antiga. |

## Testes e limites

- `npm run lint`: aprovado.
- `npm run build`: aprovado, incluindo PWA; permanece o aviso de tamanho dos bundles.
- `npm run test:backend`: **297 testes aprovados em 14 arquivos**.
- `tests/e2e/milestone-two.spec.ts`: **13 cenários distintos aprovados**, em
  rodadas focadas. Os cenários afetados pelos ajustes finais da galeria/acervo
  foram repetidos. Um teste inicialmente consultava `deliverable` no endpoint
  de detalhe, que não oferece esse campo; passou após usar a listagem oficial.
  Uma rodada concorrente com as compilações excedeu o prazo; o cenário de
  cadastro/edição/nova sessão passou ao ser repetido isoladamente, em 23,9 segundos.

Os testes usam Chromium, API real, bancos e uploads descartáveis. Falhas de rede,
respostas lentas e erros são simulados explicitamente no navegador. Imagens
externas do acervo são substituídas por uma imagem controlada nos E2E; isso
verifica seleção e associação, sem atestar disponibilidade permanente do CDN.
As imagens enviadas são arquivos de teste, comparados byte a byte; não são
fotografias de plantas reais. [Captura do catálogo](evidence/milestone-two/catalogo-confirmado.png).

**D02 não foi marcado como aprovado:** um navegador emulado não comprova a câmera
nem as permissões do Android/iOS. Para fechar o item no aparelho, abrir um novo
cadastro, usar Câmera, fotografar e salvar; recarregar e conferir a imagem.
Repetir cancelando a câmera e usando a Galeria; conferir orientação quando o
sistema negar a permissão. Usar uma planta de teste com estoque zero para não
gerar pedidos durante essa conferência.

## Publicação

- Backup íntegro do banco e uploads: `backups/milestone-two/20261012T130049Z/`.
- Rollback: `novo-hiper-rollback:before-milestone-two`.
- Imagem construída: `sha256:0ac7409638ef5752768177059cf24d2a5dd256dd4ac479de8ac416a50ff7b3f7`.
- Nenhuma migração de banco necessária; volumes de dados e fotografias preservados.
- Publicado em `https://novohiper.fluxos.dev.br`: container `healthy`, API
  saudável, bundles e 13 imagens conferidos contra o build local, service worker
  atualizado. Banco íntegro e contagens de plantas, pedidos, entregas e caixa
  iguais ao backup. Não foi usado login de produção para executar testes.

## Continuidade

Marco 3: pedido e retirada no interior da loja. A única pendência do marco 2
é D02 no aparelho físico; não há falha P0 aberta no catálogo validado.
