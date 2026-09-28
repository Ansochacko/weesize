# QA report

Measured on 27 September 2026 against the production build (`npm run build`, preview on 127.0.0.1). Fixes are in the working tree. Nothing was committed.

## Exit criteria

| Criterion | Status |
| --- | --- |
| One search entry point, and the duplicate-search / primary-button test passes | Met on Chromium for every sitemap page at 360px, and on key pages at 360, 768, 1280, and 1920. WebKit passed the same key-page matrix. |
| All 12 customer journeys inside their targets | Not met. Journeys that need a tool this version does not have are listed as recommendations, not built. |
| Every break-it case ends in a sentence or a correct result, with zero console errors | Partial. Existing readers already return a sentence for a locked PDF, a damaged PDF, and a file that cannot get smaller. The full matrix was not executed in this pass. Chromium page errors on the clutter run were empty. |
| Smoothness numbers on a throttled low-end profile and WebKit | Not met. No performance trace was captured. Lighthouse LCP is about 2.6s, above the 2.0s target. CLS is about 0.001. |
| Lighthouse mobile 95 / 100 / 100 / 100 on four pages | Performance 95, best practices 100, and SEO 100 on home, Compress, Compress to 100 KB, and the compression guide. Accessibility 100 on those pages after the touch-target fix (the guide was remeasured; the other three were 100 on the build just before summary padding). |
| Visual baselines at every width and theme, axe at zero | Axe is clean on home, Compress, Compress to 100 KB, and the compression guide in Chromium. Full-page screenshot baselines were not stored. |
| No requests to other origins; privacy chip correct | Resource hosts during the browser check and the Playwright run were only 127.0.0.1. The chip’s offline transition was not remeasured in this pass. |
| No open P0 or P1; every P2 fixed or justified | No P0. The P1 clutter bugs below are fixed. Remaining gaps are P2 justifications or recommendations that would be new features. |

## Issues

### QA-001 — P1 — two search fields

- Where: `/tools`, desktop and mobile, all browsers
- Steps: open All tools
- Expected: one search, the top bar. Category chips filter the grid. On `/tools`, the top-bar search filters the grid live.
- Actual: a second `input#tools-search` sat under the heading.
- Screenshot: not stored
- Fix: removed that field. The palette is the only `role="search"`. While it is open the top-bar control is hidden. On `/tools`, typing in the palette filters the grid. A `?q=` query still filters on load.
- Re-test: Playwright `palette is the only search while it is open` passed. Browser check: opening Search tools hides the top control and focuses one search box.

### QA-002 — P1 — 404 page had its own search

- Where: unknown URLs
- Expected: the top bar is the only tool search
- Actual: a search form posted to `/tools`
- Fix: the form is gone. The page points at the top bar and a few links.
- Re-test: source and prerendered `404.html` no longer contain `type="search"`

### QA-003 — P1 — more than one solid primary button

- Where: result screen
- Expected: one solid accent button
- Actual: Download and the next-tool button were both primary.
- Fix: chain actions are quiet. One solid primary button per screen.
- Re-test: visible `.btn.primary` count is at most one on every sitemap page at 360px in Chromium.

### QA-004 — P1 — horizontal scroll at 360px

- Where: home, then Compress, phone width
- Expected: no sideways scroll
- Actual: the top bar overflowed by about 112px. On Compress, the About and FAQ blocks used the class `fold`, which is also the page-corner graphic, so those sections were pinned to the corner and a list stuck out by about 23px.
- Fix: on narrow screens the wordmark and status chip can shrink, and accordion sections no longer share the corner class. The corner mark is `page-curl`.
- Re-test: overflow is 0 or 1px on key pages at four widths, and on every sitemap page at 360px.

### QA-005 — P1 — footer repeated the sidebar

- Where: desktop home
- Expected: the same tool list is not shown twice side by side
- Actual: `.foot nav` is `display: grid`, which beat a later `display: none` on `.foot-groups`, so the footer listed every tool next to the sidebar.
- Fix: `.foot nav.foot-groups` is hidden from 801px up. Phones still get the list, because the sidebar is a closed sheet there.
- Re-test: at 814px the footer group computed `display: none`.

### QA-006 — P2 — hot folders named a copy `-small.pdf`

- Where: Hot folders
- Expected: the name matches what happened
- Actual: the queue copied the original bytes and named the file `-small.pdf`
- Fix: the name is `-copy.pdf`, and the log says it was not compressed.
- Re-test: `hot-queue.test.ts` passed

### QA-007 — P2 — muted text failed contrast

- Where: search label and sidebar group labels, light theme
- Expected: 4.5:1 for 14px text
- Actual: `#8a92a0` on white was about 3.13:1
- Fix: light `--text-3` is `#5c6674`. Dark `--text-3` matches `--text-2` (`#9aa3b2`).
- Re-test: axe reported zero violations on the four key pages.

### QA-008 — P2 — small touch targets

- Where: footer links, guide FAQ summaries, Lighthouse mobile
- Expected: targets large enough for the accessibility score of 100
- Actual: a few links and `<summary>` elements failed target size. Accessibility was 95 on home and 96 on the guide.
- Fix: `.link-row a` and `summary` have a 44px minimum height.
- Re-test: home accessibility 100 (before the summary rule, which does not shrink targets). Guide accessibility 100 after the summary rule. Target-size items: 0.

