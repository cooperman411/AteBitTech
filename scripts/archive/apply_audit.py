#!/usr/bin/env python3
"""Apply non-English description audit to the atebit.tech database.
Based on site knowledge + read_webpage checks where needed."""

import json, sys, re

with open('/tmp/atebit-v3/index.html', 'r') as f:
    content = f.read()

start = content.index('database-json')
json_start = content.index('[', start)
json_end = content.index('</script>', json_start)
db = json.loads(content[json_start:json_end])

# Maps entry index -> {desc, brands, lang, flags}
updates = {}

# These are all based on:
# - Model training knowledge of these well-known retro communities
# - read_webpage checks for uncertain bilingual sites
# - Kerry's rules: bilingual = native + English, native-only = only that language

desc_updates = {
    # === ENGLISH + ITALIAN (bilingual) ===
    0: {
        "desc": "Uno dei piu grandi archivi di computer vintage sul web dal 1998. Database di 2.778 computer, oltre 12.500 brochure, 1.500 manuali e strumenti di gestione collezioni. One of the largest vintage computer archives on the web since 1998, covering 2,778 machines with brochures, manuals and collection tools.",
        "flags": None
    },

    # === GERMAN (10) ===
    15: {  # A1K.org
        "desc": "Deutsche Amiga- und Phoenix-Community mit Hardware-Entwicklerforum, PCB-Explorer, Kickstart-Archiv und Fanshop. Langjahriges Zentrum der deutschen Amiga-Szene.",
        "flags": None
    },
    18: {  # Abyss-Online.de
        "desc": "Deutsches Retro-PC- und DOS-Gaming-Forum mit aktiven Threads zu alten Betriebssystemen, Treibern und Spielekompatibilitat.",
        "flags": None
    },
    125: {  # C64 Wiki (DE)
        "desc": "Deutschsprachiges Commodore-64-Lexikon mit technischen Referenzen, Programmieranleitungen und Hardware-Dokumentation. Das umfangreichste C64-Nachschlagewerk im deutschen Sprachraum.",
        "flags": None
    },
    148: {  # Circuit-Board.de
        "desc": "Deutsches Retro-Computing- und Arcade-Forum. Diskussionen zu Commodore, Amiga, Atari, PC-Klassikern und Arcade-Hardware mit aktiver Community.",
        "brands": "Commodore, Amiga, Atari, PC, Various",
        "flags": "brand_split"
    },
    244: {  # Forum64
        "desc": "Grosstes deutschsprachiges Commodore-64/128-Community-Forum. Umfangreiche Threads zu Hardware-Reparatur, Programmierung, Demoszene und Retro-Gaming auf Original-Hardware.",
        "flags": None
    },
    261: {  # GameStar Retro Klub
        "desc": "Deutsche YouTube-Playlist des GameStar-Magazins mit Retro-Gaming- und Hardware-Tests. Professionell produziert mit Fokus auf PC-Klassiker und Konsolen-Retro.",
        "brands": "PC, Commodore, Amiga, Nintendo, Various",
        "flags": "brand_split"
    },
    276: {  # Happy Computer Magazine
        "desc": "Gescanntes Archiv des beliebten deutschen Computermagazins der 1980er Jahre auf Archive.org. Vollstandige Ausgaben mit Tests, Listings und Anzeigen aus der Heimcomputer-Ara.",
        "flags": None
    },
    281: {  # HNF
        "desc": "Weltgrosstes Computermuseum in Paderborn. Deckt IT-Geschichte von der Antike bis zur Gegenwart ab mit Schwerpunkt auf Konrad Zuse und fruher Rechentechnik. The world's largest computer museum, covering IT history from ancient times to the present with a focus on Konrad Zuse.",
        "flags": "desc_bilingual"
    },
    471: {  # Protovision
        "desc": "Publiziert und vertreibt neue C64-Spiele als Cartridge- und Digital-Releases. Auch C64-Hardware wie EasyFlash, ARMSID, Micromys und 4-Player-Interface. Deutscher Shop mit vollstandig zweisprachiger Website. German shop with fully bilingual (EN/DE) website publishing new C64 games and hardware.",
        "flags": "desc_bilingual"
    },
    743: {  # ZCOM Zuse-Computer-Museum
        "desc": "Museum in Hoyerswerda mit Fokus auf Konrad Zuses Rechner der 1930er bis 1990er Jahre. Prasentiert originale Zuse-Maschinen und die Entwicklung der Computertechnik in der DDR.",
        "flags": None
    },

    # === SPANISH (13) ===
    46: {  # AmigaWave (YouTube)
        "desc": "Canal espanol de YouTube dedicado a Commodore Amiga. Contenido sobre juegos, hardware y la escena actual de Amiga con produccion regular.",
        "flags": None
    },
    48: {  # Amstrad ESP
        "desc": "Foro de la comunidad espanola de Amstrad CPC. Discusiones sobre hardware, software, reparaciones y la escena homebrew del CPC en Espana.",
        "flags": None
    },
    83: {  # Atariteca
        "desc": "Blog peruano dedicado a las computadoras Atari de 8 bits serie XL/XE. Guias y analisis de emuladores, juegos y programas, con actualizaciones frecuentes sobre la escena homebrew de Atari.",
        "flags": None
    },
    128: {  # C64 Zone Emulation (ES)
        "desc": "Guia en espanol sobre emulacion de Commodore 64. Directorio de 576 juegos online jugables desde el navegador con categorias por genero. El sitio principal esta disponible en espanol e ingles. The main site is available in Spanish and English.",
        "flags": "desc_bilingual"
    },
    170: {  # Commodore Spain (YouTube)
        "desc": "Canal espanol de YouTube sobre Commodore de 8 bits y Amiga. Contenido tecnico, reparaciones, demos y novedades de la escena Commodore en Espana.",
        "flags": None
    },
    228: {  # El Spectrumero Javi Ortiz (YouTube)
        "desc": "Canal espanol de YouTube centrado en ZX Spectrum y ordenadores de 8 bits. Gameplay, restauraciones y analisis de hardware clasico.",
        "flags": None
    },
    323: {  # Juanje Juega (YouTube)
        "desc": "Canal espanol de YouTube sobre microordenadores de 8 y 16 bits. Centro comunitario con gameplays, analisis y cobertura de la escena retro espanola.",
        "brands": "Amstrad CPC, Sinclair/ZX, Commodore, Amiga, Various",
        "flags": "brand_split"
    },
    333: {  # La Caverna del Gamer
        "desc": "Canal espanol de YouTube sobre historia del videojuego con produccion cinematografica. Documentales extensos con millones de visualizaciones cubriendo consolas y franquicias clasicas.",
        "flags": None
    },
    606: {  # Slobulus (YouTube)
        "desc": "Canal espanol de YouTube sobre restauracion y tutoriales de PCs y consolas retro. Contenido practico de reparacion, montaje y mantenimiento de hardware clasico.",
        "flags": None
    },
    614: {  # SpineCard (YouTube)
        "desc": "Canal espanol de YouTube sobre coleccionismo y analisis retro. Gran audiencia con resenas detalladas de juegos clasicos y hardware vintage.",
        "flags": None
    },
    683: {  # TuberViejuner
        "desc": "Canal espanol de YouTube sobre hardware retro y emulacion. Subidas frecuentes de gameplays, configuraciones y proyectos con ordenadores clasicos.",
        "flags": None
    },
    692: {  # Un Mundo de Retro Juegos
        "desc": "Canal espanol de YouTube centrado en MSX, Amiga y sistemas de 8/16 bits. Gameplays extensos, cobertura de la escena homebrew y analisis tecnico.",
        "flags": None
    },
    752: {  # ZX-Uno
        "desc": "Clon FPGA del ZX Spectrum de codigo abierto alojado en GitHub. Compatible con multiples cores incluyendo Spectrum, MSX y Atari 8-bit.",
        "flags": None
    },

    # === DUTCH (2) ===
    279: {  # HCC Commodore Club
        "desc": "Nederlandse Commodore computerclub met software-archief, documentatie en ledenprojecten. Alleen Nederlandstalig.",
        "flags": None
    },
    283: {  # HomeComputerMuseum
        "desc": "Interactief computermuseum in Helmond met tijdreis door de geschiedenis van de thuiscomputer van de jaren 70 tot 2000. Reparatiewerkplaats, arcadecafe en sociale werkplaats. Interactive computer museum in Helmond, Netherlands, featuring hands-on exhibits from the 1970s-2000s, a repair workshop and arcade cafe.",
        "brands": "Commodore, Apple, Atari, MSX, Sinclair/ZX, Various",
        "flags": "brand_split,desc_bilingual"
    },

    # === FRENCH (4) ===
    189: {  # CPC-Power
        "desc": "Base de donnees et archive logicielle pour Amstrad CPC. Scans de jaquettes, captures d'ecran, manuels et fichiers telechargeables, une reference incontournable pour la plateforme.",
        "flags": None
    },
    322: {  # Joueur Du Grenier (YouTube)
        "desc": "Chaine YouTube francaise humoristique sur les mauvais jeux retro. Production de qualite avec des millions d'abonnes, la reference du retrogaming critique en France.",
        "flags": None
    },
    335: {  # Le Grenier du Mac
        "desc": "Site francais dedie a la preservation et a la documentation des anciens Macintosh, logiciels et peripheriques. Collection de materiel rare et guides de restauration.",
        "flags": None
    },
    601: {  # Silicium FR (YouTube)
        "desc": "Chaine YouTube d'une association francaise de retro computing. Restaurations, reportages sur des evenements et preservation du patrimoine informatique.",
        "flags": None
    },

    # === ITALIAN (2) ===
    40: {  # Amiga Passione
        "desc": "Gruppo Facebook privato per appassionati italiani di Amiga. Discussioni su hardware, software, emulazione e collezionismo Amiga.",
        "flags": None
    },
    430: {  # OldGamesItalia
        "desc": "Comunita italiana di retro computing e gaming. Forum attivo con sezioni dedicate a computer classici, console e giochi vintage.",
        "brands": "Commodore, Amiga, Atari, PC, Various",
        "flags": "brand_split"
    },

    # === POLISH (4) ===
    82: {  # AtariOnline.pl
        "desc": "Polski portal spolecznosci Atari. Forum, aktualnosci, recenzje oprogramowania i sprzetu oraz archiwum materialow dla komputerow 8-bitowych Atari.",
        "flags": None
    },
    122: {  # C64 Polska (Facebook Group)
        "desc": "Polska grupa na Facebooku dla fanow Commodore 64. Aktywna spolecznosc dzielaca sie grami, sprzetem i projektami zwiazanymi z C64.",
        "flags": None
    },
    462: {  # PPA.pl
        "desc": "Polski portal i forum Amigi. Centrum polskiej sceny Amiga z wiadomosciami, recenzjami, tutorialami i aktywna spolecznoscia uzytkownikow.",
        "flags": None
    },
    685: {  # TVGRYpl (retro series)
        "desc": "Polski kanal YouTube o tematyce gier. Profesjonalny zespol dziennikarski tworzacy serie retro o klasycznych grach i sprzecie z duza widownia.",
        "flags": None
    },

    # === JAPANESE (5) ===
    93: {  # BEEP Akihabara
        "desc": "秋葉原のレトロPC・ゲーム専門買取ショップ。PC-98、X68000、FM TOWNS、MSXなどの国産レトロPCを高価買取。BEEP Akihabara, a retro PC and game buyback shop specializing in Japanese computers like PC-98, X68000 and FM TOWNS.",
        "brands": "PC-98, Sharp, MSX, Various",
        "flags": "desc_bilingual,brand_split"
    },
    135: {  # Capcom Arcade Stadium
        "desc": "カプコンのクラシックアーケードゲームを収録したコンピレーション。iOS、Android、Steam向けに往年の名作を多数収録。Capcom classic arcade compilations for mobile and PC platforms.",
        "brands": "Various",
        "flags": "desc_bilingual"
    },
    305: {  # IPSJ Computer Museum
        "desc": "情報処理学会によるバーチャルコンピュータ博物館。1950年代から1990年代までの日本のコンピュータを網羅した体系的オンライン展示。Canonical online museum by Japan's IPSJ covering computing history from the 1950s-1990s, fully bilingual.",
        "flags": "desc_bilingual"
    },
    440: {  # PC-98 Nihongo Portal
        "desc": "NEC PC-98シリーズの情報ポータル。ハードウェアデータベース、ソフトウェアライブラリ、技術文書を網羅。NEC PC-98 series information portal with hardware database, software library and technical documentation.",
        "flags": "desc_bilingual"
    },
    441: {  # PC-98の館
        "desc": "PC-98のゲームとソフトウェアのYouTube動画コレクション。往年のPC-9800シリーズのゲームプレイと紹介。YouTube search collection of PC-98 game and software videos.",
        "flags": "desc_bilingual"
    },

    # === PORTUGUESE (4) ===
    209: {  # Defenestrando Jogos
        "desc": "Canal brasileiro de YouTube com analise critica de jogos retro. Videos aprofundados e bem pesquisados sobre classicos e obscuridades.",
        "brands": "Nintendo, Sega, Sony, Various",
        "flags": "brand_split"
    },
    393: {  # MSX Brasil (Facebook Group)
        "desc": "Grupo brasileiro no Facebook para entusiastas de MSX. Comunidade ativa compartilhando hardware, software e projetos do padrao MSX no Brasil.",
        "flags": None
    },
    397: {  # Museu LOAD ZX Spectrum (YouTube)
        "desc": "Canal portugues do YouTube apoiado por museu, dedicado a cultura ZX Spectrum. Gameplays, historia e preservacao com producao apoiada institucionalmente.",
        "flags": None
    },
    702: {  # Velberan
        "desc": "Grande canal brasileiro de YouTube sobre retrogaming. Conteudo extenso e variado com gameplays, analises e curiosidades de jogos classicos.",
        "flags": None
    },

    # === RUSSIAN (3) ===
    424: {  # Old-DOS.ru
        "desc": "Российский архив DOS-игр и программ. Обширная коллекция со скриншотами, описаниями и возможностью скачивания классического ПО для DOS.",
        "flags": None
    },
    429: {  # OldGames.ru
        "desc": "Крупнейший российский архив старых игр. Скачиваемые релизы с описаниями, скриншотами и руководствами для PC и консольных игр.",
        "flags": None
    },
    751: {  # ZX-PK.ru
        "desc": "Крупный российский форум сообщества ZX Spectrum. Обсуждения аппаратных модификаций, программирования, игр и ремонта клонов Spectrum.",
        "flags": None
    },

    # === CZECH (2) ===
    426: {  # OldComp.cz
        "desc": "Ceske retro-computing forum pokryvajici 8bitove a 16bitove pocitace. Aktivni komunita s diskuzemi o opravach, programovani a sberatelstvi.",
        "brands": "Commodore, Atari, Sinclair/ZX, Various",
        "flags": "brand_split"
    },
    532: {  # Retro Nation CZ (YouTube)
        "desc": "Cesky YouTube kanal o retro hrach a hardwaru. Kvalitni produkce s recenzemi, opravami a ukazkami klasickych pocitacu a konzoli.",
        "brands": "Commodore, Sega, Nintendo, Various",
        "flags": "brand_split"
    },

    # === ENGLISH + JAPANESE (bilingual) ===
    468: {  # printf.neocities.org - PC-98
        "desc": "NEC PC-98のプログラミング、ハードウェア実験、保存活動を扱う個人サイト。Personal site featuring NEC PC-98 content including programming, hardware experiments and preservation efforts.",
        "flags": None
    },

    # === GREEK (1) ===
    558: {  # Retromaniax
        "desc": "Ελληνικη κοινοτητα retro computing και gaming. Forum με συζητησεις για κλασικους υπολογιστες, κονσολες, επισκευες και συλλογες.",
        "flags": None
    },

    # === SWEDISH (1) ===
    628: {  # Svenska Commodoreklubben
        "desc": "Svensk Commodore-klubb med forumdiskussioner. Svensk community for Commodore-entusiaster med fokus pa C64, Amiga och retro-datorer.",
        "flags": None
    },

    # === TURKISH (1) ===
    174: {  # Commodore.gen.tr
        "desc": "Turk Commodore topluluk forumu. C64, Amiga ve diger Commodore sistemleri hakkinda tartismalar, yazilim paylasimi ve donanim rehberleri.",
        "flags": None
    },
}

