# BYP – Quick Job Quotes for Contractors

A minimal, mobile-first MVP web app that helps contractors create and send professional job quotes in about 30 seconds.

## Philosophy

**This is NOT a CRM.** This is NOT project management software. This is NOT a full estimating platform. This is a fast-response tool.

**Core goal**: Help a contractor go from "client asks for a price" to "quote link ready to send" in 20–30 seconds.

## Key Features

✓ **No required login** – Start creating quotes immediately  
✓ **Quote in 30 seconds** – Job description → price → send  
✓ **Two share links** – One for the client, one to check status  
✓ **Client accepts quotes** – Contractors see acceptance status  
✓ **Recent quotes tracking** – Device-level localStorage (no backend needed yet)  
✓ **Optional profile save** – Pre-fill contractor info for faster quotes  
✓ **3 quote card themes** – Clean, Classic, Bold  
✓ **Mobile-first** – Excellent experience on job sites, in cars, tired  

## Main Flows

### 1. Contractor Creates a Quote
- Land on tool (no sign-up gate)
- Describe job (or tap a suggestion chip)
- Enter price
- Optionally select earliest availability
- Click "Send Quote"

### 2. Quote Created / Share Screen
- Show confirmation with price
- **Client link**: `byp.me/q/[id]` – Share this with the customer
- **Manage link**: `byp.me/m/[token]` – Keep this private to check status
- "Copy reply text" button for fast messaging

### 3. Client Views Quote
- Clean, trustworthy quote card
- Shows contractor name, phone (tap-to-call), job, price, availability
- "Accept Quote" button
- "What happens next" section explaining the process
- No payment collection – this is just quote confirmation

### 4. Contractor Checks Status
- Open their manage link
- See if quote was accepted
- See how long ago it was created or accepted

### 5. Device Memory
- Recent quotes saved in localStorage
- Contractor can see list of recent quotes and their status
- Optional profile save (name, business, phone) for faster future quotes

## Technical Stack

- **No frameworks** – Plain HTML, CSS, vanilla JavaScript
- **No backend required initially** – Uses localStorage for MVP
- **Responsive mobile-first** – Designed for on-site, tired contractors
- **Single file** – All code in `index.html` with embedded styles and scripts
- **Fast deployment** – Ready for Cloudflare Pages, GitHub Pages, or any static host

## File Structure

```
index.html         # Complete app (HTML + embedded CSS + JavaScript)
README.md          # This file
.gitignore         # Excludes node_modules, etc.
```

## How to Run Locally

### Option 1: GitHub Codespaces
1. Fork/clone this repo to Codespaces
2. Open a terminal: `python -m http.server 8000` or `npx http-server`
3. Open the local server URL in your browser
4. Start creating quotes

### Option 2: Local Development
1. Clone the repo
2. Open `index.html` directly in your browser, or
3. Run a local server:
   ```bash
   # Using Python
   python -m http.server 8000

   # Or using Node.js
   npx http-server
   ```
4. Visit `http://localhost:8000`

### Option 3: Direct File
Simply open `index.html` in any modern browser. It works offline after first load.

## Deployment

### Cloudflare Pages
1. Push to GitHub
2. Connect your GitHub repo to Cloudflare Pages
3. Build command: (leave empty)
4. Build output directory: (leave empty)
5. Deploy

### GitHub Pages
1. Go to Settings → Pages
2. Set source to "Deploy from a branch" → main branch / root
3. Push your code
4. Visit `https://[username].github.io/byp-me`

### Other Static Hosts
Just upload `index.html` to any static file host. Works great on Vercel, Netlify, AWS S3 + CloudFront, etc.

## Architecture

### App State
- Managed in a single `app` object with `state` properties
- Screen transitions handled by `showScreen()`
- All state persisted to `localStorage` for MVP

### Quote Storage
- `byp_quotes` – Array of quotes, each with:
  - `id`: unique quote ID
  - `manageToken`: private token for contractor access
  - `job`: description
  - `price`: quoted price
  - `availability`: optional earliest availability
  - `status`: "created" or "accepted"
  - `createdAt`: timestamp
  - `acceptedAt`: timestamp (if accepted)

### Profile Storage
- `byp_profile` – Contractor details:
  - `name`
  - `business`
  - `phone`

### URL Routing (Hash-based)
- `/#q/[quoteId]` – Public client view
- `/#m/[manageToken]` – Contractor manage view
- Root URL – Contractor tool/landing screen

## Future Backend

When scaling beyond MVP, this structure makes it easy to connect to a real backend:

1. Replace localStorage calls with API requests
2. Move ID generation to server
3. Add user authentication (magic links or social auth)
4. Persist quotes to a database
5. Add notifications / webhooks
6. Expand to multiple users / teams

The code is structured to make this transition straightforward.

## Design Philosophy

- **Practical, not fancy** – Looks like a tool, not a marketing site
- **Calm hierarchy** – Clear what to do next
- **Mobile-first** – Contractors use this tired, on-site, in cars
- **Fast defaults** – Minimal required fields, suggestions for common jobs
- **Trust signals** – Professional quote card, clear "what happens next"
- **No clutter** – No unnecessary features, no CRM-like complexity

## Known Limitations (MVP)

- No backend – all data lost if localStorage is cleared
- No email sending – contractor copies and shares manually
- No real phone number validation
- No payment collection or invoicing
- No calendar scheduling (use "Earliest availability" dropdown only)
- No integrations with CRMs or accounting software
- No real-time notifications

These are intentional MVP constraints. The codebase is structured to add any of these later.

## Next Steps After MVP

If this resonates with contractors, consider:
1. Simple backend to persist quotes
2. Email notifications when quote is accepted
3. Magic link login (no password required)
4. SMS integration for extra-fast communication
5. Stripe integration for optional online deposits
6. Contractor dashboard (without CRM noise)
7. Client notification when quote expires

## License

MIT – Use freely, modify, deploy, share.

---

**Built for speed.** A contractor should go from "client asks 'how much?'" to "quote link ready to send" in **about 30 seconds**. If this app takes longer, it has failed.
