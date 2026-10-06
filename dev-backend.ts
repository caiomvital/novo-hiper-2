// Backend isolado para desenvolvimento: apenas a API Express, em 127.0.0.1.
import { app } from './backend/app';

const port = parseInt(process.env.DEV_API_PORT || '4317', 10);
app.listen(port, process.env.DEV_API_BIND || '127.0.0.1', () => {
  console.log(`[Novo Hiper DEV] API em http://127.0.0.1:${port}`);
});
