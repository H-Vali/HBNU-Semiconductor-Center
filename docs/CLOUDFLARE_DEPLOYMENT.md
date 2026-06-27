# Cloudflare Pages Deployment

## Pages Project

- Source: GitHub repository `H-Vali/HBNU-Semiconductor-Center`
- Production branch: `main`
- Framework preset: Vite
- Root directory: empty
- Build command: `npm install && npm run build --workspace @hbnu/web`
- Build output directory: `apps/web/dist`
- Node.js version: `20` or newer

## Environment Variables

Set these in Cloudflare Pages production environment.

```text
VITE_API_URL=https://hbnu-semiconductor-center-api.onrender.com
VITE_GOOGLE_CLIENT_ID=349529254245-fi7fm18bck7tfcm5g67hj4uhihq0d91m.apps.googleusercontent.com
```

## Render API Variables After Cloudflare URL Is Ready

Update Render API service environment variables after Cloudflare Pages gives a production URL.

```text
CLIENT_ORIGIN=https://<cloudflare-pages-domain>
```

After buying and connecting the official domain, change it again.

```text
CLIENT_ORIGIN=https://<official-domain>
```

## Google OAuth

Add both URLs to Google OAuth authorized JavaScript origins before QA.

- `https://<cloudflare-pages-domain>`
- `https://<official-domain>`

## Final QA Gate

- Google login and registration
- User role and equipment permission loading
- Training request, schedule, complete, permission grant
- Reservation creation as immediate confirmed booking
- Reservation cancellation from My Page and admin calendar
- Notice, FAQ, Q&A, penalties, audit logs
- Public access blocks for `/reservations`, `/users`, `/audit-logs`, `/admin/summary`
