import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================================
// IDENTITY — Marketing Director AI Employee
// Employé permanent de CreatorFlow Market
// Rôle : orchestrer toutes les missions marketing client
// ============================================================

const SYSTEM_PROMPT = `Tu es le Directeur Marketing de CreatorFlow Market.

Tu n'es pas un assistant. Tu n'es pas un chatbot. Tu es un employé permanent de cette entreprise.

**Ton rôle dans l'entreprise :**
- Chef de projet pour toutes les missions client
- Tu reçois une mission du CEO et tu la pilotes de A à Z
- Tu délègues au Content Employee, au Prospecting Employee, au Design Employee
- Tu produis des analyses, des stratégies, des rapports concrets
- Tu rapportes au CEO avec des livrables réels

**Tes responsabilités permanentes :**
- Analyser les besoins clients et définir la stratégie marketing
- Créer des plans de contenu, des stratégies de croissance, des campagnes
- Déléguer les tâches d'exécution à tes collègues employees
- Suivre les KPIs et ajuster la stratégie
- Produire un rapport hebdomadaire au CEO

**Règles opérationnelles :**
- TOUJOURS commencer par get_mission_context pour lire la mission complète
- TOUJOURS produire un livrable concret (stratégie, plan, analyse) avec create_strategy
- Déléguer l'exécution à content_employee ou prospecting_employee si pertinent
- Demander l'approbation CEO uniquement pour : budget > 500$, décisions irréversibles, litiges
- Terminer par complete_mission avec un rapport structuré
- Jamais de réponse vague. Toujours des actions concrètes et mesurables.

**Format de tes livrables :**
Chaque livrable doit inclure :
1. Analyse de la situation
2. Objectifs SMART
3. Plan d'action avec échéances
4. KPIs de suivi
5. Budget estimé

Tu travailles en français. Tes livrables sont professionnels et actionnables.`;

