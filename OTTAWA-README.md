# Ottawa trip planner

The planner is served at **/ottawa** (and /ottawa/). Its file is `ottawa-trip.html`, and its separate API is **/api/ottawa-state**. The existing homepage, package scripts, dependencies, and other Vercel routes are retained. The saved-page `ottawa-trip_files` folder is no longer needed by the planner.

The API has an explicit Vercel route to `/api/ottawa-state.js`. This repository's legacy `builds` setup exposes the function at its `.js` filename; the browser uses the extensionless route.

## Vercel setup

Use the existing repository and Vercel project configuration. Keep the existing root directory, build settings, and output settings; do not change the output directory to `public` or replace `vercel.json` with the standalone package's configuration. The existing `builds` entries already include root HTML files and `api/*.js` functions. No new dependency or planner build step is required.

Add these variables in **Vercel → Project Settings → Environment Variables**:

| Name | Value |
| --- | --- |
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SECRET_KEY` | Your backend secret key (`sb_secret_…`) |

Enable them for Production, and Preview if previews should sync too. Redeploy after setting them. Credentials belong only in Vercel environment variables, never in GitHub, browser code, or the HTML. The API uses the secret on the server only. A legacy service-role JWT also works when stored under `SUPABASE_SECRET_KEY`.

The supplied `supabase-setup.sql` is included as a reference. You already ran it, so no additional migration is required. Keep the Supabase Data API enabled with the public schema exposed. The API reads and upserts individual `key`/`value` rows in `public.ottawa_trip_fields`.

## Persistence and sharing

Notes, all budget fields, booking checkboxes, starting address, and skipped/moved/completed activities save locally immediately and sync through `/api/ottawa-state`. Gas defaults to **$200** for a fresh browser; existing saved amounts are retained. Today/navigation, the food and coffee shortlist, optional Ottawa Art Gallery and ruins, and the supplied plain-language copy are included.

The selected day is personal to each browser. Different fields sync independently; the last successful save wins when both people edit the same field. Restore original plan resets shared activity changes without clearing notes, budget, or bookings.

Unsent edits remain in local storage and retry while the page is open, when the connection returns, or when the page is reopened. **Share this browser’s existing edits** imports only the saved fields present when the page opened. Existing `ottawa2026-*` local-storage keys are retained. Storage is specific to a domain: edits on another domain must be copied manually.

No password is required. Anyone with the planner URL can read and edit it through the API. The planner includes `noindex,nofollow`; this is a search preference, not access control.

## Checks and troubleshooting

- Open `/ottawa` and confirm the sync badge says **Synced with both of you**.
- `/api/ottawa-state` should return JSON containing `fields`.
- Edit notes, budget, a booking checkbox, and an activity, then open the planner in another browser. Changes should appear within about five seconds.
- If sync is unavailable, confirm both Vercel variables, redeploy, and check that the table and Data API are available. Local edits are preserved.

`npm start` also serves `/ottawa` and its API locally. Without Vercel credentials, the planner still saves in the browser and the API returns 503. Do not put credentials in local repository files.

Focused verification: `node --test test/ottawa-state.test.cjs` and `node --test test/browser/ottawa.browser.test.cjs` (Chromium required). Tests use fake credentials and a mock Supabase service; they never connect to your database.
