# eBay Pricing Worker

Cloudflare Worker that proxies the eBay Browse API for atebit.tech/store/.

## Deploy

```bash
npx wrangler deploy
```

Or via Cloudflare API:
```bash
curl -X PUT \
  "https://api.cloudflare.com/client/v4/accounts/{account_id}/workers/scripts/ebay-pricing" \
  -H "Authorization: Bearer {token}" \
  -F "metadata=@wrangler.toml;type=application/json" \
  -F "ebay-pricing.js=@ebay-pricing.js;filename=worker.js;type=application/javascript+module"
```

## Features

- Per-category medians (systems vs parts vs merch)
- 5-tier badge pricing (DEAL/GOOD/FAIR/HIGH/WILD)
- 3-layer classification (eBay subcategory + title refinement + price sanity)
- 5-minute response caching via Cloudflare Cache API
- Full eBay Partner Network tracking parameters
- ItemId validation (numeric only, XSS prevention)
- Promise.allSettled for graceful API degradation
- Error logging via console.error

## API

```
GET https://ebay-pricing.coopernatural.workers.dev/?q=<search>
```

Returns JSON with `items` array, `marketMedian`, `categoryMedians`, `computerMedian`.
