import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.24.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const AGENT_BRIEFS: Record<string, string> = {
  marketing: `Tu es le Marketing AI Agent de CreatorFlow Market, employé IA chargé de l'acquisition et de la visibilité.
Tu reçois une mission du CEO. Utilise read_blog_subscribers pour connaître l'audience newsletter avant de rédiger une campagne.
Rédige le sujet et le corps de l'email de campagne, puis appelle obligatoirement request_approval avec action_type="send_campaign_email" et action_data={"subject": "...", "body": "..."} et un context expliquant la cible et l'objectif. Ne déclenche jamais un envoi sans cette approbation.
Tu peux aussi utiliser create_output pour enregistrer un plan ou une stratégie qui ne nécessite pas d'envoi immédiat.
Termine toujours avec finish_mission en résumant ce qui a été produit et ce qui est en attente d'approbation.`,

  content: `Tu es le Content AI Agent de CreatorFlow Market, employé IA chargé de la production de contenu (blog).
Tu reçois une mission du CEO. Rédige un contenu complet et de qualité, puis sauvegarde-le en brouillon avec create_blog_draft (jamais publié directement).
Utilise read_blog_articles si tu as besoin de connaître les articles existants pour éviter les doublons.
Une fois le brouillon créé, appelle obligatoirement request_approval avec action_type="publish_article" et action_data={"article_id": "<id renvoyé par create_blog_draft>"} et un context expliquant le contenu, pour demander au CEO l'autorisation de publier. Ne publie jamais sans cette approbation.
Termine toujours avec finish_mission en résumant ce que tu as produit et en précisant que la publication est en attente d'approbation.`,

  prospecting: `Tu es le Prospecting AI Agent de CreatorFlow Market, employé IA chargé de la prospection commerciale.
Tu reçois une mission du CEO. Utilise read_open_briefs pour repérer des opportunités commerciales concrètes (briefs ouverts sans proposition acceptée) et identifier des profils d'experts à approcher ou des clients à relancer.
Quand tu identifies un prospect précis à contacter par email (nom, email, raison du contact), rédige le message puis appelle obligatoirement request_approval avec action_type="send_prospect_email" et action_data={"to": "...", "subject": "...", "body": "..."} et un context expliquant pourquoi. Ne déclenche jamais un envoi sans cette approbation.
Pour des résultats qui ne sont pas des envois directs (liste de prospects qualifiés, plan de prospection), utilise create_output.
Termine avec finish_mission.`,

  support: `Tu es le Support AI Agent de CreatorFlow Market, employé IA chargé du support client.
Tu reçois une mission du CEO. Utilise read_support_tickets pour voir les tickets ouverts (status=open).
Pour chaque ticket à traiter, rédige une réponse puis appelle obligatoirement request_approval avec action_type="respond_support_ticket" et action_data={"ticket_id": "...", "response": "..."} et un context résumant le problème. Ne réponds jamais directement à un utilisateur sans cette approbation.
Termine avec finish_mission.`,
};

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'read_blog_articles',
    description: "Lire les articles du blog existants pour contexte (titre, statut, catégorie). N'expose aucune donnée sensible.",
    input_schema: {
      type: 'object',
      properties: {
        status: { type: 'string', description: "Filtrer par statut: draft, published, archived. Omettre pour tous." },
        limit: { type: 'number', description: 'Nombre maximum de résultats (défaut 10).' },
      },
    },
  },
  {
    name: 'create_blog_draft',
    description: "Créer un article de blog en brouillon (status='draft'). Ne publie jamais directement.",
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        slug: { type: 'string', description: 'slug url, kebab-case, sans accents' },
        excerpt: { type: 'string' },
        content: { type: 'string', description: 'Contenu complet en markdown/texte.' },
        category: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } },
      },
      required: ['title', 'slug', 'content'],
    },
  },
  {
    name: 'read_blog_subscribers',
    description: "Lire le nombre et un échantillon des abonnés à la newsletter du blog, pour dimensionner une campagne marketing. N'expose que l'email et la date d'inscription.",
    input_schema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Nombre maximum de résultats (défaut 20).' },
      },
    },
  },
  {
    name: 'read_open_briefs',
    description: "Lire les briefs clients ouverts (status='open'), sans proposition acceptée, pour identifier des opportunités commerciales à prospecter.",
    input_schema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Nombre maximum de résultats (défaut 15).' },
      },
    },
  },
  {
    name: 'read_support_tickets',
    description: "Lire les tickets de support clients/experts.",
    input_schema: {
      type: 'object',
      properties: {
        status: { type: 'string', description: "Filtrer par statut: open, in_progress, resolved, closed. Défaut: open." },
        limit: { type: 'number', description: 'Nombre maximum de résultats (défaut 15).' },
      },
    },
  },
  {
    name: 'create_output',
    description: "Enregistrer un livrable concret produit pendant la mission (rapport, liste, plan, brouillon d'email...). Utilisé pour tout résultat qui n'a pas d'outil dédié.",
    input_schema: {
      type: 'object',
      properties: {
        output_type: { type: 'string', description: "ex: report, email_draft, plan, lead_list" },
        output_data: { type: 'object', description: 'Contenu structuré du livrable.' },
      },
      required: ['output_type', 'output_data'],
    },
  },
  {
    name: 'request_approval',
    description: "Demander l'approbation du CEO avant une action sensible (envoi réel, publication, suppression, dépense). Bloque l'action jusqu'à validation humaine.",
    input_schema: {
      type: 'object',
      properties: {
        action_type: { type: 'string', description: "ex: publish_article, send_email, send_bulk_email, delete_data" },
        action_data: { type: 'object' },
        context: { type: 'string', description: 'Pourquoi cette action est demandée.' },
      },
      required: ['action_type', 'action_data', 'context'],
    },
  },
  {
    name: 'finish_mission',
    description: 'Termine la mission. Obligatoire en dernière étape.',
    input_schema: {
      type: 'object',
      properties: {
        result_summary: { type: 'string', description: 'Rapport final pour le CEO : ce qui a été fait, ce qui est en attente.' },
        status: { type: 'string', enum: ['completed', 'failed'] },
      },
      required: ['result_summary', 'status'],
    },
  },
];

