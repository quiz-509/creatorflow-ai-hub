/**
 * Utilitaires partagés entre les 4 heartbeat functions de l'AI Workforce.
 * Import : import { callClaude, loadProfile, ... } from '../_shared/agent-core.ts';
 */

import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.24.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno';

// ---------------------------------------------------------------------------
// Constantes partagées
// ---------------------------------------------------------------------------
export const HAIKU = 'claude-haiku-4-5-20251001';
export const SONNET = 'claude-sonnet-4-5';
export const SONNET_5 = 'claude-sonnet-5';

export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ---------------------------------------------------------------------------
// Types communs
// ---------------------------------------------------------------------------
export interface EmployeeProfile {
  slug: string;
  name: string;
  title: string;
  avatar_emoji?: string;
  system_prompt_context?: string;
  communication_tone?: string;
  is_owner?: boolean;
}

export interface ClientProject {
  id: string;
  title: string;
  client_name: string;
  client_email?: string;
  objective?: string;
}

// ---------------------------------------------------------------------------
// callClaude — appel unifié à l'API Anthropic
// ---------------------------------------------------------------------------
export async function callClaude(
  apiKey: string,
  maxTokens: number,
  prompt: string,
  model = HAIKU,
): Promise<string> {
  const client = new Anthropic({ apiKey });
  const msg = await client.messages.create({
    model,
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: prompt }],
  });
  const block = msg.content.find((b: { type: string }) => b.type === 'text');
  return block && block.type === 'text' ? (block as { type: 'text'; text: string }).text : '';
}

// ---------------------------------------------------------------------------
// loadProfile — charge le profil d'un agent depuis employee_profiles
// ---------------------------------------------------------------------------
export async function loadProfile(
  supabase: ReturnType<typeof createClient>,
  agentSlug: string,
): Promise<EmployeeProfile | null> {
  const { data } = await supabase
    .from('employee_profiles')
    .select('slug, name, title, avatar_emoji, system_prompt_context, communication_tone, is_owner')
    .eq('slug', agentSlug)
    .single();
  return data || null;
}

// ---------------------------------------------------------------------------
// loadExperience — charge l'expérience accumulée d'un agent
// ---------------------------------------------------------------------------
export async function loadExperience(
  supabase: ReturnType<typeof createClient>,
  agentSlug: string,
): Promise<string> {
  const { data } = await supabase
    .from('employee_experience')
    .select('experience_text, projects_count')
    .eq('employee_slug', agentSlug)
    .single();
  if (!data || !data.experience_text || data.projects_count === 0) return '';
  return data.experience_text;
}

// ---------------------------------------------------------------------------
// getClientMemory — charge la mémoire d'un client pour un département
// ---------------------------------------------------------------------------
export async function getClientMemory(
  supabase: ReturnType<typeof createClient>,
  clientEmail: string,
  department: string,
): Promise<string> {
  if (!clientEmail) return '';
  const { data } = await supabase
    .from('client_memory')
    .select('memory, projects_count')
    .eq('client_email', clientEmail)
    .eq('department', department)
    .maybeSingle();
  if (!data) return '';
  return `Client récurrent (${data.projects_count} interaction${data.projects_count > 1 ? 's' : ''}) :\n${data.memory}`;
}

