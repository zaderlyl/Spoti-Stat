const LASTFM_KEY  = 'fe79ae2b67b3b619504d63d7c9829008';
const LASTFM_USER = 'zaderlyl';
const LASTFM_BASE = 'https://ws.audioscrobbler.com/2.0/';

async function lastfm(method, params = {}) {
  const url = new URL(LASTFM_BASE);
  url.searchParams.set('method', method);
  url.searchParams.set('user', LASTFM_USER);
  url.searchParams.set('api_key', LASTFM_KEY);
  url.searchParams.set('format', 'json');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url);
  return res.json();
}

async function fetchRecentTracks(fromTs, toTs, maxPages = 5) {
  let tracks = [], page = 1, totalPages = 1;
  do {
    const data = await lastfm('user.getrecenttracks', { from: fromTs, to: toTs, limit: 200, page });
    totalPages = parseInt(data.recenttracks?.['@attr']?.totalPages ?? 1);
    const batch = data.recenttracks?.track ?? [];
    tracks.push(...batch.filter(t => t.date?.uts));
    page++;
    if (page > maxPages) break;
  } while (page <= totalPages);
  return tracks;
}

function formatDuree(ms) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function formatHeures(sec) {
  if (sec < 60)   return sec + 's';
  if (sec < 3600) return Math.round(sec / 60) + ' min';
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

const TOOLTIP_DARK = {
  backgroundColor: '#1a1a1a',
  borderColor: '#2e2e2e',
  borderWidth: 1,
  titleColor: '#e8e8e8',
  bodyColor: '#a0a0a0'
};

const CATEGORIES = [
  { nom: 'Rap Français',        mots: ['rap français'] },
  { nom: 'Rap Italien',         artistes: ['murubutu', 'claver gold', 'michele venanzoni'] },
  { nom: 'Hip-Hop',             mots: ['rap', 'hip hop', 'hip-hop'] },
  { nom: 'Rock',                mots: ['rock', 'punk', 'metal', 'alternative'] },
  { nom: 'Pop',                 mots: ['pop'] },
  { nom: 'Chanson Française',   mots: ['chanson'] },
  { nom: 'Singer & Songwriter', mots: ['singer', 'songwriter'] },
];

function categoriser(genres, artiste) {
  const a = artiste.toLowerCase();
  for (const cat of CATEGORIES) {
    if (cat.artistes && cat.artistes.some(x => a.includes(x)))
      if (genres.some(g => g.toLowerCase().includes('rap') || g.toLowerCase().includes('hip')))
        return cat.nom;
  }
  for (const g of genres) {
    const gl = g.toLowerCase();
    for (const cat of CATEGORIES)
      if (cat.mots && cat.mots.some(m => gl.includes(m))) return cat.nom;
  }
  return 'Autres';
}

// ── CHART ARTISTES ──────────────────────────────────────────
function creerChartArtistes(liste, limite = 10) {
  const compteur = {};
  for (const m of liste)
    for (const a of m.artiste.split(', '))
      compteur[a] = (compteur[a] ?? 0) + 1;

  const tries    = Object.entries(compteur).sort((a, b) => b[1] - a[1]);
  const sel      = limite === null ? tries : tries.slice(0, limite);
  const noms     = sel.map(x => x[0]);
  const vals     = sel.map(x => x[1]);

  const canvas = document.getElementById('chartArtistes');
  canvas.parentElement.style.height = (noms.length * 40) + 'px';
  Chart.getChart(canvas)?.destroy();

  new Chart(canvas, {
    type: 'bar',
    data: { labels: noms, datasets: [{ data: vals, backgroundColor: 'rgba(29,185,84,.7)', borderColor: '#1db954', borderWidth: 1, borderRadius: 4, borderSkipped: false }] },
    options: {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { ...TOOLTIP_DARK, callbacks: { label: ctx => ` ${ctx.parsed.x} morceau${ctx.parsed.x > 1 ? 'x' : ''}` } } },
      scales: {
        x: { ticks: { color: '#a0a0a0', stepSize: 1 }, grid: { color: '#2e2e2e' } },
        y: { ticks: { color: '#e8e8e8', font: { weight: '600' } }, grid: { display: false } }
      }
    }
  });
}

