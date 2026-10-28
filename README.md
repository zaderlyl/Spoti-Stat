# Spoti-Stat

Tableau de bord de statistiques d'écoute musicale.

Démo : https://spotistat-gamma.vercel.app

Malgré son nom, le projet n'utilise pas l'API Spotify : les écoutes viennent de **Last.fm**, et les informations sur les morceaux (pochettes, durées, genres) viennent de **Deezer**.

## Comment ça marche

- Une **action GitHub** lance `sync.mjs` toutes les 6 h : elle récupère les dernières écoutes sur Last.fm, ajoute les morceaux manquants à `data/data.json` (infos Deezer) et enregistre les écoutes dans **Supabase**.
- Le site lit le catalogue dans `data/data.json` et l'historique des écoutes dans Supabase (compteurs, graphiques par jour, top albums).
- Le morceau en cours de lecture est demandé en direct à Last.fm.

## Stack

- HTML, CSS et JavaScript, avec Alpine.js et Bootstrap Icons
- Fonctions serverless Vercel (`api/`) : un proxy Last.fm qui garde la clé côté serveur, et un point d'accès qui sert `data/data.json`
- Supabase (Postgres) pour l'historique des écoutes
- GitHub Actions pour la synchronisation automatique

## Structure

```
index.html            Page principale
Spotit'stat_V2.html   Seconde version de la page
style/                Feuilles de style
Javascript/           Scripts de la page et modèle de clés (keys.example.js)
api/                  Fonctions serverless (data.js, lastfm.js)
sync.mjs              Synchronisation : Last.fm, Deezer, data.json et Supabase
backfill.mjs          Import unique de tout l'historique Last.fm dans Supabase
data/data.json        Catalogue des morceaux écoutés
.github/workflows/    Action de synchronisation automatique
```

## Lancer le projet en local

```bash
npx serve -p 5500 .
```

Puis ouvrir http://localhost:5500

Copier `Javascript/keys.example.js` en `Javascript/keys.js` et y mettre sa clé et son nom d'utilisateur Last.fm. Une clé gratuite s'obtient sur https://www.last.fm/api.

Les routes `/api` ne tournent que sur Vercel (ou avec `vercel dev`).

## Mettre en place la synchronisation

1. Créer un projet Supabase, puis y exécuter ce SQL :

```sql
create table public.ecoutes (
  played_at timestamptz not null,
  titre     text        not null,
  artiste   text        not null,
  album     text,
  primary key (played_at, titre, artiste)
);

alter table public.ecoutes enable row level security;
create policy "lecture publique" on public.ecoutes for select using (true);

create view public.playcounts with (security_invoker = true) as
  select lower(titre) as titre, lower(artiste) as artiste, count(*)::int as n
  from public.ecoutes group by 1, 2;

create view public.albums_top with (security_invoker = true) as
  select album, count(*)::int as n
  from public.ecoutes where album is not null group by album;
```

2. Créer un fichier `.env` à la racine :

```
LASTFM_KEY=ta_cle
LASTFM_USER=ton_nom_utilisateur
SUPABASE_URL=https://ton-projet.supabase.co
SUPABASE_SERVICE_KEY=ta_cle_secrete
```

3. Importer l'historique, une seule fois :

```bash
node backfill.mjs
```

4. Sur GitHub, ajouter les mêmes quatre valeurs dans Settings, Secrets and variables, Actions. L'action « Synchro Last.fm » s'occupe ensuite du reste, et peut aussi être lancée à la main depuis l'onglet Actions.

Pour synchroniser à la main : `node sync.mjs`.

Le fichier `.env` et `Javascript/keys.js` sont ignorés par Git : ne jamais les committer. La clé secrète Supabase ne doit jamais apparaître dans le code du site ; seule la clé publique (lecture seule) y figure.

## Licence

MIT, voir [LICENSE](LICENSE).
