document.addEventListener('alpine:init', () => {
  Alpine.data('app', () => ({
    liste: [],
    recherche: '',

    async init() {
      const res  = await fetch('data/data.json');
      const brut = await res.json();

      this.liste = brut.map(t => {
        const genresArtistes = t.artists.flatMap(a => a.genres ?? []);
        const genresAlbum    = t.album.genres ?? [];
        const genres         = genresArtistes.length ? genresArtistes : genresAlbum;

        return {
          id:       t.id,
          titre:    t.name,
          artiste:  t.artists.map(a => a.name).join(', '),
          album:    t.album.name,
          pochette: t.album.images?.[0]?.url ?? '',
          genres:   genres
        };
      });

      this.$nextTick(() => this.initCharts());
    },

    filtre() {
      const q = this.recherche.toLowerCase().trim();
      if (!q) return this.liste;
      return this.liste.filter(m =>
        m.titre.toLowerCase().includes(q)   ||
        m.artiste.toLowerCase().includes(q) ||
        m.album.toLowerCase().includes(q)
      );
    },

    initCharts() {
      // Top 10 artistes
      const ca = {};
      this.liste.forEach(t =>
        t.artiste.split(', ').forEach(a => { ca[a] = (ca[a] || 0) + 1; })
      );
      const top10 = Object.entries(ca).sort((a, b) => b[1] - a[1]).slice(0, 10);

      new Chart(document.getElementById('chartArtistes'), {
        type: 'bar',
        data: {
          labels: top10.map(([n]) => n),
          datasets: [{ label: 'Morceaux', data: top10.map(([, n]) => n), backgroundColor: '#0d6efd' }]
        },
        options: {
          indexAxis: 'y',
          plugins: { legend: { display: false } },
          scales:  { x: { ticks: { stepSize: 1 } } }
        }
      });

      // Distribution genres
      const cg = {};
      this.liste.forEach(t => {
        const gs = t.genres.length ? t.genres : ['Autres'];
        gs.forEach(g => { cg[g] = (cg[g] || 0) + 1; });
      });

      new Chart(document.getElementById('chartGenres'), {
        type: 'pie',
        data: {
          labels: Object.keys(cg),
          datasets: [{
            data: Object.values(cg),
            backgroundColor: [
              '#f48fb1','#90caf9','#a5d6a7','#fff176',
              '#ce93d8','#ffcc80','#80cbc4','#ef9a9a',
              '#bcaaa4','#b0bec5'
            ]
          }]
        },
        options: { plugins: { legend: { position: 'right' } } }
      });
    }

  }));
});