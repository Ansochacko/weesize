# Contributing

The product name is `src/brand.ts`. Do not hard-code a second name into titles or the manifest.

- Keep file bytes on the device. Do not add a request to another origin, an analytics script, or a fallback that uploads when a local feature is missing.
- Do not add GPL, AGPL, or LGPL code. JSZip is used under the MIT option only.
- Do not claim a result the code does not check: encryption, redaction, OCR, PDF/A, or an exact byte size.
- New pages are data in `content/`. The build fails on duplicate FAQ answers, duplicate titles, pages under 250 words, and pages that are more than 70 percent similar.
- Translations stay `reviewed: false` until a native speaker says otherwise. Unreviewed languages stay out of the sitemap.

Run `npm test` and `npm run build`.
