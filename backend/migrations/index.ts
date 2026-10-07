import { Migration } from './types';
import { migration001Baseline } from './001_baseline';
import { migration002PlantsDeletedAt } from './002_plants_deleted_at';
import { migration003Sessions } from './003_sessions';
import { migration004OrdersDestination } from './004_orders_destination';
import { migration005ShopUpgrades } from './005_shop_upgrades';
import { migration006Milestones } from './006_milestones';

/** Lista oficial, em ordem. Novas migrations entram SEMPRE no final. */
export const MIGRATIONS: Migration[] = [migration001Baseline, migration002PlantsDeletedAt, migration003Sessions, migration004OrdersDestination, migration005ShopUpgrades, migration006Milestones];