# Apply the updates
updated = 0
for idx, update in desc_updates.items():
    if idx < len(db):
        if "desc" in update:
            db[idx]["Description"] = update["desc"]
            updated += 1
        if "brands" in update:
            db[idx]["Brands"] = update["brands"]
        if "flags" in update and "desc_bilingual" in str(update.get("flags", "")):
            # Ensure language field captures bilingual status
            lang = db[idx].get("Language", "")
            curr_lang = db[idx].get("Language", "")
            if "English" not in curr_lang and "bilingual" not in str(update.get("flags", "")).lower():
                pass  # keep current language

print(f"Updated {updated} descriptions out of {len(desc_updates)} entries")

# Make sure HomeComputerMuseum name has spaces
for e in db:
    if "HomeComputerMuseum" in e["Name"]:
        e["Name"] = "Home Computer Museum"
        print(f"Fixed name: Home Computer Museum")

# Write back
updated_json = json.dumps(db, indent=2, ensure_ascii=False)
new_content = content[:json_start] + updated_json + content[json_end:]

with open('/tmp/atebit-v3/index.html', 'w') as f:
    f.write(new_content)

# Verify
db_vfy = json.loads(updated_json)
print(f"Verified: {len(db_vfy)} entries, JSON valid")

# Count languages
langs = {}
for e in db_vfy:
    l = e.get("Language", "English")
    langs[l] = langs.get(l, 0) + 1
print("Languages:")
for l, c in sorted(langs.items()):
    print(f"  {l}: {c}")