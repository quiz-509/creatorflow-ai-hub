# Livrables

Ce dossier contient tout ce que Claude produit pour toi. C'est ton espace de sortie.

---

## Règle d'or

| Role | Emplacement |
|------|-------------|
| **Inputs** (documents que tu fournis : PDFs, exports, notes, briefs) | `context/import/` |
| **Outputs** (ce que Claude produit pour toi) | `livrables/` |

---

## Organisation

```
livrables/
├── sites-web/       Sites internet, landing pages, maquettes
├── applications/    Outils, scripts, automatisations
├── rédaction/       Contenus écrits, briefs, templates, calendriers
└── cabinet/         Livrables pour l'agence
```

---

## Convention de nommage

Format : `AAAA-MM-JJ_nom-du-projet_version`

Exemples :
- `2026-05-23_landing-page-formation_v1.html`
- `2026-05-23_script-automatisation-notion_v2.py`
- `2026-06-01_brief-article-ia-et-business_v1.md`

Règles :
- Dates au format `AAAA-MM-JJ` pour un tri chronologique naturel
- Séparateurs : tirets (`-`) pour les mots, underscores (`_`) entre les parties
- Versions : `_v1`, `_v2`... pour garder l'historique sans écraser
- Pas d'espaces, pas d'accents dans les noms de fichiers
