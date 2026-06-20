
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CEO_EMAIL = process.env('CEO_EMAIL') ?? 'pjoacenel@gmail.com';
const MAX_ITERATIONS = 15;
const MAX_TOKENS = 8192;
const WEB_SEARCH_MAX_PER_MISSION = 10;

// ---------------------------------------------------------------------------
// AGENT BRIEFS — updated with Niveau 1 & 2 capabilities
// ---------------------------------------------------------------------------
const AGENT_BRIEFS: Record<string, string> = {
  marketing: `Tu es le Marketing AI Agent de CreatorFlow Market, un employé IA disponible sur la marketplace.
Un client t'a confié une mission décrite dans l'objectif. Exécute-la comme le ferait un consultant marketing senior.

CAPACITÉS DISPONIBLES :
- Recherche web (search_web) : analyse marché, concurrents, tendances actuelles — utilise-la avant de produire une stratégie
- Lecture d'URL (read_url) : consulte un site concurrent, une landing page, un article de référence
- Mémoire client (read_client_memory) : retrouve les préférences et contexte des missions passées
- Sauvegarde mémoire (save_to_memory) : mémorise le contexte client pour les prochaines missions
- Rapports (create_report) : structure une analyse en sections documentées
- Livrable (create_output) : enregistre le livrable principal (stratégie, plan, calendrier, emails...)
- Notification CEO (notify_ceo) : si tu découvres une information critique pour l'entreprise

PROCESSUS :
1. Lis d'abord la mémoire client si disponible (read_client_memory)
2. Effectue les recherches nécessaires (search_web, read_url)
3. Produis le livrable complet avec create_output — contenu complet dans output_data, pas un résumé
4. Si applicable, sauvegarde les infos clés du client (save_to_memory)
5. Termine avec finish_mission

Si le client demande une campagne email interne CreatorFlow : read_blog_subscribers puis request_approval (action_type="send_campaign_email"). Jamais sans approbation.`,

  content: `Tu es le Content AI Agent de CreatorFlow Market, un employé IA disponible sur la marketplace.
Un client t'a confié une mission de création de contenu. Produis un contenu complet, professionnel et prêt à l'emploi.

CAPACITÉS DISPONIBLES :
- Recherche web (search_web) : vérifie les faits, trouve des angles, analyse ce qui performe dans la niche
- Lecture d'URL (read_url) : consulte un article de référence, un concurrent, une source d'inspiration
- Mémoire client (read_client_memory) : ton de voix du client, thématiques récurrentes, audience cible
- Sauvegarde mémoire (save_to_memory) : mémorise le style et les préférences éditoriales du client
- Livrable (create_output) : enregistre le contenu final (output_type="content_piece", output_data={"title":..., "body":...})
- Blog interne (create_blog_draft) : uniquement pour les articles du blog CreatorFlow lui-même

PROCESSUS :
1. Lis la mémoire client si disponible (read_client_memory) pour adapter le ton
2. Recherche les meilleures sources ou tendances (search_web) si pertinent
3. Rédige le contenu complet — pas un plan, le contenu réel
4. Enregistre avec create_output, contenu entier dans output_data.body
5. Mémorise le style client si c'est une première mission (save_to_memory)
6. Termine avec finish_mission`,

  prospecting: `Tu es le Prospecting AI Agent de CreatorFlow Market, un employé IA disponible sur la marketplace.
Un client t'a confié une mission de prospection. Exécute-la avec rigueur, comme un business developer expérimenté.

CAPACITÉS DISPONIBLES :
- Recherche web (search_web) : trouve des prospects réels, vérifie des entreprises, analyse un secteur
- Lecture d'URL (read_url) : consulte le site d'une entreprise cible, son LinkedIn, ses offres
- Mémoire client (read_client_memory) : ICP du client, secteurs ciblés, séquences passées
- Sauvegarde mémoire (save_to_memory) : mémorise le profil de prospect idéal pour ce client
- Livrable (create_output) : liste de prospects qualifiés, séquences d'emails, plan de prospection complet
- Rapports (create_report) : analyse d'un marché, d'une niche, d'une opportunité

PROCESSUS :
1. Lis la mémoire client pour comprendre le contexte (read_client_memory)
2. Effectue les recherches nécessaires pour identifier des cibles réelles (search_web)
3. Qualifie chaque prospect avec des données concrètes
4. Produis le livrable avec create_output — contenu complet, actionnable immédiatement
5. Mémorise le profil ICP si défini pour la première fois (save_to_memory)
6. Termine avec finish_mission

Pour les missions CreatorFlow interne : read_open_briefs pour identifier des opportunités. request_approval avant tout envoi réel.`,

  support: `Tu es le Support AI Agent de CreatorFlow Market, un employé IA disponible sur la marketplace.
Un client t'a confié une mission support. Réponds avec précision, clarté et efficacité.

CAPACITÉS DISPONIBLES :
- Recherche web (search_web) : trouve une solution technique, vérifie une documentation officielle
- Lecture d'URL (read_url) : consulte une doc, un guide, une page de statut de service
- Mémoire client (read_client_memory) : contexte technique du client, outils utilisés, problèmes passés
- Sauvegarde mémoire (save_to_memory) : mémorise l'environnement technique du client
- Tickets (create_support_ticket / update_support_ticket) : pour les tickets de la plateforme
- Livrable (create_output) : FAQ, procédure, réponse rédigée, base de connaissances
- Rapports (create_report) : analyse des tickets, rapport de résolution

PROCESSUS :
1. Lis le contexte client (read_client_memory) pour comprendre son environnement
2. Recherche la solution si nécessaire (search_web, read_url)
3. Produis la réponse ou le livrable complet (create_output)
4. Mémorise les infos techniques utiles pour les prochaines missions (save_to_memory)
5. Termine avec finish_mission

Pour les tickets internes CreatorFlow : read_support_tickets, puis update_support_ticket avec la réponse, puis request_approval si action sensible.`,
};

