# Repository Guidelines

## Project Structure & Module Organization

Paths are relative to this guide's directory.

- `pages/map.html` is the active tourism search page; `index.html` is a placeholder, and `01_api/06_enjoytrip.html` is an earlier prototype.
- `css/map.css` defines design tokens, components, and responsive layouts.
- `js/map.js` handles filters and paginated tourism queries. `js/kakao.js` handles SDK loading, markers, and clustering. `js/common.js` provides fetch/select helpers; `js/keys.js` loads configuration.
- `resources/` contains marker images and design references. `docs/enjoytrip.pdf` defines requirements; `docs/design.md` documents visual standards. Some design-guide paths predate refactoring; follow the current paths above.

## Build, Test, and Development Commands

Run from the directory containing this guide:

```sh
python3 -m http.server 5500 --bind 127.0.0.1
```

No build step, package manager scripts, or test runner are configured. With Node.js installed, check JavaScript syntax without executing API requests:

```sh
for file in js/*.js; do
  node --input-type=module --check < "$file" || exit 1
done
```

## Coding Style & Naming Conventions

Use two-space indentation, double-quoted JavaScript strings, semicolons, and explicit `.js` import extensions. Use camelCase identifiers, uppercase configuration constants, and kebab-case CSS classes. Preserve integration IDs such as `selectSido` and `btn_trip_search`.

Reuse CSS variables and Noto Sans KR typography. Keep cluster colors in `js/kakao.js` consistent with CSS tokens. No formatter or linter is configured; match surrounding code.

## Bootstrap Development Requirement

Develop new pages and UI changes using Bootstrap, as required by `docs/enjoytrip.pdf`. Use its grid, components, and utilities for responsive layouts. Preserve the existing design tokens, typography, and visual style through project CSS loaded after Bootstrap. When updating existing screens, integrate Bootstrap while preserving DOM IDs and JavaScript behavior.

## Testing Guidelines

No automated tests or coverage requirements exist. Manually verify dependent filters, queries exceeding 100 results, cluster zoom behavior, empty/error states, and geolocation denial. Check keyboard navigation, console errors, and layouts at 1440px, 820px, and 390px widths.

If introducing automated tests, use `tests/*.test.js` and document the runner and command here.

## Commit & Pull Request Guidelines

PRs should describe behavior changes, link related issues or specification requirements, report validation, and include screenshots for UI changes. Coordinate shared CSS/module edits with the other contributor.

## Security & Configuration

Set `DATA_GO_KR_API_KEY` and `KAKAO_MAP_KEY` as `NAME=value` entries in `.env` beside this guide. `js/keys.js` fetches this file before dependent modules execute; refresh after changes. The file is Git-ignored but browser-accessible: store only browser API keys, restrict supported origins, and avoid logging credentials or request URLs containing keys.