// ── CHART GENRES ────────────────────────────────────────────
function creerChartGenres(liste) {
  const compteur = {};
  for (const c of [...CATEGORIES.map(c => c.nom), 'Autres']) compteur[c] = 0;
  for (const m of liste) compteur[categoriser(m.genres, m.artiste)]++;
  const labels = Object.keys(compteur).filter(k => compteur[k] > 0);
  const vals   = labels.map(k => compteur[k]);

  const canvas = document.getElementById('chartGenres');
  Chart.getChart(canvas)?.destroy();

  new Chart(canvas, {
    type: 'doughnut',
    data: { labels, datasets: [{ data: vals, backgroundColor: ['#1db954','#4ade80','#60a5fa','#f472b6','#fb923c','#a78bfa','#f43f5e','#94a3b8'], borderColor: '#1a1a1a', borderWidth: 3, hoverOffset: 8 }] },
    options: {
      responsive: true, cutout: '65%',
      plugins: {
        legend: { position: 'right', labels: { color: '#e8e8e8', padding: 14, font: { size: 12 }, boxWidth: 12, boxHeight: 12, borderRadius: 6 } },
        tooltip: TOOLTIP_DARK
      }
    }
  });
}

// ── CHART ÉCOUTES PAR JOUR ──────────────────────────────────
function creerChartEcoutesParJour(joursLabels, plays, minutes) {
  const canvas = document.getElementById('chartEcoutesJour');
  Chart.getChart(canvas)?.destroy();

  new Chart(canvas, {
    type: 'line',
    data: {
      labels: joursLabels,
      datasets: [
        {
          label: 'Écoutes',
          data: plays,
          borderColor: '#1db954',
          backgroundColor: 'rgba(29,185,84,.1)',
          fill: true,
          tension: .4,
          pointBackgroundColor: '#1db954',
          pointRadius: 4,
          pointHoverRadius: 6,
          yAxisID: 'y'
        },
        {
          label: 'Minutes',
          data: minutes,
          borderColor: '#60a5fa',
          backgroundColor: 'rgba(96,165,250,.08)',
          fill: true,
          tension: .4,
          pointBackgroundColor: '#60a5fa',
          pointRadius: 4,
          pointHoverRadius: 6,
          yAxisID: 'y2'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { labels: { color: '#e8e8e8', boxWidth: 12 } },
        tooltip: { ...TOOLTIP_DARK, callbacks: {
          label: ctx => ctx.datasetIndex === 0
            ? ` ${ctx.parsed.y} écoute${ctx.parsed.y > 1 ? 's' : ''}`
            : ` ${ctx.parsed.y} min`
        }}
      },
      scales: {
        x:  { ticks: { color: '#a0a0a0', maxTicksLimit: 10 }, grid: { color: '#2e2e2e' } },
        y:  { min: 0, ticks: { color: '#1db954', stepSize: 1 }, grid: { color: '#2e2e2e' }, title: { display: true, text: 'Écoutes', color: '#1db954' } },
        y2: { min: 0, position: 'right', ticks: { color: '#60a5fa' }, grid: { display: false }, title: { display: true, text: 'Minutes', color: '#60a5fa' } }
      }
    }
  });
}

// ── CHART TRACK WEEKLY ──────────────────────────────────────
function creerChartTrackWeekly(joursLabels, plays, canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  Chart.getChart(canvas)?.destroy();

  new Chart(canvas, {
    type: 'line',
    data: {
      labels: joursLabels,
      datasets: [{
        label: 'Écoutes',
        data: plays,
        borderColor: '#1db954',
        backgroundColor: 'rgba(29,185,84,.1)',
        fill: true,
        tension: .4,
        pointBackgroundColor: '#1db954',
        pointRadius: 5,
        pointHoverRadius: 7
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { ...TOOLTIP_DARK, callbacks: { label: ctx => ` ${ctx.parsed.y} écoute${ctx.parsed.y > 1 ? 's' : ''}` } } },
      scales: {
        x: { ticks: { color: '#a0a0a0' }, grid: { color: '#2e2e2e' } },
        y: { ticks: { color: '#1db954', stepSize: 1 }, grid: { color: '#2e2e2e' }, min: 0 }
      }
    }
  });
}

// ── CHART ALBUMS ────────────────────────────────────────────
function creerChartAlbums(labels, plays, durees) {
  const canvas = document.getElementById('chartAlbumsStats');
  Chart.getChart(canvas)?.destroy();

  new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Écoutes', data: plays,
          borderColor: '#1db954', backgroundColor: 'rgba(29,185,84,.12)',
          pointBackgroundColor: '#1db954', fill: true, tension: .4,
          pointRadius: 4, pointHoverRadius: 6, borderWidth: 2, yAxisID: 'y'
        },
        {
          label: 'Temps (min)', data: durees,
          borderColor: '#60a5fa', backgroundColor: 'rgba(96,165,250,.08)',
          pointBackgroundColor: '#60a5fa', fill: true, tension: .4,
          pointRadius: 4, pointHoverRadius: 6, borderWidth: 2, yAxisID: 'y2'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { labels: { color: '#e8e8e8', boxWidth: 12 } },
        tooltip: { ...TOOLTIP_DARK, callbacks: {
          label: ctx => ctx.datasetIndex === 0
            ? ` ${ctx.parsed.y} écoute${ctx.parsed.y > 1 ? 's' : ''}`
            : ` ${ctx.parsed.y} min d'écoute`
        }}
      },
      scales: {
        x:  { ticks: { color: '#a0a0a0', maxRotation: 35 }, grid: { color: '#2e2e2e' } },
        y:  { min: 0, ticks: { color: '#1db954', stepSize: 1 }, grid: { color: '#2e2e2e' }, title: { display: true, text: 'Écoutes', color: '#1db954' } },
        y2: { min: 0, position: 'right', ticks: { color: '#60a5fa' }, grid: { display: false }, title: { display: true, text: 'Minutes', color: '#60a5fa' } }
      }
    }
  });
}


