# Board theme design QA

final result: passed

Scope: shared board appearance across Guided Play, Opening Studio (including previews and endgames), and Board Recall. Existing product layouts, labels and clocks are outside the screenshot-matching scope. Optional 3D mode retains its models with matching square colors.

Source visual truth: user attachment, `/var/folders/6x/txzxtnp106s4zmpycrq5hx2r0000gn/T/TemporaryItems/NSIRD_screencaptureui_F6VQiF/Screenshot 2026-10-23 at 4.19.53 AM.png` (914 × 949 px).
Implementation screenshot: `/Users/karan/.codex/visualizations/2026/10/23/board-theme/updated-board.png` (1280 × 720 px, desktop CSS viewport at 1×).
State: initial position, White perspective. Full source and rendered screenshots were opened together for comparison. Focused comparison: board region, source 792 × 792 px versus approximately 500 × 500 CSS px in the existing Learn layout. Compared proportional piece sizing and square geometry; different board dimensions are responsive layout constraints, not density differences. No raster pixel-diff claim.

## Findings and comparison history

- Initial pass: implicit black SVG fills rendered pawns/rooks/queen black instead of charcoal. Fixed with an explicit charcoal root fill; recaptured and visually confirmed across all six piece types.
- Initial implementation: thumbnail fixed height could clip the newly external coordinate row. Set auto height for thumbnail board frames. Rendered catalog thumbnails show all eight ranks and files.
- Final comparison: no actionable P0/P1/P2 findings in the requested board theme.
- Expected difference: freely licensed Cburnett SVG artwork supplies similar outlined chess silhouettes rather than the reference site's exact piece drawings. Artwork attribution and redistribution terms ship in `public/chess-piece-credits.txt`.
- Expected difference: screenshot player avatars, names, clocks and evaluation bar remain specific to gameplay contexts; they are not added to memory challenges or catalog thumbnails.

## Required fidelity surfaces

- Typography: external rank/file labels use bold neutral system sans, sized with board width. Repeated in-square labels removed. Existing app typography retained.
- Spacing/layout: square grid remains 1:1, pieces fill their squares with source SVG intrinsic padding, external axes sit on the charcoal frame. Desktop and 390 × 844 mobile checked, with no clipped recall board or tray overlap.
- Colors/tokens: shared cream #eeeed2, green #769656, frame #302e2b, gray coordinate text, white and charcoal piece fills with dark outlines.
- Asset fidelity: locally bundled vector piece artwork is sharp at full and thumbnail sizes; both colors and all piece types use the same asset component. No font glyph pieces remain on the 2D boards, promotion controls or recall tray.
- Copy/content: existing move guidance and navigation preserved. Rank/file order follows White and Black perspective, accessible square names retain full coordinates and piece identity.

## Validation

- All 90 existing tests pass (12 API, 78 web); production web build and TypeScript pass.
- Guided Play 2D board renders with the shared frame and assets.
- Opening Learn advance updates the pawn square correctly; restart restores initial arrangement.
- Opening catalog thumbnail proportions inspected.
- Recall timer transitions to reconstruction; Black perspective axes reverse correctly. Tray selection and placement verified on e3.
- Mobile recall board and fixed piece tray fit at 390 × 844; temporary viewport override reset.
- Learn browser console checked: no errors.

## Implementation checklist

- [x] Shared square palette and external axes.
- [x] Reusable outlined SVG pieces and license.
- [x] Full, preview, recall, tray and promotion artwork.
- [x] Responsive and reversed board checks.
- [x] Tests and production build.

Follow-up polish: exact proprietary piece silhouette reproduction is outside scope. No remaining blocking findings.
