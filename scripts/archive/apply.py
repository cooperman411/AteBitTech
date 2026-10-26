import json, re

with open('/tmp/atebit-v3/index.html') as f:
    content = f.read()
s = content.index('database-json')
js = content.index('[', s)
je = content.index('</script>', js)
db = json.loads(content[js:je])

changed_desc = 0
changed_brands = 0

for i, r in enumerate(db):
    lang = r.get('Language', 'English')
    name = r['Name']
    d = r.get('Description', '')
    brands = r.get('Brands', '')
    
    if lang != 'English':
        continue
    
    nd = d
    
    # --- Facebook Groups ---
    if '(Facebook Group)' in name or '(Facebook' in name:
        b = brands.replace(', ', ' & ')
        nd = f"Active {b} community for discussion, trading, help, and sharing."
        if nd != d:
            changed_desc += 1
    
    # --- Subreddits ---
    elif name.startswith('r/'):
        b = brands.replace(', ', ' & ')
        nd = f"{b} subreddit for discussion, help, buying and selling."
        if nd != d:
            changed_desc += 1
    
    # --- X/Twitter accounts ---
    elif ' (X)' in name and name != 'AkBKukU (X)':
        b = brands
        nd = f"{b} news, retro finds, and community on X/Twitter."
        if nd != d:
            changed_desc += 1
    
    # --- TikTok ---
    elif '(TikTok)' in name:
        nd = f"Retro gaming clips and highlights on TikTok."
        if nd != d:
            changed_desc += 1
    
    # --- Specific fragment fixes ---
    elif d == "Amstrad CPC" or d == "Amstrad CPC.":
        nd = "Active Amstrad CPC subreddit for discussion, help, hardware, and software."
        changed_desc += 1
    elif d == "MSX emulator" or d == "MSX emulator.":
        nd = "Open-source MSX emulator with high accuracy, supporting MSX1 through TurboR."
        changed_desc += 1
    elif d == "FPGA consoles" or d == "FPGA consoles.":
        nd = "High-end FPGA-based consoles that replicate classic systems with pixel-perfect accuracy."
        changed_desc += 1
    elif d == "Emulator Discord":
        nd = "Community Discord server for 86Box emulator support, development, and discussion."
        changed_desc += 1
    elif d == "Community links." or d == "Community links":
        nd = "PCem emulator community links and resources for vintage PC emulation."
        changed_desc += 1
    elif d == "DOS games history." or d == "DOS games history":
        nd = "DOS gaming history, screenshots, and nostalgia on X/Twitter."
        changed_desc += 1
    elif d == "Broad hashtag hub." or d == "Broad hashtag hub":
        nd = "Retro gaming highlights and community clips on TikTok."
        changed_desc += 1
    elif d == "Podcast + articles." or d == "Podcast + articles":
        nd = "Retronauts podcast and articles covering classic gaming history and retrospectives."
        changed_desc += 1
    elif d == "Music label for C64." or d == "Music label for C64":
        nd = "Music label producing and releasing Commodore 64 SID-based albums and remixes."
        changed_desc += 1
    elif d == "Diskmag + interviews." or d == "Diskmag + interviews":
        nd = "Scene World Magazine: disk magazine covering retro computing, demoscene, interviews, and news."
        changed_desc += 1
    elif d == "Community around WOS." or d == "Community around WOS":
        nd = "Community group around World of Spectrum for discussion, help, and game sharing."
        changed_desc += 1
    elif d == "Retro Nintendo & Sega." or d == "Retro Nintendo & Sega":
        nd = "RetroBreak covers classic Nintendo and Sega games, hardware, and collecting."
        changed_desc += 1
    elif d == "Retro Nintendo & gaming." or d == "Retro Nintendo & gaming":
        nd = "Wulff Den covers retro Nintendo hardware, mods, repairs, and gaming."
        changed_desc += 1
    elif d == "Acorn software and docs" or d == "Acorn software and docs.":
        nd = "Archive of Acorn BBC Micro and Electron software, documentation, and disk images."
        changed_desc += 1
    elif d == "DOS/Windows abandonware" or d == "DOS/Windows abandonware.":
        nd = "Archive of DOS and Windows abandonware, drivers, and vintage software."
        changed_desc += 1
    elif d == "Active Tandy community." or d == "Active Tandy community":
        nd = "Active Tandy/Radio Shack community for discussion, help, and hardware trading."
        changed_desc += 1
    elif d == "Community around MiSTer." or d == "Community around MiSTer":
        nd = "Community group for MiSTer FPGA discussion, setup help, core releases, and builds."
        changed_desc += 1
    elif d == "Project Discord on site." or d == "Project Discord on site":
        nd = "ScummVM project Discord for developer discussion, user support, and release updates."
        changed_desc += 1
    elif d == "Manuals, schematics, docs" or d == "Manuals, schematics, docs.":
        nd = "Massive archive of vintage computer manuals, schematics, and technical documentation."
        changed_desc += 1
    elif d == "PC retro hardware & games." or d == "PC retro hardware & games":
        nd = "LGR covers vintage PC hardware, oddware, thrifting, and retro PC gaming."
        changed_desc += 1
    elif d == "MS-DOS gaming and hardware" or d == "MS-DOS gaming and hardware.":
        nd = "Community for MS-DOS gaming, hardware builds, troubleshooting, and nostalgia."
        changed_desc += 1
    elif d == "MSX community forums" or d == "MSX community forums.":
        nd = "MSX Resource Center forums for MSX discussion, development, trading, and help."
        changed_desc += 1
    elif d == "BBC Micro documentation" or d == "BBC Micro documentation.":
        nd = "Comprehensive wiki covering BBC Micro hardware, software, programming, and expansions."
        changed_desc += 1
    elif d == "MRC community presence." or d == "MRC community presence":
        nd = "MSX Resource Center community on Facebook for MSX news, discussion, and sharing."
        changed_desc += 1
    elif d == "Subreddit for the Atari ST line":
        nd = "Atari ST/STE/TT/Falcon subreddit for discussion, help, demos, and hardware."
        changed_desc += 1
    elif d == "Subreddit for the Atari 2600":
        nd = "Atari 2600 subreddit for discussion, collecting, modding, and homebrew."
        changed_desc += 1
    elif d == "Subreddit for the ColecoVision.":
        nd = "ColecoVision subreddit for discussion, collecting, modding, and homebrew."
        changed_desc += 1
    elif d == "Subreddit for the Commodore 64/128.":
        nd = "Commodore 64/128 subreddit for discussion, demos, help, and hardware mods."
        changed_desc += 1
    elif d == "Subreddit for the Amiga line":
        nd = "Amiga subreddit for discussion across all models, OS variants, hardware, and games."
        changed_desc += 1
    elif d == "Subreddit for the ZX Spectrum":
        nd = "ZX Spectrum subreddit for discussion, games, hardware, and development."
        changed_desc += 1
    elif d == "Subreddit for the Atari 8-bit line":
        nd = "Atari 8-bit subreddit for discussion, programming, hardware mods, and collecting."
        changed_desc += 1
    elif d == "Subreddit for MSX computers":
        nd = "MSX subreddit for discussion across all MSX generations, hardware, and software."
        changed_desc += 1
    elif d == "Subreddit for the Sega Master System":
        nd = "Sega Master System subreddit for discussion, collecting, and game recommendations."
        changed_desc += 1
    elif d == "Subreddit for the Amstrad CPC":
        nd = "Amstrad CPC subreddit for discussion, programming, hardware, and games."
        changed_desc += 1
    elif d == "Subreddit for the Sega Saturn":
        nd = "Sega Saturn subreddit for discussion, collecting, imports, and hidden gems."
        changed_desc += 1
    elif d == "Subreddit for the TRS-80":
        nd = "TRS-80 subreddit for discussion, restoration, software, and Model I/II/III/4."
        changed_desc += 1
    elif d == "Subreddit for the NEC PC-98":
        nd = "NEC PC-98 subreddit for discussion, emulation, games, and Japanese computing."
        changed_desc += 1
    elif d == "Subreddit for the Sharp X68000":
        nd = "Sharp X68000 subreddit for discussion, games, emulation, and Japanese retro computing."
        changed_desc += 1
    elif d == "Subreddit for TI-99/4A.":
        nd = "TI-99/4A subreddit for discussion, programming, hardware, and software."
        changed_desc += 1
    elif d == "Subreddit for Atari Lynx and Jaguar.":
        nd = "Atari Lynx and Jaguar subreddit for discussion, collecting, and homebrew."
        changed_desc += 1
    elif d == "Subreddit for the FM Towns/Marty.":
        nd = "FM Towns and Marty subreddit for discussion, emulation, and Japanese PC gaming."
        changed_desc += 1
    elif d == "Subreddit for Be Inc./Haiku.":
        nd = "BeOS and Haiku subreddit for discussion, development, and Be nostalgia."
        changed_desc += 1
    elif d == "Subreddit for the Z80 CPU.":
        nd = "Z80 CPU subreddit for programming, hardware projects, and retro computing builds."
        changed_desc += 1
    elif d == "Subreddit for the 6502 CPU.":
        nd = "6502 CPU subreddit for assembly programming, hardware projects, and retro builds."
        changed_desc += 1
    elif d == "Subreddit for the 68000 CPU.":
        nd = "68000 CPU subreddit for programming, Amiga/Atari/classic Mac development."
        changed_desc += 1
    elif d == "Subreddit for classic PC gaming.":
        nd = "Classic PC gaming subreddit for DOS/Windows-era games, builds, and nostalgia."
        changed_desc += 1
    elif d == "Subreddit for retro PC gaming.":
        nd = "Retro PC gaming subreddit for DOS/Windows games, hardware builds, and nostalgia."
        changed_desc += 1
    elif d == "Subreddit for retro gaming in general.":
        nd = "General retro gaming subreddit covering all platforms, collecting, and nostalgia."
        changed_desc += 1

    # --- DVD/movie references (not retro computing) ---
    elif d.startswith("Broadcast television") or d.startswith("US entertainment"):
        # Skip - these are miscellaneous entries
        pass

    r['Description'] = nd
    
    # --- Various brand splits ---
    if 'Various' in (brands.split(', ') if brands else []):
        url = r.get('URL', '').lower()
        name_l = name.lower()
        
        # Pattern-based brand detection
        new_b = []
        
        if 'apple' in url or 'macintosh' in url or 'mac64' in url or 'powerpc' in url:
            new_b.append('Apple')
        if 'amiga' in url or 'amiga' in name_l:
            new_b.append('Amiga')
        if 'commodore' in url or 'c64' in url or 'c128' in url or 'vic-20' in url or 'vic20' in url or 'pet ' in url:
            new_b.append('Commodore')
        if 'atari' in url or 'atari' in name_l:
            new_b.append('Atari')
        if 'zx' in url or 'spectrum' in url or 'speccy' in url or 'zx81' in url or 'sinclair' in url:
            new_b.append('Sinclair/ZX')
        if 'msx' in url or 'msx' in name_l:
            new_b.append('MSX')
        if 'pc-98' in url or 'pc98' in url or 'pc-88' in url or 'nec ' in url:
            new_b.append('PC-98')
        if 'sega' in url or 'genesis' in url or 'megadrive' in url or 'dreamcast' in url or 'saturn' in url:
            new_b.append('Sega')
        if 'nintendo' in url or 'nes' in url or 'snes' in url or 'famicom' in url or 'gameboy' in url:
            new_b.append('Nintendo')
        if 'ibm' in url or 'pc-' in url or 'dos' in url or '386' in url or '486' in url or 'x86' in url:
            new_b.append('IBM')
        if 'ti-99' in url or 'ti99' in url or 'ti ' in url:
            new_b.append('TI')
        if 'amstrad' in url or 'cpc' in url:
            new_b.append('Amstrad')
        if 'bb' in name_l and 'micro' in name_l:
            new_b.append('Acorn/BBC')
        if 'oric' in url or 'oric' in name_l:
            new_b.append('Oric')
        if 'archimedes' in url or 'archimedes' in name_l:
            new_b.append('Acorn/BBC')
        if 'acorn' in url or 'electron' in url:
            new_b.append('Acorn/BBC')
        if 'tandy' in url or 'trs' in url or 'coco' in url:
            new_b.append('Tandy/Radio Shack')
        if 'vectrex' in url or 'vectrex' in name_l:
            new_b.append('Vectrex')
        if 'coleco' in url:
            new_b.append('Coleco')
        if 'dragon' in url and '32' in url or 'dragon' in name_l:
            new_b.append('Dragon')
        if 'intellivision' in url:
            new_b.append('Intellivision')
        if 'sony' in url or 'playstation' in url or 'ps1' in url:
            new_b.append('Sony')
        if 'pc-engin' in url or 'turbografx' in url or 'tg16' in url:
            new_b.append('Various')
        
        if new_b:
            # Deduplicate
            seen = set()
            dedup = []
            for b in new_b:
                if b not in seen:
                    seen.add(b)
                    dedup.append(b)
            # Keep Various if we found fewer than 3 brands
            old_set = set(brands.split(', '))
            if 'Various' in old_set and len(dedup) < 3:
                dedup.append('Various')
            new_brands = ', '.join(dedup)
            if new_brands != brands:
                r['Brands'] = new_brands
                changed_brands += 1

print(f"Description changes: {changed_desc}")
print(f"Brand changes: {changed_brands}")

# Write updated JSON
new_json = json.dumps(db, indent=2, ensure_ascii=False)
before = content[:js]
after = content[je:]
new_content = before + new_json + after

with open('/tmp/atebit-v3/index.html', 'w') as f:
    f.write(new_content)

# Verify
with open('/tmp/atebit-v3/index.html') as f:
    vc = f.read()
vs = vc.index('database-json')
vjs = vc.index('[', vs)
vje = vc.index('</script>', vjs)
vdb = json.loads(vc[vjs:vje])
print(f"Verified: {len(vdb)} entries, JSON valid")
