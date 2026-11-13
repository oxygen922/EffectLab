# Render types

Effect templates are not one image-plus-prompt video call. Each template has a `renderType` in `data/render-types.json`, and the job router picks a provider that declares that type.

Pages were fetched on 13 Nov 2026. A model is `source_page` only when a fetched page states it. Everything else is `inferred`. Prices below are the published rate applied to a 10 second 720p clip unless the page bills another way. Latency is "not stated" when the cited page does not give one. Nothing here was timed against a live key.

## The three types

| Type | What it is | Inputs |
| --- | --- | --- |
| `motion_transfer` | A dance or other routine that has to hit a beat. The model drives the user's subject with a motion reference. | User photo(s) plus `assets/reference/<slug>.mp4` |
| `face_swap` | The same scene, a different person. Birthday-car beats, elevator and ceiling-fan outfit changes, and other locked shots. | User face photo(s) plus `assets/base/<slug>.mp4` |
| `image_to_video` | Pet micro-dramas, pranks, and story beats with no fixed choreography. | Photo(s) plus the template prompt. First and last frames are optional on providers that have them. |

No fourth type. Outfit changes stay `face_swap`: the brief's own example is the elevator outfit change, and the camera and room stay put. A duo is not its own pipeline. Two people in a dance are `motion_transfer`; two people in a prompted gag are `image_to_video`. The photo count already says how many subjects there are.

`motion_transfer` and `face_swap` rows with no file on disk fall back to `image_to_video` and log a warning. Do not fill those files with a competitor's sample video. The empty list is `docs/reference-assets-todo.md`.

## What Sailf actually accepts

Sailf is the gateway already wired in `lib/providers/sailf.ts`. Base URL `https://aigc-new.sailf.work`. Public pricing is `GET /api/pricing` (no key). The studio UI bundle (`/ui-v2/assets/protocol-DLU8kMzy.js`, fetched 13 Nov 2026) is the mode list. There is no separate public docs page: `/docs` returns 404, and `#docs` is the same app shell.

| Mode the brief asked about | Sailf |
| --- | --- |
| Reference video | Yes, inside `mode: "reference"`. The UI allows videos only in that mode (3 or 10 clips depending on the model, mp4/quicktime). Pricing schemas include `has_video_ref` / `video_input: video`. A reference video must be uploaded with `POST /studio-api/assets?mode=reference&kind=videos`, then sent as `videos` on `POST /v1/videos`. Seedance models on this gateway also want `reference_roles.videos = reference_video`. |
| Motion control | No mode by that name. Reference video can steer motion. It is not Kling's motion-control API. |
| Video-to-video | No `video-to-video` mode. The bundle does list `video-extension` (continue a clip). That path was not exercised. |
| Face swap | No face-swap mode. Putting a person into a base clip is the same reference-video call, which does not lock the scene the way Wan Animate Mix or PixVerse Swap do. |
| First / last frame | Yes. Modes `first-frame` (1 image) and `first-last` (2 images). The pricing blurb for `doubao-seedance-2-5-260628` says the frame follows the first image. The upload form does not collect a separate end frame, because a second photo on a duo template is a second subject, not the last frame. |

Submit and poll, unchanged: `POST /v1/videos`, `GET /v1/videos/{task_id}`, `GET /v1/videos/{task_id}/content`. The integration gives up after 20 minutes. Sailf does not publish a latency number.

Public model ids used as defaults, from `/api/pricing` descriptions:

| Registry id | Gateway id | Pricing description |
| --- | --- | --- |
| `seedance-2.0-mini` | `model-4e2cf014f835822786c5d25d207257e3-zyf` | doubao-seedance-2.0-mini, video tokens, 80% of the official per-million-token price. 480p and 720p, with or without a reference video. |
| `seedance-2.0` | `model-d46d99cfb921dbdee0b4965fe6e80029-zyf` | doubao-seedance-2-0-260128, same token billing. |
| `seedance-2.5` | `model-31931a2794d803dce3b998d3e974f349-zyf` | doubao-seedance-2-5-260628, same token billing. 480p, 720p, 1080p. |

A dollar cost per clip is **not** on that payload. Runway's reseller table lists Seedance 2.5 at $0.30 per second at 720p ([dev.runway.com/pricing](https://dev.runway.com/pricing), fetched 13 Nov 2026). That is Runway's price, not ByteDance's and not Sailf's token invoice. It is several times Kling 3.0's official $0.084 per second, which is why Seedance 2.0 and 2.5 are flagship (4 credits) and the mini stays standard (1 credit), matching the cheap gateway default.

