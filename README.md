# siletry.com

Static marketing site for Siletry, hosted on Vercel.

## Update the live site

1. Unzip and copy everything into your website repo folder. Say yes to replace.
2. Push:
   ```bash
   git add .
   git commit -m "New Siletry homepage, logo and icons"
   git push origin main
   ```
3. Vercel deploys in about 30 seconds.

`privacy.html` and `terms.html` aren't in this zip. Your existing ones stay as they are.

## Before pushing

- In `index.html`, search for `91XXXXXXXXXX` and put in your WhatsApp number for the "Book a demo" button.

## Preview locally

```bash
python3 -m http.server 5173
```
Then open http://localhost:5173. No npm needed.

## What's here

| File | What it is |
|---|---|
| `index.html` | The homepage |
| `favicon.ico`, `favicon.svg`, `favicon-16.png`, `favicon-32.png` | Browser tab icon (the SVG turns amber in dark-mode browsers) |
| `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `site.webmanifest` | Home-screen icons for iPhone and Android |
| `og-image.png` | The preview card shown when siletry.com is shared on WhatsApp, LinkedIn or X |
| `assets/siletry-logo.svg` / `.png` | Logo for light backgrounds |
| `assets/siletry-logo-dark.svg` / `.png` | Logo for dark backgrounds |
| `assets/siletry-mark.svg` | Just the chat-bubble mark |
| `assets/siletry-app-icon-1024.png` | App icon, for Meta / WhatsApp Business profile pictures |
| `vercel.json` | Clean URLs, so `/privacy` serves `privacy.html` |
| `robots.txt` | Lets search engines index the site but not `/app` |
