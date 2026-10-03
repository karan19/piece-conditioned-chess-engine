# Piece-Conditioned Chess Engine

Local-first chess learning app for asking a strong engine one focused question:
what should I do with this selected piece, and what will the opponent probably
try in response?

The app combines a playable Stockfish game, piece-conditioned analysis,
grounded explanations, preview mode, and a local learning journal.

## Features

- Play against Stockfish as White or Black.
- Choose Easy, Medium, Hard, or Expert difficulty.
- Unlock Call Engine after both sides complete three moves.
- Select one of your pieces and ask for ranked candidate moves.
- See likely opponent replies for each candidate.
- Preview candidate and reply lines without changing the live game.
- Save learning moments locally in the browser.
- Reopen saved games and review past learning moments.
- Export learning-event JSON for debugging or research.

## Status

V1 is usable locally. See [docs/v1-ready.md](docs/v1-ready.md) for the current
readiness notes, known limitations, and deployment guidance.

Branch policy:

- `main` is the open-source development branch.
- `aws-production` is the branch AWS should deploy from.

See [docs/branch-strategy.md](docs/branch-strategy.md) for details.

## License

This project is licensed under the [MIT License](LICENSE).

## Project Structure

```text
apps/
  api/    Local Node/TypeScript service
  web/    React/TypeScript frontend
docs/     Product scope and milestone plan
```

## Local Development

Install dependencies:

```bash
npm install
```

Run both the API and web app:

```bash
npm run dev
```

Default local URLs:

```text
Web: http://localhost:5173
API: http://localhost:3001/health
```

Run validation:

```bash
npm run lint
npm test
npm run build
```

## Self-Hosting Notes

The frontend is a Vite app. The API is an Express service that runs Stockfish
locally through the `stockfish` npm package. A deployed demo needs both:

- a static frontend host; and
- a Node runtime capable of running the API and Stockfish process.

For a public demo, keep analysis request limits conservative and monitor server
CPU usage, because deep reply analysis can be expensive.
