# Directory Taxonomy

The allowed category, brand and language labels are in [data/taxonomy.json](data/taxonomy.json). Values are case-sensitive, separated by a comma and a space, with no duplicates.

| Category | Use when the linked resource chiefly provides | Do not assign just because |
|---|---|---|
| Communities & Forums | Forums, discussion groups, communities | A site links to a forum |
| Documentation & Wikis | Reference documents, technical articles, wikis | A page mentions specifications |
| Emulation & FPGA | Emulators, FPGA recreations, device emulation | A site discusses an emulator |
| Events & Shows | Festivals, meetings, historical technology shows | Someone appeared at an event |
| Hardware & Parts | Components, physical devices, kits, adapters | A site mentions hardware |
| Internet & Networking | Retro BBS and networking resources | A site has a web address |
| Museums & Exhibits | Curated historical museums and exhibitions | Someone displayed one computer |
| News & Blogs | Editorial news, magazines and blogs | A seller posts occasional news |
| Operating Systems | Operating systems and system software | A product is an emulator |
| Podcasts & Audio | Podcasts and audio-first computing shows | A video covers vintage equipment |
| Preservation & Archives | Preserved historical collections and media | A site offers one download |
| Repair & Services | Repair providers and dedicated repair resources | A video demonstrates a repair |
| Software & Games | Games, programs and software libraries | It is a complete operating system |
| Vendors & Stores | Sellers with active shop/catalog pages | A blog links to products |
| Web Tools & Browsers | Browsers and online tools | A page includes a search box |
| YouTube & Social Channels | Video channels and social community pages | A website links to YouTube |

## Selection rules

- Choose categories for **independently useful functions**, not incidental mentions. Usually one or two categories suffice; justify additional categories.
- Use brand labels for systems materially supported by the destination. For software, tag target systems; for stores, systems their products serve; for museums, material collection coverage.
- `Various` means broad or brand-independent coverage. Prefer it alone when picking arbitrary specific brands would mislead. Document exceptions before combining `Various` with named brands.
- Do not invent synonyms, punctuation variants or categories without updating the approved taxonomy and filters. Brand additions also require matching Classic Site pages.
- `Language` describes languages offered on the linked site. Record its primary language first, including a faithful English description after non-English text; a Google Translate link is not equivalent to native multilingual support.

## Validation

The site validator enforces allowed labels, no repeated labels and one syntactically plausible HTTP(S) primary URL. Human review is still required for factual category fit, translations and live availability. Existing historical quality problems are being addressed in controlled batches.
