# YouCam API notes

What we observed while building CutCheck against the YouCam API (India region, base URL `https://yce-api-01.makeupar.com`, set with `YOUCAM_BASE_URL`), between 30 October and 2 November 2026. Where a point comes from the docs and we didn't confirm it in a live response, it says so. Redacted sample responses are in [`api-samples/`](api-samples). The probe script that captured them is [`scripts/probe-youcam.ts`](../scripts/probe-youcam.ts).

## Auth and the call pattern

- Every call uses `Authorization: Bearer <API key>`. No API secret is needed.
- **Upload:** `POST /s2s/v2.0/file` with `{files:[{content_type, file_name, file_size}]}` returns a `file_id` and a signed `PUT` URL. A 92 KB photo uploaded in about 1.3 s. One generic `file_id` works for every task we used, so a photo only has to be uploaded once.
- **Task:** `POST /s2s/v2.0/task/<feature>` returns a `task_id`. Poll `GET …/<feature>/<task_id>` until `task_status` is `success` or `error`. Results are in `data.results`.
- **Delete:** `POST /s2s/v2.0/task/delete {task_id}` deletes the task and its files. It returns 200 on a finished task but **400 `OperationInvalid` while the task is still running**, so we keep the ids of unfinished tasks and delete them later.

## Hair readings

| API | Request body | Photos | Result |
|---|---|---|---|
| Hair type | `src_file_ids`, **exactly 3**, in the order front, right, left | front, turned about 45° right, turned about 45° left | `hair_type.mapping` ("1 to 2a" … "4b to 4c") and `term` ("Straight to Slight Wavy" … "Coily to Extremely Coily") |
| Frizz | `src_file_ids`, exactly 3, same order | the same 3 | `hair_frizziness.mapping` 0–3 and `term` (Not Frizzy … Extreme Frizzy) |
| Length | `src_file_id` (one) | front, shoulders in frame | `hair_length.term`, for example "ear length" |
| Density | `src_file_id` (one) | head lowered, hairline visible (docs) | never succeeded for us, see below |

- **One selfie isn't enough.** Sending one id to type or frizz returns 400 `InvalidParameters`, at no charge.
- **Case differs from the docs.** The docs list mappings in lower case ("4b to 4c"), but responses come back in upper case ("4B to 4C"). We match without regard to case.
- **Timing.** Type took about 12 s and frizz about 17 s. Frizz once was still `running` at 33 s, so the scan polls with a 50 s deadline inside a 60 s function.
- **Mirrored selfies.** Front cameras flip the image, so a "turn left" photo can arrive looking like a right turn, and type or frizz then fails with `error_face_angle_invalid`. We retry once with left and right swapped.
- **Length measures where the longest hair ends,** not the length on top. YouCam's "short hair" reaches the chin or shoulders, so we map it to medium.
- **No confidence scores.** None of the readings return one, so CutCheck shows none and keeps every reading editable.
- **Density failed on every photo we tried.** A straight-on selfie gave `unknown_internal_error`. More than a dozen head-down shots at different tilts, sizes and crops gave `error_no_face`, and a cropped front photo gave `error_face_angle_invalid`. Failed tasks cost nothing. CutCheck asks the user to pick density instead.

## Hair Style VTO v2.1

- `POST /s2s/v2.1/task/hair-transfer` with `{src_file_id, template_id, hair_color: "src"}` finished in about 8 s. The result is a signed URL in `data.results.url`.
- The catalogue (`GET /s2s/v2.1/task/template/hair-transfer`, `page_size` at most 20) has 116 templates, 17 male and 99 female. Each has `id`, `title`, `category_name`, `thumb` and `keep_users_color`.
- `hair_color: "src"` only keeps the user's colour on templates where `keep_users_color` is true. The API accepts the field on other templates too and quietly ignores it, so CutCheck shows the "your colour kept" badge only where the template supports it. No male taper, fade or crop template keeps colour.
- The try-on pastes the template's hair texture as well as its shape. On curly or coily hair, a straight-haired template produces a straight-haired preview, so CutCheck uses curly templates for curly and coily users and says so when a cut has none.
- The v2.0 catalogue (81 templates) can't keep the user's colour on any template.

## Clothes VTO and Shoes VTO V3

- **Clothes:** `POST /s2s/v2.0/task/cloth` takes a full-body source photo and either a garment reference image or a `template_id`. The outfit catalogue (`GET /s2s/v2.0/task/template/cloth`) has 250 templates. We use three masculine and three feminine ones, listed in [`data/looks.json`](../data/looks.json), and skip templates that carry a real brand name.
- **Shoes V3:** `POST /s2s/v2.0/task/shoes-transfer` takes a source (`src_file_id` or `src_file_url`) and a shoe reference (`ref_file_id` or `ref_file_url`), and nothing else. We pass the clothes result as the source and our own shoe photo as the reference, so the shoes land on the outfit.

## Units

- Feature cost list: `GET /s2s/v2.0/credit/feature-cost` (free). Balance: `GET /s2s/v1.0/client/credit`.
- Observed charges: type 2, length 2, frizz 2, Hair Style 2, Clothes 2, Shoes 2. Density is listed at 1.
- Rejected creates (400) and failed tasks (`task_status: error`) cost nothing.
- So a CutCheck scan costs 6 units, a try-on 2 and a full look 4.

## Retention

- Files, `file_id`s and `task_id`s are kept for 30 days, then removed automatically (docs). Result URLs are valid for 2 hours.
- There is no separate file-delete endpoint; deleting a task removes its files.

## Errors we handled

- Create: 400 `InvalidParameters`, `CreditInsufficiency`; 401 `InvalidApiKey`; 429.
- Task: `error_no_face`, `error_face_angle_invalid`, `error_pose`, `error_decode_image`, `unknown_internal_error`.
- `page_size` above 20 on a catalogue call returns 400.
