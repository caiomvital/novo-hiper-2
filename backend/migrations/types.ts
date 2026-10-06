export interface Migration {
  /** Inteiro estritamente crescente, sem lacunas, começando em 1. */
  version: number;
  /** Nome curto e estável (aparece em schema_migrations). */
  name: string;
  /**
   * SQL da migration (várias instruções). Executado DENTRO de uma transação (BEGIN IMMEDIATE):
   * se qualquer instrução falhar, nada é aplicado. O texto é "congelado" por checksum: depois de
   * aplicada em algum banco, NÃO edite — crie uma nova migration.
   */
  sql: string;
}
