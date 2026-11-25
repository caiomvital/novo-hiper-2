/** História única: sem espécie obrigatória, recompensa extra ou contagem paralela de entregas. */
export const MARIA_STORY_ID = 'cantinho_maria';
export const MARIA_CUSTOMER_ID = 'cust_dona_maria';
export const MARIA_STORY_TITLE = 'O cantinho de Dona Maria';
export interface ResidentStory {
  id: typeof MARIA_STORY_ID;
  status: 'available' | 'waiting' | 'ordered' | 'completed';
  orderId: string | null;
  destinationId: string;
  plantName: string | null;
  plantPhotoUrl: string | null;
  completedAt: number | null;
  acknowledged: boolean;
}
