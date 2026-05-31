// =============================================
//  1. CATÉGORIES DE GENRES
// =============================================

// On définit nos catégories et les mots-clés qui y correspondent
const CATEGORIES_GENRES = [
  {
    nom: 'Animé',
    motsClés: ['anime', 'animé', 'anison']
  },
  {
    nom: 'J-Pop',
    motsClés: ['j-pop', 'jpop', 'japanese pop']
  },
  {
    nom: 'Rock',
    motsClés: ['rock', 'punk', 'metal']
  },
  {
    nom: 'Vocaloid',
    motsClés: ['vocaloid']
  },
  {
    nom: 'Indie Japonaise',
    motsClés: ['indie', 'shibuya', 'city pop']
  },
  {
    nom: 'Variété Française',
    motsClés: ['french', 'variété', 'variete', 'french pop']
  },
  {
    nom: 'Chanson',
    motsClés: ['chanson', 'french folk']
  }
];

// Cette fonction prend un genre brut (ex: "j-pop")
// et retourne la catégorie correspondante (ex: "J-Pop")
// Si aucune catégorie ne correspond, elle retourne "Autres"
function trouverCategorie(genre) {

  // On met le genre en minuscule pour comparer plus facilement
  const genreEnMinuscule = genre.toLowerCase();

  // On parcourt chaque catégorie
  for (const categorie of CATEGORIES_GENRES) {

    // On vérifie si le genre contient un des mots-clés de la catégorie
    for (const motCle of categorie.motsClés) {
      if (genreEnMinuscule.includes(motCle)) {
        return categorie.nom; // On a trouvé la catégorie !
      }
    }
  }

  // Aucune catégorie trouvée → Autres
  return 'Autres';
}


// =============================================
//  2. GRAPHIQUE TOP 10 ARTISTES
// =============================================

function creerGraphiqueArtistes(listeMorceaux) {

  // On compte combien de morceaux chaque artiste a
  const compteurArtistes = {};

  for (const morceau of listeMorceaux) {

    // Un morceau peut avoir plusieurs artistes séparés par ", "
    const artistes = morceau.artiste.split(', ');

    for (const artiste of artistes) {
      if (compteurArtistes[artiste] === undefined) {
        compteurArtistes[artiste] = 0;
      }
      compteurArtistes[artiste]++;
    }
  }

  // On trie les artistes du plus au moins présent
  const artistesTries = Object.entries(compteurArtistes).sort((a, b) => b[1] - a[1]);

  // On garde seulement les 10 premiers
  const top10 = artistesTries.slice(0, 10);

  // On sépare les noms et les nombres pour Chart.js
  const noms    = top10.map(item => item[0]);
  const nombres = top10.map(item => item[1]);

  // On crée le graphique
  new Chart(document.getElementById('chartArtistes'), {
    type: 'bar',
    data: {
      labels: noms,
      datasets: [
        {
          label: 'Nombre de morceaux',
          data: nombres,
          backgroundColor: '#0d6efd'
        }
      ]
    },
    options: {
      indexAxis: 'y', // barres horizontales
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: { ticks: { stepSize: 1 } }
      }
    }
  });
}


// =============================================
//  3. GRAPHIQUE DISTRIBUTION DES GENRES
// =============================================

function creerGraphiqueGenres(listeMorceaux) {

  // On initialise le compteur avec toutes les catégories à 0
  const compteurCategories = {
    'Animé':             0,
    'J-Pop':             0,
    'Rock':              0,
    'Vocaloid':          0,
    'Indie Japonaise':   0,
    'Variété Française': 0,
    'Chanson':           0,
    'Autres':            0
  };

  // On parcourt chaque morceau
  for (const morceau of listeMorceaux) {

    // Si le morceau n'a pas de genre, on le met dans Autres
    if (morceau.genres.length === 0) {
      compteurCategories['Autres']++;
      continue;
    }

    // On cherche la catégorie du premier genre reconnu
    let categorieFound = 'Autres';

    for (const genre of morceau.genres) {
      const categorie = trouverCategorie(genre);
      if (categorie !== 'Autres') {
        categorieFound = categorie;
        break; // On s'arrête dès qu'on en trouve une
      }
    }

    compteurCategories[categorieFound]++;
  }

  // On garde seulement les catégories qui ont au moins 1 morceau
  const categoriesAvecMorceaux = Object.keys(compteurCategories).filter(
    cat => compteurCategories[cat] > 0
  );
  const valeurs = categoriesAvecMorceaux.map(cat => compteurCategories[cat]);

  // On crée le graphique
  new Chart(document.getElementById('chartGenres'), {
    type: 'pie',
    data: {
      labels: categoriesAvecMorceaux,
      datasets: [
        {
          data: valeurs,
          backgroundColor: [
            '#f48fb1', // Animé          - rose
            '#90caf9', // J-Pop          - bleu clair
            '#a5d6a7', // Rock           - vert clair
            '#fff176', // Vocaloid       - jaune
            '#ce93d8', // Indie Japonaise- violet
            '#ffcc80', // Variété Fr.    - orange clair
            '#80cbc4', // Chanson        - turquoise
            '#b0bec5'  // Autres         - gris
          ]
        }
      ]
    },
    options: {
      plugins: {
        legend: { position: 'right' }
      }
    }
  });
}


// =============================================
//  4. COMPOSANT ALPINE
// =============================================

document.addEventListener('alpine:init', () => {
  Alpine.data('app', () => ({

    liste: [],      // tous les morceaux
    recherche: '',  // texte dans la barre de recherche

    // Appelé au chargement de la page
    async init() {
      const reponse = await fetch('data/data.json');
      const brut    = await reponse.json();

      // On transforme chaque track brut en objet simple
      this.liste = brut.map(track => {

        // Genres : on prend ceux des artistes, sinon ceux de l'album
        const genresArtistes = track.artists.flatMap(a => a.genres ?? []);
        const genresAlbum    = track.album.genres ?? [];
        const genres         = genresArtistes.length ? genresArtistes : genresAlbum;

        return {
          id:       track.id,
          titre:    track.name,
          artiste:  track.artists.map(a => a.name).join(', '),
          album:    track.album.name,
          pochette: track.album.images?.[0]?.url ?? '',
          genres:   genres
        };
      });

      // On attend que le DOM soit à jour avant de créer les graphiques
      this.$nextTick(() => {
        creerGraphiqueArtistes(this.liste);
        creerGraphiqueGenres(this.liste);
      });
    },

    // Retourne les morceaux filtrés selon la recherche
    filtre() {
      const q = this.recherche.toLowerCase().trim();

      // Si la recherche est vide, on retourne tout
      if (!q) return this.liste;

      // Sinon on filtre
      return this.liste.filter(morceau => {
        return morceau.titre.toLowerCase().includes(q)   ||
               morceau.artiste.toLowerCase().includes(q) ||
               morceau.album.toLowerCase().includes(q);
      });
    }

  }));
});