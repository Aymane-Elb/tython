# Déploiement Tython : Proxmox, VM Debian et Docker Compose

## Ce qui est livré

Méthode choisie : **option A du sujet, SSH + Docker Compose dans une VM**.

| Fichier | Rôle |
| --- | --- |
| `docker-compose.prod.yml` | Télécharge les images publiées, configure réseau, stockage, healthchecks et logs |
| `deploy/.env.example` | Modèle de configuration sans secret réel |
| `deploy.sh` | Télécharge les images, recrée les services et attend leur bon état |

Le script s'exécute **dans la VM**, après une connexion SSH. Il ne crée pas Proxmox ni la VM. Les étapes suivantes sont un guide à exécuter ; elles ne constituent pas une preuve de déploiement distant déjà réalisé.

Architecture : navigateur → Nginx → Express → PostgreSQL. Proxmox héberge la VM Debian ; Docker tourne dans Debian, pas directement sur l'hôte Proxmox.

## 1. Choisir l'environnement sans effacer son ordinateur

Tu ne disposes que de ton ordinateur personnel : **ne démarre pas celui-ci sur une clé d'installation Proxmox**. L'installateur efface les disques sélectionnés.

Deux parcours de laboratoire sont possibles :

- **Proxmox imbriqué** : ordinateur → logiciel de virtualisation → VM Proxmox → VM Debian. Cela permet de montrer réellement Proxmox, mais exige la virtualisation imbriquée et davantage de mémoire.
- **Simulation plus rapide** : ordinateur → VM Debian → Docker. Documenter explicitement que la VM représente la cible Proxmox, sans prétendre avoir installé Proxmox. Le sujet autorise une simulation ; les critères attendus restent à confirmer avec l'évaluateur.

La machine inspectée possède environ 16 Go de RAM et un processeur Intel avec VT-x. Pour le parcours imbriqué, proposition de laboratoire : 4 vCPU, 8 Go de RAM et un disque virtuel de 64 Go pour Proxmox. Fermer les applications lourdes avant de démarrer cette VM. Le support matériel VT-x ne prouve pas que la virtualisation imbriquée est déjà activée dans l'hyperviseur.

Sur cet ordinateur Arch Linux, `virt-manager` et `virsh` sont déjà installés ; `/sys/module/kvm_intel/parameters/nested` renvoie `Y`. Le support nested est donc activé dans KVM. Il reste à exposer le CPU hôte à la VM Proxmox et à vérifier la connexion libvirt dans virt-manager.

