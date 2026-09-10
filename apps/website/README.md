# KIRA website

Static marketing site for KIRA, meant to be deployed at **kira.vietx.xyz**.

No build step, no framework — plain HTML/CSS so it's fast, easy to review, and matches KIRA's
own calm/local-first design tokens (colors and type pulled from [`DESIGN.md`](../../DESIGN.md)).

```text
apps/website/
  index.html          Landing page
  policy/index.html   Privacy policy (served at /policy)
  assets/              Shared CSS, icon, screenshot
  vercel.json          Clean-URL config for Vercel
```

## Preview locally

```bash
npx serve apps/website
# or
python3 -m http.server --directory apps/website 4173
```

## Deploy to Vercel + kira.vietx.xyz

1. In Vercel, **New Project** → import the `vietx2811/kira` repo.
2. Set **Root Directory** to `apps/website`.
3. Framework preset: **Other** (no build command, no output directory needed — it's static).
4. Deploy. Vercel serves `/policy` from `policy/index.html` automatically (clean URLs are
   enabled via `vercel.json`).
5. In the Vercel project → **Settings → Domains**, add `kira.vietx.xyz`.
6. In your DNS provider for `vietx.xyz`, add the CNAME record Vercel shows you
   (typically `kira` → `cname.vercel-dns.com`).
7. Wait for DNS to propagate and Vercel to issue the certificate, then confirm
   `https://kira.vietx.xyz` and `https://kira.vietx.xyz/policy` both load.

## Before submitting the policy URL to Pinterest / Chrome Web Store

- The policy page currently lists `privacy@vietx.xyz` as the contact address
  (`policy/index.html`, bottom of the page). Update it to whatever inbox you actually want
  reviewers and users to reach — it's a plain `mailto:` link, no other wiring needed.
- Once the site is live, use `https://kira.vietx.xyz/policy` as the privacy policy URL in the
  Pinterest Developer app review form and/or the Chrome Web Store / Edge Add-ons listing (see
  [`apps/extension/STORE_LISTING.md`](../extension/STORE_LISTING.md), which was blocked on
  exactly this).
- Section 4 of the policy describes both current Pinterest handling (client-side CDN
  upscaling, no API) and how an optional Pinterest OAuth-based board/pin import would work.
  If the actual import feature ends up behaving differently before you ship it, update that
  section to match before pointing reviewers at it — the policy needs to describe real
  behavior, not aspirational behavior.
