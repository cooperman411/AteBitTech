#!/usr/bin/env python3
"""Regenerate directory HTML from data/directory.json.

The default mode is read-only and reports whether generated output differs from
the checked-in site. Pass --write explicitly to replace differing outputs.
"""

from __future__ import annotations

import argparse
import html
import json
from pathlib import Path
import re
import sys


ROOT = Path(__file__).resolve().parent.parent
DATA_PATH = ROOT / "data" / "directory.json"


def load_entries() -> list[dict[str, str]]:
    entries = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    if not isinstance(entries, list):
        raise ValueError("data/directory.json must contain an array")
    return entries


def classic_row(entry: dict[str, str]) -> str:
    return (
        '<li><span class="entry-title"><a href="{}">{}</a></span>'
        '<div class="entry-desc">{}</div></li>'
    ).format(
        html.escape(entry["URL"], quote=True),
        html.escape(entry["Name"], quote=True),
        html.escape(entry["Description"], quote=True),
    )


def modern_fallback(entries: list[dict[str, str]]) -> str:
    rows = []
    for entry in entries:
        rows.append(
            '<li><a href="{}">{}</a><p>{}</p></li>'.format(
                html.escape(entry["URL"], quote=True),
                html.escape(entry["Name"], quote=False),
                html.escape(entry["Description"], quote=False),
            )
        )
    return (
        '<noscript id="noscript-fallback"><div>'
        '<h2>All Entries (No‑JavaScript Fallback)</h2><ul>'
        + "".join(rows)
        + "</ul></div></noscript>"
    )


def replace_once(source: str, pattern: str, replacement: str, label: str) -> str:
    updated, count = re.subn(pattern, lambda _: replacement, source, count=1, flags=re.DOTALL)
    if count != 1:
        raise ValueError(f"expected one {label}; found {count}")
    return updated


def render_modern(source: str, entries: list[dict[str, str]]) -> str:
    serialized = json.dumps(entries, indent=2, ensure_ascii=False)
    source = replace_once(
        source,
        r'(<script id="database-json" type="application/json">).*?(</script>)',
        '<script id="database-json" type="application/json">' + serialized + "</script>",
        "embedded database",
    )
    source = replace_once(
        source,
        r'<noscript id="noscript-fallback">.*?</noscript>',
        modern_fallback(entries),
        "noscript fallback",
    )
    total = str(len(entries))
    source = re.sub(r"Hand-curated directory of \d+ retro", f"Hand-curated directory of {total} retro", source)
    source = re.sub(r"Directory of \d+ curated entries", f"Directory of {total} curated entries", source)
    source = re.sub(r'("numberOfItems": )\d+', rf"\g<1>{total}", source)
    return source


def replace_classic_list(source: str, entries: list[dict[str, str]]) -> str:
    rendered = "<ul>\n" + "\n".join(classic_row(entry) for entry in entries) + "\n</ul>"
    return replace_once(source, r"<ul>\n.*?\n</ul>", rendered, "classic entry list")


def brand_links(source: str) -> list[tuple[str, str]]:
    pattern = re.compile(
        r'<a class="brand-block" href="([^"]+)">(.*?) \(\d+\)</a>',
        flags=re.DOTALL,
    )
    return [(href, html.unescape(re.sub(r"<[^>]*>", "", label)).strip()) for href, label in pattern.findall(source)]


def render_classic_index(
    source: str, entries_by_brand: dict[str, list[dict[str, str]]], total: int
) -> str:
    pattern = re.compile(
        r'(<a class="brand-block" href="[^"]+">)(.*?)( \()\d+(\)</a>)',
        flags=re.DOTALL,
    )

    def update_count(match: re.Match[str]) -> str:
        brand = html.unescape(re.sub(r"<[^>]*>", "", match.group(2))).strip()
        if brand not in entries_by_brand:
            raise ValueError(f"classic index contains unknown brand: {brand}")
        return f"{match.group(1)}{match.group(2)}{match.group(3)}{len(entries_by_brand[brand])}{match.group(4)}"

    source = pattern.sub(update_count, source)
    source = re.sub(
        r'(<a href="all\.html">All Entries \()\d+(\)</a>)',
        rf"\g<1>{total}\g<2>",
        source,
    )
    return source


def proposed_outputs(entries: list[dict[str, str]]) -> dict[Path, str]:
    outputs: dict[Path, str] = {}
    index_path = ROOT / "index.html"
    outputs[index_path] = render_modern(index_path.read_text(encoding="utf-8"), entries)

    classic_index_path = ROOT / "classic" / "index.html"
    classic_index = classic_index_path.read_text(encoding="utf-8")
    entries_by_brand: dict[str, list[dict[str, str]]] = {}
    for entry in entries:
        for brand in entry["Brands"].split(","):
            entries_by_brand.setdefault(brand.strip(), []).append(entry)

    links = brand_links(classic_index)
    indexed_brands = {brand for _, brand in links}
    if indexed_brands != set(entries_by_brand):
        raise ValueError(
            "classic brand index and data brands differ: "
            f"missing={sorted(set(entries_by_brand) - indexed_brands)}, "
            f"extra={sorted(indexed_brands - set(entries_by_brand))}"
        )
    outputs[classic_index_path] = render_classic_index(classic_index, entries_by_brand, len(entries))

    all_path = ROOT / "classic" / "all.html"
    all_source = replace_classic_list(all_path.read_text(encoding="utf-8"), entries)
    all_source = re.sub(r"(<strong>)\d+( entries</strong>)", rf"\g<1>{len(entries)}\g<2>", all_source)
    outputs[all_path] = all_source

    for href, brand in links:
        path = ROOT / "classic" / href
        if not path.is_file():
            raise ValueError(f"classic brand page is missing: classic/{href}")
        source = replace_classic_list(path.read_text(encoding="utf-8"), entries_by_brand[brand])
        source = re.sub(
            r"(<strong>)\d+( entries</strong>)",
            rf"\g<1>{len(entries_by_brand[brand])}\g<2>",
            source,
        )
        outputs[path] = source
    return outputs


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--write",
        action="store_true",
        help="replace differing generated outputs; default is comparison only",
    )
    args = parser.parse_args()

    try:
        outputs = proposed_outputs(load_entries())
    except (OSError, ValueError, json.JSONDecodeError, KeyError) as error:
        print(f"ERROR: {error}")
        return 2

    changed = [path for path, proposed in outputs.items() if path.read_text(encoding="utf-8") != proposed]
    if not changed:
        print(f"Generated output matches all {len(outputs)} current files exactly.")
        return 0

    print(f"Generated output differs in {len(changed)} file(s):")
    for path in changed:
        print(f"- {path.relative_to(ROOT)}")
    if not args.write:
        print("Comparison only: no production files were replaced.")
        return 1

    for path in changed:
        path.write_text(outputs[path], encoding="utf-8")
    print(f"Updated {len(changed)} generated file(s).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
