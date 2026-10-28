import fs   from 'fs/promises';
import path  from 'path';
import { fileURLToPath } from 'url';

// Charger .env manuellement (compatible Node 18+, sans dépendance)
try {
  const envPath = new URL('.env', import.meta.url);
  const lines = (await fs.readFile(envPath, 'utf-8')).split('\n');
  for (const line of lines) {
    const [k, ...v] = line.split('=');
    if (k && v.length) process.env[k.trim()] ??= v.join('=').trim();
  }
} catch { /* pas de .env, on continue */ }

const __dir       = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH   = path.join(__dir, 'data', 'data.json');
// Clés lues depuis les variables d'environnement (définies dans .env ou au lancement)
const LASTFM_KEY  = process.env.LASTFM_KEY;
const LASTFM_USER = process.env.LASTFM_USER;
if (!LASTFM_KEY || !LASTFM_USER) {
  console.error('❌ LASTFM_KEY et LASTFM_USER doivent être définis dans .env');
  process.exit(1);
}

// ── Helpers ───────────────────────────────────────────────────

async function get(url) {
  const res = await fetch(url);
  return res.json();
}

async function lastfm(method, params = {}) {
  const url = new URL('https://ws.audioscrobbler.com/2.0/');
  url.searchParams.set('method', method);
  url.searchParams.set('user', LASTFM_USER);
  url.searchParams.set('api_key', LASTFM_KEY);
  url.searchParams.set('format', 'json');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return get(url.toString());
}

async function pause(ms = 200) {
  return new Promise(r => setTimeout(r, ms));
}

// ── Deezer : construire un objet track normalisé ──────────────

function buildTrackObject(track, album, artist, ecoute = false) {
  return {
    id:           String(track.id),
    name:         track.title,
    duration_ms:  track.duration * 1000,
    explicit:     track.explicit_lyrics ?? false,
    popularity:   track.rank ? Math.round(track.rank / 10000) : 0,
    track_number: track.track_position ?? track.disc_number ?? 1,
    type:         'track',
    ...(ecoute && { ecoute: true }),
    external_urls: { spotify: null },
    artists: [{
      id:         String(artist.id),
      name:       artist.name,
      type:       'artist',
      followers:  { total: artist.nb_fan ?? 0 },
      genres:     album.genres?.data?.map(g => g.name) ?? [],
      popularity: artist.nb_fan ? Math.min(Math.round(artist.nb_fan / 100000), 100) : 0,
      images:     artist.picture_medium ? [{ url: artist.picture_medium, height: 250, width: 250 }] : []
    }],
    album: {
      id:           String(album.id),
      name:         album.title,
      release_date: album.release_date ?? '',
      total_tracks: album.nb_tracks ?? 1,
      type:         'album',
      genres:       album.genres?.data?.map(g => g.name) ?? [],
      images:       album.cover_medium ? [{ url: album.cover_medium, height: 300, width: 300 }] : []
    }
  };
}

// ── Main ──────────────────────────────────────────────────────

async function main() {
  console.log('🔄 Lecture de data.json…');
  const existants = JSON.parse(await fs.readFile(DATA_PATH, 'utf-8'));
  const idsExistants = new Set(existants.map(t => t.id));

  const titresExistants = new Set(
    existants.map(t => t.name.toLowerCase() + '|' + t.artists[0]?.name.toLowerCase())
  );

  const parCle = new Map(existants.map(t => [t.name.toLowerCase() + '|' + t.artists[0]?.name.toLowerCase(), t]));
  let marques = 0;

  console.log(`📀 ${existants.length} morceaux dans data.json`);
  console.log('📡 Récupération des écoutes Last.fm (50 dernières)…');

  const data   = await lastfm('user.getrecenttracks', { limit: 50 });
  const tracks = (data.recenttracks?.track ?? []).filter(t => t.date?.uts);

  console.log(`🎵 ${tracks.length} écoutes récupérées depuis Last.fm\n`);

  let ajouts = 0;
  const nouvelles = [];

  for (const t of tracks) {
    const titre   = t.name;
    const artiste = t.artist['#text'];
    const cle     = titre.toLowerCase() + '|' + artiste.toLowerCase();

    // Morceau déjà présent : on le marque comme écouté
    if (titresExistants.has(cle)) {
      const connu = parCle.get(cle);
      if (connu && !connu.ecoute) { connu.ecoute = true; marques++; }
      continue;
    }

    // Chercher sur Deezer le premier résultat pour avoir l'album ID
    const q    = encodeURIComponent(`${titre} ${artiste}`);
    const res  = await get(`https://api.deezer.com/search?q=${q}&limit=1`);
    const hit  = res.data?.[0];

    if (!hit) {
      console.log(`❌ Introuvable sur Deezer : "${titre}" — ${artiste}`);
      continue;
    }

    // On n'ajoute que le morceau écouté (pas l'album entier)
    try {
      const [trackDetail, album, artist] = await Promise.all([
        get(`https://api.deezer.com/track/${hit.id}`),
        get(`https://api.deezer.com/album/${hit.album.id}`),
        get(`https://api.deezer.com/artist/${hit.artist.id}`)
      ]);
      await pause(150);

      if (!idsExistants.has(String(trackDetail.id))) {
        const obj = buildTrackObject(trackDetail, album, artist, true);
        nouvelles.push(obj);
        idsExistants.add(obj.id);
        titresExistants.add(cle);
        ajouts++;
        console.log(`✅ Ajout : "${obj.name}" — ${artiste}`);
      }
    } catch {
      console.log(`❌ Erreur lors de la récupération de "${titre}"`);
    }
  }

  if (ajouts === 0 && marques === 0) {
    console.log('\n✨ Aucun nouveau morceau à ajouter — tout est déjà à jour !');
    return;
  }

  const fusion = [...existants, ...nouvelles];
  await fs.writeFile(DATA_PATH, JSON.stringify(fusion), 'utf-8');
  console.log(`\n🎉 ${ajouts} morceau${ajouts > 1 ? 'x' : ''} ajouté${ajouts > 1 ? 's' : ''} dans data.json`);
  console.log(`📀 Total : ${fusion.length} morceaux`);
}

main().catch(err => {
  console.error('❌ Erreur :', err.message);
  process.exit(1);
});
