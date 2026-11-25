import type { Migration } from './types';
export const migration008ResidentStories: Migration = {
  version: 8,
  name: 'resident_stories',
  sql: `CREATE TABLE IF NOT EXISTS resident_stories (
    id TEXT PRIMARY KEY,
    order_id TEXT UNIQUE REFERENCES orders(id),
    plant_name TEXT,
    plant_photo_url TEXT,
    accepted_at INTEGER NOT NULL,
    acknowledged_at INTEGER
  );`,
};
