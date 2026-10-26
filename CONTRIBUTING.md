# Contributing

Ate Bit Tech is a hand-curated directory. Contributions are welcome, but every
entry is reviewed by a human before it goes live. Nothing is auto-published.

## What is useful

- **New resources.** A site, vendor, magazine, museum, emulator, forum, repair
  service, podcast, or archive that a retro-computing newcomer or veteran would
  actually use.
- **Dead or wrong links.** A 404, a domain that changed hands, a shop that
  closed, a channel that went silent.
- **Better descriptions.** Shorter, more specific, less marketing language.
- **Language and brand fixes.** An entry tagged `Various` that belongs to a
  specific brand, or a non-English site whose description should be in its own
  language.
- **Category and tag corrections.**

## What is not accepted

- **Paid placement.** No sponsored entries, no affiliate links, no "featured for
  a fee." The Price Guide is the only place affiliate links exist.
- **Marketing copy.** Descriptions are factual and specific. No hype, no
  superlatives, no keyword stuffing.
- **Link-only submissions** with no indication of what the resource is or why
  it belongs.

## How to submit

Open an issue, or email ** picks.favored4z @ icloud . com **. Either way,
include:

1. The URL.
2. A one- or two-sentence description of what is there.
3. Brand(s) and category you think it belongs in.
4. The primary language, if it is not English.
5. For a correction: the current entry name and what is wrong.

## Review standard

An entry is accepted when it is **active, relevant, accurate, and useful**:

- The site works and is still maintained.
- It is specifically about retro or vintage computing.
- The description is true of the site as it exists right now.
- It is assigned to the narrowest accurate brand rather than a catch-all.
  `Various` is a last resort, not a default.

Bilingual sites get both languages and a description in each. Non-English sites
keep their description in their primary language, with the language field set
correctly.

## The automated checks

Every push and pull request runs `.github/workflows/integrity.yml`, which calls
`python3 scripts/validate-site.py`. It is strict, and a red run blocks the merge.
It verifies:

- The entry count in `data/directory.json` matches `expectedEntryCount` in
  `site-integrity.json`.
- Every entry conforms to `data/directory.schema.json` — required fields,
  allowed fields, stable ID format, no duplicate name/URL pairs.
- Entries are alphabetically sorted by name.
- The embedded `database-json` block in `index.html` **exactly** matches
  `data/directory.json`.
- The no-JS fallback list, `classic/all.html`, the classic brand index counts,
  and each `classic/<brand>.html` page all match the data.
- The files pinned in `site-integrity.json` are unchanged: `store/index.html`,
  `worker/README.md`, `worker/ebay-pricing.js`, `worker/wrangler.toml`.

Practical consequences:

- To **add** an entry, update `data/directory.json` *and* bump
  `expectedEntryCount` in `site-integrity.json`, then regenerate the HTML with
  `python3 scripts/build-directory.py --write`.
- To touch a **pinned** file, update its SHA-256 in `site-integrity.json` in the
  same commit. Run `python3 scripts/build-directory.py` with no flags first; it
  is read-only and reports any drift without changing anything.
- Run `python3 scripts/validate-site.py` before opening a pull request. Passing
  locally is the fastest way to get a pull request merged.

## Licensing of contributions

By submitting a resource, correction, or description, you confirm you have the
right to share it and you license it under the same terms as the rest of the
directory: [CC BY-NC 4.0](CONTENT-LICENSE.md) for data, CC BY-NC-SA 4.0 for
written material. You keep whatever rights you already had; you are not signing
them away, and no exclusive rights are claimed over your contribution.

The site code is MIT-licensed; see [LICENSE](LICENSE).
