# Marco 1 — Acesso e orientação inicial

Data: 12/10/2026. Resultado: **concluído na validação técnica e revisão textual**.
Escopo: A01–A06 e B01–B06 da [checklist](USER_JOURNEY_CHECKLIST.md).

## Correções realizadas

- Login bloqueia envios repetidos, mostra “Entrando…” e permite tentar novamente
  após erro de credencial ou conexão. Requisições de acesso têm limite de 10 segundos.
- Sair aguarda a invalidação da sessão no servidor. Falhas são informadas e
  permitem repetir a saída; tentativas simultâneas não duplicam a chamada.
- A saída concluída fecha os formulários/painéis e retorna ao catálogo para a
  próxima entrada. O cookie antigo não permite acessar a API.
- A página inicial orienta o cadastro e a Aventura com duas ações diretas.
  Textos de entrada, catálogo, pedidos, entregas e conexão foram simplificados.
- O Caixa recebe a lista de plantas necessária para renderizar sem quebrar a tela.
- A carga inicial respeita listas vazias do servidor, removendo cópias antigas
  de plantas, pedidos e entregas da interface após recarregar.
- A Aventura distingue ausência de plantas e de estoque mesmo quando a geração
  automática está desativada no ambiente de teste.

## Evidências por item

| Itens | Execução / resultado |
| --- | --- |
| A01 | Login real em API isolada; acesso às telas e recuperação de uma planta do servidor. |
| A02 | Senha incorreta mantém o login, mostra erro e aceita uma nova tentativa válida. |
| A03 | Campos vazios, envio repetido com resposta retida e falha de conexão; uma chamada por envio e recuperação do formulário. |
| A04 | Reload e novo contexto de navegador restaurado com cookie persistente; sessão válida recupera os dados oficiais. |
| A05 | Perda de sessão provoca 401 e retorno ao login; operação protegida é recusada e os dados locais são preservados. Expiração real e revogação cobertas no backend. |
| A06 | Saída real invalida cookie; recarga, voltar e reutilização do cookie antigo não reabrem acesso. Saída lenta/falha também executada. |
| B01 | Página inicial apresenta “Cadastrar planta” e “Jogar Aventura”. |
| B02 | Catálogo vazio abre o formulário da primeira planta; cancelar retorna à loja. |
| B03 | Pedidos sem catálogo orientam cadastrar plantas primeiro. |
| B04 | Jogo carregado nos três estados: sem plantas, plantas sem estoque e estoque disponível sem pedido. Mensagens conferidas no HUD. |
| B05 | Navegação entre Catálogo, Pedidos, Entregas, Aventura e Caixa sem erros de execução no navegador. |
| B06 | Revisão textual com frases curtas, ações concretas e explicação do caixa de brincadeira; termos técnicos retirados dos avisos de conexão. |

As execuções usam Chromium e a API real com SQLite descartável em `/tmp`.
Resposta lenta, falha de conexão e falha de logout são simuladas no navegador;
o restante usa os endpoints reais. A geração automática fica desativada para
manter controlado o estado sem pedidos. Nenhum cadastro, exclusão ou entrega
de teste foi realizado no banco de produção.

**Limites:** B06 foi aprovado por revisão editorial, sem uma sessão de uso com
Bernardo. A04 restaura cookies/armazenamento em novo contexto de navegador; não
simula reinício do sistema operacional. Celular, PWA instalado e funcionamento
offline completo pertencem ao marco 9.

## Verificação executada

- `npm run lint`: aprovado.
- `npm run build`: aprovado; geração PWA concluída. Permanece o aviso de tamanho
  dos bundles, que não impede a compilação.
- `npm run test:backend -- tests/backend/auth.test.ts`: **44 testes aprovados**.
- `npx playwright test tests/e2e/auth.spec.ts --project=general`: **7 aprovados**.
- `npx playwright test tests/e2e/milestone-one.spec.ts --project=general`:
  **6 aprovados**. A04 foi depois ampliado para restaurar a sessão em novo contexto
  e passou na conferência final junto com seis cenários existentes de autenticação.

Na primeira rodada, o teste de navegação foi interrompido durante alterações
com recarga automática do Vite. A rodada seguinte, com o código estável,
concluiu os seis cenários. Não ficou falha técnica aberta no escopo do marco.

Capturas preservadas: [loja e orientação](evidence/milestone-one/loja-orientacao.png)
e [Aventura sem plantas](evidence/milestone-one/aventura-sem-plantas.png).
A planta usada na captura é um dado descartável com caminho de foto de teste;
a validação de fotografias pertence ao marco 2.

## Publicação

- Backup íntegro do banco e uploads:
  `backups/milestone-one/20261012T115837Z/`.
- Imagem anterior preservada em `novo-hiper-rollback:before-milestone-one`.
- Imagem construída:
  `sha256:c9b14d249b6d03117326b630b77a6744c5b33a4e4eb57e95e9f5c86ce262e95b`.
- Implantação preserva os volumes `data` e `uploads`.
- Publicado em `https://novohiper.fluxos.dev.br`: API saudável, container
  `healthy`, bundles e 13 imagens conferidos contra o build local. Service worker
  atualizado. Banco íntegro e contagens de plantas, pedidos, entregas e caixa
  iguais ao backup. Não foi realizado login com a credencial de produção.

## Próximo marco

Marco 2: cadastro, fotografias, edição, busca, estoque e exclusão. As alterações
na carga inicial antecipam parte da correção de listas vazias; E08 e P04 seguem
abertos até a execução completa de seus cenários.
