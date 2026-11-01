# CutCheck: know before you cut

*Built for the YouCam API Skin AI & eCommerce VTO Hackathon, eCommerce VTO track.*

**Live app:** https://cutcheck-snowy.vercel.app

## Inspiration

It's a familiar moment. Someone saves a photo of a warrior cut: a sharp, textured crop with height on top. The barber cuts it faithfully. In the photo the hair was straight and dense; on them it's coily, and within a week the shape has fallen into something neither of them planned. The cut was fine. It was the wrong cut for that hair, and nothing in the process said so.

Hair try-on apps make this easier to get wrong, not harder. They will paste any style onto any head. The preview looks great, because the template's hair is doing the work, and the person walks into the salon with a picture their hair can't hold.

So we flipped the order. **Read the hair first, then decide which try-ons are worth showing.**

## What it does

CutCheck is a five-step journey: **Scan → Truth → See it → Wear it → Keep it.**

1. **Scan.** Three guided photos: straight on with shoulders in frame, then turned left and right. Each one is checked on the device for size, light, blur and framing before anything is uploaded. A photo that fails never leaves the phone.
2. **Truth.** YouCam reads hair type, length and frizz, and shows its own wording next to ours ("Coily to Extremely Coily"). You set density yourself, with a plain explanation of why. Every reading can be corrected. Then each trending cut gets a verdict:
   - **Go for it** ✓
   - **Doable, with a little help** ⚠ (for example, a volume product or a few weeks of growth)
   - **Not your hair's cut** ✗, always with the closest cut that does work
   - **We need one more answer**, when a reading is missing. We never guess.

   A top pick sits above the board with the reasons it won, plus a script you can read to your barber.
3. **See it.** Try a ✓ or ⚠ cut on your own photo with Hair Style VTO v2.1 and `hair_color: "src"`. The "your colour kept" badge appears only on templates that really keep it.
4. **Wear it.** With a separate consent, add a full-body photo and pick an occasion (everyday, interview or night out). The outfit comes from Clothes VTO and the shoes from Shoes VTO V3, in masculine or feminine styles.
5. **Keep it.** A product kit matched to your readings, a trim schedule, a demo-store cart, and a signed **stylist card** link with the cut notes and your readings, never a photo.

There are 19 cuts: 8 for men, 9 for women and 2 that work for both. One tap on "Delete" clears the session and asks YouCam to delete every task we started.

## How we built it

**The API chain.** Every YouCam call happens on our server. The browser never sees the key or a vendor URL.

| Step | YouCam API | What it decides |
|---|---|---|
| Truth | AI Hair Type Detection (3 photos) | Which cuts can hold their shape |
| Truth | AI Hair Length Detection (front photo) | What's possible today, since a cut can only go shorter |
| Truth | AI Hair Frizziness Detection (3 photos) | Definition, and whether an anti-frizz product joins the kit |
| See it | AI Hair Style VTO v2.1, `hair_color: "src"` | The cut in your own colour |
| Wear it | AI Clothes VTO (outfit templates) | The occasion look |
| Wear it | AI Shoes VTO V3 (`shoes-transfer`) | Shoes on the outfit result |

A scan costs 6 units, a try-on 2 and a look 4. Each paid call reserves its units in a Redis ledger first and settles to the real charge afterwards, so a failed task costs the budget nothing.

**A deterministic verdict engine.** No language model decides anything. Each cut in `data/cuts.json` lists the hair types it holds on, a minimum density, a minimum length and an optional frizz limit. The engine is a pure function:

- A type the cut doesn't hold on → ✗.
- Density one level short → ⚠ with a volume product; two levels short → ✗.
- Too short → ⚠ "grow first", with a time estimate. Length alone never gives a ✗.
- Frizz above the limit → ⚠, and an anti-frizz product joins the kit.
- The verdict is the worst finding, and every reason is listed.

The same inputs always give the same board, which means the rules can be published (see "How we decide" in the app) and argued with.

