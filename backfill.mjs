import fs from 'fs/promises';

// Charger .env manuellement (compatible Node 18+, sans dépendance)
try {
  const envPath = new URL('.env', import.meta.url);
  const lines = (await fs.readFile(envPath, 'utf-8')).split('\n');
  for (const line of lines) {
    const [k, ...v] = line.split('=');
    if (k && v.length) process.env[k.trim()] ??= v.join('=').trim();
  }
} catch { /* pas de .env, on continue */ }

const { LASTFM_KEY, LASTFM_USER, SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env;
if (!LASTFM_KEY || !LASTFM_USER || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ LASTFM_KEY, LASTFM_USER, SUPABASE_URL et SUPABASE_SERVICE_KEY doivent être définis dans .env');
  process.exit(1);
}

const pause = ms => new Promise(r => setTimeout(r, ms));

async function lastfmPage(page) {
  const url = new URL('https://ws.audioscrobbler.com/2.0/');
  url.search = new URLSearchParams({
    method: 'user.getrecenttracks', user: LASTFM_USER, api_key: LASTFM_KEY,
    format: 'json', limit: 200, page
  });
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Last.fm ${res.status}`);
  return res.json();
}

async function envoyer(lignes) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/ecoutes`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=ignore-duplicates,return=minimal'
    },
    body: JSON.stringify(lignes)
  });
  if (!res.ok) throw new Error(`Supabase ${res.status} : ${await res.text()}`);
}

async function main() {
  let page = 1, totalPages = 1, total = 0;

  do {
    const data = await lastfmPage(page);
    totalPages = parseInt(data.recenttracks?.['@attr']?.totalPages ?? 1, 10);

    const lignes = (data.recenttracks?.track ?? [])
      .filter(t => t.date?.uts)
      .map(t => ({
        played_at: new Date(t.date.uts * 1000).toISOString(),
        titre:     t.name,
        artiste:   t.artist['#text'],
        album:     t.album?.['#text'] || null
      }));

    if (lignes.length) await envoyer(lignes);
    total += lignes.length;
    console.log(`📄 Page ${page}/${totalPages} — ${total} écoutes envoyées`);

    page++;
    await pause(250);
  } while (page <= totalPages);

  console.log(`\n🎉 Historique terminé : ${total} écoutes dans Supabase`);
}

main().catch(err => {
  console.error('❌ Erreur :', err.message);
  process.exit(1);
});
