import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno';
import {
  callClaude, cors, loadProfile, loadExperience,
  getClientMemory, updateClientMemory, synthesizeExperience,
  EmployeeProfile, SONNET_5,
} from '../_shared/agent-core.ts';

async function searchImages(
  query: string, unsplashKey: string, pexelsKey: string, max = 3,
): Promise<string> {
  // Unsplash en priorité, Pexels en fallback
  if (unsplashKey) {
    try {
      const res = await fetch(
        `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=${max}&orientation=landscape`,
        { headers: { 'Authorization': `Client-ID ${unsplashKey}` } },
      );
      if (res.ok) {
        const data = await res.json();
        const photos = (data.results || []).slice(0, max);
        if (photos.length) {
          return photos.map((p: { urls: { regular: string }; description?: string; alt_description?: string; user: { name: string } }) =>
            `• ${p.description || p.alt_description || query} — ${p.urls.regular}\n  Crédit : ${p.user.name} / Unsplash`
          ).join('\n');
        }
      }
    } catch (_) { /* fall through to Pexels */ }
  }
  if (pexelsKey) {
    try {
      const res = await fetch(
        `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${max}&orientation=landscape`,
        { headers: { 'Authorization': pexelsKey } },
      );
      if (res.ok) {
        const data = await res.json();
        const photos = (data.photos || []).slice(0, max);
        if (photos.length) {
          return photos.map((p: { src: { large: string }; alt?: string; photographer: string }) =>
            `• ${p.alt || query} — ${p.src.large}\n  Crédit : ${p.photographer} / Pexels`
          ).join('\n');
        }
      }
    } catch (_) { /* ignore */ }
  }
  return '';
}

async function findYouTubeVideos(query: string, apiKey: string, max = 3): Promise<string> {
  if (!apiKey || !query.trim()) return '';
  try {
    const url = `https://www.googleapis.com/youtube/v3/search?q=${encodeURIComponent(query)}&part=snippet&type=video&maxResults=${max}&key=${apiKey}&relevanceLanguage=fr`;
    const res = await fetch(url);
    if (!res.ok) return '';
    const data = await res.json();
    const items = (data.items || []).slice(0, max);
    if (!items.length) return '';
    return items.map((v: { id: { videoId: string }; snippet: { title: string; channelTitle: string } }) =>
      `• "${v.snippet.title}" — https://youtube.com/watch?v=${v.id.videoId}\n  Chaîne : ${v.snippet.channelTitle}`
    ).join('\n');
  } catch (_) { return ''; }
}

