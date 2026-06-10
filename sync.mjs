import fs   from 'fs/promises';
import path  from 'path';
import { fileURLToPath } from 'url';

const __dir       = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH   = path.join(__dir, 'data', 'data.json');
const LASTFM_KEY  = 'fe79ae2b67b3b619504d63d7c9829008';
const LASTFM_USER = 'zaderlyl';

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

async function rechercherDeezer(titre, artiste) {
  const q   = encodeURIComponent(`${titre} ${artiste}`);
  const url = `https://api.deezer.com/search?q=${q}&limit=1`;
  try {
    const data = await get(url);
    const hit  = data.data?.[0];
    if (!hit) return null;

    // Récupère les détails complets de la track
    const track  = await get(`https://api.deezer.com/track/${hit.id}`);
    const album  = await get(`https://api.deezer.com/album/${hit.album.id}`);
    const artist = await get(`https://api.deezer.com/artist/${hit.artist.id}`);

    return {
      id:           String(track.id),
      name:         track.title,
      duration_ms:  track.duration * 1000,
      explicit:     track.explicit_lyrics ?? false,
      popularity:   track.rank ? Math.round(track.rank / 10000) : 0,
      preview_url:  track.preview ?? null,
      track_number: track.track_position ?? 1,
      type:         'track',
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
  } catch (e) {
    return null;
  }
}

// ── Main ──────────────────────────────────────────────────────

async function main() {
  console.log('🔄 Lecture de data.json…');
  const existants = JSON.parse(await fs.readFile(DATA_PATH, 'utf-8'));
  const idsExistants = new Set(existants.map(t => t.id));

  // Titres déjà connus (pour éviter doublons par nom)
  const titresExistants = new Set(
    existants.map(t => t.name.toLowerCase() + '|' + t.artists[0]?.name.toLowerCase())
  );

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

    if (titresExistants.has(cle)) continue;

    console.log(`🔍 Recherche Deezer : "${titre}" — ${artiste}`);
    const track = await rechercherDeezer(titre, artiste);

    if (!track) {
      console.log(`   ❌ Introuvable sur Deezer`);
      continue;
    }

    if (idsExistants.has(track.id)) {
      console.log(`   ⏭️  Déjà dans data.json (id ${track.id})`);
      titresExistants.add(cle);
      continue;
    }

    console.log(`   ✅ Ajout : "${track.name}" — ${track.artists[0].name}`);
    nouvelles.push(track);
    idsExistants.add(track.id);
    titresExistants.add(cle);
    ajouts++;

    // Pause pour respecter la limite de l'API Deezer (50 req/5s)
    await new Promise(r => setTimeout(r, 200));
  }

  if (ajouts === 0) {
    console.log('\n✨ Aucun nouveau morceau à ajouter — tout est déjà à jour !');
    return;
  }

  const fusion = [...existants, ...nouvelles];
  await fs.writeFile(DATA_PATH, JSON.stringify(fusion, null, 2), 'utf-8');
  console.log(`\n🎉 ${ajouts} morceau${ajouts > 1 ? 'x' : ''} ajouté${ajouts > 1 ? 's' : ''} dans data.json`);
  console.log(`📀 Total : ${fusion.length} morceaux`);
}

main().catch(err => {
  console.error('❌ Erreur :', err.message);
  process.exit(1);
});
