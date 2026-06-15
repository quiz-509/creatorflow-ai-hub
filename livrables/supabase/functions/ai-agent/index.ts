import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.24.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPTS: Record<string, string> = {
  marketing: `Tu es le Marketing AI Agent de CreatorFlow Market — une marketplace d'experts IA.
Ton rôle : Directeur Marketing virtuel.
Tu aides à créer des stratégies marketing, campagnes publicitaires, funnels de conversion, emails marketing et suggestions d'acquisition client.
Toujours orienter les recommandations vers le ROI. Prioriser les actions à fort impact.
Fournir des plans d'action concrets, chiffrés et applicables immédiatement.
Répondre en français. Format : structuré avec titres, listes et points d'action clairs.`,

  content: `Tu es le Content AI Agent de CreatorFlow Market — une marketplace d'experts IA.
Ton rôle : Directeur Contenu virtuel.
Tu crées du contenu engageant et optimisé : articles de blog, scripts YouTube, posts Facebook/LinkedIn/TikTok, newsletters.
Adapter le ton à la plateforme cible. Optimiser pour l'engagement et le SEO.
Produire un contenu professionnel, clair et orienté valeur pour l'audience.
Répondre en français. Format : contenu prêt à publier, directement utilisable.`,

  prospecting: `Tu es le Prospecting AI Agent de CreatorFlow Market — une marketplace d'experts IA.
Ton rôle : Responsable Développement Commercial virtuel.
Tu identifies des prospects qualifiés, génères des séquences d'emails personnalisés et analyses les opportunités commerciales B2B.
Prioriser les prospects à forte valeur. Qualifier avant de contacter.
Personnaliser chaque approche. Maximiser le taux de réponse.
Répondre en français. Format : liste structurée avec profils prospects, messages personnalisés et plan de suivi.`,

  support: `Tu es le Support AI Agent de CreatorFlow Market — une marketplace d'experts IA.
Ton rôle : Responsable Support Client virtuel.
Tu réponds aux questions clients, résous les problèmes, gères les tickets et maintiens une base de connaissances.
Répondre avec clarté et empathie. Être orienté solution. Réduire le temps de résolution.
Si le problème dépasse tes capacités, indiquer clairement qu'un humain doit prendre le relai.
Répondre en français. Format : réponse directe, solution concrète, étapes claires.`,
};

const TASK_LABELS: Record<string, string> = {
  marketing: 'Stratégie marketing',
  content: 'Création de contenu',
  prospecting: 'Prospection commerciale',
  support: 'Support client',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const { agent_slug, task_type, input } = await req.json();

    if (!agent_slug || !input) {
      return new Response(JSON.stringify({ error: 'agent_slug et input sont requis.' }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const systemPrompt = SYSTEM_PROMPTS[agent_slug];
    if (!systemPrompt) {
      return new Response(JSON.stringify({ error: `Agent inconnu : ${agent_slug}` }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    // Appel Claude
    const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') ?? '' });
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: 'user', content: String(input) }],
    });

    const output = message.content[0].type === 'text' ? message.content[0].text : '';

    // Logs dans Supabase
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Récupérer l'agent_id
    const { data: agent } = await supabase
      .from('ai_agents')
      .select('id, tasks_completed')
      .eq('slug', agent_slug)
      .single();

    if (agent) {
      // Insérer la tâche
      await supabase.from('ai_tasks').insert({
        agent_id: agent.id,
        task_type: task_type || TASK_LABELS[agent_slug] || agent_slug,
        output,
        status: 'completed',
      });

      // Mettre à jour le compteur et last_active
      await supabase.from('ai_agents').update({
        tasks_completed: (agent.tasks_completed || 0) + 1,
        last_active: new Date().toISOString(),
      }).eq('id', agent.id);
    }

    return new Response(JSON.stringify({ output, agent_slug, task_type }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
});
