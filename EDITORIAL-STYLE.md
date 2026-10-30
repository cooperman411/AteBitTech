# Directory Editorial Style

Ate Bit Tech is a curated directory of useful retro-computing resources. Descriptions explain what the linked resource provides, without promotion or copied event announcements.

- Write specific, factual descriptions of the destination itself. Aim for one or two useful sentences, normally 20–40 words per language. Do not pad simple entries or arbitrarily shorten useful ones.
- Mention the systems, software, collection or tools that make the destination relevant. Confirm substantive claims from the destination or a reliable primary source.
- Never copy exhibitor blurbs, marketing copy, scraped fragments or temporary event announcements into evergreen descriptions. Avoid ellipses standing in for missing text.
- Do not invent availability, language support, owners, prices, products, technical capabilities or current activity. Avoid hype and unsupported superlatives.
- If the linked website is primarily in a language other than English, write naturally in that language **first**, followed by a faithful English translation. Preserve accents and native scripts. For mainly English-language sites, an English description is sufficient.
- The `Language` field lists languages offered *on the destination site*, not the languages of the directory description. Keep the primary language first for non-English sites. Automatic third-party translation is not an independent native language option.
- Do not repeat the listing's Name at the start of its Description.

## Review workflow

1. Verify the live destination's purpose, relevant systems and primary language.
2. Classify it using [TAXONOMY.md](TAXONOMY.md), selecting only meaningful functions and brands.
3. Draft from verified facts and check for repetition, truncation, unnatural phrasing and language order.
4. Preserve stable IDs, record before/after differences and review changes in small batches.
5. Regenerate via `python3 scripts/build-directory.py --write` and validate using `python3 scripts/validate-site.py` and `python3 scripts/build-directory.py`.
6. Preserve the protected Price Guide and Worker files. Do not edit them as part of a directory cleanup.

Historical entries still contain inconsistencies. These standards govern new and edited entries; the remainder must be reviewed in future batches.
