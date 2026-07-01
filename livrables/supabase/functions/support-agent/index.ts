import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.24.0?target=deno';
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

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'get_client_context',
    description: 'Récupère le profil du client, ses tickets récents et ses missions. À appeler en premier pour personnaliser la réponse.',
    input_schema: {
      type: 'object' as const,
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
      type: 'object' as const,
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
      type: 'object' as const,
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
    description: 'Escalade le problème à un agent humain quand la situation dépasse les capacités de l\'IA.',
    input_schema: {
      type: 'object' as const,
      properties: {
        reason: { type: 'string', description: 'Raison de l\'escalade' },
        urgency: { type: 'string', enum: ['normal', 'urgent'], description: 'Niveau d\'urgence' }
      },
      required: ['reason', 'urgency']
    }
  }
];

async function executeTool(
  name: string,
  input: Record<string, string>,
  ctx: { supabase: ReturnType<typeof createClient>; userId: string }
): Promise<Record<string, unknown>> {
  const { supabase, userId } = ctx;

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
    return { results: sections.slice(0, 2).join('\n##') || 'Aucun résultat trouvé pour cette recherche.' };
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
    return { ticket_id: data?.id, message: `Ticket créé avec succès. Référence : ${data?.id?.slice(0, 8)}` };
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
    return { escalated: true, message: 'Un agent humain prendra contact sous 24h (2h si urgent).' };
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

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Identifier l'utilisateur depuis le JWT
    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user } } = await anonClient.auth.getUser();
    const userId = user?.id ?? 'anonymous';

    // Charger l'historique de conversation depuis agent_memory
    const { data: memoryRow } = await supabase
      .from('agent_memory')
      .select('content')
      .eq('agent_slug', 'support')
      .eq('client_id', userId)
      .eq('context_type', 'conversation_history')
      .single();

    let history: Anthropic.MessageParam[] = [];
    try {
      if (memoryRow?.content) history = JSON.parse(memoryRow.content);
    } catch { history = []; }

    // Limiter à 10 derniers échanges (20 messages) pour éviter dépassement tokens
    if (history.length > 20) history = history.slice(-20);

    const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') ?? '' });
    const ctx = { supabase, userId };

    // Boucle agentique
    const messages: Anthropic.MessageParam[] = [...history, { role: 'user', content: message }];
    let finalResponse = '';
    const toolsUsed: string[] = [];
    let iterations = 0;
    const MAX_ITERATIONS = 5;

    while (iterations < MAX_ITERATIONS) {
      iterations++;
      const response = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        tools: TOOLS,
        messages
      });

      messages.push({ role: 'assistant', content: response.content });

      if (response.stop_reason === 'end_turn') {
        finalResponse = (response.content.find(b => b.type === 'text') as Anthropic.TextBlock)?.text || '';
        break;
      }

      if (response.stop_reason === 'tool_use') {
        const toolResults: Anthropic.ToolResultBlockParam[] = [];
        for (const block of response.content) {
          if (block.type === 'tool_use') {
            toolsUsed.push(block.name);
            const result = await executeTool(block.name, block.input as Record<string, string>, ctx);
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

    // Sauvegarder l'historique mis à jour (sans les tool_results pour garder propre)
    const historyToSave = messages.filter(m =>
      !(Array.isArray(m.content) && m.content.some((b: Anthropic.ContentBlock) => b.type === 'tool_result'))
    );
    await supabase.from('agent_memory').upsert({
      agent_slug: 'support',
      client_id: userId,
      context_type: 'conversation_history',
      content: JSON.stringify(historyToSave.slice(-20)),
      updated_at: new Date().toISOString()
    }, { onConflict: 'agent_slug,client_id,context_type' });

    // Log dans agent_actions_log
    await supabase.from('agent_actions_log').insert({
      agent_slug: 'support',
      action_type: 'support_chat',
      action_data: { message_preview: message.slice(0, 100), tools_used: toolsUsed },
      status: 'executed',
      result: { response_preview: finalResponse.slice(0, 200) }
    });

    return new Response(JSON.stringify({ response: finalResponse, tools_used: toolsUsed }), {
      headers: { ...cors, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' }
    });
  }
});
