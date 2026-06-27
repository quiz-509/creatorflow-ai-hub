#!/usr/bin/env node
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { chdir } from 'process';

const __dirname = dirname(fileURLToPath(import.meta.url));
chdir(`${__dirname}/..`);

const articles = [
  { title: "GPT-5 vs Claude 4 : Comparatif complet pour professionnels en 2026",                  cat: "Actualités IA" },
  { title: "Les 7 avancées IA qui révolutionnent le business en 2026",                             cat: "Actualités IA" },
  { title: "Perplexity AI vs ChatGPT : quel outil de recherche choisir en 2026",                  cat: "Outils IA" },
  { title: "Les 10 meilleurs outils IA gratuits pour entrepreneurs en 2026",                       cat: "Outils IA" },
  { title: "Comment automatiser son marketing avec n8n et l'IA en 2026",                          cat: "Automatisation IA" },
  { title: "Stratégie de contenu IA : générer 10x plus de leads avec moins d'effort",             cat: "Marketing IA" },
  { title: "SEO et IA : comment dominer Google en 2026 avec les outils IA",                       cat: "Marketing IA" },
  { title: "Comment créer 30 posts LinkedIn par mois avec l'IA en 2 heures",                     cat: "Création de Contenu IA" },
  { title: "Midjourney v7 : guide complet pour créer des visuels professionnels avec l'IA",       cat: "Création de Contenu IA" },
  { title: "Comment tripler ses ventes avec un funnel de vente automatisé par l'IA",              cat: "Vente IA" },
  { title: "CRM IA : les meilleurs outils pour automatiser sa prospection commerciale en 2026",   cat: "Vente IA" },
  { title: "Déployer un chatbot IA pour son service client en moins de 48 heures",                cat: "Support Client IA" },
  { title: "Comment réduire ses tickets support de 70% avec l'IA en 2026",                       cat: "Support Client IA" },
  { title: "Tutoriel n8n : créer son premier workflow d'automatisation IA en 1 heure",            cat: "Tutoriels IA" },
  { title: "Comment utiliser l'API Claude pour automatiser ses tâches répétitives",               cat: "Tutoriels IA" },
  { title: "n8n vs Make vs Zapier : quel outil d'automatisation IA choisir en 2026",             cat: "Comparatifs IA" },
  { title: "Jasper vs Copy.ai vs Claude : meilleur outil de copywriting IA en 2026",             cat: "Comparatifs IA" },
  { title: "Guide complet : lancer son business en ligne avec l'IA en 30 jours",                 cat: "Guides IA" },
  { title: "De zéro à 10 000 euros par mois : vivre de l'IA en 2026",                           cat: "Guides IA" },
  { title: "OpenAI o3 et Gemini Ultra : ce que les entrepreneurs doivent savoir en 2026",         cat: "Actualités IA" },
];

let ok = 0, fail = 0;

for (let i = 0; i < articles.length; i++) {
  const { title, cat } = articles[i];
  console.log(`\n${'='.repeat(55)}`);
  console.log(`[${i+1}/${articles.length}] ${title}`);
  console.log(`${'='.repeat(55)}`);
  try {
    execSync(
      `node scripts/generate-article.js --title "${title.replace(/"/g, '\\"')}" --category "${cat}"`,
      { stdio: 'inherit', encoding: 'utf8' }
    );
    ok++;
  } catch (e) {
    console.error(`❌ Échec article ${i+1}`);
    fail++;
  }
  if (i < articles.length - 1) await new Promise(r => setTimeout(r, 3000));
}

console.log(`\n${'='.repeat(55)}`);
console.log(`✅ Batch terminé : ${ok} réussis, ${fail} échecs`);