const TOOLS = [
  {
    name: 'get_mission_context',
    description: 'Lit le contexte complet de la mission : brief client, objectifs, budget, historique. Toujours appeler en premier.',
    input_schema: {
      type: 'object',
      properties: {
        mission_id: { type: 'string', description: 'ID UUID de la mission dans agent_missions' }
      },
      required: ['mission_id']
    }
  },
  {
    name: 'create_strategy',
    description: 'Crée et sauvegarde un document de stratégie marketing complet. Utilisé pour livrer l\'analyse et le plan.',
    input_schema: {
      type: 'object',
      properties: {
        mission_id: { type: 'string' },
        title: { type: 'string', description: 'Titre du document stratégique' },
        executive_summary: { type: 'string', description: 'Résumé exécutif en 2-3 phrases' },
        situation_analysis: { type: 'string', description: 'Analyse de la situation actuelle' },
        objectives: { type: 'array', items: { type: 'string' }, description: 'Objectifs SMART (liste)' },
        action_plan: { type: 'array', items: { type: 'object', properties: { action: { type: 'string' }, deadline: { type: 'string' }, owner: { type: 'string' } } }, description: 'Plan d\'action avec responsables et délais' },
        kpis: { type: 'array', items: { type: 'string' }, description: 'KPIs de suivi' },
        budget_estimate: { type: 'string', description: 'Budget estimé avec détail' }
      },
      required: ['mission_id', 'title', 'executive_summary', 'objectives', 'action_plan']
    }
  },
  {
    name: 'delegate_to_content',
    description: 'Délègue une tâche de création de contenu au Content Employee (articles, scripts, textes).',
    input_schema: {
      type: 'object',
      properties: {
        mission_id: { type: 'string', description: 'ID de la mission parente' },
        task_title: { type: 'string', description: 'Titre de la tâche de contenu' },
        task_brief: { type: 'string', description: 'Brief détaillé pour le Content Employee' },
        content_types: { type: 'array', items: { type: 'string' }, description: 'Types de contenu attendus (article, script, email, etc.)' },
        deadline: { type: 'string', description: 'Délai attendu (ex: 3 jours)' }
      },
      required: ['mission_id', 'task_title', 'task_brief']
    }
  },
  {
    name: 'delegate_to_prospecting',
    description: 'Délègue une tâche de prospection au Prospecting Employee (qualification leads, outreach, research).',
    input_schema: {
      type: 'object',
      properties: {
        mission_id: { type: 'string', description: 'ID de la mission parente' },
        task_title: { type: 'string' },
        target_profile: { type: 'string', description: 'Profil cible à prospecter' },
        channels: { type: 'array', items: { type: 'string' }, description: 'Canaux de prospection (LinkedIn, email, etc.)' },
        volume_target: { type: 'string', description: 'Volume cible (ex: 50 leads qualifiés)' }
      },
      required: ['mission_id', 'task_title', 'target_profile']
    }
  },
  {
    name: 'request_ceo_approval',
    description: 'Soumet une décision importante au CEO pour validation. Utiliser uniquement pour budget > 500$, actions irréversibles, ou litiges.',
    input_schema: {
      type: 'object',
      properties: {
        mission_id: { type: 'string' },
        decision_title: { type: 'string', description: 'Titre court de la décision' },
        context: { type: 'string', description: 'Contexte et pourquoi cette décision' },
        recommendation: { type: 'string', description: 'Recommandation du Marketing Director' },
        options: { type: 'array', items: { type: 'string' }, description: 'Options disponibles pour le CEO' },
        urgency: { type: 'string', enum: ['normal', 'urgent'] }
      },
      required: ['mission_id', 'decision_title', 'context', 'recommendation']
    }
  },
  {
    name: 'complete_mission',
    description: 'Marque la mission comme terminée et soumet le rapport final au CEO. Appeler en dernier.',
    input_schema: {
      type: 'object',
      properties: {
        mission_id: { type: 'string' },
        completion_summary: { type: 'string', description: 'Résumé de ce qui a été accompli' },
        deliverables: { type: 'array', items: { type: 'string' }, description: 'Liste des livrables produits' },
        next_steps: { type: 'array', items: { type: 'string' }, description: 'Prochaines étapes recommandées' },
        status: { type: 'string', enum: ['awaiting_ceo', 'completed'], description: 'awaiting_ceo si besoin validation, completed si tout est fait' }
      },
      required: ['mission_id', 'completion_summary', 'deliverables', 'status']
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
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
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
  input: Record<string, unknown>,
  supabase: ReturnType<typeof createClient>,
  missionId: string
): Promise<Record<string, unknown>> {

  if (name === 'get_mission_context') {
    const [missionRes, briefRes, memRes] = await Promise.all([
      supabase.from('agent_missions').select('id,title,objective,status,context,priority,created_at,brief_id').eq('id', input.mission_id || missionId).single(),
      supabase.from('briefs').select('id,description,budget,categorie,delai,user_id,statut,created_at').eq('id', input.mission_id || missionId).maybeSingle(),
      supabase.from('agent_memory').select('content').eq('agent_slug', 'marketing').eq('context_type', 'mission_' + (input.mission_id || missionId)).maybeSingle(),
    ]);
    const mission = missionRes.data;
    if (!mission) return { error: 'Mission introuvable' };

    // Charger le brief lié à la mission si brief_id existe
    let brief = briefRes.data;
    if (!brief && mission.brief_id) {
      const { data: b } = await supabase.from('briefs').select('*').eq('id', mission.brief_id).single();
      brief = b;
    }

    return {
      mission,
      brief: brief || { note: 'Pas de brief Supabase lié — utiliser l\'objectif de la mission' },
      past_context: memRes.data?.content || null,
      today: new Date().toISOString().split('T')[0],
    };
  }

  if (name === 'create_strategy') {
    const strategyContent = {
      type: 'marketing_strategy',
      title: input.title,
      executive_summary: input.executive_summary,
      situation_analysis: input.situation_analysis,
      objectives: input.objectives,
      action_plan: input.action_plan,
      kpis: input.kpis,
      budget_estimate: input.budget_estimate,
      created_by: 'Marketing Director AI Employee',
      created_at: new Date().toISOString(),
    };

    const { data, error } = await supabase.from('agent_reports').insert({
      mission_id: input.mission_id || missionId,
      agent_slug: 'marketing',
      title: String(input.title),
      sections: strategyContent,
      content: strategyContent,
    }).select('id').single();

    if (error) return { error: error.message };

    // Mettre à jour statut mission
    await supabase.from('agent_missions').update({ status: 'in_progress' }).eq('id', input.mission_id || missionId);

    await supabase.from('agent_actions_log').insert({
      mission_id: input.mission_id || missionId,
      agent_slug: 'marketing',
      action_type: 'strategy_created',
      action_data: { strategy_title: input.title },
      status: 'executed',
      result: { report_id: data?.id },
    });

    return { success: true, report_id: data?.id, message: `Stratégie "${input.title}" créée et sauvegardée.` };
  }

  if (name === 'delegate_to_content') {
    const { data: contentAgent } = await supabase.from('ai_agents').select('id').ilike('slug', '%content%').maybeSingle();
    const agentId = contentAgent?.id;

    if (!agentId) {
      // Log sans agent_id si non trouvé
      await supabase.from('agent_actions_log').insert({
        mission_id: input.mission_id || missionId,
        agent_slug: 'marketing',
        action_type: 'delegation_content',
        action_data: { task: input.task_title, brief: input.task_brief, content_types: input.content_types },
        status: 'pending_approval',
      });
      return { delegated: false, message: 'Content Employee pas encore configuré. Tâche en file d\'attente.' };
    }

    const { data: subMission, error } = await supabase.from('agent_missions').insert({
      agent_id: agentId,
      title: String(input.task_title),
      objective: String(input.task_brief),
      status: 'assigned',
      delivered_to_client: false,
      context: JSON.stringify({ content_types: input.content_types, deadline: input.deadline, delegated_by: 'Marketing Director', parent_mission: input.mission_id || missionId }),
    }).select('id').single();

    if (error) return { error: error.message };
    return { delegated: true, sub_mission_id: subMission?.id, message: `Tâche "${input.task_title}" déléguée au Content Employee.` };
  }

  if (name === 'delegate_to_prospecting') {
    const { data: prospAgent } = await supabase.from('ai_agents').select('id').ilike('slug', '%prospect%').maybeSingle();
    const agentId = prospAgent?.id;

    if (!agentId) {
      await supabase.from('agent_actions_log').insert({
        mission_id: input.mission_id || missionId,
        agent_slug: 'marketing',
        action_type: 'delegation_prospecting',
        action_data: { task: input.task_title, target: input.target_profile },
        status: 'pending_approval',
      });
      return { delegated: false, message: 'Prospecting Employee pas encore configuré. Tâche enregistrée.' };
    }

    const { data: subMission, error } = await supabase.from('agent_missions').insert({
      agent_id: agentId,
      title: String(input.task_title),
      objective: `Prospecter : ${input.target_profile}`,
      status: 'assigned',
      delivered_to_client: false,
      context: JSON.stringify({ target_profile: input.target_profile, channels: input.channels, volume_target: input.volume_target, parent_mission: input.mission_id || missionId }),
    }).select('id').single();

    if (error) return { error: error.message };
    return { delegated: true, sub_mission_id: subMission?.id, message: `Prospection "${input.task_title}" déléguée.` };
  }

  if (name === 'request_ceo_approval') {
    const { data, error } = await supabase.from('pending_approvals').insert({
      type: 'marketing_decision',
      status: 'pending',
      data: {
        mission_id: input.mission_id || missionId,
        decision_title: input.decision_title,
        context: input.context,
        recommendation: input.recommendation,
        options: input.options || [],
        urgency: input.urgency || 'normal',
        from: 'Marketing Director AI Employee',
      },
    }).select('id').single();

    if (error) return { error: error.message };

    await supabase.from('agent_missions').update({ status: 'awaiting_ceo' }).eq('id', input.mission_id || missionId);
    return { approval_id: data?.id, message: 'Décision soumise au CEO. Mission en pause jusqu\'à validation.' };
  }

  if (name === 'complete_mission') {
    const finalStatus = input.status || 'awaiting_ceo';

    await supabase.from('agent_missions').update({
      status: String(finalStatus),
      completed_at: finalStatus === 'completed' ? new Date().toISOString() : null,
    }).eq('id', input.mission_id || missionId);

    // Rapport final
    await supabase.from('agent_reports').insert({
      mission_id: input.mission_id || missionId,
      agent_slug: 'marketing',
      title: 'Rapport final — Marketing Director',
      sections: {
        completion_summary: input.completion_summary,
        deliverables: input.deliverables,
        next_steps: input.next_steps || [],
        completed_at: new Date().toISOString(),
      },
      content: {
        completion_summary: input.completion_summary,
        deliverables: input.deliverables,
        next_steps: input.next_steps || [],
      },
    });

    return { success: true, status: finalStatus, message: `Mission ${finalStatus === 'completed' ? 'terminée' : 'soumise au CEO pour validation'}.` };
  }

  return { error: `Outil inconnu : ${name}` };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const { mission_id } = await req.json();
    if (!mission_id) throw new Error('mission_id requis');

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY non configurée');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Marquer la mission comme en cours
    await supabase.from('agent_missions').update({ status: 'in_progress' }).eq('id', mission_id);

    // Charger la mémoire de travail de l'employé
    const { data: workingMem } = await supabase.from('agent_memory').select('content').eq('agent_slug', 'marketing').eq('context_type', 'working_memory').maybeSingle();

    const contextMsg = `Tu viens de recevoir une mission du CEO.\n\nID de la mission : ${mission_id}\n\nCommence par get_mission_context pour lire le contexte complet, puis exécute ton travail selon tes responsabilités de Directeur Marketing.`;

    const messages: unknown[] = [{ role: 'user', content: contextMsg }];
    let finalResponse = '';
    const toolsUsed: string[] = [];
    let iterations = 0;
    const MAX_ITERATIONS = 10;

    // Boucle agentique — l'employé travaille jusqu'à complétion
    while (iterations < MAX_ITERATIONS) {
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
              block.input as Record<string, unknown>,
              supabase,
              mission_id
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

    // Sauvegarder la mémoire de travail (historique de cette session)
    await supabase.from('agent_memory').upsert({
      agent_slug: 'marketing',
      client_id: null,
      context_type: 'mission_' + mission_id,
      content: JSON.stringify(messages.slice(-6)),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'agent_slug,client_id,context_type' });

    // Log global
    await supabase.from('agent_actions_log').insert({
      mission_id,
      agent_slug: 'marketing',
      action_type: 'mission_execution',
      action_data: { tools_used: toolsUsed, iterations },
      status: 'executed',
      result: { summary: finalResponse.slice(0, 300) },
    });

    return new Response(JSON.stringify({
      success: true,
      tools_used: toolsUsed,
      iterations,
      summary: finalResponse,
    }), { headers: { ...cors, 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error('marketing-director error:', (err as Error).message);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' }
    });
  }
});
