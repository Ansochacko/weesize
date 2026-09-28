# Verifying an upload requirement

Weesize applies a preset only when the record is `verified`. A draft is a schema example. Its numbers are placeholders and must never be shown as rules.

## Add a record

1. Copy `content/requirements/example-photo.json` to a new file. Use a stable id: lowercase, hyphens, no country guessed into the id until the source is real (`in-passport-photo`, not `passport`).
2. Set `placeholder` to `false` only after the steps below. Leave `status` as `draft` until then.
3. Open the official page yourself. Copy only limits that the page states: formats, minimum and maximum bytes, pixel size, millimetres, DPI, color, background, whether a background may be replaced, head-size percentage, and page count.
4. Put the page URL in `sourceUrl`. It must be `https://`. `example.invalid` is rejected even if someone marks the file verified.
5. Set `lastVerified` to the day you read the page (`YYYY-MM-DD`) and `verifiedBy` to your name or handle.
6. Set `status` to `verified`.
7. In the pull request, quote the sentence you copied and the heading it sits under. Do not round a limit into a nearby number. If the page is silent, leave that field `null`. Null means "not stated", and the checklist will say it was not checked.

## What does not count

- A blog, a forum, or another PDF tool.
- A number you remember.
- A machine translation of a page you cannot read. Ask someone who can read it, then set `verifiedBy` to that person.
- An undated screenshot.

## When a rule changes

Set `status` to `outdated`. Outdated records stay out of the app and the sitemap. The in-app "Report outdated" link opens a prefilled GitHub issue, or a mail draft if no repository is configured. The app does not send the report itself.

## Publish

Verified records are imported by `src/lib/requirements.ts`. A verified record gets a short page at `/presets/{id}`. Drafts and outdated records do not.
