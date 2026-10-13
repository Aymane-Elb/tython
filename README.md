# Tython

Une petite application de tâches : **React + Vite** pour l’interface, **Express** pour l’API et **PostgreSQL** pour les données.

Fonctionnalités : ajouter une tâche, la marquer comme terminée, la supprimer et filtrer la liste. Interface responsive en français, avec états de chargement et messages d’erreur.

## Démarrer

Prérequis : Node.js **22.12+**, npm et Docker avec Docker Compose.

```bash
npm install
cp server/.env.example server/.env
npm run db:up
npm run dev
```

Ouvrir **http://localhost:5173**. L’API écoute sur **http://127.0.0.1:3001**. Vite transmet les requêtes `/api` à Express. La table est créée automatiquement au démarrage du serveur.

Si PostgreSQL est déjà installé, créer une base et renseigner sa connexion dans `server/.env`, puis ignorer `npm run db:up`. Si le port 5432 est occupé, modifier le port hôte dans `compose.yaml` et `DATABASE_URL`. Si le port API change, adapter aussi le proxy dans `client/vite.config.js`.

Les identifiants Docker fournis sont uniquement destinés au développement local. Cette application personnelle n’inclut pas d’authentification ; les utilisateurs d’une même instance partagent les tâches.

## Structure

```text
client/src/App.jsx       Interface et appels API
client/src/styles.css   Styles
client/vite.config.js   Serveur de développement et proxy
server/src/app.js       Routes Express et validation
server/src/index.js     Connexion PostgreSQL et démarrage
server/src/schema.sql   Table tasks
server/test/api.test.js Tests d’intégration
compose.yaml            PostgreSQL et volume persistant
```

## API

| Méthode | Route | Action / corps JSON |
| --- | --- | --- |
| GET | `/api/health` | Vérifier la connexion à PostgreSQL |
| GET | `/api/tasks` | Lister les tâches, plus récentes en premier |
| POST | `/api/tasks` | Ajouter : `{"title":"Apprendre React"}` |
| PATCH | `/api/tasks/:id` | Changer le statut : `{"completed":true}` |
| DELETE | `/api/tasks/:id` | Supprimer |

Les titres sont limités à 200 caractères et les requêtes SQL utilisent des paramètres.

## Vérifier et compiler

Avec PostgreSQL démarré et `server/.env` configuré :

```bash
npm test
npm run build
npm start
```

Les tests utilisent un schéma temporaire isolé, supprimé à la fin ; ils ne modifient pas les tâches de l’application. Ils couvrent la persistance, les opérations de l’API et les entrées invalides.

Après compilation, Express sert également l’interface React sur **http://127.0.0.1:3001**. `npm start` exige que `npm run build` ait été exécuté pour afficher l’interface.

Arrêter React et Express avec `Ctrl+C`. Arrêter PostgreSQL avec `npm run db:down` ; les données sont conservées dans le volume Docker.

Documentation : [Vite](https://vite.dev/guide/), [Express](https://expressjs.com/), [node-postgres](https://node-postgres.com/features/queries).