async function checkGrammar(text: string, lang = 'fr'): Promise<string> {
  if (!text.trim()) return '';
  try {
    const body = new URLSearchParams({ text: text.slice(0, 2000), language: lang });
    const res = await fetch('https://api.languagetool.org/v2/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    if (!res.ok) return '';
    const data = await res.json();
    const matches = (data.matches || []).slice(0, 8);
    if (!matches.length) return '';
    return matches.map((m: { message: string; context?: { text?: string; offset?: number; length?: number }; replacements?: { value: string }[] }) => {
      const ctx = m.context?.text?.slice(
        Math.max(0, (m.context.offset || 0) - 10),
        (m.context.offset || 0) + (m.context.length || 20) + 10,
      ) || '';
      const fix = m.replacements?.[0]?.value || '';
      return `• ${m.message}${ctx ? ' ("' + ctx.trim() + '")' : ''}${fix ? ' → "' + fix + '"' : ''}`;
    }).join('\n');
  } catch (_) { return ''; }
}

async function webSearch(query: string, apiKey: string, maxResults = 5): Promise<string> {
  if (!apiKey || !query.trim()) return '';
  try {
    const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${maxResults}&search_lang=fr`;
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json', 'X-Subscription-Token': apiKey },
    });
    if (!res.ok) return '';
    const data = await res.json();
    const results = (data.web?.results || []).slice(0, maxResults);
    if (!results.length) return '';
    return results.map((r: { title: string; url: string; description?: string }) =>
      `• ${r.title}\n  ${r.url}${r.description ? '\n  ' + r.description.slice(0, 160) : ''}`
    ).join('\n\n');
  } catch (_) { return ''; }
}

const PUBLISH_KEYWORDS = [
  'publier', 'publish', 'poster sur le blog', 'mettre en ligne',
  'publication directe', 'publier sur le site', 'publish to cms',
  'publier l\'article', 'poster l\'article',
];

// Livrables complexes → Sonnet 5 pour qualité maximale
const COMPLEX_CONTENT_KEYWORDS = [
  'script vidéo', 'script youtube', 'scénario', 'stratégie de contenu',
  'plan de contenu', 'piliers de contenu', 'calendrier éditorial',
  'article long', 'long-form', 'article approfondi', 'guide complet',
  'ebook', 'livre blanc', 'white paper', 'newsletter complète',
  'séquence email', 'brand voice', 'identité de contenu',
  'étude de cas', 'campagne', 'stratégie', 'roadmap', 'plan 90',
];

function selectContentModel(brief: string): string {
  const lower = brief.toLowerCase();
  return COMPLEX_CONTENT_KEYWORDS.some(kw => lower.includes(kw))
    ? SONNET_5
    : 'claude-haiku-4-5-20251001';
}

function needsPublication(brief: string): boolean {
  const lower = brief.toLowerCase();
  return PUBLISH_KEYWORDS.some(k => lower.includes(k));
}

function mdToHtml(md: string): string {
  return md
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^[-*] (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>[^<]*<\/li>\n?)+/g, '<ul>$&</ul>')
    .replace(/\n\n+/g, '</p><p>')
    .replace(/^(?!<[hul])(.+)$/gm, (line) =>
      line.startsWith('<') ? line : `<p>${line}</p>`
    );
}

async function publishToWordPress(
  siteUrl: string, username: string, appPassword: string,
  title: string, htmlContent: string, status = 'publish',
  seoMeta?: { metaTitle?: string; metaDescription?: string; slug?: string },
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const endpoint = `${siteUrl.replace(/\/$/, '')}/wp-json/wp/v2/posts`;
    const credentials = btoa(`${username}:${appPassword}`);
    const postSlug = seoMeta?.slug?.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-') || '';
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${credentials}`,
      },
      body: JSON.stringify({
        title: seoMeta?.metaTitle || title,
        content: htmlContent,
        status,
        excerpt: seoMeta?.metaDescription || '',
        ...(postSlug ? { slug: postSlug } : {}),
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      return { success: false, error: err.slice(0, 200) };
    }
    const data = await res.json();
    return { success: true, url: data.link };
  } catch (err) {
    return { success: false, error: (err as Error).message.slice(0, 200) };
  }
}

async function publishToGhost(
  siteUrl: string, adminApiKey: string,
  title: string, htmlContent: string, status = 'published',
  seoMeta?: { metaTitle?: string; metaDescription?: string; slug?: string },
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const [keyId, keySecret] = adminApiKey.split(':');
    if (!keyId || !keySecret) return { success: false, error: 'admin_api_key invalide (format attendu: id:secret)' };

    const now = Math.floor(Date.now() / 1000);
    const header = btoa(JSON.stringify({ alg: 'HS256', kid: keyId, typ: 'JWT' }))
      .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const payload = btoa(JSON.stringify({ iat: now, exp: now + 300, aud: '/admin/' }))
      .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

    const secretBytes = new Uint8Array(
      (keySecret.match(/.{2}/g) || []).map((b: string) => parseInt(b, 16))
    );
    const cryptoKey = await crypto.subtle.importKey(
      'raw', secretBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
    );
    const sigBytes = await crypto.subtle.sign(
      'HMAC', cryptoKey, new TextEncoder().encode(`${header}.${payload}`),
    );
    const sig = btoa(String.fromCharCode(...new Uint8Array(sigBytes)))
      .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

    const postSlug = seoMeta?.slug?.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-') || '';
    const endpoint = `${siteUrl.replace(/\/$/, '')}/ghost/api/admin/posts/`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Ghost ${header}.${payload}.${sig}`,
      },
      body: JSON.stringify({ posts: [{
        title: seoMeta?.metaTitle || title,
        html: htmlContent,
        status,
        excerpt: seoMeta?.metaDescription || '',
        meta_title: seoMeta?.metaTitle || '',
        meta_description: seoMeta?.metaDescription || '',
        ...(postSlug ? { slug: postSlug } : {}),
      }] }),
    });
    if (!res.ok) {
      const err = await res.text();
      return { success: false, error: err.slice(0, 200) };
    }
    const data = await res.json();
    return { success: true, url: data.posts?.[0]?.url };
  } catch (err) {
    return { success: false, error: (err as Error).message.slice(0, 200) };
  }
}

async function deliverViaWebhook(
  webhookUrl: string, title: string, htmlContent: string, markdown: string,
  meta: { project_id: string; client_name: string; status?: string },
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        html: htmlContent,
        markdown,
        status: meta.status || 'published',
        project_id: meta.project_id,
        client_name: meta.client_name,
        delivered_at: new Date().toISOString(),
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      return { success: false, error: err.slice(0, 200) };
    }
    const data = await res.json().catch(() => ({}));
    return { success: true, url: data.url || data.link || data.permalink || webhookUrl };
  } catch (err) {
    return { success: false, error: (err as Error).message.slice(0, 200) };
  }
}

async function executeDelivery(
  adapter: DeliveryConfig, title: string, htmlContent: string, markdown: string,
  meta: { project_id: string; client_name: string },
  seoMeta?: { metaTitle?: string; metaDescription?: string; slug?: string },
): Promise<{ success: boolean; url?: string; error?: string }> {
  if (adapter.type === 'wordpress' && adapter.username && adapter.app_password) {
    return publishToWordPress(adapter.url, adapter.username, adapter.app_password, title, htmlContent, adapter.status || 'publish', seoMeta);
  }
  if (adapter.type === 'ghost' && adapter.admin_api_key) {
    return publishToGhost(adapter.url, adapter.admin_api_key, title, htmlContent, adapter.status || 'published', seoMeta);
  }
  if (adapter.type === 'webhook') {
    return deliverViaWebhook(adapter.url, title, htmlContent, markdown, { ...meta, status: adapter.status });
  }
  return { success: false, error: `Adapter "${adapter.type}" non reconnu ou credentials manquants` };
}

const AGENT_SLUG = 'content';
const DEPARTMENT = 'content';

interface InternalRequest {
  id: string;
  project_id: string;
  from_dept: string;
  brief: string;
  objective?: string;
  decision_reason?: string;
}

interface DeliveryConfig {
  type: 'wordpress' | 'ghost' | 'webhook';
  url: string;
  // WordPress
  username?: string;
  app_password?: string;
  // Ghost
  admin_api_key?: string;
  // All types
  status?: string;
}

interface ClientProject {
  id: string;
  title: string;
  client_name: string;
  client_email?: string;
  objective?: string;
  delivery_config?: DeliveryConfig | null;
}

async function updateMetrics(
  supabase: ReturnType<typeof createClient>,
  anthropicKey: string,
  profile: EmployeeProfile,
): Promise<void> {
  try {
    const [totalRes, completedRes, activeRes, durationRes] = await Promise.all([
      supabase.from('internal_requests').select('*', { count: 'exact', head: true }).eq('to_dept', DEPARTMENT),
      supabase.from('internal_requests').select('*', { count: 'exact', head: true }).eq('to_dept', DEPARTMENT).eq('status', 'completed'),
      supabase.from('internal_requests').select('*', { count: 'exact', head: true }).eq('to_dept', DEPARTMENT).in('status', ['pending', 'in_progress']),
      supabase.from('internal_requests').select('created_at, completed_at').eq('to_dept', DEPARTMENT).eq('status', 'completed').not('completed_at', 'is', null).limit(50),
    ]);

    const total = totalRes.count || 0;
    const completed = completedRes.count || 0;
    const active = activeRes.count || 0;
    const successRate = total > 0 ? (completed / total) * 100 : 0;

    let avgDays = 0;
    if (durationRes.data?.length) {
      const ms = durationRes.data.reduce((s: number, r: { created_at: string; completed_at: string }) =>
        s + (new Date(r.completed_at).getTime() - new Date(r.created_at).getTime()), 0);
      avgDays = ms / durationRes.data.length / 86400000;
    }

    const { data: exp } = await supabase.from('employee_experience').select('experience_text').eq('employee_slug', profile.slug).single();

    const metaRaw = await callClaude(anthropicKey, 200, `Tu es ${profile.name}, ${profile.title}.
Métriques : ${total} livrables traités, ${completed} complétés, succès ${successRate.toFixed(0)}%, durée moy ${avgDays.toFixed(1)}j.
${exp?.experience_text ? 'Expérience : ' + exp.experience_text.slice(0, 250) : ''}

Format exact :
[COMPÉTENCES] comp1 | comp2 | comp3
[OBJECTIF] Une phrase sur ton objectif Q3 2026
[FORMATION] Une phrase sur ce que tu travailles à améliorer`);

    const tag = (t: string) => { const m = metaRaw.match(new RegExp(`\\[${t}\\]([^\\n]+)`)); return m ? m[1].trim() : ''; };
    const skills = tag('COMPÉTENCES').split('|').map((s: string) => s.trim()).filter(Boolean);

    await supabase.from('employee_metrics').update({
      total_projects: total,
      active_projects: active,
      completed_projects: completed,
      success_rate: Math.round(successRate * 100) / 100,
      avg_duration_days: Math.round(avgDays * 10) / 10,
      skills_mastered: skills,
      quarterly_objectives: tag('OBJECTIF'),
      training_focus: tag('FORMATION'),
      updated_at: new Date().toISOString(),
    }).eq('employee_slug', profile.slug);
  } catch (err) {
    console.error('[content] updateMetrics error:', (err as Error).message);
  }
}

function buildDeliverablePrompt(
  profile: EmployeeProfile,
  project: ClientProject,
  request: InternalRequest,
  experience: string,
  clientMemory: string,
  searchContext: string,
  videoContext: string,
): string {
  return `${profile.system_prompt_context}
${experience ? '\n═══ TON EXPÉRIENCE ACCUMULÉE ═══\n' + experience.slice(0, 400) + '\nApplique ces apprentissages dans ce livrable.\n' : ''}
${clientMemory ? '\n═══ MÉMOIRE CLIENT ═══\n' + clientMemory + '\nAdapte ton livrable aux préférences et contraintes connues de ce client.\n' : ''}
${searchContext ? '\n═══ RECHERCHE WEB — SOURCES ACTUELLES ═══\n' + searchContext + '\nCite et intègre ces références dans ton livrable pour lui donner de la profondeur et de la crédibilité.\n' : ''}
${videoContext ? '\n═══ VIDÉOS YOUTUBE PERTINENTES ═══\n' + videoContext + '\nSuggère d\'intégrer ou de référencer ces vidéos dans ton livrable quand c\'est pertinent.\n' : ''}
═══ PROJET CLIENT ═══
Client : ${project.client_name}
Projet : ${project.title}
Objectif général : ${(project.objective || '').slice(0, 400)}

═══ BRIEF D'ARIA ═══
${request.brief}
${request.decision_reason ? `\nContexte de la demande : ${request.decision_reason}` : ''}

Produis le livrable demandé. Tu es responsable de la qualité de ton travail.

[TYPE]
article_blog | script_youtube | posts_sociaux | newsletter | stratégie_éditoriale | autre

[RÉSUMÉ]
2-3 phrases sur ce que tu as produit et pourquoi c'est adapté à ce client.

[LIVRABLE_COMPLET]
Le livrable complet, prêt à être utilisé. Minimum 400 mots.
Article : Titre H1 + Accroche + 3 sections H2 + Conclusion + CTA
Script : Accroche (0-15s) + Corps (3 parties) + Outro
Posts : 5 posts complets avec texte + hashtags
Newsletter : Objet + Corps complet + CTA

[SEO]
(Si article_blog, newsletter ou contenu web — OBLIGATOIRE. Sinon, laisse vide.)
TITRE_META: [60 chars max — accrocheur + mot-clé principal]
DESCRIPTION_META: [155 chars max — incite au clic, contient le mot-clé]
SLUG: [3-5 mots séparés par des tirets, en minuscules]
MOT_CLE_PRINCIPAL: [1 mot-clé ou expression cible]
MOTS_CLES_SECONDAIRES: [3-5 mots-clés secondaires séparés par des virgules]

[NOTES_POUR_ARIA]
2-3 notes techniques ou recommandations qu'Aria pourrait communiquer au client.`;
}

async function executeInternalRequest(
  supabase: ReturnType<typeof createClient>,
  anthropicKey: string,
  braveApiKey: string,
  unsplashKey: string,
  pexelsKey: string,
  youtubeKey: string,
  profile: EmployeeProfile,
  request: InternalRequest,
  experience: string,
): Promise<boolean> {
  try {
    const { data: project } = await supabase
      .from('client_projects')
      .select('id, title, client_name, client_email, objective, delivery_config')
      .eq('id', request.project_id)
      .single();

    if (!project) {
      console.error('[content] project not found:', request.project_id);
      return false;
    }

    await supabase.from('internal_requests').update({ status: 'in_progress' }).eq('id', request.id);

    const searchQuery = `${project.title} ${request.brief.split('\n')[0]}`.slice(0, 120);
    const [searchResults, videoResults, clientMemory] = await Promise.all([
      webSearch(searchQuery, braveApiKey, 5),
      findYouTubeVideos(searchQuery, youtubeKey, 3),
      getClientMemory(supabase, project.client_email || '', DEPARTMENT),
    ]);

    const contentModel = selectContentModel(request.brief);
    console.log(`[content] model selected: ${contentModel} for request ${request.id.slice(0, 8)}`);
    const raw = await callClaude(anthropicKey, 2048, buildDeliverablePrompt(profile, project, request, experience, clientMemory, searchResults, videoResults), contentModel);

    const extract = (tag: string): string => {
      const m = raw.match(new RegExp(`\\[${tag}\\]([\\s\\S]*?)(?=\\[[A-Z_ÉÈÀÙÎ]+\\]|$)`));
      return m ? m[1].trim() : '';
    };

    const contentType = extract('TYPE') || 'livrable_contenu';
    const summary = extract('RÉSUMÉ') || extract('RESUME') || raw.slice(0, 200);
    const deliverable = extract('LIVRABLE_COMPLET') || raw;
    const notes = extract('NOTES_POUR_ARIA') || '';

    // Extraction SEO (articles et contenu web)
    const seoRaw = extract('SEO');
    const extractSeoField = (field: string): string => {
      const m = seoRaw.match(new RegExp(`${field}:\\s*(.+)`));
      return m ? m[1].trim() : '';
    };
    const seoMeta = seoRaw.trim() ? {
      metaTitle: extractSeoField('TITRE_META'),
      metaDescription: extractSeoField('DESCRIPTION_META'),
      slug: extractSeoField('SLUG'),
      mainKeyword: extractSeoField('MOT_CLE_PRINCIPAL'),
      secondaryKeywords: extractSeoField('MOTS_CLES_SECONDAIRES'),
    } : null;

    // Enrichissements post-génération : images + correction grammaticale
    const titleMatch2 = deliverable.match(/^#\s+(.+)$/m);
    const imageQuery = titleMatch2 ? titleMatch2[1].trim() : searchQuery;
    const [imageResults, grammarNotes] = await Promise.all([
      searchImages(imageQuery, unsplashKey, pexelsKey, 3),
      checkGrammar(deliverable, 'fr'),
    ]);

    // Livraison via delivery_config si Aria le demande explicitement
    let deliveryResult: { success: boolean; url?: string; error?: string } | null = null;
    if (needsPublication(request.brief) && project.delivery_config) {
      const titleMatch = deliverable.match(/^#\s+(.+)$/m);
      const deliveryTitle = titleMatch ? titleMatch[1].trim() : `${project.title} — ${contentType}`;
      const htmlContent = mdToHtml(deliverable);
      deliveryResult = await executeDelivery(
        project.delivery_config as DeliveryConfig,
        deliveryTitle, htmlContent, deliverable,
        { project_id: project.id, client_name: project.client_name },
        seoMeta || undefined,
      );
      console.log(`[content] delivery for ${project.id}: type=${project.delivery_config.type}, success=${deliveryResult.success}, url=${deliveryResult.url}`);
    }

    const deliveryNote = deliveryResult
      ? deliveryResult.success
        ? `\n\n✅ Livré (${(project.delivery_config as DeliveryConfig).type}) : ${deliveryResult.url}`
        : `\n\n⚠️ Échec livraison (${(project.delivery_config as DeliveryConfig).type}) : ${deliveryResult.error}`
      : '';

    const imageSection = imageResults ? `\n\n─── IMAGES SUGGÉRÉES ───\n${imageResults}` : '';
    const grammarSection = grammarNotes ? `\n\n─── CORRECTIONS LINGUISTIQUES ───\n${grammarNotes}` : '';

    await supabase.from('internal_requests').update({
      status: 'completed',
      result: `[${contentType.toUpperCase()}]\n\n${deliverable}${imageSection}${grammarSection}${deliveryNote}`,
      result_summary: `${contentType} — ${summary.slice(0, 200)}${notes ? '\n\nNotes : ' + notes.slice(0, 150) : ''}${seoMeta?.metaTitle ? '\n\nSEO: ' + seoMeta.metaTitle : ''}${deliveryNote}`,
      completed_at: new Date().toISOString(),
    }).eq('id', request.id);

    const reportSections = [
      { heading: 'Type', content: contentType },
      { heading: 'Résumé', content: summary },
      { heading: 'Livrable complet', content: deliverable },
      { heading: 'Notes pour Aria', content: notes },
    ];
    if (seoMeta?.metaTitle) {
      reportSections.push({
        heading: 'SEO',
        content: [
          `Titre : ${seoMeta.metaTitle}`,
          `Description : ${seoMeta.metaDescription}`,
          `Slug : ${seoMeta.slug}`,
          `Mot-clé principal : ${seoMeta.mainKeyword}`,
          `Mots-clés secondaires : ${seoMeta.secondaryKeywords}`,
        ].filter(l => !l.endsWith(': ')).join('\n'),
      });
    }
    if (deliveryResult) {
      reportSections.push({
        heading: 'Livraison',
        content: deliveryResult.success
          ? `Livré avec succès (${(project.delivery_config as DeliveryConfig).type}) : ${deliveryResult.url}`
          : `Échec (${(project.delivery_config as DeliveryConfig).type}) : ${deliveryResult.error}`,
      });
    }

    await supabase.from('agent_reports').insert({
      agent_slug: AGENT_SLUG,
      title: `${contentType} — ${project.client_name} : ${project.title.slice(0, 50)}`,
      sections: reportSections,
      report_type: 'content_deliverable',
      content: {
        project_id: project.id, internal_request_id: request.id, content_type: contentType,
        delivered: deliveryResult?.success || false,
        delivery_type: (project.delivery_config as DeliveryConfig | undefined)?.type || null,
        ...(seoMeta ? { seo: seoMeta } : {}),
      },
    });

    await supabase.from('project_history').insert({
      project_id: project.id,
      event_type: deliveryResult?.success ? 'content_delivered_external' : 'content_delivered',
      old_value: { request_status: 'pending' },
      new_value: {
        request_status: 'completed', content_type: contentType,
        ...(deliveryResult?.success ? { delivery_url: deliveryResult.url, delivery_type: (project.delivery_config as DeliveryConfig).type } : {}),
      },
      actor_type: 'agent',
      note: `${profile.name} (${profile.title}) — ${deliveryResult?.success ? `livré via ${(project.delivery_config as DeliveryConfig).type} : ${deliveryResult.url}` : `livrable produit : ${contentType}. ${summary.slice(0, 100)}`}`,
    });

    await synthesizeExperience(supabase, anthropicKey, profile, project, contentType, summary);
    await updateClientMemory(supabase, anthropicKey, project.client_email || '', project.title, contentType, summary, profile.name, profile.title, DEPARTMENT);

    return true;
  } catch (err) {
    console.error('[content] executeInternalRequest error:', (err as Error).message);
    await supabase.from('internal_requests').update({ status: 'pending' }).eq('id', request.id);
    return false;
  }
}

async function processInternalRequests(
  supabase: ReturnType<typeof createClient>,
  anthropicKey: string,
  braveApiKey: string,
  unsplashKey: string,
  pexelsKey: string,
  youtubeKey: string,
  profile: EmployeeProfile,
): Promise<{ requests_processed: number; actions: string[] }> {
  const experience = await loadExperience(supabase, AGENT_SLUG);

  const { data: requests } = await supabase
    .from('internal_requests')
    .select('id, project_id, from_dept, brief, objective, decision_reason')
    .eq('to_dept', DEPARTMENT)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(3);

  const actions: string[] = [];
  let processed = 0;

  if (requests?.length) {
    for (const request of requests as InternalRequest[]) {
      const success = await executeInternalRequest(supabase, anthropicKey, braveApiKey, unsplashKey, pexelsKey, youtubeKey, profile, request, experience);
      if (success) {
        processed++;
        actions.push(`executed:${request.id.slice(0, 8)}`);
      }
    }
  }

  await updateMetrics(supabase, anthropicKey, profile);

  return { requests_processed: processed, actions };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const startTime = Date.now();
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')!;
    const braveApiKey = Deno.env.get('BRAVE_SEARCH_API_KEY') || '';
    const unsplashKey = Deno.env.get('UNSPLASH_ACCESS_KEY') || '';
    const pexelsKey = Deno.env.get('PEXELS_API_KEY') || '';
    const youtubeKey = Deno.env.get('YOUTUBE_API_KEY') || '';

    const supabase = createClient(supabaseUrl, supabaseKey);

    const profile = await loadProfile(supabase, AGENT_SLUG);
    if (!profile) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Profil employee_profiles introuvable pour slug=content' }),
        { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } },
      );
    }

    await supabase.from('agent_heartbeats').insert({
      agent_slug: AGENT_SLUG, run_type: 'daily',
      status: 'running', started_at: new Date().toISOString(),
    });

    const result = await processInternalRequests(supabase, anthropicKey, braveApiKey, unsplashKey, pexelsKey, youtubeKey, profile);

    await supabase.from('agent_heartbeats').insert({
      agent_slug: AGENT_SLUG, run_type: 'daily',
      status: 'completed', started_at: new Date().toISOString(),
      decisions: result.actions,
    });

    return new Response(
      JSON.stringify({ ok: true, ...result, duration_ms: Date.now() - startTime }),
      { headers: { ...cors, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('[content] fatal error:', (err as Error).message);
    return new Response(
      JSON.stringify({ ok: false, error: (err as Error).message }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } },
    );
  }
});
