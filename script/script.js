const CATEGORIES_GENRES = [
  { nom: 'Rap Français',        motsClés: ['rap français'] },
  { nom: 'Hip-Hop',             motsClés: ['rap', 'hip hop', 'hip-hop'] },
  { nom: 'Rock',                motsClés: ['rock', 'punk', 'metal', 'alternative'] },
  { nom: 'Pop',                 motsClés: ['pop'] },
  { nom: 'Chanson Française',   motsClés: ['chanson'] },
  { nom: 'Singer & Songwriter', motsClés: ['singer', 'songwriter'] }
];

function trouverCategorie(genre) {
  const genreEnMinuscule = genre.toLowerCase();
  for (const categorie of CATEGORIES_GENRES) {
    for (const motCle of categorie.motsClés) {
      if (genreEnMinuscule.includes(motCle)) {
        return categorie.nom;
      }
    }
  }
  return 'Autres';
}


function creerGraphiqueArtistes(listeMorceaux) {
  const compteurArtistes = {};

  for (const morceau of listeMorceaux) {
    const artistes = morceau.artiste.split(', ');
    for (const artiste of artistes) {
      if (compteurArtistes[artiste] === undefined) {
        compteurArtistes[artiste] = 0;
      }
      compteurArtistes[artiste]++;
    }
  }

  const top10  = Object.entries(compteurArtistes).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const noms   = top10.map(item => item[0]);
  const nombres = top10.map(item => item[1]);

  const canvasA = document.getElementById('chartArtistes');
  Chart.getChart(canvasA)?.destroy();

  new Chart(canvasA, {
    type: 'bar',
    data: {
      labels: noms,
      datasets: [{ label: 'Nombre de morceaux', data: nombres, backgroundColor: '#0d6efd' }]
    },
    options: {
      indexAxis: 'y',
      plugins: { legend: { display: false } },
      scales: { x: { ticks: { stepSize: 1 } } }
    }
  });
}


function creerGraphiqueGenres(listeMorceaux) {
  const compteurCategories = {
    'Rap Français':        0,
    'Hip-Hop':             0,
    'Rock':                0,
    'Pop':                 0,
    'Chanson Française':   0,
    'Singer & Songwriter': 0,
    'Autres':              0
  };

  for (const morceau of listeMorceaux) {
    if (morceau.genres.length === 0) {
      compteurCategories['Autres']++;
      continue;
    }

    let categorieFound = 'Autres';
    for (const genre of morceau.genres) {
      const categorie = trouverCategorie(genre);
      if (categorie !== 'Autres') {
        categorieFound = categorie;
        break;
      }
    }
    compteurCategories[categorieFound]++;
  }

  const categoriesAvecMorceaux = Object.keys(compteurCategories).filter(cat => compteurCategories[cat] > 0);
  const valeurs = categoriesAvecMorceaux.map(cat => compteurCategories[cat]);

  const canvasG = document.getElementById('chartGenres');
  Chart.getChart(canvasG)?.destroy();

  new Chart(canvasG, {
    type: 'pie',
    data: {
      labels: categoriesAvecMorceaux,
      datasets: [{
        data: valeurs,
        backgroundColor: [
          '#f48fb1',
          '#f06292',
          '#a5d6a7',
          '#90caf9',
          '#ffcc80',
          '#ce93d8',
          '#b0bec5'
        ]
      }]
    },
    options: {
      plugins: { legend: { position: 'right' } }
    }
  });
}


function formatDuree(ms) {
  const total = Math.floor(ms / 1000);
  const min   = Math.floor(total / 60);
  const sec   = String(total % 60).padStart(2, '0');
  return `${min}:${sec}`;
}

document.addEventListener('alpine:init', () => {
  Alpine.data('app', () => ({

    liste:              [],
    albums:             [],
    recherche:          '',
    morceauSelectionne: null,

    async init() {
      const reponse = await fetch('data/data.json');
      const brut    = await reponse.json();

      this.liste = brut.map(track => {
        const genresArtistes = track.artists.flatMap(a => a.genres ?? []);
        const genresAlbum    = track.album.genres ?? [];
        const genres         = genresArtistes.length ? genresArtistes : genresAlbum;

        return {
          id:          track.id,
          titre:       track.name,
          artiste:     track.artists.map(a => a.name).join(', '),
          album:       track.album.name,
          albumDate:   track.album.release_date ?? '',
          albumTracks: track.album.total_tracks ?? '',
          pochette:    track.album.images?.[0]?.url ?? '',
          genres,
          duree:       track.duration_ms ?? 0,
          popularite:  track.popularity ?? 0,
          previewUrl:  track.preview_url ?? '',
          numPiste:    track.track_number ?? '',
          explicit:    track.explicit ?? false,
          spotifyUrl:  track.external_urls?.spotify ?? '',
          artistes:    track.artists.map(a => ({
            nom:        a.name,
            popularite: a.popularity ?? 0,
            followers:  a.followers?.total ?? 0,
            image:      a.images?.[0]?.url ?? ''
          }))
        };
      });

      const albumsMap = {};
      for (const track of brut) {
        const alb = track.album;
        if (!albumsMap[alb.id]) {
          albumsMap[alb.id] = {
            id:          alb.id,
            nom:         alb.name,
            artiste:     track.artists.map(a => a.name).join(', '),
            date:        alb.release_date ?? '',
            totalTracks: alb.total_tracks ?? 0,
            pochette:    alb.images?.[0]?.url ?? '',
            popularite:  track.popularity ?? 0
          };
        } else {
          albumsMap[alb.id].popularite = Math.max(albumsMap[alb.id].popularite, track.popularity ?? 0);
        }
      }
      this.albums = Object.values(albumsMap)
        .sort((a, b) => b.popularite - a.popularite)
        .slice(0, 12);

      this.$nextTick(() => {
        creerGraphiqueArtistes(this.liste);
        creerGraphiqueGenres(this.liste);
      });
    },

    ouvrirDetails(morceau) {
      this.morceauSelectionne = morceau;
      document.getElementById('modalDetails').showModal();
    },

    fermerDetails() {
      document.getElementById('modalDetails').close();
      this.morceauSelectionne = null;
    },

    formatDuree(ms) {
      return formatDuree(ms);
    },

    filtre() {
      const q = this.recherche.toLowerCase().trim();
      if (!q) return this.liste;
      return this.liste.filter(morceau =>
        morceau.titre.toLowerCase().includes(q)   ||
        morceau.artiste.toLowerCase().includes(q) ||
        morceau.album.toLowerCase().includes(q)
      );
    }

  }));
});
