import 'dotenv/config';
import { createApp } from './app.js';

const port = Number(process.env.PORT) || 4000;
const app = createApp();

app.listen(port, () => {
  console.log(`City Link API listening on http://127.0.0.1:${port}`);
});
