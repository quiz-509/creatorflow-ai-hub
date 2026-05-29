# /commit

> Commande pour créer un commit Git propre avec un message généré automatiquement.

---

## Mission

Quand je lance `/commit`, exécute la séquence suivante :

### Étape 1 : Vérifier l'état du dépôt

Exécute en parallèle :
- `git status` pour voir les fichiers modifiés, ajoutés, supprimés
- `git diff` pour voir le contenu des modifications non stagées
- `git diff --staged` pour voir ce qui est déjà stagé
- `git log --oneline -5` pour voir le style des derniers messages de commit

Si le répertoire n'est pas un dépôt Git, signale-le et propose d'en initialiser un avec `git init`.

### Étape 2 : Analyser les changements

Identifie :
- La nature des changements (nouveau fichier, modification, suppression, refactoring)
- Le ou les domaines concernés (livrables, context, config, code, etc.)
- S'il y a des fichiers sensibles à ne PAS commiter (`.env`, clés, secrets)

Si `.env` ou tout fichier listé dans `.gitignore` apparaît dans les fichiers à commiter, **stop** : signale le problème et ne commite pas tant que ce n'est pas résolu.

### Étape 3 : Proposer un message de commit

Génère un message de commit selon ce format :

```
type(scope): description courte en français

Corps optionnel si nécessaire (max 3 lignes)
```

Types disponibles :
- `feat` : nouvelle fonctionnalité ou nouveau livrable
- `fix` : correction d'un bug ou d'une erreur
- `docs` : documentation, README, CLAUDE.md, CONTEXT.md
- `config` : configuration, .gitignore, .env.example
- `refactor` : réorganisation sans changement fonctionnel
- `chore` : maintenance, nettoyage

Présente le message proposé et demande ma confirmation avant de commiter.

### Étape 4 : Stager et commiter

Une fois que je confirme :
1. Stage les fichiers pertinents (`git add` ciblé, jamais `git add .` sans vérification)
2. Crée le commit avec le message validé
3. Confirme le succès avec le hash du commit

---

## Règles importantes

- Ne jamais stager `.env`, `*.key`, `*.pem` ou tout fichier exclu par `.gitignore`
- Toujours demander confirmation avant de créer le commit
- Si des changements sont non liés, proposer de les séparer en plusieurs commits
- Utiliser le français pour les messages de commit (sauf convention contraire du projet)
- Ne jamais utiliser `--no-verify` ou bypasser les hooks Git