**Keep-your-colour, honestly.** Hair Style v2.1 can keep the user's own colour, but only on templates marked `keep_users_color`. We checked every template we use. Where a cut has no colour-keeping template, the badge doesn't show. Try-on also pastes the template's hair texture, which is how a curly-haired teammate once got a straight-hair preview. Now curly and coily hair only ever gets a curly model, and where a cut has none, the app says so instead of showing straight hair.

**Shoes V3 on an outfit.** The Look chain runs one step at a time from the browser: the clothes result feeds the shoes call. No server route chains two vendor tasks, so a slow step can't time out the whole look.

**Stack.** Next.js 16 on Vercel, Upstash Redis for rate limits and the unit ledger, sharp to re-encode every upload (EXIF and GPS stripped), MediaPipe for the on-device face and framing check, zod for every request body, Cloudflare Turnstile on the routes that take images, and GSAP with Lenis for motion.

## Challenges

Most of our time went into learning how the APIs really behave. These are the things we hit, all written up in `docs/API_NOTES.md`:

- **One selfie isn't enough.** Hair type and frizz need exactly three photos, in the order front, right, left. Sending one gives a 400. Our scan grew from one photo to four and then settled on three.
- **Density refused every angle we tried.** Across more than a dozen head-down shots at different tilts, sizes and crops, it returned `error_no_face` or `error_face_angle_invalid`. Rather than ship a reading that never comes back, density is now set by hand, with a short explanation.
- **Mirrored selfies.** Front cameras flip the image, so "turn left" can arrive as a right turn and type or frizz rejects the angle. On `error_face_angle_invalid` we now retry once with left and right swapped.
- **Frizz can run past 30 seconds.** The first run was still "running" at 33 s. We poll with a deadline, and a task that's still running is settled carefully instead of double-charged.
- **Case mismatch.** The docs list hair-type mappings in lower case ("4b to 4c"), but responses come back in upper case ("4B to 4C"). We match without regard to case.
- **Deleting a running task returns 400.** Deletion has to wait for a task to finish, so we track unfinished task ids and delete them later.
- **Length measures where the longest hair ends,** not the length on top. "Short hair" in YouCam's terms reaches the chin or shoulders, so we map it to medium, and the front photo has to show the shoulders.
- **Our own bug:** Upstash's client parses stored values as JSON by default. That silently corrupted the signed image tokens until we turned the parsing off.

## Honest limits

- **Small test set.** We tested on photos of our own team, not on a broad panel of hair types. The readings looked right on the hair we tried, but we haven't measured accuracy, and we won't claim to have.
- **No confidence scores.** The APIs don't return one, so every reading stays editable and we never show a made-up percentage.
- **Density is self-reported** until the Density API accepts a photo we can reliably capture.
- **The rules are our own styling heuristics,** written for CutCheck and published in the app. They are not a barber's judgement, and a try-on is a visual preview, not a guarantee of the real cut.
- **Limited units.** Public visitors get a clearly labelled demo built from real YouCam readings; judges get live calls through a code link.

## Accomplishments we're proud of

- An analysis step that **changes what the try-on offers**, instead of decorating it.
- Every ✗ comes with a reason in plain words and a closest alternative, so no one hits a dead end.
- Privacy by design: no images stored on our servers, readings kept in the browser tab, result images served only to the session that made them, and a delete button that reaches YouCam too.
- A cost model that holds on a tiny budget: per-session limits, a judge reserve that public traffic can't touch, and a demo mode that's honest about being one.
- Men's and women's cuts, curly-hair try-on models, and outfits for both.

## What's next

- **Salon embed.** A stylist sends the scan link before the appointment and the client arrives with their readings and a stylist card.
- **More cuts,** especially for women and for curly and coily hair, where try-on templates are fewest.
- **Brand kits.** Swap the demo products for a real catalogue, so the kit becomes a basket.
- **Density from a photo,** once we find a capture the API accepts.

## Built with

YouCam AI Hair Type, Length and Frizziness Detection · YouCam Hair Style VTO v2.1 · YouCam Clothes VTO · YouCam Shoes VTO V3 · Next.js · React · TypeScript · Tailwind CSS · Vercel · Upstash Redis · sharp · MediaPipe · zod · Cloudflare Turnstile · GSAP · Lenis · Playwright · Vitest

*Cosmetic styling guidance, not medical advice.*
