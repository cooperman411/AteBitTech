#!/usr/bin/env python3
"""Read-only integrity checks for AteBit.Tech.

This validator never writes production files. It checks the embedded directory
data, its static HTML representations, and fingerprints for the protected Price
Guide and Cloudflare Worker.
"""

from __future__ import annotations

from collections import Counter
import hashlib
import html
import json
from pathlib import Path
import re
import sys
from typing import Any


ROOT = Path(__file__).resolve().parent.parent
CONFIG_PATH = ROOT / "site-integrity.json"
DATA_PATH = ROOT / "data" / "directory.json"
SCHEMA_PATH = ROOT / "data" / "directory.schema.json"


class Report:
    def __init__(self) -> None:
        self.passed = 0
        self.errors: list[str] = []

    def ok(self, message: str) -> None:
        self.passed += 1
        print(f"PASS: {message}")

    def error(self, message: str) -> None:
        self.errors.append(message)
        print(f"FAIL: {message}")


def read_text(relative_path: str) -> str:
    return (ROOT / relative_path).read_text(encoding="utf-8")


def sha256(relative_path: str) -> str:
    digest = hashlib.sha256()
    with (ROOT / relative_path).open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def plain_text(value: str) -> str:
    return html.unescape(re.sub(r"<[^>]*>", "", value)).strip()


def extract_main_database(source: str) -> list[dict[str, Any]]:
    match = re.search(
        r'<script\b[^>]*\bid=["\']database-json["\'][^>]*>(.*?)</script>',
        source,
        flags=re.DOTALL | re.IGNORECASE,
    )
    if not match:
        raise ValueError("index.html has no script element with id=database-json")
    value = json.loads(match.group(1))
    if not isinstance(value, list):
        raise ValueError("database-json must contain a JSON array")
    if not all(isinstance(entry, dict) for entry in value):
        raise ValueError("every database entry must be a JSON object")
    return value


def extract_list_rows(source: str, description_tag: str) -> list[tuple[str, str, str]]:
    rows: list[tuple[str, str, str]] = []
    for item in re.findall(r"<li\b[^>]*>(.*?)</li>", source, flags=re.DOTALL | re.IGNORECASE):
        link = re.search(
            r'<a\b[^>]*\bhref=["\']([^"\']*)["\'][^>]*>(.*?)</a>',
            item,
            flags=re.DOTALL | re.IGNORECASE,
        )
        if not link:
            continue
        description = re.search(
            description_tag,
            item,
            flags=re.DOTALL | re.IGNORECASE,
        )
        rows.append(
            (
                plain_text(link.group(2)),
                html.unescape(link.group(1)),
                plain_text(description.group(1)) if description else "",
            )
        )
    return rows


def expected_rows(entries: list[dict[str, Any]]) -> Counter[tuple[str, str, str]]:
    return Counter(
        (
            str(entry.get("Name", "")).strip(),
            str(entry.get("URL", "")).strip(),
            str(entry.get("Description", "")).strip(),
        )
        for entry in entries
    )


def compare_rows(
    report: Report,
    label: str,
    actual: list[tuple[str, str, str]],
    expected: Counter[tuple[str, str, str]],
) -> None:
    actual_counter = Counter(actual)
    if actual_counter == expected:
        report.ok(f"{label} matches all {sum(expected.values())} source entries")
        return
    missing = sum((expected - actual_counter).values())
    extra = sum((actual_counter - expected).values())
    report.error(
        f"{label} is out of sync: {len(actual)} rendered rows, "
        f"{missing} missing/stale source rows, {extra} extra/stale rendered rows"
    )


def check_protected_files(report: Report, config: dict[str, Any]) -> None:
    protected = config["protectedFiles"]
    for relative_path, expected_hash in protected.items():
        path = ROOT / relative_path
        if not path.is_file():
            report.error(f"protected file is missing: {relative_path}")
        elif sha256(relative_path) != expected_hash:
            report.error(f"protected file changed: {relative_path}")
        else:
            report.ok(f"protected file unchanged: {relative_path}")

    for relative_directory, expected_files in config["protectedDirectories"].items():
        directory = ROOT / relative_directory
        actual_files = sorted(
            path.relative_to(ROOT).as_posix()
            for path in directory.rglob("*")
            if path.is_file()
        )
        if actual_files == sorted(expected_files):
            report.ok(f"protected directory inventory unchanged: {relative_directory}/")
        else:
            report.error(
                f"protected directory inventory changed: {relative_directory}/ "
                f"(expected {sorted(expected_files)}, found {actual_files})"
            )


