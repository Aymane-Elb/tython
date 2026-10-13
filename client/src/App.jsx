import { useEffect, useState } from 'react';

async function api(path = '', options = {}) {
  const response = await fetch(`/api/tasks${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json' },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || 'Impossible de contacter le serveur.');
  }
  return response.status === 204 ? null : response.json();
}

export default function App() {
  const [tasks, setTasks] = useState([]);
  const [title, setTitle] = useState('');
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function loadTasks() {
    setLoading(true);
    setError('');
    try { setTasks(await api()); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadTasks(); }, []);

  async function mutate(action) {
    setBusy(true);
    setError('');
    try { await action(); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  function addTask(event) {
    event.preventDefault();
    if (!title.trim() || busy) return;
    mutate(async () => {
      const task = await api('', { method: 'POST', body: JSON.stringify({ title }) });
      setTasks((items) => [task, ...items]);
      setTitle('');
    });
  }

  function toggleTask(task) {
    mutate(async () => {
      const updated = await api(`/${task.id}`, { method: 'PATCH', body: JSON.stringify({ completed: !task.completed }) });
      setTasks((items) => items.map((item) => item.id === task.id ? updated : item));
    });
  }

  function deleteTask(task) {
    mutate(async () => {
      await api(`/${task.id}`, { method: 'DELETE' });
      setTasks((items) => items.filter((item) => item.id !== task.id));
    });
  }

  const done = tasks.filter((task) => task.completed).length;
  const visible = tasks.filter((task) => filter === 'all' || (filter === 'done' ? task.completed : !task.completed));

  return (
    <div className="app">
      <header className="topbar"><a className="brand" href="/"><span className="brand-icon" aria-hidden="true">✓</span>tython<span className="brand-dot">.</span></a><span className="topbar-note">Un peu d’ordre, l’esprit libre.</span></header>
      <main>
        <div className="eyebrow">VOTRE ESPACE PERSONNEL</div>
        <h1>Une chose à la fois<span>.</span></h1>
        <p className="intro">Notez vos idées, organisez vos tâches et avancez à votre rythme.</p>

        <section className="task-card" aria-labelledby="tasks-heading">
          <div className="card-heading"><div><h2 id="tasks-heading">Mes tâches</h2><p aria-live="polite">{loading ? 'Chargement…' : `${tasks.length - done} à faire · ${done} terminée${done > 1 ? 's' : ''}`}</p></div><span className="counter" aria-label={`${tasks.length} tâches`}>{tasks.length.toString().padStart(2, '0')}</span></div>
          <form onSubmit={addTask} className="add-form">
            <label htmlFor="new-task" className="sr-only">Nouvelle tâche</label>
            <input id="new-task" placeholder="Qu’avez-vous prévu de faire ?" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={200} required disabled={busy || loading} autoComplete="off" />
            <button className="add-button" disabled={busy || loading || !title.trim()} type="submit"><span aria-hidden="true">+</span> Ajouter</button>
          </form>
          {error && <div className="error" role="alert">{error} <button type="button" onClick={loadTasks} disabled={busy || loading}>Réessayer</button></div>}
          <div className="filters" role="group" aria-label="Filtrer les tâches">{[['all', 'Toutes'], ['todo', 'À faire'], ['done', 'Terminées']].map(([value, label]) => <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}</div>
          {loading ? <p className="empty" role="status">Chargement de vos tâches…</p> : visible.length ? (
            <ul className="task-list">{visible.map((task) => <li key={task.id} className={task.completed ? 'task completed' : 'task'}><label className="task-label"><input type="checkbox" checked={task.completed} onChange={() => toggleTask(task)} disabled={busy} /><span>{task.title}</span></label><button className="delete-button" title="Supprimer" aria-label={`Supprimer : ${task.title}`} onClick={() => deleteTask(task)} disabled={busy}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M3 6h18M9 6V4h6v2M5 6l1 14h12l1-14M10 10v6M14 10v6" /></svg></button></li>)}</ul>
          ) : !error && <div className="empty"><span className="empty-icon" aria-hidden="true">✓</span><h3>{filter === 'done' ? 'Chaque petit pas compte.' : filter === 'todo' && tasks.length ? 'Tout est fait, bien joué !' : 'Place à votre prochaine idée.'}</h3><p>{filter === 'done' ? 'Vos tâches terminées apparaîtront ici.' : filter === 'todo' && tasks.length ? 'Prenez un moment pour souffler.' : 'Ajoutez une tâche pour commencer.'}</p></div>}
        </section>
        <footer className="page-footer">Moins de distractions. Plus de petits pas.</footer>
      </main>
    </div>
  );
}
