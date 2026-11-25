import type { DbWrapper } from '../db';
import { ROSTER } from '../../src/shared/roster';
import { MARIA_CUSTOMER_ID, MARIA_STORY_ID, type ResidentStory } from '../../src/shared/residentStory';

export async function readResidentStory(db: DbWrapper): Promise<ResidentStory> {
  const row = await db.get(`SELECT s.*, o.status AS order_status, o.destination_id, o.updated_at
    FROM resident_stories s LEFT JOIN orders o ON o.id = s.order_id WHERE s.id = ?`, MARIA_STORY_ID);
  const completed = row?.order_status === 'entregue';
  return {
    id: MARIA_STORY_ID,
    status: !row ? 'available' : !row.order_id ? 'waiting' : completed ? 'completed' : 'ordered',
    orderId: row?.order_id ?? null,
    destinationId: row?.destination_id ?? ROSTER.find(r => r.id === MARIA_CUSTOMER_ID)!.destinationId,
    plantName: row?.plant_name ?? null,
    plantPhotoUrl: row?.plant_photo_url ?? null,
    completedAt: completed ? row.updated_at : null,
    acknowledged: Boolean(row?.acknowledged_at),
  };
}