function slugify(s: string): string {
  return s.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const { agent_slug, title, objective } = await req.json();

    if (!agent_slug || !objective) {
      return new Response(JSON.stringify({ error: 'agent_slug et objective sont requis.' }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const brief = AGENT_BRIEFS[agent_slug];
    if (!brief) {
      return new Response(JSON.stringify({ error: `Agent inconnu : ${agent_slug}` }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { data: agent } = await supabase.from('ai_agents').select('id, tasks_completed').eq('slug', agent_slug).single();
    if (!agent) {
      return new Response(JSON.stringify({ error: `Agent ${agent_slug} introuvable dans ai_agents.` }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const { data: mission, error: missionErr } = await supabase.from('agent_missions').insert({
      agent_id: agent.id,
      title: title || objective.slice(0, 80),
      objective,
      status: 'in_progress',
      started_at: new Date().toISOString(),
    }).select().single();
    if (missionErr || !mission) throw new Error(missionErr?.message || 'Échec création mission.');

    const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') ?? '' });

    const messages: Anthropic.MessageParam[] = [
      { role: 'user', content: `Mission : ${mission.title}\n\nObjectif détaillé : ${objective}` },
    ];

    let finalSummary = '';
    let finalStatus: 'completed' | 'failed' = 'completed';
    let finished = false;

    for (let iteration = 0; iteration < 8 && !finished; iteration++) {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        system: brief,
        tools: TOOLS,
        messages,
      });

      messages.push({ role: 'assistant', content: response.content });

      if (response.stop_reason !== 'tool_use') {
        const textBlock = response.content.find((b) => b.type === 'text');
        finalSummary = textBlock && textBlock.type === 'text' ? textBlock.text : 'Mission terminée sans rapport explicite.';
        finished = true;
        break;
      }

      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const block of response.content) {
        if (block.type !== 'tool_use') continue;
        let resultText = '';

        try {
          if (block.name === 'read_blog_articles') {
            const input = block.input as { status?: string; limit?: number };
            let query = supabase.from('blog_articles').select('id, title, slug, status, category, created_at').order('created_at', { ascending: false }).limit(input.limit || 10);
            if (input.status) query = query.eq('status', input.status);
            const { data, error } = await query;
            if (error) throw new Error(error.message);
            resultText = JSON.stringify(data);
          } else if (block.name === 'read_blog_subscribers') {
            const input = block.input as { limit?: number };
            const { data, error, count } = await supabase.from('blog_subscribers').select('email, created_at', { count: 'exact' }).order('created_at', { ascending: false }).limit(input.limit || 20);
            if (error) throw new Error(error.message);
            resultText = JSON.stringify({ total: count, sample: data });
          } else if (block.name === 'read_open_briefs') {
            const input = block.input as { limit?: number };
            const { data, error } = await supabase.from('briefs').select('id, titre, description, categorie, budget, created_at').eq('status', 'open').order('created_at', { ascending: false }).limit(input.limit || 15);
            if (error) throw new Error(error.message);
            resultText = JSON.stringify(data);
          } else if (block.name === 'read_support_tickets') {
            const input = block.input as { status?: string; limit?: number };
            let query = supabase.from('support_tickets').select('id, subject, message, status, priority, created_at').order('created_at', { ascending: false }).limit(input.limit || 15);
            query = query.eq('status', input.status || 'open');
            const { data, error } = await query;
            if (error) throw new Error(error.message);
            resultText = JSON.stringify(data);
          } else if (block.name === 'create_blog_draft') {
            const input = block.input as { title: string; slug: string; excerpt?: string; content: string; category?: string; tags?: string[] };
            const slug = slugify(input.slug || input.title);
            const { data, error } = await supabase.from('blog_articles').insert({
              title: input.title,
              slug,
              excerpt: input.excerpt || null,
              content: input.content,
              category: input.category || 'Actualités IA',
              tags: input.tags || [],
              status: 'draft',
              ai_generated: true,
              author: 'Content AI Agent',
            }).select('id, slug').single();
            if (error) throw new Error(error.message);
            await supabase.from('agent_outputs').insert({
              mission_id: mission.id,
              output_type: 'article_draft',
              output_data: { article_id: data.id, slug: data.slug, title: input.title },
              status: 'completed',
            });
            resultText = JSON.stringify({ ok: true, article_id: data.id, slug: data.slug });
          } else if (block.name === 'create_output') {
            const input = block.input as { output_type: string; output_data: Record<string, unknown> };
            await supabase.from('agent_outputs').insert({
              mission_id: mission.id,
              output_type: input.output_type,
              output_data: input.output_data,
              status: 'completed',
            });
            resultText = JSON.stringify({ ok: true });
          } else if (block.name === 'request_approval') {
            const input = block.input as { action_type: string; action_data: Record<string, unknown>; context: string };
            const { data: output } = await supabase.from('agent_outputs').insert({
              mission_id: mission.id,
              output_type: input.action_type,
              output_data: input.action_data,
              status: 'waiting_approval',
            }).select('id').single();
            await supabase.from('pending_approvals').insert({
              mission_id: mission.id,
              output_id: output?.id || null,
              action_type: input.action_type,
              action_data: input.action_data,
              context: input.context,
            });
            await supabase.from('agent_missions').update({ status: 'waiting_approval' }).eq('id', mission.id);
            resultText = JSON.stringify({ ok: true, note: "Approbation demandée au CEO. Action mise en attente." });
          } else if (block.name === 'finish_mission') {
            const input = block.input as { result_summary: string; status: 'completed' | 'failed' };
            finalSummary = input.result_summary;
            finalStatus = input.status;
            finished = true;
            resultText = JSON.stringify({ ok: true });
          } else {
            resultText = JSON.stringify({ error: `Outil inconnu: ${block.name}` });
          }
        } catch (toolErr) {
          resultText = JSON.stringify({ error: (toolErr as Error).message });
        }

        toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: resultText });
      }

      messages.push({ role: 'user', content: toolResults });
    }

    if (!finished) {
      finalSummary = finalSummary || 'Mission interrompue après le nombre maximum d\'itérations.';
      finalStatus = 'failed';
    }

    const missionStatusAfter = finalStatus === 'completed' && (await supabase.from('agent_missions').select('status').eq('id', mission.id).single()).data?.status === 'waiting_approval'
      ? 'waiting_approval'
      : finalStatus;

    await supabase.from('agent_missions').update({
      status: missionStatusAfter,
      result_summary: finalSummary,
      completed_at: missionStatusAfter !== 'waiting_approval' ? new Date().toISOString() : null,
    }).eq('id', mission.id);

    await supabase.from('ai_agents').update({
      tasks_completed: (agent.tasks_completed || 0) + 1,
      last_active: new Date().toISOString(),
    }).eq('id', agent.id);

    return new Response(JSON.stringify({
      mission_id: mission.id,
      status: missionStatusAfter,
      result_summary: finalSummary,
    }), { headers: { ...cors, 'Content-Type': 'application/json' } });

  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
});
