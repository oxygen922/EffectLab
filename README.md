# EffectLab

EffectLab is a face and pet effect template lab. Pick a template, upload the photos it asks for, and an async job renders a short clip. Credits are held before the render starts, captured when it succeeds, and returned when it fails.

This MVP includes:

- a template catalog (name, photo count, duration, original cover, tags)
- upload to an async job (`pending` → `running` → `done` or `failed`)
- a credits ledger with balance, holds, captures, and releases
- a mock video provider behind a small adapter
- a Stripe stub that does not charge cards or grant credits

Renders in this build are original SVG animations from the mock provider. They are not model output and they are not copies of anyone else's sample clips.

## Monitored competitor sites

Template discovery follows public catalog metadata from these sites. The links are their public homepages. EffectLab does not mirror their pages, sample videos, posters, or prompts.

| Site | Homepage |
| --- | --- |
| ViralVideoAI | https://viralvideoai.app/ |
| Vidlark | https://vidlark.ai/ |
| Jumponthetrend | https://jumponthetrend.app/ |
| MakeViral | https://www.makeviral.ai/ |
| Starrd | https://www.getstarrd.app/ |
| media.io | https://www.media.io/ |
| Zooop | https://zooop.ai/ |
| Vellm | https://vellm.app/ |

## How to update templates

The app catalog is metadata only. Update it from the radar export:

```bash
npm run import:templates
```

That reads `template-radar/latest/templates.json` (override with `npm run import:templates -- --from path/to/templates.json` or `TEMPLATES_JSON`). The script rewrites `data/templates.json` from public fields: name, slug, site names, photo count, duration, tags, category, first-seen day, cross-site count, and a priority score. Priority favors templates seen on 4 or more catalogs and templates first seen within 48 hours of the radar timestamp.

The import never copies competitor sample videos, preview files, posters, or prompts. Fields such as `preview_poster_url`, `video_url`, `sample_url`, and `prompt` are dropped, and any value that points at a video file is rejected. Covers are original SVGs served from `/covers/[slug]`. Nothing in the catalog points at a competitor asset.

Manual fields live in either of these places:

- `data/editorial.json` — blurbs, credit cost, featured flag, hidden flag, tags, and display names. Every import reapplies this file, so it is the right place for merchandising that should stick.
- `data/templates.json` — rows with `"origin": "manual"` are kept when that slug is not in the radar file. `studio-slate` is one of these and is also declared in `data/editorial.json`.

Radar-owned rows are regenerated. Put lasting edits for those rows in `data/editorial.json`, not only in the generated file. Do not paste competitor prompts or media URLs into either file. A blurb that contains a URL is discarded.

The checked-in `template-radar/latest/templates.json` is a metadata snapshot from 2026-11-04. Replace that file with a newer radar export, then run the import again. Do not add video files next to it.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000. The first API call creates an anonymous session cookie and grants starter credits (`STARTER_CREDITS`, default 8). A new session can render until the balance is gone. The account page shows the ledger and the Stripe stub.

```bash
npm test
npm run lint
npm run build
```

## API

| Method | Path | Behavior |
| --- | --- | --- |
| `GET` | `/api/templates` | Catalog. Optional `q`, `category`, `featured=1`. |
| `GET` | `/api/templates/:slug` | One template. |
| `POST` | `/api/jobs` | Multipart `templateId` plus `images`. Holds credits and creates a job. `402` when the balance is short. |
| `GET` | `/api/jobs/:id` | Owner-only status. Polling advances the mock provider. |
| `GET` | `/api/jobs/:id/result` | Original SVG clip once the job is `done`. |
| `GET` | `/api/me/credits` | Available balance and held amount. |
| `GET` | `/api/me/ledger` | Recent ledger entries. |
| `POST` | `/api/stripe/checkout` | Stub. Returns `501` and `checkout_url: null`. |
| `POST` | `/api/stripe/webhook` | Stub. Acknowledges and does not grant credits. |
| `POST` | `/api/webhooks/provider` | Provider callback. Body `{ jobId, status, providerJobId }`. `status` is `running`, `done`, or `failed`. The provider job id must match the stored id. If `PROVIDER_WEBHOOK_SECRET` is set, also send `x-effectlab-provider-secret`. |

`VIDEO_PROVIDER` defaults to `mock`. Any other value throws. The mock provider reports `pending` for about 1.6s, `running` until about 5.2s, then `done`, using the job clock so a poll still completes after the request that created the job has finished.

Credits move inside one file-backed transaction (`data/runtime.json`, not committed):

1. Grant starter credits on first session.
2. Hold the template cost before the provider is asked to generate. The job is rejected when `balance < cost`.
3. Capture the hold when the provider reports `done`.
4. Release the hold when the provider reports `failed` or the upload cannot be stored.

Uploads stay in `data/uploads/` (gitignored) and are readable only by the owning session. Accepted types are JPEG, PNG, and WebP, up to 8 MB each, checked by signature.

## Stripe

Checkout and the webhook exist so a later payment integration has a place to land. This version never creates a Checkout Session and never increments the balance from a webhook, even if `STRIPE_SECRET_KEY` is present. See `.env.example`.

## What this repo refuses to store

- competitor sample videos, preview posters, and proprietary prompts
- copied cover artwork (covers and the mock clip are original SVG)
- card charges