Sources : [configuration matérielle Proxmox](https://www.proxmox.com/en/products/proxmox-virtual-environment/requirements), [installation officielle](https://www.proxmox.com/en/products/proxmox-virtual-environment/get-started).

## 2. Installer Proxmox dans une VM de laboratoire

1. Télécharger l'ISO **Proxmox VE** depuis les [téléchargements officiels](https://www.proxmox.com/en/downloads/proxmox-virtual-environment/iso).
2. Dans ton hyperviseur de bureau, créer une nouvelle VM Linux avec les ressources proposées ci-dessus. Créer un **nouveau disque virtuel** ; ne jamais utiliser un disque physique de ton ordinateur en passthrough.
   Avec virt-manager : ouvrir l'application, sélectionner la connexion QEMU/KVM, puis **Créer une nouvelle machine virtuelle → Média d'installation local (ISO)**. Sélectionner l'ISO, allouer 8192 Mio et 4 processeurs, puis créer un disque virtuel de 64 Go. Cocher la personnalisation avant installation et choisir un CPU exposant les capacités de l'hôte (`host-passthrough`). Utiliser le réseau virtuel NAT `default` pour ce laboratoire, s'il est disponible.
3. Activer l'exposition de VT-x/AMD-V au système invité (virtualisation imbriquée). Le nom exact du réglage dépend de l'hyperviseur. Sous KVM, on utilise généralement un CPU de type host-passthrough avec le support nested activé sur l'hôte.
4. Attacher l'ISO au lecteur virtuel et démarrer la VM. Sélectionner **Install Proxmox VE (Graphical)**.
5. Choisir uniquement le disque virtuel créé. Pour ce petit laboratoire, garder ext4. Régler pays, clavier et fuseau horaire ; définir le mot de passe administrateur et une adresse e-mail.
6. Configurer un nom d'hôte, par exemple `pve.lab.test`, une IP libre dans le réseau virtuel, son masque, sa passerelle et son DNS. Ces valeurs dépendent de ton hyperviseur : ne pas recopier une IP arbitraire.
7. Terminer l'installation, retirer l'ISO du lecteur virtuel et redémarrer la VM Proxmox.
8. Depuis le navigateur de ton ordinateur, ouvrir `https://IP_PROXMOX:8006`. Vérifier qu'il s'agit bien de ta VM avant d'accepter l'avertissement lié à son certificat local. Se connecter avec `root`, domaine d'authentification **Linux PAM**, et le mot de passe choisi.

Pour le réseau : avec KVM/libvirt, un réseau NAT virtuel permet habituellement au PC hôte d'atteindre les invités. Avec un NAT qui n'autorise pas cet accès, configurer une redirection vers le port 8006 ou une interface host-only supplémentaire. Pour les VM Debian internes, vérifier également le passage de leurs adresses MAC dans le réseau de l'hyperviseur externe ; si elles n'ont pas de réseau, il faudra adapter le mode bridge/NAT. La configuration précise dépend du logiciel de virtualisation, notamment en Wi-Fi.

Proxmox dans une VM est réservé ici à l'apprentissage. Sur une machine dédiée, la procédure ISO est similaire, mais efface le disque physique sélectionné. Référence détaillée : [guide d'installation Proxmox](https://github.com/proxmox/pve-docs/blob/master/pve-installation.adoc).

## 3. Créer la VM Debian

Dans Proxmox :

1. Télécharger une ISO Debian stable amd64 depuis [Debian](https://www.debian.org/distrib/).
2. Sélectionner le nœud Proxmox, son stockage acceptant les ISO (souvent `local`), puis **ISO Images → Upload**.
3. Cliquer **Create VM**, nommer la VM `tython-server`, choisir l'ISO Debian.
4. Allouer 2 vCPU, 2 à 4 Go de RAM et environ 24 Go de disque. Utiliser le bridge `vmbr0` et une carte VirtIO.
5. Démarrer la VM et ouvrir **Console**. Installer Debian sans environnement de bureau, avec **SSH server** et les utilitaires standard.
6. Créer un utilisateur, par exemple `deploy`. Il doit disposer de `sudo` (à configurer depuis le compte administrateur si nécessaire).
7. Réserver une IP pour la VM dans le DHCP, ou configurer une IP fixe valide. Vérifier Internet et le DNS depuis Debian.

Pour une simulation simple, créer cette VM directement dans l'hyperviseur du PC en sautant Proxmox. La suite est identique.

Depuis ton ordinateur, remplacer `IP_VM` par l'adresse réelle :

```bash
ssh deploy@IP_VM
```

L'IP de Debian et l'IP de Proxmox sont différentes. Le port 8006 administre Proxmox ; le port 22 sert à SSH sur Debian ; le port 8080 servira Tython.

## 4. Installer Docker dans Debian

Sur une **VM Debian 12 ou 13 neuve**, connectée en SSH, avec un utilisateur autorisé à utiliser sudo :

```bash
sudo apt update
sudo apt install -y ca-certificates curl git openssl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

sudo tee /etc/apt/sources.list.d/docker.sources >/dev/null <<EOF
Types: deb
URIs: https://download.docker.com/linux/debian
Suites: $(. /etc/os-release && echo "$VERSION_CODENAME")
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
sudo docker run --rm hello-world
sudo docker compose version
```

Ces commandes concernent Debian, pas Ubuntu ni le PC hôte. Si Docker est déjà installé, vérifier l'installation existante avant de remplacer des paquets. Source : [installation officielle Docker sur Debian](https://docs.docker.com/engine/install/debian/).

## 5. Publier les images puis récupérer les fichiers

1. Fusionner le travail via PR dans `dev`, puis via PR dans `main` après réussite de la CI.
2. Attendre la fin des jobs images du workflow déclenché par le push sur `main`.
3. Noter le **SHA complet de ce commit sur main**. Le tag est `sha-` suivi de ce SHA. Ce déploiement nécessite les nouvelles images supportant les variables `PGHOST`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`.
4. Dans la VM, récupérer le dépôt :

```bash
git clone https://github.com/Aymane-Elb/tython.git
cd tython
```

Si le dépôt est privé, utiliser une authentification Git adaptée, sans inscrire de token dans l'URL. On peut aussi transférer uniquement `deploy.sh`, `docker-compose.prod.yml` et `deploy/.env.example` par `scp`.

Si les images GHCR sont privées, utiliser un token GitHub autorisé à lire ces packages (`read:packages`) et le saisir au prompt de connexion :

```bash
sudo docker login ghcr.io -u Aymane-Elb
```

Ne pas mettre le token dans Git ni dans la ligne de commande. Utiliser le même utilisateur Docker pour le login et le déploiement, ici `sudo docker`. Le `GITHUB_TOKEN` automatique de la CI n'est pas un identifiant permanent pour ta VM.

## 6. Configurer la production

Sur la VM, dans le dépôt :

```bash
cp deploy/.env.example deploy/.env
chmod 600 deploy/.env
openssl rand -hex 24
nano deploy/.env
```

Renseigner `POSTGRES_PASSWORD` avec la valeur générée, `IMAGE_TAG` avec le tag `sha-...` publié, et conserver le préfixe GHCR si le dépôt n'a pas changé.

Le backend reçoit les variables PostgreSQL séparément : pas besoin de recopier ni d'encoder le mot de passe dans une URL de production. `DATABASE_URL` reste compatible pour le développement local.

Par défaut, `BIND_ADDRESS=127.0.0.1` garde l'application accessible uniquement depuis la VM. Pour un accès direct depuis le PC sur le réseau de laboratoire, mettre **l'IP privée réelle de Debian** dans `BIND_ADDRESS`. Ne pas y mettre l'IP de Proxmox.

Autre possibilité, conserver l'écoute locale et ouvrir ce tunnel depuis le PC :

```bash
ssh -N -L 8081:127.0.0.1:8080 deploy@IP_VM
```

Puis ouvrir `http://localhost:8081` sur le PC. Cela évite d'exposer le port de l'application au réseau.

Le fichier `deploy/.env` est ignoré par Git et exclu des images. Modifier le mot de passe du fichier ne change pas celui d'une base PostgreSQL déjà initialisée : pour une rotation, changer aussi le mot de passe du rôle dans PostgreSQL. Ne pas supprimer le volume pour régler un problème de connexion.

## 7. Déployer et vérifier

Depuis le dépôt dans la VM :

```bash
sudo bash ./deploy.sh
```

Le script valide Compose sans afficher les secrets, télécharge les images, recrée les services en conservant les données, attend les healthchecks et teste `/api/health` via Nginx. Cette mise à jour peut provoquer une courte interruption ; ce n'est pas un déploiement sans coupure.

Accéder à `http://IP_VM:8080` si l'écoute est configurée sur l'IP privée, ou au tunnel SSH ci-dessus. Ajouter une tâche et actualiser la page. Résultat attendu de `/api/health` : `{"status":"ok"}`.

Sur la VM, raccourci pour les commandes d'exploitation, à redéfinir dans chaque nouveau terminal :

```bash
dc() { sudo docker compose -p tython-prod --env-file deploy/.env -f docker-compose.prod.yml "$@"; }
dc ps
dc logs --tail=100 backend frontend db
```

Le volume `tython-prod_postgres_data` est indépendant du volume du Compose de développement. Les anciennes tâches locales ne sont donc pas copiées automatiquement sur le serveur.

## 8. Observabilité et sécurité minimales

- Les trois services ont un healthcheck. Celui du frontend vérifie Nginx, l'API et la connexion à PostgreSQL.
- Les services redémarrent après une sortie de processus grâce à `restart: unless-stopped`. Un état `unhealthy` seul ne déclenche pas un redémarrage automatique.
- Les logs utilisent `json-file` avec rotation : 10 Mo par fichier, 3 fichiers par conteneur.
- PostgreSQL et Express n'ont aucun port publié sur l'hôte. PostgreSQL est sur un réseau interne inaccessible directement au frontend.
- L'application ne possède pas d'authentification. Le parcours livré vise un réseau de laboratoire ou un tunnel SSH ; HTTPS et authentification restent nécessaires avant une exposition publique adaptée.
- Garder l'administration Proxmox et SSH accessibles seulement depuis le réseau de gestion. Un port publié par Docker peut contourner des règles UFW ; ne pas compter uniquement sur UFW pour limiter cet accès.

## 9. Mise à jour, sauvegarde et retour arrière

Avant une mise à jour, noter l'ancien `IMAGE_TAG` et sauvegarder les données. Avec la fonction `dc` définie précédemment :

```bash
mkdir -p backups
chmod 700 backups
umask 077
dc exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB"' > "backups/tython-$(date +%Y%m%d-%H%M%S).sql"
```

Vérifier le succès de la commande et conserver une copie hors de la VM. `backups/` est exclu de Git et du contexte Docker.

Pour mettre à jour : renseigner le nouveau tag dans `deploy/.env`, puis relancer `sudo bash ./deploy.sh`. Pour revenir à une image précédente, remettre son tag et relancer le script. Cela ne restaure pas les données et suppose un schéma SQL compatible. Le script ne lance pas de retour arrière automatique.

Pour arrêter sans supprimer les données : `dc down`. Ne pas ajouter `-v`, qui supprimerait les volumes.

## 10. Simulation locale et preuves

Une vérification locale peut utiliser les mêmes fichiers avec des images construites localement :

```bash
docker build -f client/Dockerfile -t tython-lab-frontend:local .
docker build -f server/Dockerfile -t tython-lab-backend:local .
```

Créer un fichier `.env` dédié à partir de `deploy/.env.example`, renseigner un mot de passe de test et utiliser `IMAGE_PREFIX=tython-lab`, `IMAGE_TAG=local`, `BIND_ADDRESS=127.0.0.1`, `HTTP_PORT=18080`.

```bash
DEPLOY_PROJECT=tython-lab bash ./deploy.sh chemin/vers/.env --skip-pull
```

`--skip-pull` sert aux tests avec images locales. En déploiement distant normal, laisser le script télécharger les images GHCR.

Preuves à joindre : capture du pipeline vert, images GHCR, `dc ps` avec trois services healthy, page contenant une tâche conservée après actualisation, logs sans secret, et capture de la VM dans Proxmox si ce parcours a réellement été réalisé. Distinguer clairement les vérifications locales de l'installation distante encore à faire.

### Vérification locale réalisée le 13 octobre 2026

- Construction des deux images depuis les Dockerfiles : réussie.
- Validation du Compose et de la syntaxe Bash, ESLint backend : réussis.
- Exécution de `deploy.sh` avec des images locales dans le projet isolé `tython-deployment-check` : trois services `healthy`.
- Interface HTTP et `/api/health` via Nginx : accessibles.
- Création d'une tâche, recréation des trois conteneurs par le script, relecture de la tâche conservée, modification et suppression : réussies.
- Publication/téléchargement GHCR et installation réelle de Proxmox : non vérifiés dans ce test local.
