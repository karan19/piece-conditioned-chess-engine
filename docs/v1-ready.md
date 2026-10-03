# V1 Readiness Notes

## What Works

- Play a complete chess game against Stockfish.
- Start as White or Black.
- Choose opponent difficulty.
- Save and reopen games locally.
- Use Call Engine after the opening-gate rule is satisfied.
- Analyze a selected piece only on the user's turn.
- Receive ranked candidate moves, opponent replies, engine scores, and grounded explanations.
- Preview candidate and reply lines without mutating the live game.
- Persist successful Call Engine sessions as learning moments.
- Review saved learning moments in the Learning Journal.
- Export a saved learning moment as JSON.

## Known Limitations

- Persistence is browser-local only. Clearing browser storage removes saved games.
- There is no account system or cloud sync.
- Stockfish analysis is quality-first and can take 20-60 seconds in busy positions.
- Explanations are deterministic and factual, but intentionally plain.
- The app does not yet import or export PGN.
- The learning journal is useful but still simple.
- Public deployment needs CPU guardrails because opponent-reply analysis can be expensive.

## Open Source Checklist

- Choose and add an explicit license before publishing broadly.
- Add screenshots or a short demo GIF.
- Add contribution guidelines if external contributions are welcome.
- Add issue templates after the first public feedback round.
- Keep the V1 scope and milestone docs as planning references.

## Deployment Recommendation

Deploy a V1 demo before V2, but treat it as a feedback build rather than a finished product.
The current app is complete enough for people to understand the concept. Waiting for V2 would delay useful feedback on the core learning loop.

Recommended path:

1. Publish the repository first.
2. Add a short README demo section with screenshots.
3. Deploy a small public demo with clear beta wording.
4. Monitor API latency and CPU use.
5. Use feedback to decide V2 explanation and review priorities.

## V2 Candidates

- LLM wording layer constrained by deterministic evidence.
- PGN import/export.
- Cloud sync or accounts.
- Richer tactical motif detection.
- Deeper variation previews.
- More detailed post-game review timeline.
- More nuanced Stockfish difficulty personalities.
