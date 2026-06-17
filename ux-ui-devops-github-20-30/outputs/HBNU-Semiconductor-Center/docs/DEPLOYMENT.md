# Deployment Guide

## 1. Local development

```bash
npm install
npm run dev
npm run dev:api
```

## 2. Database

Docker Compose starts PostgreSQL and applies `infra/db/schema.sql`.

```bash
docker compose up postgres
```

## 3. Authentication

Create OAuth applications in Google Cloud Console and Kakao Developers.

Required callback paths:

- `https://your-domain.example/auth/google/callback`
- `https://your-domain.example/auth/kakao/callback`

Store client IDs and secrets in GitHub Actions secrets or Kubernetes secrets.

## 4. CI/CD

Current workflow:

- install dependencies
- build frontend and backend

Next production steps:

- publish `apps/web` and `apps/api` Docker images to GHCR
- apply `infra/k8s/deployment.yml`
- add ingress, TLS, and managed PostgreSQL secrets

## 5. Auto-save workflow

For local automatic save:

```powershell
.\scripts\save-to-github.ps1 -Message "feat: update equipment portal"
```

For team development, use feature branches and pull requests.
