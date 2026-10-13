#!/usr/bin/env bash
set -Eeuo pipefail

project_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
env_file="${1:-$project_dir/deploy/.env}"
mode="${2:-}"

if [[ $# -gt 2 || ( -n "$mode" && "$mode" != '--skip-pull' ) ]]; then
  echo "Usage : $0 [fichier.env] [--skip-pull]" >&2
  exit 2
fi
if [[ ! -f "$env_file" ]]; then
  echo "Fichier absent : $env_file. Copier deploy/.env.example puis renseigner les valeurs." >&2
  exit 1
fi
command -v docker >/dev/null || { echo 'Docker est requis.' >&2; exit 1; }
docker compose version >/dev/null
docker info >/dev/null

# Le fichier .env est interprete par Compose, jamais execute par le shell.
compose=(docker compose --project-name "${DEPLOY_PROJECT:-tython-prod}" --env-file "$env_file" -f "$project_dir/docker-compose.prod.yml")
"${compose[@]}" config --quiet

if [[ "$mode" != '--skip-pull' ]]; then
  echo 'Telechargement des images...'
  "${compose[@]}" pull
fi

# Recreer aussi Nginx pour renouveler la resolution du nom du backend.
# Les volumes PostgreSQL sont conserves.
echo 'Demarrage et verification des services...'
if ! "${compose[@]}" up -d --force-recreate --wait --wait-timeout 180; then
  "${compose[@]}" ps --all
  echo 'Echec du deploiement. Consulter les logs ; aucun rollback automatique.' >&2
  exit 1
fi
"${compose[@]}" exec -T frontend wget -q -T 10 -O - http://127.0.0.1/api/health
printf '\nDeploiement valide : API accessible via Nginx.\n'
"${compose[@]}" ps
