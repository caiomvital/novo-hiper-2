import { assertEnvironmentIsSafeForTests } from './helpers/safety';

// Roda uma vez por arquivo de teste, antes de qualquer import do backend.
assertEnvironmentIsSafeForTests();
