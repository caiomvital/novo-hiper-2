# Volta orientada para melhorar a loja

## Comportamento

- Depois da entrega, “Melhorar minha loja” aponta a direção e a distância para a Loja de Utilidades.
- Depois de uma compra confirmada, “Voltar à Novo Hiper para instalar” fecha o painel e orienta até a loja. A mesma ação está disponível na orientação quando há uma melhoria pendente.
- O jogador pode cancelar a orientação. O pedido permanece ativo; a seta volta ao cliente quando aplicável.
- Chegar à Novo Hiper ou abrir as utilidades limpa o destino da orientação. Entrar na plataforma também limpa esse destino.
- Com três melhorias instaladas, a volta aponta para a Novo Hiper para continuar cuidando das plantas, sem sugerir uma quarta melhoria inexistente.

É direção em linha reta, sem navegação automática: o jogador segue as ruas e usa os controles normais. Não há teleporte, nova recompensa ou alteração de estoque, caixa ou pedido. A escolha da orientação é local à sessão da Aventura.

## Verificação

TypeScript e 138 testes unitários passaram. O teste de navegador em tela de 480 × 500 com toque habilitado passou pelo ciclo completo: entrega, orientação/cancelamento, compra, volta orientada, instalação e limpeza da seta. Confirmou que orientar não muda a posição nem o saldo e que só a compra debita seu preço oficial.

Evidências: [volta às utilidades](evidence/shop-guide/volta-as-utilidades.png) e [volta para instalar](evidence/shop-guide/volta-para-instalar.png). A validação usa banco descartável no projeto Playwright `routes`; não usa dados de produção. Android físico continua pendente.

O segundo cenário passou: orientar com pedido ativo, cancelar e recuperar a seta do cliente, entrar na plataforma e abandoná-la preservando o pedido, o saldo e as cinco unidades em estoque. Não houve teste físico de Android nesta etapa.

Não há alteração do backend nem migration nova; a última suíte completa do servidor passou com 301 testes na publicação da jornada.

## Publicação

Publicado em 14/10/2026 em https://novohiper.fluxos.dev.br . Imagem ativa `sha256:f9ed76a6b5b006a4679b3efc440aa7d4f074240457fbca2f1ea3bcf036d5fcfb`, container saudável, API pública `ok`. HTML, JavaScript, CSS, service worker e 13 imagens conferidos por hash.

Banco na migration 7, integridade `ok`, contagens preservadas: uma planta, nove pedidos, oito entregas e nove transações. Backup imediatamente anterior em `backups/shop-guide/20261014T194308Z/`; retorno disponível por `novo-hiper-rollback:before-shop-guide`, compatível com o mesmo schema.
