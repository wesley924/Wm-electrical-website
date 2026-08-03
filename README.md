# WM Electrical Group — Website

Static site, ready to deploy to Vercel. No build step or framework required.

## Folder structure
```
wm-electrical-site/
├── index.html          ← the whole site (single page)
├── images/
│   ├── logo-white.png  ← navbar logo
│   └── logo-black.png  ← footer logo
├── vercel.json
└── README.md
```

## Option A — Deploy via Vercel CLI (fastest)
1. Install the CLI (one-time): `npm i -g vercel`
2. From inside this folder, run: `vercel`
3. Follow the prompts (log in, confirm project name, accept defaults)
4. Once deployed, run `vercel --prod` to push it live
5. In the Vercel dashboard → Project → Settings → Domains, add **wmelectricalgroup.com** and follow the DNS instructions Vercel gives you (usually an A record or CNAME at your domain registrar)

## Option B — Deploy via GitHub + Vercel dashboard
1. Create a new GitHub repo and push this folder to it
2. Go to vercel.com → **Add New Project** → import the GitHub repo
3. Framework preset: choose **"Other"** (no build command needed)
4. Deploy
5. Add your domain **wmelectricalgroup.com** under Project → Settings → Domains, same as above

## Setting up live Google Reviews (Option A — official Google API)

Reviews are shown directly on the page (no click-through needed), pulled live via a
Vercel serverless function at `/api/reviews`. Nothing works until you complete these
one-time steps:

### 1. Create a Google Cloud API key
1. Go to https://console.cloud.google.com/ and create a project (or use an existing one)
2. In the left menu: **APIs & Services → Library** → search **"Places API"** → click **Enable**
3. Go to **APIs & Services → Credentials** → **Create Credentials → API Key**
4. Copy the key it generates
5. Click **Restrict Key** → under "API restrictions" choose **Places API** only (keeps the key locked down to just this use)
6. Billing: Google requires a linked billing account, but gives ~$200/month free credit — normal review traffic for one business site won't come close to using it

### 2. Find your Place ID
1. Go to https://developers.google.com/maps/documentation/places/web-service/place-id
2. Use the "Place ID Finder" tool on that page, search **"WM Electrical Group"**
3. Copy the Place ID it shows you (looks like `ChIJ...`)

### 3. Add both values to Vercel
1. In your Vercel project → **Settings → Environment Variables**
2. Add:
   - `GOOGLE_PLACES_API_KEY` = the key from step 1
   - `GOOGLE_PLACE_ID` = the Place ID from step 2
3. Redeploy the project (Vercel → Deployments → ⋯ → Redeploy) so the function picks up the new variables

Once that's done, the testimonials section will automatically replace the placeholder
reviews with your real, live Google reviews (Google only returns up to 5 at a time — that's
a Google API limit, not something we can change). If the API isn't configured yet, or a
request ever fails, the page quietly falls back to the placeholder reviews so nothing breaks.

## What's placeholder and still needs your real content
- Phone number (currently 1300 000 000)
- Email address
- ABN and electrical licence number
- Testimonials (currently generic placeholder names/quotes)
- Services copy (currently generic descriptions)
- Google Reviews — code is wired in; just needs the API key + Place ID steps above to go live

Once your content questionnaire is filled out, I can update `index.html` directly with the real copy before you go live.
