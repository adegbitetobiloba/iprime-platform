# Photographs on the website

The site is built to show real photographs in three places. Until an approved image is added, each place shows a clean designed panel (no broken images), so nothing is missing or ugly in the meantime.

| Slot | Where it appears | Suggested image | Size |
|---|---|---|---|
| `hero` | Homepage, top right (replaces the logo card when set) | Students working at computers in a school computer laboratory | 1200 x 800, WebP, under 150 KB |
| `cbt` | Homepage, "Computer-based testing" section | A supervised computer-based examination or students at screens | 1200 x 900, WebP, under 150 KB |
| `learning` | Reserved for the learning library section | Students studying with books and devices | 1200 x 800, WebP, under 150 KB |

## Adding an image (no coding beyond one line)
1. Prepare the file as WebP (use squoosh.app, free, in the browser) at the size above.
2. Upload it to the repo folder `frontend/public/images/` (create the folder by uploading a file with that path).
3. Edit `frontend/src/siteImages.js`: replace `hero: null` with
   `hero: { src: "/images/hero.webp", alt: "Describe what the photo shows", width: 1200, height: 800 }`.
4. Commit. Render rebuilds and the photo appears. If the file is missing or fails to load, the designed panel shows instead.

## Where to get images legally
- **Best: your own photographs** of your centre. For recognisable students (especially minors) get written permission from the parent or guardian first. Never present a stock photo as a picture of your actual students or events.
- **Free stock sites** such as Unsplash, Pexels or Pixabay allow commercial use, but each photo has its own page and terms, and photos of identifiable people can need a model release that these sites do not guarantee. Read the licence on the photo's page, download the file and store it in the repo; do not link to the stock site's address (it can disappear or change).
- Do not copy images from other schools' or CBT centres' websites.
- Keep a note of each image's source and licence in a file `frontend/public/images/SOURCES.md`.
