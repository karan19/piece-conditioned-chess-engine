# AWS Deployment Plan

Target public beta domain:

```text
https://chess.karankan19.com
```

Route 53 hosted zone found:

```text
karankan19.com. -> Z04253271Z3Y5QK2QPX13
```

## Recommended Shape

- Frontend: AWS Amplify Hosting
- API: AWS App Runner from `Dockerfile.api`
- Public app domain: `chess.karankan19.com`
- API domain: `api.chess.karankan19.com`

Using a separate API subdomain keeps the deployment simple while still making
the public product URL clean.

## Required Environment Variables

Frontend, in Amplify:

```text
VITE_API_BASE_URL=https://api.chess.karankan19.com
```

API, in App Runner:

```text
ALLOWED_ORIGINS=https://chess.karankan19.com
PORT=3001
```

## Deployment Order

1. Create the App Runner service from the GitHub repository using
   `Dockerfile.api`.
2. Confirm the API health check returns:

   ```text
   /health
   ```

3. Attach the custom domain `api.chess.karankan19.com` to the App Runner
   service and add the DNS records App Runner provides in Route 53.
4. Create the Amplify app from the same GitHub repository using `amplify.yml`.
5. Set `VITE_API_BASE_URL` in Amplify to the API custom domain.
6. Attach `chess.karankan19.com` to Amplify and add the DNS records Amplify
   provides in Route 53.
7. Run a smoke test:

   - Open `https://chess.karankan19.com`.
   - Start a game.
   - Make at least six plies.
   - Call Engine on a selected piece.
   - Confirm candidates and opponent replies return from the deployed API.

## Beta Cost Guardrails

- Start with one small App Runner service.
- Keep candidate and reply caps conservative.
- Watch App Runner CPU usage during analysis calls.
- Add request throttling before a wider public launch.
- Leave V2 intelligence experiments out of the public beta until V1 hosting is
  stable.
