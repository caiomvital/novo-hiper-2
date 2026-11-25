import type { Migration } from './types';
export const migration007StoryAcknowledgements: Migration = {
  version: 7,
  name: 'story_acknowledgements',
  sql: `CREATE TABLE IF NOT EXISTS story_acknowledgements (
    id TEXT PRIMARY KEY,
    seen_at INTEGER NOT NULL
  );`,
};
