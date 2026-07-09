// ============================================================
// LEGACY — support-agent
// Remplacé par : support-heartbeat (Employee-First architecture)
// Raison : ancienne architecture chat-based sans internal_requests ni profil DB.
//          Le support est maintenant géré via Kai (Kai's heartbeat + internal_requests).
// Références vérifiées : app/ (NON), app/dashboard-client.html (NON)
// Seule référence restante : livrables/sites-web/dashboard-client.html (ancienne version dev)
// Ne pas supprimer : contient FAQ_KB et logique de routing tickets — utile comme référence.
// Date marquage LEGACY : 2026-07-09
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `Tu es le Support AI Agent de CreatorFlow Market — une marketplace hybride combinant experts humains et agents IA.

Ton rôle : Résoudre les problèmes clients rapidement et avec empathie. Tu as accès à des outils pour consulter le profil client, créer des tickets et rechercher dans la base de connaissance.

Règles :
- Toujours commencer par appeler get_client_context pour personnaliser ta réponse
- Utiliser search_faq avant de répondre à une question technique
- Créer un ticket si le problème nécessite un suivi ou dépasse 2 échanges
- Escalader à un humain si : remboursement > 24h, litige mission, problème de sécurité
- Répondre en français, ton chaleureux et professionnel
- Format : réponse directe d'abord, puis explication si nécessaire`;

const FAQ_KB = `
# CreatorFlow Market — Base de connaissances Support

## Paiements
- Comment payer une mission ? Allez dans Dashboard → Missions → cliquez la mission → "Payer via Stripe". Paiement 100% sécurisé.
- Remboursement possible ? Oui dans les 24h si la mission n'a pas démarré. Au-delà, escalader à un humain.
- Délai de paiement expert : dès que le client valide la livraison, le virement est initié sous 2-5 jours ouvrés.

## Missions
- Déposer un brief : Dashboard client → "Nouveau brief" → remplir le formulaire → soumettre. Propositions sous 24-48h.
- Valider une livraison : Dashboard → Mission → "Valider la livraison". Déclenche le paiement expert.
- Mission bloquée : contacter l'expert via la messagerie intégrée. Si pas de réponse sous 48h, escalader.

## Experts
- Devenir expert : cliquer "Devenir expert" → profil complet → validation sous 24-48h par l'équipe.
- Profil refusé : l'équipe envoie un email avec les raisons. Vous pouvez soumettre à nouveau.
- Paiements experts : voir tableau de bord expert → section "Revenus".

## Compte & Technique
- Mot de passe oublié : page de connexion → "Mot de passe oublié" → email envoyé.
- Email de confirmation non reçu : vérifier spams. Expéditeur : no-reply@creatorflowmarket.com
- Page ne charge pas : vider le cache (Ctrl+Shift+R), réessayer. Si persistant, décrire l'erreur.
- Supprimer un compte : envoyer une demande via ce chat avec la raison, l'équipe traitera sous 48h.

## Agents IA
- Les agents IA disponibles : Marketing, Contenu, Prospection, Support.
- Accès agents : Dashboard → "Employés IA" → choisir l'agent.
- Les agents IA ne remplacent pas les experts humains, ils les complètent.
`;

const TOOLS = [
  {
    name: 'get_client_context',
    description: 'Récupère le profil du client, ses tickets récents et ses missions. À appeler en premier pour personnaliser la réponse.',
    input_schema: {
      type: 'object',
      properties: {
        user_id: { type: 'string', description: 'UUID du client authentifié' }
      },
      required: ['user_id']
    }
  },
  {
    name: 'search_faq',
    description: 'Recherche dans la base de connaissances CreatorFlow Market. Utiliser avant de répondre à une question technique.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Question ou sujet à rechercher' }
      },
      required: ['query']
    }
  },
  {
    name: 'create_support_ticket',
    description: 'Crée un ticket de support pour documenter et suivre le problème.',
    input_schema: {
      type: 'object',
      properties: {
        subject: { type: 'string', description: 'Titre court du problème' },
        message: { type: 'string', description: 'Description détaillée du problème' },
        priority: { type: 'string', enum: ['low', 'normal', 'high', 'urgent'], description: 'Priorité du ticket' }
      },
      required: ['subject', 'message', 'priority']
    }
  },
  {
    name: 'escalate_to_human',
    description: "Escalade le problème à un agent humain quand la situation dépasse les capacités de l'IA.",
    input_schema: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: "Raison de l'escalade" },
        urgency: { type: 'string', enum: ['normal', 'urgent'], description: "Niveau d'urgence" }
      },
      required: ['reason', 'urgency']
    }
  }
];

