# Ate Bit Tech

A curated, searchable index of retro and vintage computing resources — from Amiga to ZX Spectrum and beyond — published at **https://atebit.tech**.
About: Community project. No affiliation with listed entities.

## Why
Centralize vendors, parts suppliers, magazines, emulators, museums, forums, and communities so newcomers and veterans can find what they need fast.

## Features
- Fast client-side filtering (category, brand of computer/console, language)
- No-JS fallback list for accessibility
- High-contrast toggle 
- Schema.org metadata for better search previews
- Privacy-first analytics: GoatCounter counts page views and country only — no cookies, no stored IP addresses, no personal data

## Stack
- Static HTML + Tailwind (CDN)
- Generated from `data/directory.json` — edit the data, then run `python3 scripts/build-directory.py --write`
- `python3 scripts/validate-site.py` verifies the data, the modern page, and all 45 classic pages stay in sync; it runs on every push via GitHub Actions
- Hosted on GitHub Pages

## License and Use
This repository mixes code and content, so two licenses apply:

- **Code** (site HTML, `scripts/`, `worker/`, workflow files): MIT.
- **Directory data and written content**: CC BY-NC 4.0 / CC BY-NC-SA 4.0 — free for non-commercial use with attribution.
- **Name, wordmark, artwork, and design**: all rights reserved.

Full scope table in [LICENSE](LICENSE). Attribution terms and a plain-English summary in [CONTENT-LICENSE.md](CONTENT-LICENSE.md). Contributions are welcome; see [CONTRIBUTING.md](CONTRIBUTING.md).

## Collaborate
Do you want to submit a new resource, or change or remove an existing one? 
Found a bad or incorrect link?
Want to discuss access or collaboration? Email ** picks.favored4z @ icloud . com **.

