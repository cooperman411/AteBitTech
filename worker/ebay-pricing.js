// Ate Bit Tech — eBay Pricing Worker v3
// Two-mode price guide:
//   Mode A (price guide ON):  ?q=BRAND+KEYWORD&category=SINGLE_CAT_ID
//   Mode B (price guide OFF): ?q=KEYWORD (no category param)
// Per-category medians, 5-tier badges, full tracking params, caching
// v3.3: Fixed "+" bundle false positive (A500+), added game/software detection,
//       added Amiga-specific parts to tier1 (scandoubler, gotek, kickstart, PSU),
//       price override at $150 without requiring "computer" in title, slash bundles
//       stripping ("no power supply"), tiered part indicators refined, price
//       override now requires "computer" in title, added drive/mainboard to tier1
// v3.1: Refined system detection — price override (>$80), bundle override,
//       removed RAM/memory from part indicators (they're specs, not parts),
//       tiered part indicators (Tier 1 always blocks, Tier 2 overridable)
// v3: Fixed 'ic ' false positive (matched 'classic'), improved system detection
//     for bundles, reordered classification priority (system > part downgrade)

export default {
  async fetch(request) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    const url = new URL(request.url);
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const query = url.searchParams.get('q');
    if (!query) {
      return new Response(JSON.stringify({ error: 'Missing ?q= parameter' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const categoryParam = url.searchParams.get('category');

    // --- Cache check (5-minute TTL) ---
    const cacheKey = new Request('https://cache.local/?q=' + encodeURIComponent(query) + (categoryParam ? '&cat=' + categoryParam : '') + '&v=37');
    const cached = await caches.default.match(cacheKey);
    if (cached) {
      return cached;
    }

    const EBAY_APP_ID = 'YOUR_EBAY_APP_ID';
    const EBAY_CERT_ID = 'YOUR_EBAY_CERT_ID';
    const EBAY_SCOPE = 'https://api.ebay.com/oauth/api_scope';
    const CAMPAIGN_ID = '5339157717';
    const TRACKING_PARAMS = '&mkcid=1&mkrid=711-53200-19255-0&siteid=0&toolid=80006&mkevt=1&campid=' + CAMPAIGN_ID;
    const base64 = btoa(EBAY_APP_ID + ':' + EBAY_CERT_ID);

    var KNOWN_CATS = {
      '162075': 'Vintage Computers & Mainframes',
      '175690': 'Vintage Parts & Accessories',
      '14906': 'Vintage Manuals & Merchandise',
      '4193': 'Other Vintage Computing'
    };

    // Determine if price guide is available (requires a valid single category)
    var priceGuideAvailable = false;
    var catFilter = '';
    if (categoryParam && KNOWN_CATS[categoryParam]) {
      priceGuideAvailable = true;
      catFilter = '&category_ids=' + categoryParam;
    }

    try {
      // --- Get eBay OAuth token ---
      const tokenResp = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': 'Basic ' + base64
        },
        body: 'grant_type=client_credentials&scope=' + encodeURIComponent(EBAY_SCOPE)
      });
      const tokenData = await tokenResp.json();
      const accessToken = tokenData.access_token;
      if (!accessToken) {
        return new Response(JSON.stringify({
          error: 'eBay authentication failed',
          priceGuideAvailable: false,
          results: []
        }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const ebayHeaders = {
        'Authorization': 'Bearer ' + accessToken,
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US'
      };

      // --- Fetch data ---
      var items = [];
      var soldItems = [];

      if (priceGuideAvailable) {
        // Mode A: fetch both active and sold with category filter
        const results = await Promise.allSettled([
          fetch('https://api.ebay.com/buy/browse/v1/item_summary/search?q=' + encodeURIComponent(query) + '&limit=200' + catFilter + '&fieldgroups=EXTENDED,FULL', { headers: ebayHeaders }).then(function(r) { return r.json(); }),
          fetch('https://api.ebay.com/buy/browse/v1/item_summary/search?q=' + encodeURIComponent(query) + '&limit=200' + catFilter + '&filter=soldItems:{true}&fieldgroups=EXTENDED,FULL', { headers: ebayHeaders }).then(function(r) { return r.json(); })
        ]);

        var searchData = results[0].status === 'fulfilled' ? results[0].value : { itemSummaries: [] };
        var soldData = results[1].status === 'fulfilled' ? results[1].value : { itemSummaries: [] };
        items = searchData.itemSummaries || [];
        soldItems = soldData.itemSummaries || [];
      } else {
        // Mode B: fetch active items only
        const searchResp = await fetch('https://api.ebay.com/buy/browse/v1/item_summary/search?q=' + encodeURIComponent(query) + '&limit=200&fieldgroups=EXTENDED,FULL', { headers: ebayHeaders });
        const searchData = await searchResp.json();
        items = searchData.itemSummaries || [];
      }

      // --- Median helper ---
      function median(arr) {
        if (arr.length === 0) return null;
        var mid = Math.floor(arr.length / 2);
        if (arr.length % 2 === 0) return (arr[mid - 1] + arr[mid]) / 2;
        return arr[mid];
      }

      // --- Classification (3-layer) ---
      function classifyItem(item) {
        var cats = item.categories || [];
        var ebayCatId = '';
        var ebayCatName = '';
        for (var c = 0; c < cats.length; c++) {
          var cid = cats[c].categoryId;
          if (KNOWN_CATS[cid]) { ebayCatId = cid; ebayCatName = KNOWN_CATS[cid]; break; }
        }
        if (!ebayCatName) { ebayCatName = 'Other'; ebayCatId = ''; }

        var title = (item.title || '').toLowerCase();

        // Layer 1: Merch check
        var antiPatterns = ['patch', 'shirt', 'mug', 'sticker', 'fabric', 'iron-on', 'decal', 'poster', 'vinyl', 'art print', 'badge', 'pinback', 'button pin', 'hat', 'cap', 't-shirt', 'tshirt', 'keychain', 'lanyard', 'pennant', 'banner', 'flag', 'sign', 'plaque'];
        var isMerch = false;
        for (var a = 0; a < antiPatterns.length; a++) {
          var pat = antiPatterns[a];
          if (pat === 'print') {
            if (/\bprint(?!er)\b/.test(title)) { isMerch = true; break; }
          } else if (title.indexOf(pat) !== -1) { isMerch = true; break; }
        }

        // Layer 2: Part/accessory keywords
        // v3 FIX: Removed 'ic ' — it matched 'classic' in 'Macintosh Classic' titles
        var partAccessoryWords = ['cable', 'adapter', 'adaptor', 'replacement', 'keyboard', 'mouse', 'cover', 'case shell',
          'case cover', 'bottom case', 'top case', 'power supply', 'power adapt', 'usb', 'hdmi', 'rgb',
          'screw', 'key stem', 'keycap', 'spring', 'plunger', 'rf shield', 'heat sink', 'heatsink',
          'mounting bracket', 'standoff', 'spacer', 'label', 'sticker label', 'serial sticker',
          'membrane', 'led', 'fan', 'drive belt', 'capacitor', 'resistor', 'pcb', 'board only',
          'motherboard', 'logic board', 'mainboard', 'floppy drive', 'hard drive', 'disk drive', 'sd card',
          'memory', 'ram', 'rom', 'chip', 'cpu', 'processor', 'interface', 'controller',
          'expansion', 'slot cover', 'bracket', 'bezel', 'faceplate', 'door', 'lock', 'key',
          'feet', 'rubber', 'pad', 'grommet', 'gasket', 'filter', 'dust cover',
          'ac power', 'dc power', 'charger', 'battery', 'battery pack', 'cmos', 'coin cell',
          'ribbon', 'flat cable', 'connector', 'socket', 'header', 'jumper', 'shunt',
          'transistor', 'diode', 'integrated circuit', 'eprom', 'eeprom', 'flash',
          'dip', 'sil', 'breakout', 'module', 'sensor', 'switch', 'button',
          'potentiometer', 'pot ', 'trimmer', 'capacitor kit', 'resistor kit', 'repair kit',
          'scandoubler', 'flickerfixer', 'gotek', 'sound sampler', 'kickstart',
          'monitor', 'crt', 'display', 'printer', 'imagewriter', 'modem', 'scanner',
          'psu', 'parts only', 'for parts',
          'bundle', 'lot of', 'lot ', 'bulk', 'qty', 'set of', 'pair of',
          'manual', 'guide', 'handbook', 'schematics', 'service manual', 'owners manual',
          'user guide', 'reference guide', 'programming guide', 'technical manual',
          'instruction', 'instructions', 'documentation', 'book', 'cassette', 'tape',
          'disk', 'disc', 'floppy', 'cd-rom', 'software', 'program', 'os ', 'operating system',
          'game', 'games', 't-shirt', 'tshirt', 'shirt', 'mug', 'poster', 'sticker', 'decal', 'patch', 'hat',
          'cap', 'keychain', 'pennant', 'banner', 'flag', 'sign', 'plaque', 'art print',
          'print', 'iron-on', 'fabric', 'vinyl', 'badge', 'pinback', 'button pin', 'lanyard',
          'advert', 'advertisement', 'catalog', 'catalogue', 'brochure', 'flyer', 'leaflet',
          'magazine', 'newsletter', 'journal', 'issue', 'volume', 'edition'];

        var isPartAccessory = false;
        for (var w = 0; w < partAccessoryWords.length; w++) {
          if (title.indexOf(partAccessoryWords[w]) !== -1) { isPartAccessory = true; break; }
        }

        // v3.3: System detection — restructured for accuracy
        // Priority: explicit system phrases -> model patterns (with price/bundle override) -> "computer" word
        var systemWords = ['computer system', 'desktop computer', 'complete system', 'home computer', 'personal computer', 'working computer', 'vintage computer', 'retro computer', 'all-in-one computer'];
        var isSystem = false;
        for (var s = 0; s < systemWords.length; s++) {
          if (title.indexOf(systemWords[s]) !== -1) { isSystem = true; break; }
        }

        // Bundle detection and price threshold (used in multiple checks below)
        // v3.3: Fixed "+" bug — only " + " (with spaces) is a bundle, not "A500+" (model number)
        // v3.3: Added slash bundle (3+ "/" separators indicate item list, not model range)
        // v3.3: Added "included" to bundle words
        var slashBundle = (title.match(/\//g) || []).length >= 3;
        var isBundle = /\s\+\s/.test(title) || slashBundle || /\b(bundle|with|w\/|include[ds]?|including|plus)\b/i.test(title);
        var itemPrice = parseFloat(item.price && item.price.value);
        var priceHigh = !isNaN(itemPrice) && itemPrice > 80;
        var priceVeryHigh = !isNaN(itemPrice) && itemPrice > 150;
        // v3.2: "computer" singular only — excludes "Individual Computers" (brand name)
        var hasComputer = /\bcomputer\b(?!s)/i.test(title);

        // v3.2: Strip negative-context phrases before part checks
        // "No power supply", "no cable", etc. should not trigger part indicators
        var cleanTitle = title.replace(/\bno\s+(power supply|cable|adapter|charger|battery|mouse|keyboard|manual|disk|disc|drive|cord|power|psu)\b/gi, '');

        // v3.4: Definitive parts — never a computer, even with "vintage computer" in title
        // Used to override systemWords and Step 3 (non-bundle only)
        var definitiveParts = /\b(logic board|motherboard|mainboard|board only|psu|monitor|crt|display|printer|imagewriter|scandoubler|flickerfixer|gotek|sound sampler|kickstart|ram card|memory card|memory module|ram module|pcmcia|compact flash|cf card|repair kit|capacitor kit|resistor kit)\b/i;

        // v3.4: Even if systemWords matched, override if definitive parts present (non-bundle only)
        if (isSystem && !isBundle && definitiveParts.test(cleanTitle)) {
          isSystem = false;
        }

        // v3.3: Game/software check — blocks system classification unless in a bundle
        // "Game for Amiga 500" = game (block). "Amiga 500 with games" = computer bundle (allow).
        // Also catches game media: "game on floppy disk" even in a bundle
        var isGameSoftware = (/\b(game|games|program|software)\b/i.test(cleanTitle) && !isBundle) ||
                             (/\b(game|games)\b/i.test(cleanTitle) && /\b(floppy|disk|disc|cassette|tape|cartridge)\b/i.test(cleanTitle));

        // Step 2: Model pattern detection (before "computer" word so price/bundle can override)
        // v3.2: Added amiga\s+(500|600|...) to match "Amiga 600" (with space), not just "A600"
        if (!isSystem) {
          var systemModelPatterns = /\b(c64|c128|vic-?20|c16|c116|plus\/?4|pet\b|cbm\b|a500|a600|a1000|a1200|a2000|a2500|a3000|a4000|cd32|cdtv|amiga\s+(500|600|1000|1200|2000|2500|3000|4000)|atari\s+(st|1040|520|2600|800|400|xl|xe|mega|jaguar|lynx|7800|5200)|amstrad\s+cpc|sinclair\s+(spectrum|zx\s*81|ql)|trs-?80|ti-?99|apple\s+(ii|iie|iic|iigs|lisa)|macintosh|imac|powerbook|power\s*mac|commodore\s+(64|128|vic|pet|plus)|ibm\s+(pc|at|xt|ps)|thinkpad|raspberry\s*pi|sam\s*coup)/i;
          if (systemModelPatterns.test(title)) {
            // Tier 1: never a computer, regardless of price or bundle
            // v3.3: Added psu, kickstart, scandoubler, flickerfixer, gotek, sound sampler
            // v3.3: Removed "cord" (moved to tier2 — computers come with cords)
            var tier1Parts = /\b(cable|screw|capacitor|ribbon|sticker|decal|poster|mug|shirt|patch|hat|keychain|repair kit|capacitor kit|resistor kit|cassette|tape|book|connector|external|logic board|motherboard|mainboard|board only|ram card|memory card|memory module|ram module|pcmcia|compact flash|cf card|drive|sd card|psu|kickstart|scandoubler|flickerfixer|gotek|sound sampler|monitor|crt|display|printer|imagewriter|modem|scanner)\b/i;
            // Tier 2: part indicators, overridable by high price (>$150) or bundle context
            // v3.1: Removed ram/memory/rom — these are specs (e.g., "132MB RAM"), not parts
            // v3.3: Removed "software" (now handled by isGameSoftware), added "cords?"
            var tier2Parts = /\b(keyboard|mouse|joystick|controller|gamepad|cartridge|disk|disc|floppy|battery|chip|cpu|cover|case|fan|power supply|charger|adapter|adaptor|cords?)\b/i;
            // v3.3: Price override no longer requires "computer" in title — uses $150 threshold
            // This allows "Macintosh Color Classic M1600 Keyboard Mouse" ($725) to be a computer
            if (!tier1Parts.test(cleanTitle) && !isGameSoftware) {
              var tier2Override = priceVeryHigh || isBundle;
              if (tier2Override) {
                isSystem = true;
              } else if (!tier2Parts.test(cleanTitle)) {
                isSystem = true;
              }
            }
          }
        }

        // Step 3: "computer" in title (bundle-aware modifier check)
        // If bundle, skip modifier check entirely (bundles containing "computer" are systems)
        if (!isSystem && hasComputer) {
          if (isBundle) {
            isSystem = true;
          } else if (definitiveParts.test(cleanTitle)) {
            // v3.4: Part listing with "computer" as keyword (e.g., "PSU for Commodore 64 Computer")
            // Don't classify as system
          } else {
            var computerModifiers = ['cable', 'keyboard', 'mouse', 'adapter', 'power supply',
              'cover', 'case', 'fan', 'monitor', 'screen', 'stand', 'desk', 'table', 'shelf', 'bag',
              'charger', 'battery', 'screw', 'capacitor', 'ribbon', 'motherboard', 'logic board',
              'software', 'manual', 'guide', 'handbook', 'instruction', 'book'];
            var isComputerModifier = false;
            for (var m = 0; m < computerModifiers.length; m++) {
              if (title.indexOf('computer ' + computerModifiers[m]) !== -1) {
                isComputerModifier = true; break;
              }
            }
            if (!isComputerModifier) isSystem = true;
          }
        }

        var docWords = ['manual', 'guide', 'handbook', 'schematics', 'service manual', 'owners manual', 'user guide', 'reference guide', 'programming guide', 'technical manual', 'instruction', 'instructions', 'documentation', 'book'];
        var isDoc = false;
        for (var d = 0; d < docWords.length; d++) {
          if (title.indexOf(docWords[d]) !== -1) { isDoc = true; break; }
        }

        // v3 FIX: Reordered — system classification takes priority over part downgrade
        // This prevents real computers from being downgraded due to accessory keywords in bundles
        var finalCat = ebayCatName;
        var finalSub = ebayCatId;
        if (isMerch) { finalCat = 'Vintage Manuals & Merchandise'; finalSub = '14906'; }
        else if (isDoc && ebayCatId !== '14906') { finalCat = 'Vintage Manuals & Merchandise'; finalSub = '14906'; }
        else if (isSystem) { finalCat = 'Vintage Computers & Mainframes'; finalSub = '162075'; }
        else if (isPartAccessory && (ebayCatId === '162075' || ebayCatId === '14906')) { finalCat = 'Vintage Parts & Accessories'; finalSub = '175690'; }

        // Layer 3: Price sanity check
        if (finalSub === '162075' && item.price && parseFloat(item.price.value) < 20) {
          finalCat = 'Vintage Parts & Accessories';
          finalSub = '175690';
        }

        if (!finalCat || finalCat === 'Other') {
          finalCat = 'Other';
          finalSub = '';
        }

        return { category: finalCat, catId: finalSub };
      }

      // --- Compute per-category medians (Mode A only) ---
      var marketMedian = null;
      var categoryMedians = {};
      var categoryCounts = {};

      if (priceGuideAvailable) {
        var soldPrices = soldItems
          .map(function(i) { return parseFloat(i.price && i.price.value); })
          .filter(function(v) { return !isNaN(v); })
          .sort(function(a, b) { return a - b; });
        marketMedian = median(soldPrices);

        var categoryPrices = {};
        for (var catId in KNOWN_CATS) {
          categoryPrices[catId] = [];
        }

        for (var s = 0; s < soldItems.length; s++) {
          var soldItem = soldItems[s];
          var cls = classifyItem(soldItem);
          var price = parseFloat(soldItem.price && soldItem.price.value);
          if (!isNaN(price) && cls.catId && categoryPrices[cls.catId]) {
            categoryPrices[cls.catId].push(price);
          }
        }

        for (var catId in KNOWN_CATS) {
          var prices = categoryPrices[catId].sort(function(a, b) { return a - b; });
          categoryCounts[catId] = prices.length;
          categoryMedians[catId] = median(prices);
        }
      }

      // --- Build results ---
      var results = [];
      for (var i = 0; i < items.length; i++) {
        var item = items[i];
        var cls = classifyItem(item);

        if (!cls.catId) continue;

        var price = parseFloat(item.price && item.price.value);

        var imageUrl = '';
        if (item.thumbnailImages && item.thumbnailImages.length > 0) {
          imageUrl = item.thumbnailImages[0].imageUrl || '';
        }

        var listingUrl = item.itemWebUrl || '';
        var affUrl = listingUrl + (listingUrl.indexOf('?') > -1 ? '&' : '?') + TRACKING_PARAMS;

        var result = {
          title: item.title,
          price: price,
          image: imageUrl,
          url: affUrl,
          condition: item.condition || 'Unknown',
          conditionId: item.conditionId || '',
          category: cls.category,
          catName: KNOWN_CATS[cls.catId] || cls.category,
          categoryId: cls.catId,
          brand: item.brand || ''
        };

        if (priceGuideAvailable) {
          var catId = cls.catId;
          var catMedian = categoryMedians[catId] || marketMedian;
          var catCount = categoryCounts[catId] || 0;

          var minThreshold = 15;
          var effectiveMedian = (catCount >= minThreshold) ? catMedian : marketMedian;

          if (!effectiveMedian) effectiveMedian = 0;

          var vsMedian = effectiveMedian > 0 ? Math.round(((effectiveMedian - price) / effectiveMedian) * 100) : 0;

          var badge = '';
          var badgeLabel = '';

          if (vsMedian >= 50) { badge = 'STEAL'; badgeLabel = '🔥 Steal'; }
          else if (vsMedian >= 20) { badge = 'GOOD'; badgeLabel = '✓ Good Value'; }
          else if (vsMedian >= -10) { badge = 'FAIR'; badgeLabel = '• Fair Price'; }
          else if (vsMedian >= -50) { badge = 'HIGH'; badgeLabel = '↑ Slightly High'; }
          else { badge = 'WILD'; badgeLabel = '💀 Wildly Overpriced'; }

          result.vsMedian = vsMedian;
          result.median = effectiveMedian;
          result.medianConfidence = (catCount >= minThreshold) ? 'good' : 'low';
          result.badge = badge;
          result.badgeLabel = badgeLabel;
          result.catSampleCount = catCount;
          result.marketMedian = marketMedian;
        }

        results.push(result);
      }

      // --- Sort ---
      if (priceGuideAvailable) {
        var badgeOrder = { 'STEAL': 0, 'GOOD': 1, 'FAIR': 2, 'HIGH': 3, 'WILD': 4 };
        results.sort(function(a, b) {
          var ba = badgeOrder[a.badge] !== undefined ? badgeOrder[a.badge] : 2;
          var bb = badgeOrder[b.badge] !== undefined ? badgeOrder[b.badge] : 2;
          return bb - ba;
        });
      } else {
        results.sort(function(a, b) { return (a.price || 0) - (b.price || 0); });
      }

      var output = {
        query: query,
        priceGuideAvailable: priceGuideAvailable,
        results: results,
        cached_at: new Date().toISOString()
      };

      if (priceGuideAvailable) {
        output.marketMedian = marketMedian;
        output.categoryMedians = categoryMedians;
        output.categoryCounts = categoryCounts;
      }

      // --- Cache ---
      var response = new Response(JSON.stringify(output), {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
          'Cache-Control': 'public, max-age=300'
        }
      });
      try { await caches.default.put(cacheKey, response.clone()); } catch(e) {}

      return response;

    } catch (error) {
      return new Response(JSON.stringify({ error: error.message, priceGuideAvailable: false, results: [] }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
}
