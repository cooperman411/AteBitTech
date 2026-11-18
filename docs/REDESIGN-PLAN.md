# Ate Bit Tech redesign plan

## Direction

Phase 1 is a local homepage shell for review: compact pixel wordmark, dinosaur and pink diskette, pale slate teal surfaces, restrained copper, readable result rows and routes by system and task. Light and dark follow the device by default; visitors can choose a theme, return to device settings, and independently enable high contrast. Preserve the directory, filters and no-JavaScript fallback. The original light/dark mockup supplied on November 18 is the visual reference: compact header, large direct heading, system and task shortcuts, and horizontal directory rows. Its prominent search position is reserved for working keyword search in Phase 2. Shortcuts use the existing taxonomy rather than claiming a more specific filter than the data supports.

## Sequence

1. Homepage shell and appearance controls, with current filters and directory intact.
2. Keyword search across names, descriptions, systems and categories, with ranked name matches, aliases, accent folding, shareable URLs and browser history. Phase 2 is a local preview pending review and release approval.
3. Subsequent page and feature work only after scope and direction are agreed. Classic pages and directory data are outside Phase 1.

## Price Guide safeguards

Keep the homepage link to `/store/`. Preserve `store/index.html`, `worker/`, their inventory and integrity pins. Do not alter pricing.atebit.tech, Cloudflare routes or secrets. Validate the protected files and test the existing Price Guide separately before any future release that touches it. Asking prices must remain clearly labeled, and existing listing cards must survive thumbnail failures.

## Release gates

This is a local preview. Kerry must approve the design and explicitly approve any push, deployment or publication before it happens. Review the mockup alignment, both themes and phone layout, accessibility, filters, no-JavaScript browsing, the integrity check, the directory comparison and protected-file diff. Investigate the pre-existing generated count drift in `classic/amstrad-cpc.html` and `classic/commodore.html` separately; do not regenerate Classic pages as part of Phase 1.

## Phase 3 local preview

Search retains non-Latin text while folding Latin accents. About and Privacy share the homepage header and appearance controls. The homepage includes small C64 repair and Amiga parts starter selections from existing directory entries; contribution links use the existing email process. The generated Classic counts and sitemap were corrected. Before release, review the updated privacy policy and the wider privacy and compliance claims against actual hosting and analytics behavior, alongside the full design and storefront safeguards above.