def check_database(
    report: Report,
    config: dict[str, Any],
    schema: dict[str, Any],
    entries: list[dict[str, Any]],
) -> None:
    expected_count = config["expectedEntryCount"]
    if len(entries) == expected_count:
        report.ok(f"main database contains {expected_count} entries")
    else:
        report.error(
            f"main database count is {len(entries)}; baseline expects {expected_count}"
        )

    item_schema = schema["items"]
    required = set(item_schema["required"])
    allowed = set(item_schema["properties"])
    invalid: list[str] = []
    for position, entry in enumerate(entries, start=1):
        missing = sorted(required - set(entry))
        unexpected = sorted(set(entry) - allowed)
        if missing or unexpected:
            invalid.append(
                f"entry {position} ({entry.get('Name', 'unnamed')}): "
                f"missing={missing}, unexpected={unexpected}"
            )
    if invalid:
        report.error(f"{len(invalid)} entries violate the directory field schema")
        for detail in invalid[:10]:
            print(f"      {detail}")
    else:
        report.ok("all entries use fields allowed by the expanded directory schema")

    optional_type_errors: list[str] = []
    ids: list[str] = []
    url_fields = ("Wikipedia", "YouTube", "Reddit")
    for position, entry in enumerate(entries, start=1):
        name = entry.get("Name", "unnamed")
        if "ID" in entry:
            value = entry["ID"]
            if not isinstance(value, str) or not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", value):
                optional_type_errors.append(f"entry {position} ({name}): invalid ID")
            else:
                ids.append(value)
        for field in url_fields:
            if field in entry and not isinstance(entry[field], str):
                optional_type_errors.append(f"entry {position} ({name}): {field} must be a string")
        if "GitHub" in entry and (
            not isinstance(entry["GitHub"], list)
            or not all(isinstance(value, str) for value in entry["GitHub"])
            or len(entry["GitHub"]) != len(set(entry["GitHub"]))
        ):
            optional_type_errors.append(f"entry {position} ({name}): GitHub must be a unique string array")
        if "CommunityLinks" in entry:
            links = entry["CommunityLinks"]
            valid_links = isinstance(links, list) and all(
                isinstance(link, dict)
                and set(link).issubset({"Type", "Label", "URL"})
                and {"Type", "URL"}.issubset(link)
                and link["Type"] in {"forum", "discord", "community"}
                and isinstance(link["URL"], str)
                and ("Label" not in link or isinstance(link["Label"], str))
                for link in links
            )
            if not valid_links:
                optional_type_errors.append(f"entry {position} ({name}): invalid CommunityLinks")
        if "Featured" in entry and not isinstance(entry["Featured"], bool):
            optional_type_errors.append(f"entry {position} ({name}): Featured must be boolean")
        if "LastReviewed" in entry and (
            not isinstance(entry["LastReviewed"], str)
            or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", entry["LastReviewed"])
        ):
            optional_type_errors.append(f"entry {position} ({name}): LastReviewed must be YYYY-MM-DD")

    duplicate_ids = [value for value, count in Counter(ids).items() if count > 1]
    if duplicate_ids:
        optional_type_errors.append(f"duplicate stable IDs: {duplicate_ids}")
    if optional_type_errors:
        report.error(f"{len(optional_type_errors)} optional metadata schema violations")
        for detail in optional_type_errors[:10]:
            print(f"      {detail}")
    else:
        report.ok("optional metadata fields conform to the expanded schema")

    keys = [(str(entry.get("Name", "")).strip(), str(entry.get("URL", "")).strip()) for entry in entries]
    duplicates = [key for key, count in Counter(keys).items() if count > 1]
    if duplicates:
        report.error(f"database contains {len(duplicates)} duplicate Name/URL pairs")
    else:
        report.ok("database contains no duplicate Name/URL pairs")


