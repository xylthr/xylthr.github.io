# Xyl’thr: personal site

A static website (no build step, no dependencies) for GitHub Pages.

```
index.html                    the page
assets/style.css              look and feel
assets/app.js                 sound, music, project list
site.config.json              username, Discord, optional sound/music files
data/projects.json            placeholder; the workflow overwrites it on each deploy
data/projects.sample.json     sample data for ?demo=1
scripts/fetch_projects.py     reads the GitHub profile
404.html
.github/workflows/deploy.yml  builds and deploys
```

## Publish it

1. Create a **public** repo named exactly `<your-username>.github.io` and push this folder to it:
   ```
   git init -b main
   git add .
   git commit -m "Initial site"
   git remote add origin https://github.com/<your-username>/<your-username>.github.io.git
   git push -u origin main
   ```
2. **Settings > Pages**: set **Source** to **GitHub Actions**.
3. **Actions** tab > **Build and deploy site** > **Run workflow** (a push to `main` also starts it).
4. The site is live at `https://<your-username>.github.io`.

## How projects get listed

The workflow runs `scripts/fetch_projects.py` on every push, every 6 hours, and on demand. It writes `data/projects.json`
from the public repos of the account that owns the repo.

| You want | Do this |
|---|---|
| A project to appear | Nothing. Public, non-fork, non-archived repos are listed |
| Shown first with a FEATURED badge | Add the topic `featured` |
| Hidden from the site | Add the topic `nosite` (or add the name to `excludeRepos`) |
| A Download button | Publish a **Release** (one file links straight to it, several link to the release page) |

If `data/projects.json` is empty (local preview, before the first deploy), the page reads the repos straight from the
GitHub API instead, so it still works.

## Customize

- `site.config.json`: `discord` (copied by the Discord button), `musicFile` and `sounds` (paths to your own audio; leave
  empty for the built-in synthesized sounds and music).
- Language chips and the intro text are in `index.html`; colors are the variables at the top of `assets/style.css`.

## Preview locally

```
python -m http.server 8000
```

Open `http://localhost:8000/` (live GitHub data) or `http://localhost:8000/?demo=1` (sample projects).
