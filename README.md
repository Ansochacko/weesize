# Weesize

The product name is defined in `src/brand.ts` (currently Weesize). The domain and tagline live in that file too. Rebuild after you change them.

Weesize is a **free and open source** PDF toolkit that runs entirely in the browser. It compresses, merges, splits, and rearranges PDFs, and turns images into a PDF. There is no upload, no account, no paid plan, and no server-side processing. After the page has loaded, turning off the network does not stop the tools.

Your files never leave your device.

The mark is a large faint page with a smaller solid page inside it. Logo files are in `public/brand/`. A size sheet is at `public/dev/brand-check.png`.

## Open source

- Code license: MIT (`LICENSE`). Copyright year 2026; product name from `src/brand.ts`.
- Name and logo: see `TRADEMARK.md`. Forks must use a different product name and mark.
- Third-party licenses: `THIRD_PARTY_LICENSES.md` (MIT, Apache-2.0, BSD, ISC, Zlib, OFL only).
- Contributing: `CONTRIBUTING.md`
- Security reports: `SECURITY.md`
- Optional support: set `brand.supportUrl` to a Sponsors or Ko-fi page. The footer then shows a quiet text link. The app never loads payment scripts.
- Repository link: set `brand.repoUrl`. The footer and privacy page then show “Open source”.

## Privacy design

The promise is enforced by the page, not only written on it.

- The Content-Security-Policy meta tag is `default-src 'self'; connect-src 'self'; worker-src 'self' blob:; img-src 'self' blob: data:; style-src 'self' 'unsafe-inline'; font-src 'self'; script-src 'self' 'wasm-unsafe-eval'`. `connect-src 'self'` allows only this origin. Nothing in the tools fetches another host.
- Fonts, PDF engines, and the service worker ship with the site. Nothing is loaded from a CDN.
- A file you open stays in memory for that tab. Weesize does not write file bytes to `localStorage`, IndexedDB, cookies, or the service worker cache. The only saved settings are the theme and the last compression level, in an IndexedDB database named `weesize-prefs`. Settings can erase them in one click. The theme is also applied before first paint from `weesize-theme` in local storage, then stored with the other preferences.
- The service worker precaches the app shell (HTML, CSS, JavaScript, fonts, icons). It does not cache documents you open. After the first visit the tools keep working with the network off.
- Heavy libraries load during the first visit, while the status chip still says “Loading…”. They are not fetched later in idle time. A request after the chip says On-device would break the no-upload check, so the privacy rule wins over idle prefetch.
- Work is handed to workers as transferable `ArrayBuffer`s. The page keeps one copy of each file so you can start over or send the result to another tool. That copy never leaves the tab.

## How compression works

Compress keeps text as text. It only rewrites images that are worth shrinking, and it keeps the original file if the rewrite is not smaller.

Three levels are shown up front. Recommended is selected.

| Level | What you see | What it does |
| --- | --- | --- |
| Light | Best quality, slightly smaller. | Longest side 2400 px, JPEG quality about 0.85 |
| Recommended | Good quality, much smaller. | Longest side 1600 px, quality about 0.72 |
| Strong | Smallest file, lower image quality. | Longest side 1100 px, quality about 0.55 |

More options holds “Convert to black & white”, a quality slider, and “Maximum squeeze (slower)”.

The fast path, all off the main thread:

1. As soon as a file is added, a background scan reads each image’s byte size and pixel size. It does not decode pixels. An image used on many pages is handled once.
2. Images that are already small and efficiently stored, images under 64 px, and images with transparency or an unusual color space are left alone.
3. The rest are processed largest first, across a pool of up to six workers.
4. Each image is resized with `createImageBitmap` and encoded with `OffscreenCanvas.convertToBlob` as JPEG. An image is replaced only when the new bytes are smaller.
5. “Maximum squeeze (slower)” is the only path that uses MozJPEG. The WebAssembly bytes are compiled in the worker with `WebAssembly.compile`. They are not fetched. The module is bundled so the page never downloads a wasm file after load.
6. Embedded thumbnails, unused objects, and extra document info are removed, and the file is saved with object streams. If that file is not smaller, you get the original back and the sentence “This PDF is already well compressed. No smaller version was possible.”

