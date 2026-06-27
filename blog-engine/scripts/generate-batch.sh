#!/bin/bash
# Batch generation — 20 articles across all 10 categories
# Run from: d:/jarvis-starter-kit/livrables/blog-engine
# Usage: bash scripts/generate-batch.sh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/.."

run() {
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "[$1/20] $2 — $3"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  node scripts/generate-article.js --title "$2" --category "$3"
  sleep 3
}

# Actualités IA (2)
run 1  "GPT-5 vs Claude 4 : Comparatif complet pour professionnels en 2026" "Actualités IA"
run 2  "Les 7 avancées IA qui révolutionnent le business en 2026" "Actualités IA"

# Outils IA (2 — 1 existe déjà)
run 3  "Perplexity AI vs ChatGPT : quel outil de recherche choisir en 2026" "Outils IA"
run 4  "Les 10 meilleurs outils IA gratuits pour entrepreneurs en 2026" "Outils IA"

# Automatisation IA (1 — 1 existe déjà)
run 5  "Comment automatiser son marketing avec n8n et l'IA en 2026" "Automatisation IA"

# Marketing IA (2)
run 6  "Stratégie de contenu IA : générer 10x plus de leads avec moins d'effort" "Marketing IA"
run 7  "SEO et IA : comment dominer Google en 2026 avec les outils IA" "Marketing IA"

# Création de Contenu IA (2)
run 8  "Comment créer 30 posts LinkedIn par mois avec l'IA en 2 heures" "Création de Contenu IA"
run 9  "Midjourney v7 : guide complet pour créer des visuels professionnels avec l'IA" "Création de Contenu IA"

# Vente IA (2)
run 10 "Comment tripler ses ventes avec un funnel de vente automatisé par l'IA" "Vente IA"
run 11 "CRM IA : les meilleurs outils pour automatiser sa prospection commerciale en 2026" "Vente IA"

# Support Client IA (2)
run 12 "Déployer un chatbot IA pour son service client en moins de 48 heures" "Support Client IA"
run 13 "Comment réduire ses tickets support de 70 pourcent avec l'IA en 2026" "Support Client IA"

# Tutoriels IA (2)
run 14 "Tutoriel n8n : créer son premier workflow d'automatisation IA en 1 heure" "Tutoriels IA"
run 15 "Comment utiliser l'API Claude pour automatiser ses tâches répétitives" "Tutoriels IA"

# Comparatifs IA (2)
run 16 "n8n vs Make vs Zapier : quel outil d'automatisation IA choisir en 2026" "Comparatifs IA"
run 17 "Jasper vs Copy.ai vs Claude : meilleur outil de copywriting IA en 2026" "Comparatifs IA"

# Guides IA (2)
run 18 "Guide complet : lancer son business en ligne avec l'IA en 30 jours" "Guides IA"
run 19 "De zéro à 10 000 euros par mois : vivre de l'IA en 2026, le guide" "Guides IA"

# OpenAI news bonus
run 20 "OpenAI o3 et Gemini Ultra : ce que les entrepreneurs doivent savoir en 2026" "Actualités IA"

echo ""
echo "✅ Batch terminé — 20 articles générés"