// ── COMPOSANT ALPINE ─────────────────────────────────────────
document.addEventListener('alpine:init', () => {
  Alpine.data('app', () => ({

    liste:              [],
    albums:             [],
    morceauSelectionne: null,
    tousArtistes:       false,
    recherche:          '',
    trierPar:           'defaut',
    ordreAsc:           true,
    filtreGenre:        '',
    nowPlaying:         null,
    playcounts:         {},
    _pollTimer:         null,
    _playcountTimer:    null,
    dernierRefresh:     null,

    // Stats globales
    chargementStats:    false,
    statsChargees:      false,

    // Stats par morceau
    trackStatsVisible:  false,
    trackStatsLoading:  false,
    trackStatsDays:     [],
    trackStatsPlays:    [],
    trackStatsTotalPlays: 0,
    trackStatsTotalMin:   0,

    // Stats albums global
    albumStatsVisible:  false,
    albumStatsLoading:  false,

    // Popup album
    albumSelectionne:   null,
    albumPopupLoading:  false,

    // Featurings du top track (chargés depuis Deezer)
    topTrackFeats:      [],

    // Sections repliables
    sections: {
      chartsArtistesGenres: true,
      ecoutesJour:          true,
      albums:               true,
      morceaux:             true,
    },

    // Filtres morceaux
    ongletMorceaux:     'tous',   // 'tous' | 'ecoutes'

    // Filtres albums
    rechercheAlbum:     '',
    trierAlbumPar:      'popularite', // 'popularite' | 'nom' | 'date' | 'ecoutes'

    async init() {
      const brut = await fetch('data/data.json').then(r => r.json());

      this.liste = brut.map(t => {
        const ga     = t.artists.flatMap(a => a.genres ?? []);
        const genres = ga.length ? ga : (t.album.genres ?? []);
        return {
          id: t.id, titre: t.name,
          artiste:     t.artists.map(a => a.name).join(', '),
          album:       t.album.name,
          albumDate:   t.album.release_date ?? '',
          albumTracks: t.album.total_tracks ?? 0,
          pochette:    (t.album.images?.slice().sort((a,b)=>(b.height||0)-(a.height||0))[0]?.url ?? '').replace(/\/\d+x\d+-/, '/1000x1000-'),
          genres,
          duree:       t.duration_ms ?? 0,
          popularite:  t.popularity ?? 0,
          previewUrl:  t.preview_url ?? '',
          numPiste:    t.track_number ?? '',
          explicit:    t.explicit ?? false,
          spotifyUrl:  t.external_urls?.spotify ?? '',
          artistes:    t.artists.map(a => ({ nom: a.name, popularite: a.popularity ?? 0, followers: a.followers?.total ?? 0, image: (a.images?.slice().sort((x,y)=>(y.height||0)-(x.height||0))[0]?.url ?? '').replace(/\/\d+x\d+-/, '/500x500-') }))
        };
      });

      const albumsMap = {};
      for (const t of brut) {
        const a = t.album;
        if (!albumsMap[a.id]) {
          albumsMap[a.id] = { id: a.id, nom: a.name, artiste: t.artists[0]?.name ?? '', date: a.release_date ?? '', totalTracks: a.total_tracks ?? 0, pochette: (a.images?.slice().sort((a,b)=>(b.height||0)-(a.height||0))[0]?.url ?? '').replace(/\/\d+x\d+-/, '/1000x1000-'), popularite: t.popularity ?? 0 };
        } else {
          albumsMap[a.id].popularite = Math.max(albumsMap[a.id].popularite, t.popularity ?? 0);
        }
      }
      this.albums = Object.values(albumsMap).sort((a, b) => b.popularite - a.popularite);

      this.$nextTick(() => { creerChartArtistes(this.liste); creerChartGenres(this.liste); });

      await this.chargerPlaycounts();
      await this.rafraichirNowPlaying();

      // Now Playing : toutes les 30s
      this._pollTimer = setInterval(() => this.rafraichirNowPlaying(), 30000);

      // Playcounts : toutes les 2 minutes
      this._playcountTimer = setInterval(async () => {
        await this.chargerPlaycounts();
        this.dernierRefresh = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      }, 120000);
    },

    // ── LAST.FM NOW PLAYING ──
    async rafraichirNowPlaying() {
      try {
        const data  = await lastfm('user.getrecenttracks', { limit: 1 });
        const track = data.recenttracks?.track?.[0];
        this.nowPlaying = track?.['@attr']?.nowplaying === 'true' ? {
          titre:   track.name,
          artiste: track.artist['#text'],
          album:   track.album['#text'],
          image:   track.image?.find(i => i.size === 'large')?.['#text'] || ''
        } : null;
      } catch { this.nowPlaying = null; }
    },

    // ── LAST.FM PLAYCOUNTS ──
    async chargerPlaycounts() {
      try {
        const data   = await lastfm('user.gettoptracks', { limit: 200, period: 'overall' });
        const tracks = data.toptracks?.track ?? [];
        for (const t of tracks)
          this.playcounts[t.name.toLowerCase() + '|' + t.artist.name.toLowerCase()] = parseInt(t.playcount, 10);
        // Charger les featurings du top track après les playcounts
        await this.chargerFeaturingsTopTrack();
      } catch {}
    },

    // ── FEATURINGS DU TOP TRACK (Deezer contributors) ──
    async chargerFeaturingsTopTrack() {
      try {
        const track = this.stats.topEcouteTrack;
        if (!track) return;
        // Extraire feats depuis le titre (feat. X, Y)
        const titleFeats = (() => {
          const m = track.titre.match(/\(feat\.?\s*([^)]+)\)/i);
          if (!m) return [];
          return m[1].split(/[,&]+/).map(s => s.trim()).filter(Boolean);
        })();
        // Chercher sur Deezer pour avoir les contributors
        const deezerId = track.id; // l'id Deezer est stocké dans track.id
        const res = await fetch(`https://api.deezer.com/track/${deezerId}`);
        const data = await res.json();
        const contributors = data.contributors ?? [];
        // Artistes déjà dans le track
        const dejaNoms = new Set(track.artistes.map(a => a.nom.toLowerCase()));
        const feats = contributors
          .filter(c => !dejaNoms.has(c.name.toLowerCase()))
          .map(c => ({
            nom:   c.name,
            image: c.picture_medium || c.picture || ''
          }));
        // Compléter avec feats du titre si pas déjà inclus
        for (const n of titleFeats) {
          if (!feats.some(f => f.nom.toLowerCase() === n.toLowerCase()) && !dejaNoms.has(n.toLowerCase()))
            feats.push({ nom: n, image: '' });
        }
        this.topTrackFeats = feats;
      } catch { this.topTrackFeats = []; }
    },

    getPlaycount(morceau) {
      return this.playcounts[morceau.titre.toLowerCase() + '|' + morceau.artiste.split(', ')[0].toLowerCase()] ?? null;
    },

    // ── STATS GLOBALES PAR JOUR ──
    async chargerStatsGlobales() {
      if (this.statsChargees || this.chargementStats) return;
      this.chargementStats = true;

      // Durée moyenne en secondes depuis les données locales
      const dureeMoyenne = this.liste.length
        ? this.liste.reduce((s, m) => s + m.duree, 0) / this.liste.length / 1000
        : 210;

      // Préparer les 30 derniers jours
      const parJour = {};
      const dateKeys = {};
      for (let i = 29; i >= 0; i--) {
        const d   = new Date();
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() - i);
        const label = d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
        const ts    = Math.floor(d.getTime() / 1000);
        parJour[label] = { plays: 0, sec: 0 };
        dateKeys[ts]   = label;
      }

      // Récupérer les tracks page par page sans filtre from/to
      let page = 1, totalPages = 1;
      const cutoff = Math.floor(Date.now() / 1000) - 30 * 86400;

      do {
        const data  = await lastfm('user.getrecenttracks', { limit: 200, page });
        totalPages  = parseInt(data.recenttracks?.['@attr']?.totalPages ?? 1);
        const batch = (data.recenttracks?.track ?? []).filter(t => t.date?.uts);

        let stop = false;
        for (const t of batch) {
          const uts = parseInt(t.date.uts);
          if (uts < cutoff) { stop = true; break; }

          const d   = new Date(uts * 1000);
          d.setHours(0, 0, 0, 0);
          const label = d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
          if (parJour[label] !== undefined) {
            parJour[label].plays++;
            parJour[label].sec += dureeMoyenne;
          }
        }
        if (stop) break;
        page++;
        if (page > 8) break;
      } while (page <= totalPages);

      const labels  = Object.keys(parJour);
      const plays   = labels.map(k => parJour[k].plays);
      const minutes = labels.map(k => Math.round(parJour[k].sec / 60));

      this.chargementStats = false;
      this.statsChargees   = true;

      this.$nextTick(() => creerChartEcoutesParJour(labels, plays, minutes));
    },

    // ── STATS PAR MORCEAU ──
    async ouvrirStatsTrack(morceau) {
      this.trackStatsVisible = true;
      this.trackStatsLoading = true;
      this.trackStatsTotalPlays = 0;
      this.trackStatsTotalMin   = 0;

      const now    = Math.floor(Date.now() / 1000);
      const depuis = now - 7 * 86400;
      const all    = await fetchRecentTracks(depuis, now, 3);

      const nomCible     = morceau.titre.toLowerCase();
      const artisteCible = morceau.artiste.split(', ')[0].toLowerCase();
      const dureeSeconde = morceau.duree / 1000;

      // Grouper par jour sur 7 jours
      const parJour = {};
      for (let i = 6; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        parJour[d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })] = 0;
      }

      for (const t of all) {
        if (t.name.toLowerCase() === nomCible && t.artist['#text'].toLowerCase() === artisteCible) {
          const d   = new Date(parseInt(t.date.uts) * 1000);
          const key = d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
          if (parJour[key] !== undefined) parJour[key]++;
          this.trackStatsTotalPlays++;
        }
      }

      this.trackStatsTotalMin = Math.round(this.trackStatsTotalPlays * dureeSeconde / 60);
      this.trackStatsPlays    = Object.values(parJour);
      this.trackStatsDays     = Object.keys(parJour);
      this.trackStatsLoading  = false;

      this.$nextTick(() => creerChartTrackWeekly(this.trackStatsDays, this.trackStatsPlays, 'chartTrackWeekly'));
    },

    fermerStatsTrack() {
      this.trackStatsVisible = false;
    },

    // ── STATS ALBUMS ──
    async ouvrirStatsAlbums() {
      this.albumStatsVisible = true;
      this.albumStatsLoading = true;

      const data   = await lastfm('user.gettopalbums', { limit: 20, period: 'overall' });
      const albums = data.topalbums?.album ?? [];

      const labels = albums.map(a => a.name.length > 20 ? a.name.slice(0, 18) + '…' : a.name);
      const plays  = albums.map(a => parseInt(a.playcount, 10));

      // Estimer la durée d'écoute : plays × durée moyenne des morceaux de l'album
      const dureeMoyenne = this.liste.length
        ? this.liste.reduce((s, m) => s + m.duree, 0) / this.liste.length / 1000 / 60
        : 3.5;
      const durees = plays.map(p => Math.round(p * dureeMoyenne));

      this.albumStatsLoading = false;
      this.$nextTick(() => creerChartAlbums(labels, plays, durees));
    },

    fermerStatsAlbums() {
      this.albumStatsVisible = false;
    },

    async ouvrirAlbum(alb) {
      this.albumSelectionne  = alb;
      this.albumPopupLoading = true;

      // Tracks de cet album triées par numéro de piste
      const tracksAlbum = this.liste
        .filter(m => m.album === alb.nom)
        .sort((a, b) => (a.numPiste ?? 0) - (b.numPiste ?? 0));

      // Récupérer les écoutes des 30 derniers jours depuis Last.fm
      const depuis = Math.floor(Date.now() / 1000) - 30 * 86400;
      let page = 1, totalPages = 1, toutesEcoutes = [];

      do {
        const data  = await lastfm('user.getrecenttracks', { limit: 200, page });
        totalPages  = parseInt(data.recenttracks?.['@attr']?.totalPages ?? 1);
        const batch = (data.recenttracks?.track ?? []).filter(t => t.date?.uts);
        let stop = false;
        for (const t of batch) {
          if (parseInt(t.date.uts) < depuis) { stop = true; break; }
          toutesEcoutes.push(t);
        }
        if (stop) break;
        page++;
        if (page > 10) break;
      } while (page <= totalPages);

      // Pour chaque track : compter écoutes + calculer temps (écoutes × durée)
      const labels  = [];
      const ecoutes = [];
      const minutes = [];

      for (const m of tracksAlbum) {
        const count = toutesEcoutes.filter(t =>
          t.name.toLowerCase()          === m.titre.toLowerCase() &&
          t.artist['#text'].toLowerCase() === m.artiste.split(', ')[0].toLowerCase()
        ).length;

        const titre = m.titre.length > 30 ? m.titre.slice(0, 28) + '…' : m.titre;
        labels.push(titre);
        ecoutes.push(count);
        minutes.push(parseFloat(((count * (m.duree ?? 0)) / 60000).toFixed(1)));
      }

      this.albumPopupLoading = false;

      this.$nextTick(() => {
        const canvas = document.getElementById('chartAlbumPopup');
        if (!canvas) return;
        Chart.getChart(canvas)?.destroy();

        canvas.parentElement.style.height = Math.max(220, tracksAlbum.length * 54) + 'px';

        new Chart(canvas, {
          type: 'line',
          data: {
            labels,
            datasets: [
              {
                label:               'Écoutes',
                data:                ecoutes,
                borderColor:         '#1db954',
                backgroundColor:     'rgba(29,185,84,.0)',
                pointBackgroundColor:'#1db954',
                pointBorderColor:    '#0f0f0f',
                pointBorderWidth:    2,
                pointRadius:         7,
                pointHoverRadius:    10,
                fill:                false,
                tension:             0,
                borderWidth:         2,
                borderDash:          [],
                xAxisID:             'x'
              },
              {
                label:               'Minutes',
                data:                minutes,
                borderColor:         '#60a5fa',
                backgroundColor:     'rgba(96,165,250,.0)',
                pointBackgroundColor:'#60a5fa',
                pointBorderColor:    '#0f0f0f',
                pointBorderWidth:    2,
                pointRadius:         7,
                pointHoverRadius:    10,
                fill:                false,
                tension:             0,
                borderWidth:         2,
                xAxisID:             'x2'
              }
            ]
          },
          options: {
            indexAxis:           'y',
            responsive:          true,
            maintainAspectRatio: false,
            interaction:         { mode: 'y', intersect: false },
            plugins: {
              legend: {
                position: 'bottom',
                labels: {
                  color:   '#a0a0a0',
                  boxWidth: 10, boxHeight: 10,
                  useBorderRadius: true, borderRadius: 5,
                  font: { size: 12 }, padding: 20
                }
              },
              tooltip: {
                ...TOOLTIP_DARK,
                padding: 12,
                callbacks: {
                  label: ctx => ctx.datasetIndex === 0
                    ? `  🎧 ${ctx.raw} écoute${ctx.raw > 1 ? 's' : ''}`
                    : `  ⏱ ${ctx.raw} min`
                }
              }
            },
            scales: {
              y: {
                ticks:  { color: '#e0e0e0', font: { size: 12 }, padding: 10 },
                grid:   { color: '#1e1e1e' },
                border: { display: false }
              },
              x: {
                min:      0,
                position: 'bottom',
                ticks:    { color: '#1db954', stepSize: 1, font: { size: 11 } },
                grid:     { color: '#1e1e1e' },
                border:   { display: false },
                title:    { display: true, text: 'Écoutes', color: '#1db954', font: { size: 11 } }
              },
              x2: {
                min:      0,
                position: 'top',
                ticks:    { color: '#60a5fa', font: { size: 11 } },
                grid:     { display: false },
                border:   { display: false },
                title:    { display: true, text: 'Minutes', color: '#60a5fa', font: { size: 11 } }
              }
            }
          }
        });
      });
    },

    fermerAlbum() {
      this.albumSelectionne = null;
    },

    // ── UTILS ──
    get stats() {
      const artistes = new Set(this.liste.flatMap(m => m.artiste.split(', ')));
      const genres   = {};
      for (const m of this.liste) { const c = categoriser(m.genres, m.artiste); genres[c] = (genres[c] ?? 0) + 1; }
      // Morceau le plus écouté via Last.fm playcounts
      let topEcoute      = '—';
      let topEcouteTrack = null;
      let topEcouteCount = 0;
      if (Object.keys(this.playcounts).length > 0) {
        const [meilleurCle, count] = Object.entries(this.playcounts).sort((a, b) => b[1] - a[1])[0] ?? [];
        if (meilleurCle) {
          topEcoute      = meilleurCle.split('|')[0];
          topEcouteCount = count;
          const [nom, art] = meilleurCle.split('|');
          topEcouteTrack = this.liste.find(m =>
            m.titre.toLowerCase() === nom &&
            m.artiste.split(', ')[0].toLowerCase() === art
          ) ?? null;
        }
      }

      return {
        total:     this.liste.length,
        artistes:  artistes.size,
        topGenre:  Object.entries(genres).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—',
        topEcoute,
        topEcouteTrack,
        topEcouteCount
      };
    },

    ouvrirDetails(m) { this.morceauSelectionne = m; this.trackStatsVisible = false; },
    fermerDetails()  { this.morceauSelectionne = null; },
    toggleArtistes() { this.tousArtistes = !this.tousArtistes; creerChartArtistes(this.liste, this.tousArtistes ? null : 10); },
    toggleOrdre()    { this.ordreAsc = !this.ordreAsc; },
    formatDuree(ms)  { return formatDuree(ms); },
    formatHeures(s)  { return formatHeures(s); },

    genresDisponibles() {
      const s = new Set();
      for (const m of this.liste) for (const g of m.genres) s.add(g);
      return [...s].sort();
    },

    filtre() {
      const q = this.recherche.toLowerCase().trim();
      let res = this.liste.filter(m => {
        const r = !q || m.titre.toLowerCase().includes(q) || m.artiste.toLowerCase().includes(q) || m.album.toLowerCase().includes(q);
        const g = !this.filtreGenre || m.genres.includes(this.filtreGenre);
        // Filtre onglet : 'ecoutes' = seulement les tracks avec playcount > 0
        const cle = m.titre.toLowerCase() + '|' + m.artiste.split(', ')[0].toLowerCase();
        const e = this.ongletMorceaux === 'tous' || (this.playcounts[cle] ?? 0) > 0;
        return r && g && e;
      });
      if (this.trierPar !== 'defaut') {
        res = [...res].sort((a, b) => {
          let va, vb;
          switch (this.trierPar) {
            case 'titre':      va = a.titre;        vb = b.titre;       break;
            case 'artiste':    va = a.artiste;       vb = b.artiste;     break;
            case 'album':      va = a.album;         vb = b.album;       break;
            case 'popularite': va = a.popularite;    vb = b.popularite;  break;
            case 'genre':      va = a.genres[0]??''; vb = b.genres[0]??''; break;
            case 'duree':      va = a.duree;         vb = b.duree;       break;
            case 'ecoutes': {
              const ca = a.titre.toLowerCase()+'|'+a.artiste.split(', ')[0].toLowerCase();
              const cb = b.titre.toLowerCase()+'|'+b.artiste.split(', ')[0].toLowerCase();
              va = this.playcounts[ca] ?? 0;
              vb = this.playcounts[cb] ?? 0;
              break;
            }
          }
          if (typeof va === 'string') return this.ordreAsc ? va.localeCompare(vb,'fr') : vb.localeCompare(va,'fr');
          return this.ordreAsc ? va - vb : vb - va;
        });
      }
      return res;
    },

    // Albums filtrés + triés
    albumsFiltres() {
      const q = this.rechercheAlbum.toLowerCase().trim();
      let res = this.albums.filter(a =>
        !q || a.nom.toLowerCase().includes(q) || a.artiste.toLowerCase().includes(q)
      );
      switch (this.trierAlbumPar) {
        case 'nom':       res = [...res].sort((a, b) => a.nom.localeCompare(b.nom, 'fr')); break;
        case 'date':      res = [...res].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')); break;
        case 'ecoutes': {
          res = [...res].sort((a, b) => {
            const ea = this.liste.filter(m => m.album === a.nom).reduce((s, m) => {
              const k = m.titre.toLowerCase()+'|'+m.artiste.split(', ')[0].toLowerCase();
              return s + (this.playcounts[k] ?? 0);
            }, 0);
            const eb = this.liste.filter(m => m.album === b.nom).reduce((s, m) => {
              const k = m.titre.toLowerCase()+'|'+m.artiste.split(', ')[0].toLowerCase();
              return s + (this.playcounts[k] ?? 0);
            }, 0);
            return eb - ea;
          });
          break;
        }
        default: res = [...res].sort((a, b) => b.popularite - a.popularite);
      }
      return res;
    },

    // Nombre d'écoutes total d'un album
    ecoutesAlbum(alb) {
      return this.liste
        .filter(m => m.album === alb.nom)
        .reduce((s, m) => {
          const k = m.titre.toLowerCase()+'|'+m.artiste.split(', ')[0].toLowerCase();
          return s + (this.playcounts[k] ?? 0);
        }, 0);
    }

  }));
});
