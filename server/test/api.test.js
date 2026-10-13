import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { once } from 'node:events';
import pg from 'pg';
import { createApp } from '../src/app.js';

let db;
let admin;
let server;
let base;
const schema = `test_${process.pid}_${Date.now()}`;

before(async () => {
  if (!process.env.DATABASE_URL) throw new Error('Configurez DATABASE_URL (server/.env) et démarrez PostgreSQL avant les tests.');
  admin = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  await admin.query(`CREATE SCHEMA ${schema}`);
  db = new pg.Pool({ connectionString: process.env.DATABASE_URL, options: `-c search_path=${schema}` });
  await db.query(await readFile(new URL('../src/schema.sql', import.meta.url), 'utf8'));
  server = createApp(db).listen(0, '127.0.0.1');
  await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server?.listening) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  await db?.end();
  if (admin) {
    try { await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); }
    finally { await admin.end(); }
  }
});

function request(path, method = 'GET', body) {
  return fetch(`${base}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

test('PostgreSQL est accessible', async () => {
  const response = await request('/health');
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ok' });
});

test('création, persistance, modification et suppression', async () => {
  const title = "Lire l’API ; DROP TABLE tasks; --";
  const created = await request('/tasks', 'POST', { title: `  ${title}  ` });
  assert.equal(created.status, 201);
  const task = await created.json();
  assert.equal(task.title, title);
  assert.equal(task.completed, false);
  const stored = await db.query('SELECT title FROM tasks WHERE id = $1', [task.id]);
  assert.equal(stored.rows[0].title, title);
  const listed = await (await request('/tasks')).json();
  assert.ok(listed.some((item) => item.id === task.id));
  const updated = await request(`/tasks/${task.id}`, 'PATCH', { completed: true });
  assert.equal(updated.status, 200);
  assert.equal((await updated.json()).completed, true);
  assert.equal((await request(`/tasks/${task.id}`, 'PATCH', { completed: false })).status, 200);
  assert.equal((await request(`/tasks/${task.id}`, 'DELETE')).status, 204);
  assert.equal((await request(`/tasks/${task.id}`, 'DELETE')).status, 404);
  assert.equal((await request(`/tasks/${task.id}`, 'PATCH', { completed: true })).status, 404);
});

test('les entrées invalides sont refusées', async () => {
  for (const title of ['', '   ', 42, null, 'a'.repeat(201)]) {
    assert.equal((await request('/tasks', 'POST', { title })).status, 400);
  }
  assert.equal((await request('/tasks', 'POST')).status, 400);
  assert.equal((await request('/tasks/1', 'PATCH', { completed: 'true' })).status, 400);
  for (const id of ['0', '-1', 'abc', '2147483648']) {
    assert.equal((await request(`/tasks/${id}`, 'DELETE')).status, 400);
  }
});

test('les erreurs de protocole renvoient du JSON', async () => {
  const malformed = await fetch(`${base}/api/tasks`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' });
  assert.equal(malformed.status, 400);
  assert.equal((await malformed.json()).error, 'JSON invalide.');
  assert.equal((await request('/tasks', 'POST', { title: 'a'.repeat(11000) })).status, 413);
  const missing = await request('/unknown');
  assert.equal(missing.status, 404);
  assert.equal((await missing.json()).error, 'Route introuvable.');
});