// ---------------------------------------------------------------------------
// updateClientMemory — met à jour la mémoire client après chaque livrable
// ---------------------------------------------------------------------------
export async function updateClientMemory(
  supabase: ReturnType<typeof createClient>,
  anthropicKey: string,
  clientEmail: string,
  projectTitle: string,
  deliverableType: string,
  summary: string,
  agentName: string,
  agentTitle: string,
  department: string,
): Promise<void> {
  if (!clientEmail) return;
  try {
    const { data: existing } = await supabase
      .from('client_memory')
      .select('memory, projects_count')
      .eq('client_email', clientEmail)
      .eq('department', department)
      .maybeSingle();

    const count = (existing?.projects_count || 0) + 1;
    const currentMemory = existing?.memory || '';

    const newMemory = await callClaude(anthropicKey, 300,
      `Tu es ${agentName}, ${agentTitle} chez CreatorFlow Market.
${currentMemory ? `MÉMOIRE EXISTANTE (${existing?.projects_count || 0} interaction(s)) :\n${currentMemory.slice(0, 400)}\n` : ''}
LIVRABLE VENANT D'ÊTRE PRODUIT :
Projet : ${projectTitle}
Type : ${deliverableType}
Résumé : ${summary.slice(0, 200)}

Synthétise la mémoire client en 5-7 bullet points. Focus : préférences observées, ce qui fonctionne, contraintes spécifiques à ce client.
Format : bullet points uniquement, sans intro ni conclusion.`);

    const { error } = await supabase.from('client_memory').upsert({
      client_email: clientEmail,
      department,
      memory: newMemory.trim(),
      projects_count: count,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'client_email,department' });
    if (error) console.error(`[${department}] updateClientMemory upsert error:`, error.message);
  } catch (err) {
    console.error(`[${department}] updateClientMemory error:`, (err as Error).message);
  }
}

// ---------------------------------------------------------------------------
// workforce_insights — mémoire analytique cross-clients (patterns à l'échelle
// de la plateforme, pas d'un seul client). Ex: "secteur X convertit 3x mieux".
// ---------------------------------------------------------------------------
export async function loadWorkforceInsights(
  supabase: ReturnType<typeof createClient>,
  domain: string,
  limit = 5,
): Promise<string> {
  const { data } = await supabase
    .from('workforce_insights')
    .select('insight_text, sample_size')
    .eq('domain', domain)
    .order('sample_size', { ascending: false })
    .limit(limit);
  if (!data || data.length === 0) return '';
  return data.map((i: { insight_text: string }) => `• ${i.insight_text}`).join('\n');
}

export async function upsertWorkforceInsight(
  supabase: ReturnType<typeof createClient>,
  domain: string,
  insightKey: string,
  insightText: string,
  sampleSize: number,
): Promise<void> {
  const { error } = await supabase.from('workforce_insights').upsert({
    domain,
    insight_key: insightKey,
    insight_text: insightText,
    sample_size: sampleSize,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'domain,insight_key' });
  if (error) console.error(`[workforce_insights] upsert error (${domain}/${insightKey}):`, error.message);
}

// ---------------------------------------------------------------------------
// synthesizeExperience — synthétise l'expérience accumulée après chaque mission
// ---------------------------------------------------------------------------
export async function synthesizeExperience(
  supabase: ReturnType<typeof createClient>,
  anthropicKey: string,
  profile: EmployeeProfile,
  project: ClientProject,
  deliverableType: string,
  summary: string,
): Promise<void> {
  try {
    const { data: exp } = await supabase
      .from('employee_experience')
      .select('experience_text, projects_count')
      .eq('employee_slug', profile.slug)
      .single();

    const count = (exp?.projects_count || 0) + 1;
    const currentExp = exp?.experience_text || '';

    const prompt = `Tu es ${profile.name}, ${profile.title} chez CreatorFlow Market.

${currentExp ? `EXPÉRIENCE ACTUELLE (${exp?.projects_count || 0} livrables) :\n${currentExp.slice(0, 500)}\n` : ''}
LIVRABLE VENANT D'ÊTRE PRODUIT :
Client : ${project.client_name}
Projet : ${project.title}
Type : ${deliverableType}
Résumé : ${summary.slice(0, 200)}

Synthétise ton expérience accumulée en 8-10 bullet points concis (1 ligne chacun).
Focus : profils clients récurrents, types de livrables maîtrisés, ce qui fonctionne, difficultés récurrentes, meilleures pratiques.
Format : bullet points uniquement, sans intro ni conclusion.`;

    const newExp = await callClaude(anthropicKey, 400, prompt);
    await supabase.from('employee_experience').update({
      experience_text: newExp.trim(),
      projects_count: count,
      last_synthesized: new Date().toISOString(),
    }).eq('employee_slug', profile.slug);
  } catch (err) {
    console.error(`[${profile.slug}] synthesizeExperience error:`, (err as Error).message);
  }
}
