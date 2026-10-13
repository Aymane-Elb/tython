# Tython

Une petite application de tâches : **React + Vite** pour l’interface, **Express** pour l’API et **PostgreSQL** pour les données.

Fonctionnalités : ajouter une tâche, la marquer comme terminée, la supprimer et filtrer la liste. Interface responsive en français, avec états de chargement et messages d’erreur.

## Démarrer

Prérequis : Node.js **22.13+ (branche 22) ou 24+**, npm et Docker avec Docker Compose.

```bash
npm install
cp .env.example .env
cp server/.env.example server/.env
```

Renseigner `POSTGRES_PASSWORD` dans `.env` a la racine, puis les memes identifiants dans `DATABASE_URL` de `server/.env` (encoder les caracteres speciaux du mot de passe dans l’URL). Ensuite :

```bash
npm run db:up
npm run dev
```

Ouvrir **http://localhost:5173**. L’API écoute sur **http://127.0.0.1:3001**. Vite transmet les requêtes `/api` à Express. La table est créée automatiquement au démarrage du serveur.

Si PostgreSQL est déjà installé, créer une base et renseigner sa connexion dans `server/.env`, puis ignorer `npm run db:up`. Si le port 5432 est occupé, modifier le port hôte dans `compose.yaml` et `DATABASE_URL`. Si le port API change, adapter aussi le proxy dans `client/vite.config.js`.

Compose lit le `.env` racine et injecte les variables PostgreSQL au demarrage. Le serveur local lit `server/.env`. Ces fichiers sont ignores par Git et exclus des images Docker ; seuls les `.env.example`, sans secret reel, sont versionnes. Les Dockerfiles contiennent uniquement des valeurs non sensibles (`HOST`, `PORT`, `NODE_ENV`).

Si le volume PostgreSQL existe deja, conserver ses identifiants : modifier `.env` ne change pas le mot de passe d’une base deja initialisee. Cette application personnelle n’inclut pas d’authentification ; les utilisateurs d’une même instance partagent les tâches.

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

## Integration continue

Le workflow `.github/workflows/ci.yml` se declenche sur les Pull Requests vers `dev` ou `main`, et sur les pushes vers `main`.

- `npm ci`, puis `npm run lint` (backend), `npm test` et `npm run build`.
- Les tests utilisent un PostgreSQL 17 temporaire cree par GitHub Actions, avec des identifiants de test sans lien avec les secrets locaux.
- Construction des images frontend et backend sur chaque execution, apres reussite des controles.
- Publication sur GHCR uniquement pour les pushes sur `main`, avec les tags `latest` et `sha-<commit complet>`.

Les images sont nommees `ghcr.io/aymane-elb/tython-frontend` et `ghcr.io/aymane-elb/tython-backend` pour ce depot ; le workflow adapte automatiquement le nom au depot GitHub, en minuscules.

La publication utilise le `GITHUB_TOKEN` fourni automatiquement avec la permission `packages: write` : aucun token personnel ni fichier `.env` ne doit etre ajoute au depot. Suivre les executions dans l’onglet **Actions** de GitHub. La CI publie les images mais ne deploie pas encore sur Proxmox.

Reference : [publier des images Docker avec GitHub Actions](https://docs.github.com/en/actions/tutorials/publish-packages/publish-docker-images).

## Déploiement sur une VM

Le guide [DEPLOYMENT.md](DEPLOYMENT.md) décrit Proxmox en laboratoire, la création d'une VM Debian, Docker, les secrets, le déploiement et les vérifications.

La production utilise `docker-compose.prod.yml`, `deploy/.env` (à créer depuis `deploy/.env.example`) et `bash ./deploy.sh`. Elle télécharge les images GHCR publiées par la CI et ajoute les healthchecks, la rotation des logs et un volume PostgreSQL distinct du développement.
