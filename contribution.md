# Contribuer au projet

## Branches
- main : version stable.
- dev : intégration des changements.
- feature/* : branches créées depuis dev pour chaque modification.

## Pull Requests
- Ouvrir une Pull Request de feature/* vers dev sur GitHub.
- Vérifier les changements et les tests avant de fusionner.
- Pour une release, ouvrir une Pull Request de dev vers main.
- Identifier les releases avec un tag, par exemple v1.0.0.

## Commits
Utiliser un préfixe simple :
- feat: nouvelle fonctionnalité
- fix: correction
- docs: documentation
- ci: pipeline
- chore: maintenance

## Synchronisation GitHub / GitLab
GitHub est la source principale ; GitLab est un miroir.
Les Pull Requests et les fusions sont effectuées sur GitHub.
Après chaque fusion, mettre à jour la branche locale depuis GitHub,
puis pousser cette branche vers GitLab.
Ne pas modifier directement le miroir GitLab.