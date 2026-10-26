import json

with open('/tmp/atebit-v3/index.html') as f:
    content = f.read()
s = content.index('database-json')
js = content.index('[', s)
je = content.index('</script>', js)
db = json.loads(content[js:je])

splits = {
    76: "Atari",        # Atari800 -> Atari 8-bit emulator
    80: "Atari",        # AtariArchives.org -> Atari books
    81: "Atari",        # AtariMax -> Atari flas
