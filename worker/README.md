# eBay Pricing Worker

Cloudflare Worker for the [Ate Bit Tech Price Guide](https://www.atebit.tech/store/). It returns active eBay Browse listings, preserves eBay Partner Network tracking, and classifies vintage items using eBay categories, titles, and prices. Sold-price comparisons are currently unavailable.

## Deploy

Update the existing `ebay-pricing` Worker. Set `EBAY_APP_ID` and `EBAY_CERT_ID` as Cloudflare Worker secrets through the authenticated dashboard or Wrangler secret commands. Enter the values through the secure prompts.

Upload the candidate with `npx wrangler versions upload` from this directory. Verify an active-listings search on the preview and then deploy that version. Keep the custom domain `pricing.atebit.tech` and the existing workers.dev route enabled.

## API

```text
GET https://pricing.atebit.tech/?q=Commodore+64&marketplace=EBAY_US
GET https://pricing.atebit.tech/?q=Commodore+64&category=162075&marketplace=EBAY_GB
```

A successful response includes `results`, `marketplace`, `currency`, and `priceGuideAvailable: false`. An empty search returns HTTP 200 with an empty `results` array. An eBay upstream error returns HTTP 502 with `code: "EBAY_UNAVAILABLE"`.