Several PDFs compress together and download as a zip. Images to PDF can reduce size with the same Recommended settings. That option is on by default.

pdf.js and pdf-lib each keep one long-lived worker, so a file is parsed once and reused. Image shrinking is the work that spreads across the pool.

## Run

```bash
npm install
npm run dev      # local development
npm run build    # typecheck and production build
npm run test     # unit tests
npm run preview  # serve the production build
```

Open the URL `vite preview` prints. If port 4173 is already taken, Vite picks the next port.

## Verify the no-upload claim yourself

1. Run `npm run build`, then `npm run preview`, and open the site.
2. Open DevTools and select the Network panel. Turn on “Disable cache”.
3. Reload and wait until the status chip says **On-device**.
4. Every request should be to this site’s own origin: the page, scripts, stylesheet, font files, workers, and the service worker. There should be no other host.
5. Add a PDF and use a tool, including Maximum squeeze. The Network panel should not gain new requests. Creating the address of the MozJPEG file is not the same as downloading it. No request for that `.wasm` file should appear.
6. In the Network panel, set throttling to **Offline**. The proof panel fills green and says you are offline. Compress, merge, split, organize, and images to PDF still run.
7. Reload while still offline. The app should open again from the service worker.
8. In Application → Local Storage, Weesize should have no file keys after a reload. In IndexedDB, `weesize-prefs` may hold the theme and the last compression level, and nothing else. Settings → Erase saved preferences removes that database.

## This build

The catalog lists every planned tool. These ones process a file on this device: Compress PDF, Compress images, Repair PDF, Merge, Split, Organize, Rotate, Crop, Images to PDF, Scan to PDF, Word to PDF, HTML to PDF, PDF to images, PDF to Word, PDF to Markdown, Watermark, Page numbers, Compare PDFs, and Workflows. Summarize and Translate appear only when the browser itself has an on-device model, and they never call a cloud service.

Protect, Unlock, Redact, Make searchable, PDF/A, Excel, PowerPoint, Edit PDF, Sign & fill, and PDF forms stay on a page that explains the limit. A white box is not redaction, a guessed password is not unlocking, and an unchecked file is not PDF/A. Limited tools stay honest about missing capabilities; they are not gated behind payment.

Output names follow the file you started with, such as `contract-compressed.pdf`, `contract-merged.pdf`, `contract-organized.pdf`, and `contract-pages-1-3.pdf`.

Compression still uses the measured path above: resize and JPEG, replace an image only when the file gets smaller. SSIMULACRA2, Jpegli, mixed raster content, and a learned quality predictor are not in this build, so the app does not print a quality score. JBIG2 symbol matching is not implemented, and a unit test fails if that mode appears in the source. The manifest declares a share target and a PDF file handler. The generated service worker does not yet read a share POST, so a phone share sheet may open Weesize without handing over the file.

`THIRD_PARTY_LICENSES.md` lists every dependency that ships today.

## Licenses

Weesize itself is MIT. Direct dependencies:

| Package | License |
| --- | --- |
| pdf-lib | MIT |
| pdfjs-dist | Apache-2.0 |
| jszip | MIT OR GPL-3.0-or-later — Weesize uses the MIT option |
| fflate | MIT |
| @jsquash/jpeg | Apache-2.0; the MozJPEG codec is BSD-3-Clause, IJG, and zlib |
| @fontsource/ibm-plex-sans | SIL Open Font License 1.1 |
| geist | SIL Open Font License 1.1 |
| vite, vite-plugin-pwa | MIT (build tools) |
| typescript | Apache-2.0 (build tool) |

No Ghostscript, MuPDF, or AGPL/GPL code is included. The font license is OFL because the typeface has to be self-hosted. It is not a network request and it is not AGPL or GPL.
