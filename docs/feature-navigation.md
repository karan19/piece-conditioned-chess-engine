# Feature navigation

The root URL is the Chess Learning Lab homepage. Both feature apps use the browser location as the source of truth. Navigation pushes history entries; searches and display preferences replace the current entry so typing and board-mode changes do not fill the Back stack. Breadcrumbs, active sidebar links, page titles, and heading focus identify the current view.

| View | URL |
| --- | --- |
| Guided Play menu | `/guided-play/` |
| Game setup | `/guided-play/new-game/?side=black&difficulty=hard` |
| Saved game | `/guided-play/games/{local-game-id}/?board=2d` |
| Learning Journal | `/guided-play/journal/` |
| Review | `/guided-play/journal/{local-game-id}/?event={local-event-id}` |
| Opening library | `/opening-studio/` |
| My openings | `/opening-studio/my-openings/?side=black` |
| Opening detail | `/opening-studio/openings/london-system/?line=2` |
| Guided lesson | `/opening-studio/openings/london-system/learn/?line=2` |
| Endgame library | `/opening-studio/endgames/?type=rook&difficulty=hard&page=2` |
| Endgame position | `/opening-studio/endgames/0008Q/` |
| Endgame Stories library | `/endgame-stories/` |
| Guided endgame study | `/endgame-stories/KEnJIrhWSDQ/?line=main_bind&ply=2` |
| Source walkthrough | `/endgame-stories/NysivKCHQiY/?mode=source&frame=12` |
| Study practice | `/endgame-stories/KEnJIrhWSDQ/?mode=practice` |

Opening queries preserve search (`q`), category (`filter`), pagination (`page`), variation search (`variation`), variation pagination (`line-page`), learning side (`side`), and the originating saved list (`from=my-openings`). Lines use a one-based index in the pinned catalog family. Imported lines use a short stable token in `custom`. The import dialog uses `import=1`, so browser Back closes it.

Game and review links refer to browser-local records; they do not publish game data or make it available on another device. Missing records and invalid paths provide explicit recovery links. Chess moves, engine analysis, and storage keys remain unchanged.

Legacy `/v2/` links redirect with their query and hash intact. Studio then converts old family/endgame hashes into the corresponding readable route. `/v1` redirects to Guided Play at the host.

Vite builds separate homepage, Guided Play, Opening Studio, and legacy Studio entries. Its development and preview middleware resolves nested feature routes to the correct entry. Production rewrites are recorded in `scripts/amplify-feature-routes.json` and must be applied before deploying a new routing build.