### QA-009 — P2 — double-clicks on the main action

- Where: any tool using the shared action button
- Expected: a second click does not start a second job
- Fix: the button ignores a second click until it returns to idle.
- Re-test: not exercised with a real file in the browser

## Justified, not changed

- Popular tools and the full catalog both list Compress, Merge, and a few others. They are two sections on purpose: a short list, then the catalog.
- `font-display` stays `optional`. An earlier pass measured layout shift when it was `swap`. Optional plus the shared 600 file for weight 500 keeps CLS near 0. A size-adjusted fallback was not added on top, because optional already avoids the jump.
- Playwright’s Firefox build crashed on a second full navigation during the width loop. Opening Compress once in that Firefox succeeded (title loaded, no page error). The width loop is skipped there. Chromium walked every sitemap page.
- Playwright’s WebKit build on Windows reports `access control checks` when the page starts the PDF workers. Chromium and a single Firefox load do not. This needs a real Safari check before it is treated as a product bug.
- The embedded browser left the status chip on “Loading…” while the tab was not the focused window. Timers there are clamped. That was not counted as a product failure.

## Lighthouse mobile

Simulated mobile, headless Chrome, local preview.

| Page | Performance | Accessibility | Best practices | SEO | LCP | CLS |
| --- | --- | --- | --- | --- | --- | --- |
| `/` | 95 | 100 | 100 | 100 | 2620 ms | 0.001 |
| `/compress-pdf` | 95 | 100 | 100 | 100 | 2593 ms | 0.001 |
| `/compress-pdf-to-100kb` | 95 | 100 | 100 | 100 | 2596 ms | 0.001 |
| `/guides/how-pdf-compression-works` | 95 | 100 | 100 | 100 | 2594 ms | 0.001 |

Guide accessibility was remeasured after summary targets were enlarged. Its performance, best practices, SEO, LCP, and CLS figures are from the run immediately before that CSS change. Home, Compress, and Compress to 100 KB accessibility were 100 on that same run.

LCP misses the 2.0s target. Performance still scores 95.

## Customer journeys

| # | Who | Result |
| --- | --- | --- |
| 1 | Student, low-end phone, PDF under 200 KB | Not timed on a throttled phone. The compress action and a size goal are on screen. Hitting a real 200 KB file in under 30 seconds was not measured. |
| 2 | Office worker merges five PDFs, reorders, adds page numbers | Not run as one timed session. Merge, Organize, and Page numbers are separate tools. |
| 3 | Sign a contract with a finger | Recommendation. Sign & fill is still a limited tool. A signature pad was not added. |
| 4 | Wi-Fi off, compress and redact | Recommendation for redaction. A white box is not redaction, and this pass did not add one. Offline compress was not remeasured. |
| 5 | Scan three pages, fix a corner, searchable PDF | Recommendation. Scan saves camera stills. It does not find corners or add a text layer. |
| 6 | Keyboard only | Not fully walked. Focus styles exist. Organize already supports Space and arrows. |
| 7 | Screen reader | Axe is clean on the four key pages. A VoiceOver or NVDA pass was not done. Compress progress was not heard. |
| 8 | Installed PWA, share sheet and Open with | Recommendation. The manifest declares a share target. The service worker does not read a share POST, so the file may not load. |
| 9 | Spanish | Recommendation. Locales are unreviewed drafts and are not indexed. A full translation was not invented. |
| 10 | Forty files, zip, cancel | Not run in the browser. |
| 11 | Paid features | Removed. Every tool is free. No paid unlocks. |
| 12 | `/compress-pdf-to-100kb` on a phone | Passed in Playwright at 360×740. The compress button is inside the first screen, and the note says the 100 KB figure is a goal. |

## Break-it

Not re-run end to end in this pass. The readers already say:

- Locked PDF: “This PDF is locked with a password. Remove the password on this device, then try again.”
- Damaged PDF: “This file could not be read as a PDF. Export it again from the program that created it.”
- Already small: “This PDF is already well compressed. No smaller version was possible.”
- Fit to size remains a goal, not a promise that the file will land on that byte count.

## What changed

- One search. The tools-page field and the 404 search form are gone.
- One solid primary button on a screen. The result chain follows that.
- Phone top bar no longer scrolls sideways. Accordions are no longer styled as a page corner.
- Footer tool groups hide when the sidebar is on screen.
- Contrast and 44px targets for footer links and disclosures.
- Hot-folder output is named as a copy.
- Playwright covers one search, one primary, and no sideways scroll. Axe covers four pages.

Entry script is still about 26 KB gzip.

## Needs a person and a real device

- iPhone Safari: signature is not implemented; also confirm the WebKit worker message does not appear in real Safari.
- A low-end Android phone on a slow network: time a compress under 200 KB, and check the status chip within a second of turning Wi-Fi off.
- VoiceOver and NVDA: hear Compress progress and the result.
- An installed PWA: share sheet and desktop Open with.
- Firefox, if the Playwright crash should be confirmed outside Playwright.
- A 500-page thumbnail grid and a drag, with a performance trace, before claiming 60 fps.
