import { DatabaseSync } from 'node:sqlite';

/** Adaptador mínimo com a mesma forma do DbWrapper do backend, para testar o runner de migrations isoladamente. */
export function openRawDb(file: string) {
  const raw = new DatabaseSync(file);
  raw.exec('PRAGMA foreign_keys = ON;');
  const norm = (p: any[]) => (p.length === 1 && Array.isArray(p[0]) ? p[0] : p);
  const wrapper = {
    raw,
    async all(sql: string, ...p: any[]) {
      const a = norm(p);
      return raw.prepare(sql).all(...a).map((r: any) => ({ ...r }));
    },
    async get(sql: string, ...p: any[]) {
      const a = norm(p);
      const r = raw.prepare(sql).get(...a);
      return r ? { ...r } : undefined;
    },
    async run(sql: string, ...p: any[]) {
      const a = norm(p);
      const t = sql.trim().toUpperCase();
      if (a.length === 0 && (t.startsWith('BEGIN') || t.startsWith('COMMIT') || t.startsWith('ROLLBACK') || t.startsWith('PRAGMA'))) {
        raw.exec(sql);
        return { changes: 0, lastInsertRowid: 0 };
      }
      const r = raw.prepare(sql).run(...a);
      return { changes: Number(r.changes), lastInsertRowid: r.lastInsertRowid };
    },
    async exec(sql: string) {
      raw.exec(sql);
    },
  };
  return wrapper;
}
