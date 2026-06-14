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

function buildTrackObject(track, album, artist) {
  return {
    id:           String(track.id),
    name:         track.title,
    duration_ms:  track.duration * 1000,
    explicit:     track.explicit_lyrics ?? false,
    popularity:   track.rank ? Math.round(track.rank / 10000) : 0,
    preview_url:  track.preview ?? null,
    track_number: track.track_position ?? track.disc_number ?? 1,
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
}

// ── Deezer : chercher une track, puis récupérer TOUT son album ─

async function rechercherEtRecupererAlbum(titre, artiste, idsExistants, titresExistants) {
  const q   = encodeURIComponent(`${titre} ${artiste}`);
  const url = `https://api.deezer.com/search?q=${q}&limit=1`;

  try {
    const data = await get(url);
    const hit  = data.data?.[0];
    if (!hit) return [];

    // Infos complètes album + artiste
    const [album, artist] = await Promise.all([
      get(`https://api.deezer.com/album/${hit.album.id}`),
      get(`https://api.deezer.com/artist/${hit.artist.id}`)
    ]);
    await pause(150);

    // Toutes les tracks de l'album
    const albumTracks = await get(`https://api.deezer.com/album/${hit.album.id}/tracks?limit=100`);
    await pause(150);

    const nouvelles = [];

    for (const t of albumTracks.data ?? []) {
      if (idsExistants.has(String(t.id))) continue;

      const cle = t.title.toLowerCase() + '|' + artist.name.toLowerCase();
      if (titresExistants.has(cle)) continue;

      // Détails complets de la track pour avoir rank, preview, etc.
      let trackDetail;
      try {
        trackDetail = await get(`https://api.deezer.com/track/${t.id}`);
        await pause(120);
      } catch {
        trackDetail = t;
      }

      const obj = buildTrackObject(trackDetail, album, artist);
      nouvelles.push(obj);
      idsExistants.add(obj.id);
      titresExistants.add(cle);
    }

    return nouvelles;
  } catch (e) {
    return [];
  }
}

// ── Main ──────────────────────────────────────────────────────

async function main() {
  console.log('🔄 Lecture de data.json…');
  const existants = JSON.parse(await fs.readFile(DATA_PATH, 'utf-8'));
  const idsExistants = new Set(existants.map(t => t.id));

  const titresExistants = new Set(
    existants.map(t => t.name.toLowerCase() + '|' + t.artists[0]?.name.toLowerCase())
  );

  // Albums déjà présents (pour ne pas re-scanner un album entier inutilement)
  const albumsExistants = new Set(existants.map(t => t.album.id));

  console.log(`📀 ${existants.length} morceaux dans data.json`);
  console.log('📡 Récupération des écoutes Last.fm (50 dernières)…');

  const data   = await lastfm('user.getrecenttracks', { limit: 50 });
  const tracks = (data.recenttracks?.track ?? []).filter(t => t.date?.uts);

  console.log(`🎵 ${tracks.length} écoutes récupérées depuis Last.fm\n`);

  // Albums déjà traités dans cette session (évite de scanner le même album deux fois)
  const albumsTraites = new Set();
  let ajouts = 0;
  const nouvelles = [];

  for (const t of tracks) {
    const titre   = t.name;
    const artiste = t.artist['#text'];
    const cle     = titre.toLowerCase() + '|' + artiste.toLowerCase();

    // Si la track exacte est déjà là, on vérifie quand même si l'album est complet
    // (cas où la track était là mais pas les autres morceaux de l'album)
    if (titresExistants.has(cle)) {
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

    const albumId = String(hit.album.id);

    // Album déjà entièrement scanné dans cette session ou dans data.json
    if (albumsTraites.has(albumId)) {
      console.log(`⏭️  Album déjà traité cette session : ${hit.album.title}`);
      titresExistants.add(cle); // marquer quand même pour ne pas re-chercher
      continue;
    }

    albumsTraites.add(albumId);

    if (albumsExistants.has(albumId)) {
      // L'album est connu mais la track spécifique manque — on l'ajoute seule
      console.log(`🎵 Track manquante dans un album connu : "${titre}"`);
      try {
        const trackDetail = await get(`https://api.deezer.com/track/${hit.id}`);
        const album       = await get(`https://api.deezer.com/album/${hit.album.id}`);
        const artist      = await get(`https://api.deezer.com/artist/${hit.artist.id}`);
        await pause(150);

        if (!idsExistants.has(String(trackDetail.id))) {
          const obj = buildTrackObject(trackDetail, album, artist);
          nouvelles.push(obj);
          idsExistants.add(obj.id);
          titresExistants.add(cle);
          ajouts++;
          console.log(`   ✅ Ajout : "${obj.name}"`);
        }
      } catch {
        console.log(`   ❌ Erreur lors de la récupération de la track`);
      }
      continue;
    }

    // Nouvel album → récupérer TOUTES ses pistes
    console.log(`💿 Nouvel album détecté : "${hit.album.title}" — ${artiste}`);
    console.log(`   🔍 Récupération de toutes les pistes…`);

    const tracksAlbum = await rechercherEtRecupererAlbum(titre, artiste, idsExistants, titresExistants);

    if (tracksAlbum.length === 0) {
      console.log(`   ℹ️  Aucune nouvelle piste à ajouter`);
    } else {
      for (const obj of tracksAlbum) {
        nouvelles.push(obj);
        ajouts++;
        console.log(`   ✅ ${obj.track_number}. "${obj.name}"`);
      }
      console.log(`   → ${tracksAlbum.length} piste(s) ajoutée(s)`);
    }
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
