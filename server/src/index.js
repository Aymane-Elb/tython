import pg from 'pg';
import { readFile } from 'node:fs/promises';
import { createApp } from './app.js';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL manque. Copiez server/.env.example vers server/.env.');
  process.exit(1);
}

const db = new pg.Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
db.on('error', (error) => console.error('Erreur PostgreSQL :', error.message));

try {
  await db.query(await readFile(new URL('./schema.sql', import.meta.url), 'utf8'));
  const port = Number(process.env.PORT || 3001);
  const host = process.env.HOST || '127.0.0.1';
  const server = createApp(db).listen(port, host, () => {
    console.log(`Application / API : http://${host}:${port}`);
  });
  server.on('error', async (error) => {
    console.error('Démarrage impossible :', error.message);
    await db.end();
    process.exitCode = 1;
  });
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => {
      server.close(async () => { await db.end(); });
    });
  }
} catch (error) {
  console.error('Connexion à PostgreSQL impossible :', error.message);
  await db.end();
  process.exitCode = 1;
}