// ---------------------------------------------------------------------------
// TOOLS
// ---------------------------------------------------------------------------
const TOOLS: Anthropic.Tool[] = [
  // --- Niveau 1 : Lecture interne ---
  {
    name: 'read_blog_articles',
    description: "Lire les articles du blog CreatorFlow existants (titre, statut, catégorie).",
    input_schema: {
      type: 'object',
      properties: {
        status: { type: 'string', description: "Filtrer par statut : draft, published, archived. Omettre pour tous." },
        limit: { type: 'number', description: 'Nombre max de résultats (défaut 10).' },
      },
    },
  },
  {
    name: 'read_blog_subscribers',
    description: "Lire le nombre et un échantillon des abonnés à la newsletter.",
    input_schema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Nombre max de résultats (défaut 20).' },
      },
    },
  },
  {
    name: 'read_open_briefs',
    description: "Lire les briefs clients ouverts sans proposition acceptée.",
    input_schema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Nombre max de résultats (défaut 15).' },
      },
    },
  },
  {
    name: 'read_support_tickets',
    description: "Lire les tickets de support clients.",
    input_schema: {
      type: 'object',
      properties: {
        status: { type: 'string', description: "Filtrer par statut : open, in_progress, resolved, closed. Défaut : open." },
        limit: { type: 'number', description: 'Nombre max de résultats (défaut 15).' },
      },
    },
  },
  {
    name: 'read_mission_history',
    description: "Lire l'historique des missions passées du client courant (missions complétées, avec résumé).",
    input_schema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Nombre max de missions à retourner (défaut 5).' },
      },
    },
  },

  // --- Niveau 1 : Écriture interne ---
  {
    name: 'create_blog_draft',
    description: "Créer un article de blog en brouillon pour le blog CreatorFlow. Ne publie jamais directement.",
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        slug: { type: 'string', description: 'slug url, kebab-case, sans accents' },
        excerpt: { type: 'string' },
        content: { type: 'string', description: 'Contenu complet en markdown.' },
        category: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } },
      },
      required: ['title', 'slug', 'content'],
    },
  },
  {
    name: 'create_support_ticket',
    description: "Créer un nouveau ticket de support sur la plateforme CreatorFlow.",
    input_schema: {
      type: 'object',
      properties: {
        subject: { type: 'string', description: 'Titre du ticket.' },
        message: { type: 'string', description: 'Contenu détaillé du ticket.' },
        priority: { type: 'string', description: "Priorité : low, medium, high, urgent. Défaut : medium." },
      },
      required: ['subject', 'message'],
    },
  },
  {
    name: 'update_support_ticket',
    description: "Mettre à jour un ticket de support existant : ajouter une réponse, changer le statut.",
    input_schema: {
      type: 'object',
      properties: {
        ticket_id: { type: 'string', description: 'UUID du ticket.' },
        agent_response: { type: 'string', description: 'Réponse rédigée par l\'agent.' },
        status: { type: 'string', description: "Nouveau statut : open, in_progress, resolved, closed." },
      },
      required: ['ticket_id'],
    },
  },
  {
    name: 'create_report',
    description: "Créer un rapport structuré en sections. Idéal pour les analyses, audits, bilans.",
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Titre du rapport.' },
        sections: {
          type: 'array',
          description: 'Sections du rapport.',
          items: {
            type: 'object',
            properties: {
              heading: { type: 'string' },
              content: { type: 'string' },
            },
            required: ['heading', 'content'],
          },
        },
      },
      required: ['title', 'sections'],
    },
  },
  {
    name: 'create_output',
    description: "Enregistrer le livrable principal de la mission (rapport, liste, plan, contenu rédigé...). Mettre le contenu complet dans output_data.",
    input_schema: {
      type: 'object',
      properties: {
        output_type: { type: 'string', description: "ex: report, email_draft, plan, lead_list, content_piece, faq, strategy" },
        output_data: { type: 'object', description: 'Contenu complet et structuré du livrable.' },
      },
      required: ['output_type', 'output_data'],
    },
  },
  {
    name: 'notify_ceo',
    description: "Envoyer une notification email au CEO. À utiliser pour les découvertes importantes, alertes, ou résultats remarquables nécessitant son attention immédiate.",
    input_schema: {
      type: 'object',
      properties: {
        subject: { type: 'string', description: 'Sujet de la notification.' },
        message: { type: 'string', description: 'Corps du message. Sois précis et actionnable.' },
      },
      required: ['subject', 'message'],
    },
  },
  {
    name: 'request_approval',
    description: "Demander l'approbation du CEO avant une action sensible (envoi email, publication, suppression, dépense). Bloque jusqu'à validation.",
    input_schema: {
      type: 'object',
      properties: {
        action_type: { type: 'string', description: "ex: publish_article, send_campaign_email, send_prospect_email, respond_support_ticket" },
        action_data: { type: 'object' },
        context: { type: 'string', description: 'Pourquoi cette action est demandée.' },
      },
      required: ['action_type', 'action_data', 'context'],
    },
  },
  {
    name: 'finish_mission',
    description: 'Terminer la mission. Obligatoire en dernière étape. Résume ce qui a été produit.',
    input_schema: {
      type: 'object',
      properties: {
        result_summary: { type: 'string', description: 'Rapport final : ce qui a été fait, les livrables produits, les points en attente.' },
        status: { type: 'string', enum: ['completed', 'failed'] },
      },
      required: ['result_summary', 'status'],
    },
  },

  // --- Niveau 2 : Web & mémoire ---
  {
    name: 'search_web',
    description: "Effectuer une recherche web pour trouver des informations récentes, analyser la concurrence, vérifier des faits, identifier des prospects. Retourne les meilleurs résultats structurés.",
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Requête de recherche en français ou anglais.' },
        max_results: { type: 'number', description: 'Nombre de résultats souhaités (défaut 5, max 10).' },
      },
      required: ['query'],
    },
  },
  {
    name: 'read_url',
    description: "Lire et extraire le contenu textuel d'une URL : site concurrent, article de blog, landing page, documentation. Retourne le texte principal de la page.",
    input_schema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL complète à lire (https://...).' },
      },
      required: ['url'],
    },
  },
  {
    name: 'read_client_memory',
    description: "Lire la mémoire persistante enregistrée sur ce client : préférences, contexte business, historique. À appeler en début de mission pour personnaliser le travail.",
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'save_to_memory',
    description: "Sauvegarder une information importante sur le client pour les prochaines missions. Les types recommandés : 'business_context', 'tone_of_voice', 'target_audience', 'icp', 'preferences', 'technical_stack'.",
    input_schema: {
      type: 'object',
      properties: {
        context_type: { type: 'string', description: "Catégorie de mémoire : 'business_context', 'tone_of_voice', 'target_audience', 'icp', 'preferences', 'technical_stack'." },
        content: { type: 'string', description: 'Contenu à mémoriser. Sois précis et synthétique.' },
      },
      required: ['context_type', 'content'],
    },
  },
  {
    name: 'read_client_file',
    description: "Lire le contenu extrait d'un fichier uploadé par le client (PDF, DOCX, CSV, texte).",
    input_schema: {
      type: 'object',
      properties: {
        file_id: { type: 'string', description: 'UUID du fichier dans client_files.' },
      },
      required: ['file_id'],
    },
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function slugify(s: string): string {
  return s.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

async function callSendEmail(
  supabaseUrl: string,
  serviceKey: string,
  to: string,
  subject: string,
  body: string,
): Promise<void> {
  try {
    await fetch(`${supabaseUrl}/functions/v1/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
        'apikey': serviceKey,
      },
      body: JSON.stringify({ type: 'custom', to, data: { subject, body } }),
    });
  } catch (_) {
    // Notification non-critique, on ne bloque pas la mission
  }
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------
async function handler(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const supabaseUrl = process.env('SUPABASE_URL') ?? '';
  const serviceKey = process.env('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const anthropicKey = process.env('ANTHROPIC_API_KEY') ?? '';
  const tavilyKey = process.env('TAVILY_API_KEY') ?? '';

  try {
    const { agent_slug, title, objective, client_id, mission_id: existing_mission_id } = await req.json();

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

    const supabase = createClient(supabaseUrl, serviceKey);

    // Charger l'agent
    const { data: agent } = await supabase
      .from('ai_agents')
      .select('id, tasks_completed')
      .eq('slug', agent_slug)
      .single();

    if (!agent) {
      return new Response(JSON.stringify({ error: `Agent ${agent_slug} introuvable dans ai_agents.` }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    // Créer ou récupérer la mission
    let mission: Record<string, unknown>;
    if (existing_mission_id) {
      const { data: m, error: mErr } = await supabase
        .from('agent_missions')
        .update({ status: 'in_progress', started_at: new Date().toISOString() })
        .eq('id', existing_mission_id)
        .select()
        .single();
      if (mErr || !m) throw new Error(mErr?.message || 'Mission introuvable.');
      mission = m;
    } else {
      const { data: m, error: mErr } = await supabase
        .from('agent_missions')
        .insert({
          agent_id: agent.id,
          title: title || objective.slice(0, 80),
          objective,
          status: 'in_progress',
          started_at: new Date().toISOString(),
          created_by: client_id || null,
          payment_status: 'free',
        })
        .select()
        .single();
      if (mErr || !m) throw new Error(mErr?.message || 'Échec création mission.');
      mission = m;
    }

    const missionClientId = (mission.created_by as string) || null;

    // Charger la mémoire client (Niveau 2)
    let memoryBlock = '';
    if (missionClientId) {
      const { data: memories } = await supabase
        .from('agent_memory')
        .select('context_type, content, updated_at')
        .eq('agent_slug', agent_slug)
        .eq('client_id', missionClientId);
      if (memories?.length) {
        memoryBlock = '[MÉMOIRE CLIENT — informations des missions précédentes]\n' +
          memories.map((m: Record<string, string>) => `• ${m.context_type} : ${m.content}`).join('\n');
      }
    }

    // Charger l'historique des missions (Niveau 1)
    let historyBlock = '';
    if (missionClientId) {
      const { data: history } = await supabase
        .from('agent_missions')
        .select('title, result_summary, completed_at')
        .eq('created_by', missionClientId)
        .eq('agent_id', agent.id)
        .eq('status', 'completed')
        .neq('id', mission.id as string)
        .order('completed_at', { ascending: false })
        .limit(3);
      if (history?.length) {
        historyBlock = '[MISSIONS PRÉCÉDENTES AVEC CE CLIENT]\n' +
          history.map((h: Record<string, string>) =>
            `• ${h.title} (${h.completed_at?.slice(0, 10) || 'date inconnue'}) : ${(h.result_summary || '').slice(0, 300)}`
          ).join('\n');
      }
    }

    // Construire le premier message avec contexte enrichi
    let userContent = '';
    if (memoryBlock) userContent += memoryBlock + '\n\n';
    if (historyBlock) userContent += historyBlock + '\n\n';
    if (memoryBlock || historyBlock) userContent += '---\n\n';
    userContent += `Mission : ${mission.title as string}\n\nObjectif détaillé : ${objective}`;

    const anthropic = new Anthropic({ apiKey: anthropicKey });

    const messages: Anthropic.MessageParam[] = [
      { role: 'user', content: userContent },
    ];

    let finalSummary = '';
    let finalStatus: 'completed' | 'failed' = 'completed';
    let finished = false;
    let webSearchCount = 0;

    for (let iteration = 0; iteration < MAX_ITERATIONS && !finished; iteration++) {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: MAX_TOKENS,
        system: brief,
        tools: TOOLS,
        messages,
      });

      messages.push({ role: 'assistant', content: response.content });

      if (response.stop_reason !== 'tool_use') {
        const textBlock = response.content.find((b) => b.type === 'text');
        finalSummary = textBlock?.type === 'text' ? textBlock.text : 'Mission terminée.';
        finished = true;
        break;
      }

      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const block of response.content) {
        if (block.type !== 'tool_use') continue;
        let resultText = '';

        try {
          // ----------------------------------------------------------------
          // NIVEAU 1 — Lecture interne
          // ----------------------------------------------------------------
          if (block.name === 'read_blog_articles') {
            const input = block.input as { status?: string; limit?: number };
            let query = supabase
              .from('blog_articles')
              .select('id, title, slug, status, category, created_at')
              .order('created_at', { ascending: false })
              .limit(input.limit || 10);
            if (input.status) query = query.eq('status', input.status);
            const { data, error } = await query;
            if (error) throw new Error(error.message);
            resultText = JSON.stringify(data);

          } else if (block.name === 'read_blog_subscribers') {
            const input = block.input as { limit?: number };
            const { data, error, count } = await supabase
              .from('blog_subscribers')
              .select('email, created_at', { count: 'exact' })
              .order('created_at', { ascending: false })
              .limit(input.limit || 20);
            if (error) throw new Error(error.message);
            resultText = JSON.stringify({ total: count, sample: data });

          } else if (block.name === 'read_open_briefs') {
            const input = block.input as { limit?: number };
            const { data, error } = await supabase
              .from('briefs')
              .select('id, titre, description, categorie, budget, created_at')
              .eq('status', 'open')
              .order('created_at', { ascending: false })
              .limit(input.limit || 15);
            if (error) throw new Error(error.message);
            resultText = JSON.stringify(data);

          } else if (block.name === 'read_support_tickets') {
            const input = block.input as { status?: string; limit?: number };
            let query = supabase
              .from('support_tickets')
              .select('id, subject, message, status, priority, created_at')
              .order('created_at', { ascending: false })
              .limit(input.limit || 15);
            query = query.eq('status', input.status || 'open');
            const { data, error } = await query;
            if (error) throw new Error(error.message);
            resultText = JSON.stringify(data);

          } else if (block.name === 'read_mission_history') {
            const input = block.input as { limit?: number };
            if (!missionClientId) {
              resultText = JSON.stringify({ note: 'Aucun client identifié pour cette mission.' });
            } else {
              const { data, error } = await supabase
                .from('agent_missions')
                .select('title, objective, result_summary, status, completed_at')
                .eq('created_by', missionClientId)
                .eq('agent_id', agent.id)
                .eq('status', 'completed')
                .neq('id', mission.id as string)
                .order('completed_at', { ascending: false })
                .limit(input.limit || 5);
              if (error) throw new Error(error.message);
              resultText = JSON.stringify(data);
            }

          // ----------------------------------------------------------------
          // NIVEAU 1 — Écriture interne
          // ----------------------------------------------------------------
          } else if (block.name === 'create_blog_draft') {
            const input = block.input as {
              title: string; slug: string; excerpt?: string;
              content: string; category?: string; tags?: string[];
            };
            const slug = slugify(input.slug || input.title);
            const { data, error } = await supabase
              .from('blog_articles')
              .insert({
                title: input.title,
                slug,
                excerpt: input.excerpt || null,
                content: input.content,
                category: input.category || 'Actualités IA',
                tags: input.tags || [],
                status: 'draft',
                ai_generated: true,
                author: 'Content AI Agent',
              })
              .select('id, slug')
              .single();
            if (error) throw new Error(error.message);
            await supabase.from('agent_outputs').insert({
              mission_id: mission.id,
              output_type: 'article_draft',
              output_data: { article_id: data.id, slug: data.slug, title: input.title },
              status: 'completed',
            });
            resultText = JSON.stringify({ ok: true, article_id: data.id, slug: data.slug });

          } else if (block.name === 'create_support_ticket') {
            const input = block.input as { subject: string; message: string; priority?: string };
            const { data, error } = await supabase
              .from('support_tickets')
              .insert({
                subject: input.subject,
                message: input.message,
                priority: input.priority || 'medium',
                status: 'open',
                created_by: missionClientId,
              })
              .select('id')
              .single();
            if (error) throw new Error(error.message);
            resultText = JSON.stringify({ ok: true, ticket_id: data.id });

          } else if (block.name === 'update_support_ticket') {
            const input = block.input as { ticket_id: string; agent_response?: string; status?: string };
            const updates: Record<string, unknown> = {};
            if (input.agent_response) updates.agent_response = input.agent_response;
            if (input.status) {
              updates.status = input.status;
              if (input.status === 'resolved' || input.status === 'closed') {
                updates.resolved_at = new Date().toISOString();
              }
            }
            const { error } = await supabase
              .from('support_tickets')
              .update(updates)
              .eq('id', input.ticket_id);
            if (error) throw new Error(error.message);
            resultText = JSON.stringify({ ok: true });

          } else if (block.name === 'create_report') {
            const input = block.input as { title: string; sections: Array<{ heading: string; content: string }> };
            const { data, error } = await supabase
              .from('agent_reports')
              .insert({
                mission_id: mission.id,
                agent_slug,
                title: input.title,
                sections: input.sections,
              })
              .select('id')
              .single();
            if (error) throw new Error(error.message);
            // Aussi sauvegarder comme output pour l'affichage client
            await supabase.from('agent_outputs').insert({
              mission_id: mission.id,
              output_type: 'report',
              output_data: {
                title: input.title,
                body: input.sections.map((s) => `## ${s.heading}\n\n${s.content}`).join('\n\n'),
                sections: input.sections,
              },
              status: 'completed',
            });
            resultText = JSON.stringify({ ok: true, report_id: data.id });

          } else if (block.name === 'create_output') {
            const input = block.input as { output_type: string; output_data: Record<string, unknown> };
            await supabase.from('agent_outputs').insert({
              mission_id: mission.id,
              output_type: input.output_type,
              output_data: input.output_data,
              status: 'completed',
            });
            resultText = JSON.stringify({ ok: true });

          } else if (block.name === 'notify_ceo') {
            const input = block.input as { subject: string; message: string };
            await callSendEmail(
              supabaseUrl, serviceKey, CEO_EMAIL,
              `[Agent ${agent_slug}] ${input.subject}`,
              `Mission : ${mission.title as string}\nClient : ${missionClientId || 'N/A'}\n\n${input.message}`,
            );
            resultText = JSON.stringify({ ok: true });

          } else if (block.name === 'request_approval') {
            const input = block.input as {
              action_type: string;
              action_data: Record<string, unknown>;
              context: string;
            };
            const { data: output } = await supabase
              .from('agent_outputs')
              .insert({
                mission_id: mission.id,
                output_type: input.action_type,
                output_data: input.action_data,
                status: 'waiting_approval',
              })
              .select('id')
              .single();
            await supabase.from('pending_approvals').insert({
              mission_id: mission.id,
              output_id: output?.id || null,
              action_type: input.action_type,
              action_data: input.action_data,
              context: input.context,
            });
            await supabase.from('agent_missions').update({ status: 'waiting_approval' }).eq('id', mission.id);
            // Notifier le CEO
            await callSendEmail(
              supabaseUrl, serviceKey, CEO_EMAIL,
              `[Approbation requise] ${input.action_type}`,
              `L'agent ${agent_slug} demande ton approbation.\n\nContexte : ${input.context}\n\nMission : ${mission.title as string}\n\nDonnées :\n${JSON.stringify(input.action_data, null, 2)}\n\nConnecte-toi à creatorflowmarket.com pour approuver ou rejeter.`,
            );
            resultText = JSON.stringify({ ok: true, note: 'Approbation demandée au CEO.' });

          } else if (block.name === 'finish_mission') {
            const input = block.input as { result_summary: string; status: 'completed' | 'failed' };
            finalSummary = input.result_summary;
            finalStatus = input.status;
            finished = true;
            resultText = JSON.stringify({ ok: true });

          // ----------------------------------------------------------------
          // NIVEAU 2 — Web & mémoire
          // ----------------------------------------------------------------
          } else if (block.name === 'search_web') {
            if (webSearchCount >= WEB_SEARCH_MAX_PER_MISSION) {
              resultText = JSON.stringify({ error: `Limite de ${WEB_SEARCH_MAX_PER_MISSION} recherches web atteinte pour cette mission.` });
            } else if (!tavilyKey) {
              resultText = JSON.stringify({ error: 'TAVILY_API_KEY non configurée. Ajoute-la dans les secrets Supabase.' });
            } else {
              const input = block.input as { query: string; max_results?: number };
              webSearchCount++;
              const resp = await fetch('https://api.tavily.com/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  api_key: tavilyKey,
                  query: input.query,
                  max_results: Math.min(input.max_results || 5, 10),
                  search_depth: 'basic',
                  include_answer: true,
                }),
                signal: AbortSignal.timeout || AbortSignal.abort(12000),
              });
              if (!resp.ok) throw new Error(`Tavily error ${resp.status}`);
              const data = await resp.json() as {
                answer?: string;
                results?: Array<{ title: string; url: string; content: string }>;
              };
              const results = (data.results || []).map((r) => ({
                title: r.title,
                url: r.url,
                snippet: r.content.slice(0, 500),
              }));
              resultText = JSON.stringify({ answer: data.answer || null, results });
            }

          } else if (block.name === 'read_url') {
            const input = block.input as { url: string };
            // Sécurité basique : pas d'URLs locales
            if (/^https?:\/\/(localhost|127\.|10\.|192\.168\.|::1)/.test(input.url)) {
              resultText = JSON.stringify({ error: 'URLs locales non autorisées.' });
            } else {
              const resp = await fetch(`https://r.jina.ai/${input.url}`, {
                headers: {
                  'Accept': 'text/plain',
                  'X-No-Cache': 'true',
                  'X-Return-Format': 'text',
                },
                signal: AbortSignal.timeout || AbortSignal.abort(15000),
              });
              if (!resp.ok) throw new Error(`Jina Reader error ${resp.status} pour ${input.url}`);
              const text = await resp.text();
              // Limiter à 4000 chars pour économiser les tokens
              resultText = JSON.stringify({ url: input.url, content: text.slice(0, 4000) });
            }

          } else if (block.name === 'read_client_memory') {
            if (!missionClientId) {
              resultText = JSON.stringify({ note: 'Aucun client identifié, pas de mémoire disponible.' });
            } else {
              const { data, error } = await supabase
                .from('agent_memory')
                .select('context_type, content, updated_at')
                .eq('agent_slug', agent_slug)
                .eq('client_id', missionClientId);
              if (error) throw new Error(error.message);
              resultText = data?.length
                ? JSON.stringify(data)
                : JSON.stringify({ note: 'Aucune mémoire enregistrée pour ce client.' });
            }

          } else if (block.name === 'save_to_memory') {
            if (!missionClientId) {
              resultText = JSON.stringify({ note: 'Pas de client identifié, mémoire non sauvegardée.' });
            } else {
              const input = block.input as { context_type: string; content: string };
              const { error } = await supabase
                .from('agent_memory')
                .upsert({
                  agent_slug,
                  client_id: missionClientId,
                  context_type: input.context_type,
                  content: input.content,
                  updated_at: new Date().toISOString(),
                }, { onConflict: 'agent_slug,client_id,context_type' });
              if (error) throw new Error(error.message);
              resultText = JSON.stringify({ ok: true, saved: input.context_type });
            }

          } else if (block.name === 'read_client_file') {
            const input = block.input as { file_id: string };
            const { data, error } = await supabase
              .from('client_files')
              .select('filename, file_type, content_extracted, uploaded_at')
              .eq('id', input.file_id)
              .single();
            if (error) throw new Error(error.message);
            if (!data?.content_extracted) {
              resultText = JSON.stringify({ error: 'Contenu du fichier non extrait ou fichier introuvable.' });
            } else {
              resultText = JSON.stringify({
                filename: data.filename,
                file_type: data.file_type,
                content: data.content_extracted.slice(0, 6000),
              });
            }

          } else {
            resultText = JSON.stringify({ error: `Outil inconnu : ${block.name}` });
          }

        } catch (toolErr) {
          resultText = JSON.stringify({ error: (toolErr as Error).message });
        }

        toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: resultText });
      }

      messages.push({ role: 'user', content: toolResults });
    }

    if (!finished) {
      finalSummary = finalSummary || `Mission interrompue après ${MAX_ITERATIONS} itérations.`;
      finalStatus = 'failed';
    }

    // Statut final (ne pas écraser waiting_approval)
    const { data: currentMission } = await supabase
      .from('agent_missions')
      .select('status')
      .eq('id', mission.id as string)
      .single();

    const missionStatusAfter = currentMission?.status === 'waiting_approval'
      ? 'waiting_approval'
      : finalStatus;

    await supabase.from('agent_missions').update({
      status: missionStatusAfter,
      result_summary: finalSummary,
      completed_at: missionStatusAfter !== 'waiting_approval' ? new Date().toISOString() : null,
    }).eq('id', mission.id as string);

    // Livrable de secours si l'agent a oublié create_output
    if (finalStatus === 'completed' && finalSummary) {
      const { count } = await supabase
        .from('agent_outputs')
        .select('id', { count: 'exact', head: true })
        .eq('mission_id', mission.id as string)
        .eq('status', 'completed');
      if (!count) {
        await supabase.from('agent_outputs').insert({
          mission_id: mission.id,
          output_type: 'summary',
          output_data: { title: mission.title as string, body: finalSummary },
          status: 'completed',
        });
      }
    }

    // Notification CEO automatique pour les missions payées
    const isPaid = (mission.payment_status as string) === 'paid';
    const isFailed = finalStatus === 'failed';
    if (isPaid || isFailed) {
      const icon = isFailed ? '❌' : '✅';
      await callSendEmail(
        supabaseUrl, serviceKey, CEO_EMAIL,
        `${icon} Mission ${finalStatus === 'completed' ? 'complétée' : 'échouée'} — ${mission.title as string}`,
        `Agent : ${agent_slug}\nMission : ${mission.title as string}\nClient : ${missionClientId || 'N/A'}\nStatut : ${missionStatusAfter}\n\nRésumé :\n${finalSummary.slice(0, 1500)}\n\nVoir le livrable : https://creatorflowmarket.com/admin.html`,
      );
    }

    // Mettre à jour les stats de l'agent
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
