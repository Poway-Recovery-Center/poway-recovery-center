# Poway Recovery Center

Multi-page website deployed with GitHub Pages. User accounts are handled by a separate Flask backend, [poway-recovery-center-api](https://github.com/AdyaShipekar/poway-recovery-center-api). This is the same split as the Open Coding Society [pages](https://github.com/Open-Coding-Society/pages) (frontend) and [flask](https://github.com/Open-Coding-Society/flask) (backend) repos.

## Run locally
Clone both repos next to each other, then start each one:
```bash
cd poway-recovery-center-api
make            # creates .venv, installs requirements, starts the API on http://localhost:8587

cd ../poway-recovery-center
make            # starts the site on http://localhost:4000
```
Then visit `http://localhost:4000` and log in. `make stop` in either repo stops that server.

The site still works without the backend running, but logging in, signing up, and the profile page show that the server can't be reached.

## Structure
Pages share one layout, so the header (About · Resources · Contact Us · Log in) and footer are the same everywhere.
- `_layouts/default.html`: page shell (head, header, page heading + breadcrumb, footer, scripts). Pages set `title`, `nav`, `heading`, `intro`, `parent` and `scripts` in front matter
- `_includes/header.html`, `_includes/footer.html`: navigation and footer
- `index.html`: home; hero with "How can we help?" quick links and today's meetings from the API
- `resources.html`: resource hub; pill buttons for every resource and tabs by category (on this site, crisis help, meetings & groups, treatment & care, everyday needs)
- `schedule.html`: meeting schedule and reservations (all data from the API's `/api/schedule`); `programs.html` redirects here
- `mood-room.html`, `reflection-wall.html`: wellness tools, linked from Resources
- `about.html`, `contact.html`: about the center; Contact Us form (sent to the API's `/api/contact`)
- `login.html`, `signup.html`, `profile.html`: accounts; profile shows upcoming reservations, and admins also see contact messages and members
- `_sass/`: all styling, compiled by Jekyll from `assets/css/main.scss` (there are no hand-written `.css` files)
  - `_tokens.scss`: colors, fonts, breakpoints
  - `mixins/_buttons.scss`, `elements/buttons/`: buttons ported from Open Coding Society's `ocs__btn` system as `prc__btn` (`.small/.medium/.large`, `.pill`, `.accent`, `.fill`, `.alert-red/yellow/green`, `.block`, `.prc__links`)
  - `base/`, `layout/`, `components/` (cards, tabs, forms, support widgets), `pages/`
- `js/`: page behavior; `js/api/` holds backend calls (`config.js` sets `pythonURI`), `js/tabs.js` the shared tabs
- `.github/workflows/jekyll-gh-pages.yml`: builds the site with `bundle exec jekyll build` (same Jekyll as `make`) and deploys it to GitHub Pages

## Deploying
Every push to `main` runs `.github/workflows/jekyll-gh-pages.yml`, which publishes the site to https://adyashipekar.github.io/poway-recovery-center/ (repo Settings → Pages → Source must be "GitHub Actions").

GitHub Pages only serves static files, so the API has to be deployed separately (see the poway-recovery-center-api README). Once it's running on HTTPS, set that address as `deployedPythonURI` in `js/api/config.js` and push.

The meeting schedule, reservations and contact messages live in the backend; the schedule is synced from the North County San Diego AA meeting feed. The reflection wall still uses browser localStorage. The Mood Room uses a local supportive categorizer and Apple Music search links.
