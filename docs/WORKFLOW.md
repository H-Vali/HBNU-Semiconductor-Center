# Working Across PCs

This repository should be treated as the single source of truth for the HBNU Semiconductor Center platform.

## Source Layout

- Web app: `apps/web`
- API app: `apps/api`
- Database and infra references: `infra`
- Deployment and helper scripts: `scripts`
- Do not commit local workspace folders such as `ux-ui-devops-github-20-30/`.

## Start Work On Another PC

```bash
git clone https://github.com/H-Vali/HBNU-Semiconductor-Center.git
cd HBNU-Semiconductor-Center
git pull origin main
npm install
```

Before making changes on an existing clone:

```bash
git status
git fetch origin main
git merge --ff-only origin/main
```

## Render API Deployment

Render must run the API from the repository root, not from a nested local workspace folder.

Recommended Render settings:

- Repository: `H-Vali/HBNU-Semiconductor-Center`
- Branch: `main`
- Root Directory: empty repository root
- Build Command: `npm install && npm run build --workspace @hbnu/api`
- Start Command: `node apps/api/dist/server.js`

Required environment variables:

- `DATABASE_URL`
- `JWT_SECRET`
- `CLIENT_ORIGIN`
- `GOOGLE_CLIENT_ID`
- `ADMIN_EMAILS`

Useful production checks:

```bash
curl https://hbnu-semiconductor-center-api.onrender.com/health
curl https://hbnu-semiconductor-center-api.onrender.com/equipment
```

Expected `/health` marker for the active API:

```json
{"ok":true,"api":"apps/api","build":"current-api"}
```

## GitHub Pages Preview Deployment

The public preview repository is separate:

- Source repository: `H-Vali/HBNU-Semiconductor-Center`
- Preview repository: `H-Vali/HBNU-Semiconductor-Center-Preview`
- Public URL: `https://h-vali.github.io/HBNU-Semiconductor-Center-Preview/`

Build the web preview with:

```powershell
$env:GITHUB_PAGES_BASE='/HBNU-Semiconductor-Center-Preview/'
$env:VITE_API_URL='https://hbnu-semiconductor-center-api.onrender.com'
$env:VITE_GOOGLE_CLIENT_ID='<google-client-id>'
node .\node_modules\vite\bin\vite.js build
```

Then copy `apps/web/dist` into the preview repository while preserving:

- `.git`
- `.github`
- `.gitattributes`
- `.nojekyll`

## Commit Discipline

For every change:

1. Pull latest `main`.
2. Make the scoped change.
3. Run the relevant build/typecheck.
4. Commit and push the source repository.
5. If the web changed, rebuild and push the preview repository.
6. Verify Render API and public preview URLs.
