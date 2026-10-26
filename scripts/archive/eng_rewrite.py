#!/usr/bin/env python3
"""Targeted rewrite of inadequate English descriptions + Various brand splits."""

import json

with open('/tmp/atebit-v3/index.html', 'r') as f:
    content = f.read()

start = content.index('database-json')
json_start = content.index('[', start)
json_end = content.index('</script>', json_start)
db = json.loads(content[json_start:json_end])

# Map of index -> new description for entries with fragment/inadequate descriptions
rewrites = {
    # --- Fragments /