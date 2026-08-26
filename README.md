# WM Electrical – Inspection Report Generator

Turns a completed ServiceM8 "Home Electrical Safety Inspection Report" form into
your branded PDF, skipping any empty smoke alarm / defect rows. Runs as an
add-on to your existing wmelectricalgroup.com Vercel project.

## Files in this folder

- `api/generate-report.js` – serverless function that does the actual work
- `lib/servicem8.js` – calls to the ServiceM8 API
- `lib/report-template.js` – builds the branded HTML that becomes the PDF
- `public/admin/inspection-report.html` – the private page you'll use
- `package.json` – dependencies (Vercel installs these automatically)

Copy these into your existing `wesley924/Wm-electrical` repo, preserving the
folder structure (`api/`, `lib/`, `public/admin/`), then commit + push as usual.

## One-time setup

### 1. Get your ServiceM8 API key
ServiceM8 dashboard → Settings → Staff → your name → API Key section.
Generate one if you don't already have it.

### 2. Add environment variables in Vercel
Project → Settings → Environment Variables:

| Name | Value |
|---|---|
| `SM8_API_KEY` | your ServiceM8 API key |
| `SM8_ACCOUNT_EMAIL` | the ServiceM8 login email tied to that key |
| `ADMIN_TOOL_PASSWORD` | a password you make up, just for this tool |
| `SITE_URL` | your live domain, e.g. `https://wmelectricalgroup.com` |

Never commit these into GitHub — Vercel env vars stay private.

### 3. Logo
Already included as `public/assets/logo.png` — nothing to configure, it just
needs to be uploaded to GitHub along with everything else so it's live at
`yoursite.com/assets/logo.png`.

### 4. Confirm your field labels match
Open `api/generate-report.js` and check the `FIELD_LABEL_MAP` object — the
left-hand strings must match your ServiceM8 form's actual question labels
exactly (I copied them from your uploaded Word template, but if you've
tweaked wording since, update them here).

### 5. Deploy
Push to GitHub as usual — Vercel auto-deploys.

## Using it

1. Go to `wmelectricalgroup.com/admin/inspection-report.html`
2. Enter the tool password + the ServiceM8 Job Number
3. Click **Generate PDF** — it opens in a new tab, ready to save or email

## Known things to verify on your first real test

- **Attachment/photo URLs** — `getAttachmentUrl()` in `lib/servicem8.js` guesses
  the response field name (`photo_url` / `file_url`). Run one real job through
  and check the console log if photos don't appear — the exact field name may
  need a one-line tweak.
- **Form Response field names** — ServiceM8's raw JSON key for individual
  answers can be `field_responses` or `answers` depending on API version;
  the code tries both, but confirm against a real response.
- These are the two most likely "off by one field name" issues on a brand
  new integration — everything else follows the documented ServiceM8 API
  structure.
