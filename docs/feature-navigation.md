# Feature navigation

The root URL is the Chess Learning Lab homepage. Guided Play lives at `/guided-play/` and Opening Studio at `/opening-studio/`. The two-word feature names replace user-facing version labels.

Both feature entries reuse their existing app and browser storage keys. The old `/v2/` entry redirects in the browser, preserving query strings and hash parameters for named openings and endgame positions. `/v1` redirects to Guided Play at the host.

Vite builds four HTML entries: homepage, Guided Play, Opening Studio, and the legacy Studio redirect. Production Amplify custom routes are recorded in `scripts/amplify-feature-routes.json`; these must be applied before deploying the new HTML entries. Existing API proxy settings and static asset handling remain unchanged.
