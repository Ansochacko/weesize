# SEO playbook

The product name, domain, and tagline live in `src/brand.ts`. Change them there and rebuild. Do not add an analytics script to the page. Measurement is Google Search Console, Bing Webmaster Tools, and the host’s logs.

## Set up on day one

- Google Search Console and Bing Webmaster Tools. Paste the verification tokens into `brand.verification` in `src/brand.ts`. Those tags make no requests.
- Google Keyword Planner, to check the volumes behind `seo/keywords.csv` before you add more pages.
- Ahrefs or Semrush for one month of keyword and competitor research, then only when you need them.
- Google Trends for seasonality and countries.
- Keywords Everywhere or Ubersuggest for cheap checks later.
- PageSpeed Insights and Lighthouse.
- Screaming Frog, free up to 500 URLs, for a crawl.
- The Rich Results Test, on a few templates: home, a tool, an exact-size page, a guide.

Submit the sitemap index at `/sitemap.xml`. Only reviewed languages are in it. Draft translations are `noindex` until a native speaker sets `reviewed: true`.

After each deploy, a person can run `npm run indexnow` on the server with `INDEXNOW_KEY` and `INDEXNOW_HOST`. That script is not in the browser.

## Monthly routine

- Search Console queries with high impressions and a low click-through rate: rewrite the title and description. Keep the keyword first and the brand last. Stay under 60 and 155 characters. Include “no upload”.
- Queries sitting in positions 8–20: strengthen that page and the links to it.
- Publish 4–8 new guides. One question each. Link them to the tool that actually does the job.
- Add a size or format page when Search Console shows real demand. Give it its own explanation. Do not clone a page and swap the number.
- Check Core Web Vitals in Search Console. Do not add a client script to measure them.

## Milestones

Track, by page group (tool, exact-size, privacy, guides, and each reviewed language):

- indexed pages
- impressions
- clicks
- average position

There is no client-side dashboard. Export from Search Console and Bing.

## Do not

- Invent a portal’s file-size rule. The list in `seo/unreviewed-translations.txt` is waiting on official sources.
- Add a tracker, a chat widget, a pop-up, or a fake review to “help rankings”.
- Publish an unreviewed translation in the sitemap.
- Mention paid tiers or upgrades. Every tool is free. Prefer natural “free” / “no sign-up” / “no watermark” wording where it fits.