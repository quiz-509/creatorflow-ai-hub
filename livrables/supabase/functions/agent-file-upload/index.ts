import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPPORTED_TEXT_TYPES = ['text/plain', 'text/markdown', 'text/csv', 'application/json', 'text/html'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    // Auth — récupérer le client
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Non authentifié.' }), {
        status: 401, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const missionId = formData.get('mission_id') as string | null;

    if (!file) {
      return new Response(JSON.stringify({ error: 'Aucun fichier fourni.' }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    if (file.size > MAX_FILE_SIZE) {
      return new Response(JSON.stringify({ error: 'Fichier trop volumineux (max 5 MB).' }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'bin';
    const storagePath = `${user.id}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

    // Upload dans Supabase Storage
    const fileBuffer = await file.arrayBuffer();
    const { error: storageError } = await supabase.storage
      .from('client-files')
      .upload(storagePath, fileBuffer, { contentType: file.type || 'application/octet-stream', upsert: false });
    if (storageError) throw new Error(`Storage : ${storageError.message}`);

    // Extraire le texte si fichier texte
    let contentExtracted: string | null = null;
    const mimeType = file.type || '';

    if (SUPPORTED_TEXT_TYPES.some(t => mimeType.includes(t.split('/')[1])) ||
        ['txt','md','csv','json','html','xml'].includes(fileExt)) {
      const text = await file.text();
      contentExtracted = text.slice(0, 50000); // max 50k chars
    } else if (fileExt === 'pdf') {
      contentExtracted = `[PDF] ${file.name} — ${(file.size / 1024).toFixed(0)} KB. Extraction PDF non disponible. Utilisez read_url si le document est accessible en ligne.`;
    } else if (['docx', 'doc'].includes(fileExt)) {
      contentExtracted = `[DOCX] ${file.name} — ${(file.size / 1024).toFixed(0)} KB. Extraction DOCX non disponible actuellement.`;
    } else {
      contentExtracted = `[Fichier binaire] ${file.name} — type: ${mimeType}, taille: ${(file.size / 1024).toFixed(0)} KB.`;
    }

    // Enregistrer dans client_files
    const { data: fileRecord, error: dbError } = await supabase
      .from('client_files')
      .insert({
        client_id: user.id,
        mission_id: missionId || null,
        filename: file.name,
        storage_path: storagePath,
        content_extracted: contentExtracted,
        file_type: fileExt,
      })
      .select('id, filename, file_type')
      .single();
    if (dbError) throw new Error(`DB : ${dbError.message}`);

    return new Response(JSON.stringify({
      ok: true,
      file_id: fileRecord.id,
      filename: fileRecord.filename,
      file_type: fileRecord.file_type,
      content_extracted: !!contentExtracted,
      message: contentExtracted
        ? `Fichier analysé. Utilisez file_id "${fileRecord.id}" avec read_client_file dans votre mission.`
        : `Fichier uploadé mais non lisible. Seuls les fichiers texte, CSV, JSON et Markdown sont analysables.`,
    }), { headers: { ...cors, 'Content-Type': 'application/json' } });

  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
});
