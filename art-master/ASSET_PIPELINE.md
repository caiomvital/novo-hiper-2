# ASSET_PIPELINE.md — Fluxo Oficial de Producao

## Filosofia LEGO
Todo asset deve responder: 'Quantas vezes consigo reutilizar isso?'

## Bernardo como Rig
Divisao modular: Corpo, Cabeca, Oculos, Mochila, Bracos, Maos, Poses e Anchors.
Mao Anchor: posicao (X, Y) para encaixe modular de vasos e ferramentas.
Pe Anchor: ponto de pivot de colisao e sombra.

## Plantas e Vasos
Ordem de producao: Bernardo -> Plantas -> Vasos.
Planta: Seedling, Pequena, Media, Grande, Florida, Seca, UI.
Vaso desmontavel: Base, Borda, Terra, Sombra.

## Etapas de Execucao
1. Conceito & Modularidade
2. Quadro Parado (Idle) + Ancoragem ao Bernardo
3. Validacao de Contexto
4. Spritesheet + Atlas JSON para Phaser 3