async function callAnthropic(messages: unknown[], apiKey: string): Promise<unknown> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools: TOOLS,
      messages,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${err}`);
  }
  return res.json();
}

async function executeTool(
  name: string,
  input: Record<string, string>,
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<Record<string, unknown>> {
  if (name === 'get_client_context') {
    const [profileRes, ticketsRes, missionsRes] = await Promise.all([
      supabase.from('profiles').select('full_name, email, type_utilisateur, created_at').eq('id', userId).single(),
      supabase.from('support_tickets').select('id, subject, status, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(3),
      supabase.from('missions').select('id, titre, statut, created_at').or(`client_id.eq.${userId},expert_id.eq.${userId}`).order('created_at', { ascending: false }).limit(3)
    ]);
    return {
      profile: profileRes.data,
      recent_tickets: ticketsRes.data || [],
      recent_missions: missionsRes.data || []
    };
  }

  if (name === 'search_faq') {
    const query = (input.query || '').toLowerCase();
    const sections = FAQ_KB.split('\n##').filter(s =>
      s.toLowerCase().includes(query) ||
      query.split(' ').some((w: string) => w.length > 3 && s.toLowerCase().includes(w))
    );
    return { results: sections.slice(0, 2).join('\n##') || 'Aucun résultat trouvé.' };
  }

  if (name === 'create_support_ticket') {
    const { data, error } = await supabase.from('support_tickets').insert({
      user_id: userId,
      subject: input.subject,
      message: input.message,
      priority: input.priority || 'normal',
      status: 'in_progress',
      ai_response: 'Ticket créé par Support AI Agent'
    }).select('id').single();
    if (error) return { error: error.message };
    return { ticket_id: data?.id, message: `Ticket créé. Référence : ${data?.id?.slice(0, 8)}` };
  }

  if (name === 'escalate_to_human') {
    await supabase.from('support_tickets').insert({
      user_id: userId,
      subject: `[ESCALADE] ${input.reason}`,
      message: input.reason,
      priority: input.urgency === 'urgent' ? 'urgent' : 'high',
      status: 'open',
      ai_response: 'Escaladé à un agent humain par le Support AI Agent'
    });
    return { escalated: true, message: 'Un agent humain prendra contact sous 24h.' };
  }

  return { error: `Outil inconnu : ${name}` };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const authHeader = req.headers.get('Authorization') || '';
    const { message } = await req.json();

    if (!message) {
      return new Response(JSON.stringify({ error: 'message requis' }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' }
      });
    }

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY non configurée');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user } } = await anonClient.auth.getUser();
    const userId = user?.id ?? 'anonymous';

    // Charger historique
    const { data: memoryRow } = await supabase
      .from('agent_memory')
      .select('content')
      .eq('agent_slug', 'support')
      .eq('client_id', userId)
      .eq('context_type', 'conversation_history')
      .maybeSingle();

    let history: unknown[] = [];
    try { if (memoryRow?.content) history = JSON.parse(memoryRow.content); } catch { history = []; }
    if (history.length > 20) history = history.slice(-20);

    // Boucle agentique
    const messages: unknown[] = [...history, { role: 'user', content: message }];
    let finalResponse = '';
    const toolsUsed: string[] = [];
    let iterations = 0;

    while (iterations < 5) {
      iterations++;
      const response = await callAnthropic(messages, apiKey) as Record<string, unknown>;
      const content = response.content as Array<Record<string, unknown>>;
      messages.push({ role: 'assistant', content });

      if (response.stop_reason === 'end_turn') {
        const textBlock = content.find(b => b.type === 'text');
        finalResponse = (textBlock?.text as string) || '';
        break;
      }

      if (response.stop_reason === 'tool_use') {
        const toolResults = [];
        for (const block of content) {
          if (block.type === 'tool_use') {
            toolsUsed.push(block.name as string);
            const result = await executeTool(
              block.name as string,
              block.input as Record<string, string>,
              supabase,
              userId
            );
            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: JSON.stringify(result)
            });
          }
        }
        messages.push({ role: 'user', content: toolResults });
      } else {
        break;
      }
    }

    // Sauvegarder historique (sans tool_results)
    const historyToSave = messages.filter(m => {
      const msg = m as Record<string, unknown>;
      return !(Array.isArray(msg.content) && (msg.content as Array<Record<string, unknown>>).some(b => b.type === 'tool_result'));
    });

    await supabase.from('agent_memory').upsert({
      agent_slug: 'support',
      client_id: userId,
      context_type: 'conversation_history',
      content: JSON.stringify(historyToSave.slice(-20)),
      updated_at: new Date().toISOString()
    }, { onConflict: 'agent_slug,client_id,context_type' });

    // Log
    await supabase.from('agent_actions_log').insert({
      agent_slug: 'support',
      action_type: 'support_chat',
      action_data: { message_preview: message.slice(0, 100), tools_used: toolsUsed },
      status: 'executed',
      result: { response_preview: finalResponse.slice(0, 200) }
    }).throwOnError();

    return new Response(JSON.stringify({ response: finalResponse, tools_used: toolsUsed }), {
      headers: { ...cors, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('support-agent error:', (err as Error).message);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' }
    });
  }
});
