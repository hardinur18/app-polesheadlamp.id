# Contributing

## Branch Strategy

- `development`: integration and staging branch
- `main`: production branch
- feature branches: branch from `development`

Recommended naming:

- `feature/<short-description>`
- `fix/<short-description>`
- `hotfix/<short-description>`
- `chore/<short-description>`

## Delivery Flow

1. Branch from `development`.
2. Open a pull request back to `development`.
3. After validation and review, merge into `development` for preview deployment.
4. Promote tested changes from `development` into `main`.
5. Every push to `main` deploys production to `https://polesheadlamp-id.pages.dev`.

## Environments

- Preview deployments: any pushed branch other than `main`
- Production deployment: `main`

## Secrets

Never commit local secrets or machine-specific config.

Use local files only:

- `.env.local`
- `supabase/functions/.env`

Use GitHub repository secrets for CI/CD:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
