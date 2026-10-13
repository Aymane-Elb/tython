import express from 'express';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export function createApp(db) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '10kb' }));

  app.get('/api/health', async (_req, res) => {
    await db.query('SELECT 1');
    res.json({ status: 'ok' });
  });

  app.get('/api/tasks', async (_req, res) => {
    const { rows } = await db.query('SELECT * FROM tasks ORDER BY created_at DESC, id DESC');
    res.json(rows);
  });

  app.post('/api/tasks', async (req, res) => {
    const title = req.body?.title;
    if (typeof title !== 'string' || !title.trim() || title.trim().length > 200) {
      return res.status(400).json({ error: 'Le titre doit contenir entre 1 et 200 caractères.' });
    }
    const { rows } = await db.query('INSERT INTO tasks (title) VALUES ($1) RETURNING *', [title.trim()]);
    res.status(201).json(rows[0]);
  });

  app.param('id', (req, res, next, id) => {
    if (!/^[1-9]\d*$/.test(id) || Number(id) > 2147483647) {
      return res.status(400).json({ error: 'Identifiant invalide.' });
    }
    next();
  });

  app.patch('/api/tasks/:id', async (req, res) => {
    if (typeof req.body?.completed !== 'boolean') {
      return res.status(400).json({ error: 'Le statut doit être un booléen.' });
    }
    const { rows } = await db.query('UPDATE tasks SET completed = $1 WHERE id = $2 RETURNING *', [req.body.completed, req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Tâche introuvable.' });
    res.json(rows[0]);
  });

  app.delete('/api/tasks/:id', async (req, res) => {
    const { rowCount } = await db.query('DELETE FROM tasks WHERE id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Tâche introuvable.' });
    res.status(204).end();
  });

  app.use('/api', (_req, res) => res.status(404).json({ error: 'Route introuvable.' }));

  const dist = fileURLToPath(new URL('../../client/dist/', import.meta.url));
  if (existsSync(dist)) {
    app.use(express.static(dist));
    app.get('/{*path}', (_req, res) => res.sendFile(`${dist}/index.html`));
  }

  app.use((error, _req, res, _next) => {
    if (error.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON invalide.' });
    if (error.type === 'entity.too.large') return res.status(413).json({ error: 'Requête trop volumineuse.' });
    console.error(error);
    res.status(500).json({ error: 'Le serveur a rencontré une erreur. Réessayez dans un instant.' });
  });
  return app;
}