def check_main_static_content(
    report: Report, source: str, entries: list[dict[str, Any]]
) -> None:
    rows = expected_rows(entries)
    fallback = re.search(
        r'<noscript\b[^>]*\bid=["\']noscript-fallback["\'][^>]*>(.*?)</noscript>',
        source,
        flags=re.DOTALL | re.IGNORECASE,
    )
    if not fallback:
        report.error("main page has no noscript fallback")
    else:
        compare_rows(
            report,
            "main noscript fallback",
            extract_list_rows(fallback.group(1), r"<p\b[^>]*>(.*?)</p>"),
            rows,
        )

    stale_counts = sorted(set(re.findall(r"\b\d{3}\b", source)) - {str(len(entries))})
    stale_entry_counts = [count for count in stale_counts if count == "739"]
    if stale_entry_counts:
        occurrences = len(re.findall(r"\b739\b", source))
        report.error(
            f"main page contains {occurrences} stale references to 739 entries; "
            f"the database contains {len(entries)}"
        )
    else:
        report.ok("main page has no known stale 739-entry references")

    duplicate_declaration = re.search(
        r"(^[ \t]*(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=.*;[ \t]*$)\s*\n"
        r"[ \t]*(?:const|let)\s+\2\s*=.*;[ \t]*$",
        source,
        flags=re.MULTILINE,
    )
    if duplicate_declaration:
        report.error(
            f"main page has an adjacent duplicate JavaScript declaration: "
            f"{duplicate_declaration.group(2)}"
        )
    else:
        report.ok("main page has no adjacent duplicate JavaScript declarations")


def extract_brand_index(source: str) -> list[tuple[str, str, int]]:
    links: list[tuple[str, str, int]] = []
    pattern = re.compile(
        r'<a\b[^>]*\bclass=["\'][^"\']*\bbrand-block\b[^"\']*["\']'
        r'[^>]*\bhref=["\']([^"\']+)["\'][^>]*>(.*?)\s+\((\d+)\)</a>',
        flags=re.DOTALL | re.IGNORECASE,
    )
    for href, label, count in pattern.findall(source):
        links.append((html.unescape(href), plain_text(label), int(count)))
    return links


def check_classic(
    report: Report, entries: list[dict[str, Any]]
) -> None:
    all_rows = extract_list_rows(
        read_text("classic/all.html"),
        r'<div\b[^>]*\bclass=["\'][^"\']*\bentry-desc\b[^"\']*["\'][^>]*>(.*?)</div>',
    )
    compare_rows(report, "classic/all.html", all_rows, expected_rows(entries))

    expected_by_brand: dict[str, Counter[tuple[str, str, str]]] = {}
    for entry in entries:
        row = (
            str(entry.get("Name", "")).strip(),
            str(entry.get("URL", "")).strip(),
            str(entry.get("Description", "")).strip(),
        )
        for brand in str(entry.get("Brands", "")).split(","):
            expected_by_brand.setdefault(brand.strip(), Counter())[row] += 1

    links = extract_brand_index(read_text("classic/index.html"))
    indexed_brands = {brand for _, brand, _ in links}
    missing_brands = sorted(set(expected_by_brand) - indexed_brands)
    if missing_brands:
        report.error(f"classic brand index omits brands: {missing_brands}")
    else:
        report.ok("classic brand index includes every database brand")

    for href, brand, published_count in links:
        path = ROOT / "classic" / href
        expected = expected_by_brand.get(brand)
        if expected is None:
            report.error(f"classic brand index has unknown brand: {brand}")
            continue
        if published_count != sum(expected.values()):
            report.error(
                f"classic index count for {brand} is {published_count}; "
                f"database expects {sum(expected.values())}"
            )
        if not path.is_file():
            report.error(f"classic brand link has no target file: classic/{href}")
            continue
        actual = extract_list_rows(
            path.read_text(encoding="utf-8"),
            r'<div\b[^>]*\bclass=["\'][^"\']*\bentry-desc\b[^"\']*["\'][^>]*>(.*?)</div>',
        )
        if Counter(actual) != expected:
            missing = sum((expected - Counter(actual)).values())
            extra = sum((Counter(actual) - expected).values())
            report.error(
                f"classic/{href} is out of sync for {brand}: "
                f"{missing} missing and {extra} extra/stale rows"
            )


def main() -> int:
    report = Report()
    try:
        config = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
        schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
        source = read_text("index.html")
        entries = json.loads(DATA_PATH.read_text(encoding="utf-8"))
        embedded_entries = extract_main_database(source)
    except (OSError, ValueError, json.JSONDecodeError) as error:
        print(f"FATAL: {error}")
        return 2

    check_protected_files(report, config)
    check_database(report, config, schema, entries)
    if entries == embedded_entries:
        report.ok("data/directory.json exactly matches the embedded main database")
    else:
        report.error("data/directory.json differs from the embedded main database")
    check_main_static_content(report, source, entries)
    check_classic(report, entries)

    print()
    print(f"Integrity summary: {report.passed} passed, {len(report.errors)} failed")
    if report.errors:
        print("Existing integrity issues require review; no files were modified by this check.")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
