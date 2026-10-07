import { Migration } from './types';
import { migration001Baseline } from './001_baseline';
import { migration002PlantsDeletedAt } from './002_plants_deleted_at';
import { migration003Sessions } from './003_sessions';
import { migration004OrdersDestination } from './004_orders_destination';

/** Lista oficial, em ordem. Novas migrations entram SEMPRE no final. */
export const MIGRATIONS: Migration[] = [migration001Baseline, migration002PlantsDeletedAt, migration003Sessions, migration004OrdersDestination];
