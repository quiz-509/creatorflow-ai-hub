# Batch generation — 20 articles
# Run from: D:\jarvis-starter-kit\livrables\blog-engine
# Usage: powershell -ExecutionPolicy Bypass -File scripts/generate-batch.ps1

$articles = @(
  @{ n=1;  title="GPT-5 vs Claude 4 : Comparatif complet pour professionnels en 2026";                    cat="Actualites IA" },
  @{ n=2;  title="Les 7 avancees IA qui revolutionnent le business en 2026";                               cat="Actualites IA" },
  @{ n=3;  title="Perplexity AI vs ChatGPT : quel outil de recherche choisir en 2026";                    cat="Outils IA" },
  @{ n=4;  title="Les 10 meilleurs outils IA gratuits pour entrepreneurs en 2026";                         cat="Outils IA" },
  @{ n=5;  title="Comment automatiser son marketing avec n8n et l'IA en 2026";                            cat="Automatisation IA" },
  @{ n=6;  title="Strategie de contenu IA pour generer 10x plus de leads avec moins d'effort";            cat="Marketing IA" },
  @{ n=7;  title="SEO et IA : comment dominer Google en 2026 avec les outils IA";                         cat="Marketing IA" },
  @{ n=8;  title="Comment creer 30 posts LinkedIn par mois avec l'IA en 2 heures";                       cat="Creation de Contenu IA" },
  @{ n=9;  title="Midjourney v7 : guide complet pour des visuels professionnels avec l'IA";               cat="Creation de Contenu IA" },
  @{ n=10; title="Comment tripler ses ventes avec un funnel automatise par l'IA";                         cat="Vente IA" },
  @{ n=11; title="CRM IA : meilleurs outils pour automatiser sa prospection commerciale en 2026";         cat="Vente IA" },
  @{ n=12; title="Deployer un chatbot IA pour son service client en moins de 48 heures";                  cat="Support Client IA" },
  @{ n=13; title="Comment reduire ses tickets support de 70 pourcent avec l'IA en 2026";                 cat="Support Client IA" },
  @{ n=14; title="Tutoriel n8n : creer son premier workflow d'automatisation IA en 1 heure";              cat="Tutoriels IA" },
  @{ n=15; title="Comment utiliser l'API Claude pour automatiser ses taches repetitives";                 cat="Tutoriels IA" },
  @{ n=16; title="n8n vs Make vs Zapier : quel outil d'automatisation IA choisir en 2026";               cat="Comparatifs IA" },
  @{ n=17; title="Jasper vs Copy.ai vs Claude : meilleur outil de copywriting IA en 2026";               cat="Comparatifs IA" },
  @{ n=18; title="Guide complet : lancer son business en ligne avec l'IA en 30 jours";                   cat="Guides IA" },
  @{ n=19; title="De zero a 10000 euros par mois : vivre de l'IA en 2026";                               cat="Guides IA" },
  @{ n=20; title="OpenAI o3 et Gemini Ultra : ce que les entrepreneurs doivent savoir en 2026";           cat="Actualites IA" }
)

foreach ($a in $articles) {
  Write-Host ""
  Write-Host ("=" * 50) -ForegroundColor Cyan
  Write-Host "[$($a.n)/20] $($a.title)" -ForegroundColor Yellow
  Write-Host ("=" * 50) -ForegroundColor Cyan

  $catMap = @{
    "Actualites IA"         = "Actualites IA"
    "Outils IA"             = "Outils IA"
    "Automatisation IA"     = "Automatisation IA"
    "Marketing IA"          = "Marketing IA"
    "Creation de Contenu IA"= "Creation de Contenu IA"
    "Vente IA"              = "Vente IA"
    "Support Client IA"     = "Support Client IA"
    "Tutoriels IA"          = "Tutoriels IA"
    "Comparatifs IA"        = "Comparatifs IA"
    "Guides IA"             = "Guides IA"
  }

  node scripts/generate-article.js --title $a.title --category $a.cat
  Start-Sleep -Seconds 3
}

Write-Host ""
Write-Host "Batch termine — 20 articles generes" -ForegroundColor Green