Sailf's `supportedRenderTypes` includes all three types because reference mode can carry a video. The router still prefers Kling for motion control and Wan or PixVerse for a locked face swap when those keys exist.

## Recommended provider by type

| Type | Recommended provider | Endpoint | Inputs | Price per 10s clip | Latency | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `motion_transfer` | Kling 3.0 Motion Control | `POST https://api-singapore.klingai.com/motion-control/kling-3.0`, then `GET https://api-singapore.klingai.com/tasks?task_ids=` ([motion control](https://kling.ai/document-api/api/video/motion-control.md), [pricing](https://kling.ai/document-api/pricing/base/video.md)) | One appearance image, one motion video, `character_orientation` `image` or `video` | $1.26 at 720p ($0.126/s). $1.68 at 1080p ($0.168/s). | Not stated | Official async API. Callback optional. This is the dedicated choreography route. |
| `motion_transfer` | Wan 2.2 Animate Move (DashScope) | `POST https://{WorkspaceId}.ap-southeast-1.maas.aliyuncs.com/api/v1/services/aigc/image2video/video-synthesis` with `X-DashScope-Async: enable`, model `wan2.2-animate-move` ([model page](https://www.alibabacloud.com/help/en/model-studio/wan2-2-animate-move)) | Character photo plus a performance video | Beijing standard $0.60 ($0.06/s), pro $0.90 ($0.09/s). Singapore standard $1.20, pro $1.80. | Not stated. Task id is valid 24 hours. | The exact task-status URL was not in the excerpt kept from that page. **Poll path unverified.** |
| `motion_transfer` | Viggle Remix | `POST /v1/renders` after `POST /v1/motions` ([pricing](https://docs.viggle.ai/v1/pricing), [renders](https://docs.viggle.ai/v1/api-reference/renders)) | Character image plus a driving video or motion id | $0.10 for one character ($0.01 per output second). Motion `type=render` has no separate preprocess charge. | Not stated. Docs say poll until `ready` or `failed`. | Cheapest dedicated motion API in this set. Host base URL was not copied from the docs. **Base URL unverified.** |
| `motion_transfer` | Runway Act-Two | `POST /v1/character_performance`, model `act_two` ([help](https://help.runwayml.com/hc/en-us/articles/42311337895827-Performance-Capture-with-Act-Two), [dev pricing](https://dev.runway.com/pricing)) | Character image or video, plus a 3–30s driving performance | $0.50 ($0.05/s, 5 credits/s at $0.01/credit). 3 second minimum ($0.15). | Not stated | Help page is the product spec. The dev pricing page fetched on 13 Nov 2026 did not repeat the Act-Two row in the excerpt, so the $0.05/s figure is from the help article (5 credits/s) plus Runway's published $0.01/credit. **Confirm the credit value on the pricing page before buying.** |
| `face_swap` | Wan 2.2 Animate Mix (DashScope) | Same video-synthesis URL as Animate Move, model `wan2.2-animate-mix`, modes `wan-std` / `wan-pro` ([API](https://www.alibabacloud.com/help/en/model-studio/wan-animate-mix-api)) | `image_url` of the person, `video_url` of the scene. 2–30s, mp4/avi/mov. | Beijing $0.90 std / $1.30 pro. Singapore $1.80 std / $2.60 pro. | Not stated | Keeps the original scene, lighting, and motion. This is the closest match to "same scene, different person." **Poll path unverified**, same as Animate Move. |
| `face_swap` | Wan 2.2 Animate Replace on fal | `POST https://queue.fal.run/fal-ai/wan/v2.2-14b/animate/replace`, then the `status_url` from the response ([model](https://fal.ai/models/fal-ai/wan/v2.2-14b/animate/replace/llms.txt), [queue](https://docs.fal.ai/model-apis/model-endpoints/queue)) | `video_url`, `image_url` | At 720p, $0.08 per 16 frames. A 10s 24fps clip is 240/16 × $0.08 = $1.20. 16fps would be $0.80. | Not stated. States are `IN_QUEUE`, `IN_PROGRESS`, `COMPLETED`. | fal bills frames, not wall-clock seconds. |
| `face_swap` | PixVerse Swap on fal | `POST https://queue.fal.run/fal-ai/pixverse/swap` ([model](https://fal.ai/models/fal-ai/pixverse/swap/llms.txt)) | `video_url`, `image_url`, `mode` defaults to `person` | 720p is $0.20 per 5 seconds and doubles past 5 seconds, so a 10s clip is $0.40. 1080p is listed at $0.40 per 5 seconds and the same page says 1080p is not a request option. **That conflict is unverified; trust the schema enum (`360p`, `540p`, `720p`).** | Not stated. Same fal queue. | Whole-person swap, not a face-only mask. A full-body source photo can drag clothing into the shot. |
| `image_to_video` | Sailf Seedance 2.0 Mini | `POST /v1/videos` with `mode: "reference"` and uploaded image asset ids | 1–9 reference images, prompt, duration, 9:16 | Token price, 80% of official. Dollar clip cost **unverified** on Sailf. | Not stated. Client timeout 20 min. | Current production path. |
| `image_to_video` | MiniMax Hailuo 02 | `POST https://api.minimax.io/v1/video_generation`, poll `GET /v1/query/video_generation?task_id=` ([i2v](https://platform.minimax.io/docs/api-reference/video-generation-i2v), [first/last](https://platform.minimax.io/docs/api-reference/video-generation-fl2v), [query](https://platform.minimax.io/docs/api-reference/video-generation-query)) | `first_frame_image` plus prompt. First/last needs `last_frame_image` and model `MiniMax-Hailuo-02`. Statuses: Preparing, Queueing, Processing, Success, Fail. | Official i2v page does not list a dollar rate. **Price unverified.** Runway's reseller table lists Hailuo-class models from about $0.03–$0.06/s, which would be roughly $0.30–$0.60 for 10s. Do not treat that as MiniMax's invoice. | Not stated | Hailuo 02 is the first/last-frame model. Hailuo 2.3 on the same page is i2v only. |
| `image_to_video` | Kling 3.0 image-to-video | Official price is on the [video pricing](https://kling.ai/document-api/pricing/base/video.md) page. The create URL for plain i2v was **not** re-fetched; only motion control's create URL was. | Image plus prompt. Optional audio. | No audio: $0.84 ($0.084/s). With audio: $1.26 ($0.126/s). 1080p with audio $1.68. | Not stated | **i2v create path unverified.** Motion control is a different route, above. |
| `image_to_video` | Vidu Q2 reference | `POST https://api.vidu.com/ent/v2/reference2video`, poll `GET /ent/v2/tasks/{id}/creations` ([reference](https://platform.vidu.com/docs/api-reference/video-models/vidu-q2/reference-to-video)) | Prompt, 1–7 images, and on `viduq2-pro` 1–2 reference videos | Official credit price is ¥0.03125 per credit ([pricing](https://platform.vidu.com/docs/overview/pricing)). The reference-to-video credit row was truncated in the fetch. **Dollar clip cost unverified.** fal's Q2 reference pro page says $0.30 for a 720p video ([llms.txt](https://fal.ai/models/fal-ai/vidu/q2/reference-to-video/pro/llms.txt)). | Not stated. States: created, queueing, processing, success, failed. | `viduq2-pro` is the variant that accepts video references. |

## What each source site says

Fetched from the URLs in `data/prompts.json` `research.sources`, plus the site home or FAQ pages below. A banner or a model menu is not a per-template assignment.

| Site | What the pages state |
| --- | --- |
| Vellm | Every template page fetched says videos are AI-generated with Seedance 2.5 by ByteDance. The homepage says a template becomes a 1080p video generated with Seedance 2.5. |
| MakeViral | The generate block names the engine for that template. Most rows say Seedance 2.5. A few name Kling 3.0 or Kling 3.0 Motion Control as "(this template)", sometimes next to a second variant that is also marked that way (person vs pet, or portrait vs the trend clip). |
| Jump on the Trend | Homepage FAQ: Kling O3 edits the real trend clip and puts your face in each shot. The 3 Nov 2026 comparison says O3 for viral clips, Kling 4.0 for clips over 15 seconds, and Kling 3.0 for AI video templates. Of the trend URLs in this catalog, only the End of Watch locker page states a model on the page itself: Kling O3 standard, Kling 4.0 higher quality. Other trend pages do not name a model. The FAQ split was not applied to every Jump template, because the page does not say which bucket that template is in. |
| media.io | The pet-drama page says the Chinese micro-drama templates are powered by Seedance 2.0. The rest of the chrome lists Seedance 2.5, MiniMax H3, Wan 3.0, and Kling 3.0 as featured models, not as the engine of one effect. |
| DoTheTrend | The Te He Perdido page (used for Club Spotlight Couple) says Model Seedance 2.0 Recommended, with Seedance 2.0 Mini and Seedance 2.5 as other settings. Vellm's page for the same trend says Seedance 2.5. The per-template line wins the tie, and Vellm is recorded as the disagreement. |
| Vidlark | Homepage: upload a photo or type a sentence and pick a model such as Veo, Kling, or Seedance. Template pages do not name one engine. The "Kling 4.0 is live" banner is a promo. |
| Zooop | Marketing copy lists Seedance 2.5, Gemini Omni 1.2 Flash, MiniMax H3, Kling V4, and Wan 3.0. Template pages do not assign one of them. Jump on the Trend's 3 Nov 2026 comparison says Zooop does not name a model on the template pages it read. |
| ViralVideoAI | The FAQ contrasts the product with CapCut, Sora, and Veo. It does not say those models render the templates. |
| Starrd | Homepage lists Seedance 2.0 and Kling Motion Control among several models. No catalog source URL is a Starrd template page, so this is not assigned to a row. |
| AI Dance App | The Shake It page calls itself a Viggle alternative. That is not a claim that the clip is rendered by Viggle. |

When two sites name different models, the one named on more of that template's source pages wins. A tie prefers the page that names the engine for that template (MakeViral, DoTheTrend, media.io) over Vellm's site-wide footer.

## How many templates suggest each model

128 templates are `source_page`. 64 are `inferred`.

| Suggested model | Templates | How it got there |
| --- | --- | --- |
| Seedance 2.5 | 120 | Vellm footer and/or a MakeViral generate spec |
| Seedance 2.0 Mini | 49 | Inferred image-to-video. No source page named an engine. This is the cheap Sailf default. |
| Kling 3.0 Motion Control | 13 | 12 inferred beat-matched routines with no stated engine, plus Popstar, where MakeViral says Motion Control copies the clip |
| Wan 2.2 Animate Mix | 3 | Inferred face swap where no page named an engine |
| Kling O3 | 3 | End of Watch pages, which share Jump on the Trend's locker-scene URL |
| Seedance 2.0 | 2 | media.io pet drama ("powered by Seedance 2.0") and DoTheTrend's recommended line for Club Spotlight Couple |
| Kling 3.0 | 2 | MakeViral "(this template)" on Anıtkabir (the person variant; the pet variant is Seedance 2.5) and Christmas Car Lights (the car variant; the window variant is Seedance 2.5) |

Laughing Fairy's MakeViral page names Kling 3.0 for a one-photo "You" portrait and Seedance 2.5 for the fairy clip. This catalog row is the fairy scene, so the suggestion is Seedance 2.5 and Kling 3.0 is the alternate.

## Credits

The template page and the job use the suggested model's tier:

| Tier | Credits | Models |
| --- | --- | --- |
| Standard | 1 | Seedance 2.0 Mini, Hailuo 02, PixVerse Swap, Viggle Remix |
| Pro | 2 | Kling 3.0 image-to-video, MiniMax H3, Wan 2.2 Animate Mix and Move, Vidu Q2 Pro, Runway Act-Two |
| Flagship | 4 | Seedance 2.0, Seedance 2.5, Kling 3.0 Motion Control, Kling O3, Kling 4.0, Veo 3.1 |

Seedance 2.0/2.5 and Kling motion control / O3 / 4.0 are flagship because the published per-second rates are several times a mini or Hailuo-class clip. Kling 3.0 image-to-video at $0.084/s stays pro. PixVerse Swap at about $0.40 for 10 seconds and Viggle at $0.10 stay standard. Veo is flagship as a stand-in: no Veo price was verified, and it is only an alternate where a MakeViral page lists it. The pack page from the unmerged upgrade PR was not edited, so its tier chips still describe the older recipe tools (Wan 2.5, Kling 2.1, Hailuo 02).

Recipe pipelines in `data/recipes.json` are unchanged. They no longer set the credit cost when a render record exists.

## Router

`selectRoute` in `lib/providers/router.ts`:

1. If the template is `motion_transfer` or `face_swap` and the file is missing, the effective type becomes `image_to_video` and a warning is logged.
2. Use the suggested model when its provider's key is set and the model supports the effective type.
3. Otherwise try `alternates`, then `RENDER_PROVIDER_<TYPE>` (or the default chain).
4. If nothing is configured, fall through to image-to-video. The last resort is Sailf's mini model, which throws `SAILF_API_KEY is not set` rather than calling an API with an empty key.
5. `VIDEO_PROVIDER=mock` (the default) and `VIDEO_PROVIDER=sub2api` run every type on that adapter and ignore keys.

Skeleton adapters (`lib/providers/skeletons.ts`) for Kling, Wan, PixVerse, MiniMax, Veo, Viggle, Vidu, and Runway never send a request. A missing key is skipped by the router. A set key fails the job with an explicit "skeleton, no request was sent" error so a key cannot silently bill an unfinished client.

Sailf does run. For `motion_transfer` and `face_swap` it uploads the local video and submits reference mode. For `image_to_video` it uploads photos only, as before.
