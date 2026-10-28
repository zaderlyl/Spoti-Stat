# Spoti-Stat

Tableau de bord de statistiques d'écoute musicale.

Démo : https://spotistat-gamma.vercel.app

Malgré son nom, le projet n'utilise pas l'API Spotify : les écoutes viennent de **Last.fm**, et les informations sur les morceaux (pochettes, durées, extraits audio) viennent de **Deezer**.

## Stack

- HTML, CSS et JavaScript, avec Alpine.js et Bootstrap Icons
- Fonctions serverless Vercel (`api/`) : un proxy Last.fm qui garde la clé côté serveur, et un point d'accès qui sert `data/data.json`
- Un script Node (`sync.mjs`) qui met à jour `data/data.json`

## Structure

```
index.html            Page principale
Spotit'stat_V2.html   Seconde version de la page
style/                Feuilles de style
Javascript/           Scripts de la page et modèle de clés (keys.example.js)
api/                  Fonctions serverless (data.js, lastfm.js)
sync.mjs              Synchronisation des écoutes (Last.fm) et des morceaux (Deezer)
data/data.json        Données affichées par la page
```

## Lancer le projet en local

```bash
npx serve -p 5500 .
```

Puis ouvrir http://localhost:5500

Copier `Javascript/keys.example.js` en `Javascript/keys.js` et y mettre sa clé et son nom d'utilisateur Last.fm. Une clé gratuite s'obtient sur https://www.last.fm/api.

## Mettre à jour les données

Créer un fichier `.env` à la racine :

```
LASTFM_KEY=ta_cle
LASTFM_USER=ton_nom_utilisateur
```

Puis lancer :

```bash
node sync.mjs
```

Le fichier `.env` et `Javascript/keys.js` sont ignorés par Git : ne jamais les committer.

## Licence

MIT, voir [LICENSE](LICENSE).
