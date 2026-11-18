// Ate Bit Tech Price Guide. Browse returns active listings.
const EBAY_SCOPE = 'https://api.ebay.com/oauth/api_scope';
const TRACKING_PARAMS = {
  mkcid: '1', mkrid: '711-53200-19255-0', siteid: '0',
  toolid: '80006', mkevt: '1', campid: '5339157717'
};
const MARKETPLACES = {
  EBAY_US: { name: 'US', currency: 'USD', symbol: '$' },
  EBAY_CA: { name: 'Canada', currency: 'CAD', symbol: 'CA$' },
  EBAY_GB: { name: 'UK & Ireland', currency: 'GBP', symbol: '£' },
  EBAY_AU: { name: 'Australia & NZ', currency: 'AUD', symbol: 'AU$' }
};
const KNOWN_CATS = {
  '162075': 'Vintage Computers & Mainframes',
  '175690': 'Vintage Parts & Accessories',
  '14906': 'Vintage Manuals & Merchandise',
  '4193': 'Other Vintage Computing'
};
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

function searchError(status, code, error) {
  return Response.json({ code, error, priceGuideAvailable: false, results: [] }, {
    status, headers: { ...corsHeaders, 'Cache-Control': 'no-store' }
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // --- Classic site proxy ---
    // Intercept /classic/* paths to serve over HTTP for old browsers.
    if (url.pathname.startsWith('/classic')) {
      try {
        var fetchPath = url.pathname;
        if (fetchPath === '/classic' || fetchPath === '/classic/') {
          fetchPath = '/classic/index.html';
        }
        const ghUrl = 'https://raw.githubusercontent.com/cooperman411/AteBitTech/main' + fetchPath;
        const ghResp = await fetch(ghUrl);
        if (!ghResp.ok) {
          return new Response('Not found', { status: 404, headers: corsHeaders });
        }
        var ct = 'text/html; charset=utf-8';
        if (fetchPath.endsWith('.css')) ct = 'text/css; charset=utf-8';
        else if (fetchPath.endsWith('.js')) ct = 'text/javascript; charset=utf-8';
        else if (fetchPath.endsWith('.png')) ct = 'image/png';
        else if (fetchPath.endsWith('.gif')) ct = 'image/gif';
        else if (fetchPath.endsWith('.jpg') || fetchPath.endsWith('.jpeg')) ct = 'image/jpeg';
        else if (fetchPath.endsWith('.svg')) ct = 'image/svg+xml';
        else if (fetchPath.endsWith('.ttf')) ct = 'font/ttf';
        else if (fetchPath.endsWith('.ico')) ct = 'image/x-icon';
        return new Response(ghResp.body, {
          headers: { 'content-type': ct, 'cache-control': 'public, max-age=3600' }
        });
      } catch (e) {
        return new Response('Proxy error', { status: 500, headers: corsHeaders });
      }
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }
    if (request.method !== 'GET') {
      return searchError(405, 'METHOD_NOT_ALLOWED', 'Use GET to search.');
    }

    const query = url.searchParams.get('q')?.trim();
    if (!query) return searchError(400, 'MISSING_QUERY', 'Enter a search term.');

    const requestedCategory = url.searchParams.get('category');
    const category = Object.hasOwn(KNOWN_CATS, requestedCategory) ? requestedCategory : '';
    const requestedMarketplace = url.searchParams.get('marketplace');
    const marketplace = Object.hasOwn(MARKETPLACES, requestedMarketplace) ? requestedMarketplace : 'EBAY_US';
    const marketInfo = MARKETPLACES[marketplace];
    const cacheKey = new Request('https://cache.local/?' + new URLSearchParams({
      q: query, cat: category, mkt: marketplace, v: 'active-v1'
    }));

    try {
      const cached = await caches.default.match(cacheKey);
      if (cached) return cached;
    } catch {
      // A cache failure should not interrupt a search.
    }

    if (!env.EBAY_APP_ID || !env.EBAY_CERT_ID) {
      return searchError(503, 'SEARCH_UNAVAILABLE', 'Listing search is temporarily unavailable.');
    }

    try {
      const credentials = btoa(env.EBAY_APP_ID + ':' + env.EBAY_CERT_ID);
      const tokenResp = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: 'Basic ' + credentials
        },
        body: new URLSearchParams({ grant_type: 'client_credentials', scope: EBAY_SCOPE }),
        signal: AbortSignal.timeout(10000)
      });
      if (!tokenResp.ok) throw new Error('eBay OAuth failed');
      const { access_token: accessToken } = await tokenResp.json();
      if (!accessToken) throw new Error('eBay OAuth returned no access token');

      const browseUrl = new URL('https://api.ebay.com/buy/browse/v1/item_summary/search');
      browseUrl.search = new URLSearchParams({ q: query, limit: '200', fieldgroups: 'EXTENDED,FULL' });
      if (category) browseUrl.searchParams.set('category_ids', category);
      const searchResp = await fetch(browseUrl, {
        headers: {
          Authorization: 'Bearer ' + accessToken,
          'X-EBAY-C-MARKETPLACE-ID': marketplace
        },
        signal: AbortSignal.timeout(10000)
      });
      if (!searchResp.ok) throw new Error('eBay Browse failed');
      const data = await searchResp.json();
      if (data?.errors?.length || (!Array.isArray(data?.itemSummaries) && data?.total !== 0)) {
        throw new Error('eBay Browse returned an unexpected response');
      }
      const items = data.itemSummaries || [];

      // --- Classification (3-layer) ---
      function classifyItem(item, selectedCat) {
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
        // v3.6: Use word boundary regex — prevents 'cap' matching 'caps', 'sign' matching 'design', etc.
        var isMerch = /\b(patch|shirt|mug|sticker|fabric|iron-on|decal|poster|vinyl|art print|badge|pinback|button pin|hat|cap|t-shirt|tshirt|keychain|lanyard|pennant|banner|flag|sign|plaque)\b/i.test(title) || /\bprint(?!er)\b/i.test(title);

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
          'psu', 'parts only', 'for parts', 'datassette', 'datasette', 'chassis',
          'case,', 'case.', 'case ', 'club no', 'club magazine',
          'joystick', 'joysticks', 'gamepad', 'controller', 'multicart',
          'rom chip', 'eprom', 'eeprom', 'pla ', 'recap', 'capacitor kit',
          'vga', 'isa', 'pci', 'agp', 'scsi', 'ide', 'sata',
          'emulation', 'emulator', 'x commodore', 'x amiga', 'x atari',
          'retro-gaming', 'retro gaming', 'gaming ',
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

        // v3.5: System detection — comprehensive rewrite for accuracy
        // Priority: explicit system phrases -> model patterns (with price/bundle override) -> "computer" word
        var systemWords = ['computer system', 'desktop computer', 'complete system', 'home computer', 'personal computer', 'working computer', 'vintage computer', 'retro computer', 'all-in-one computer'];
        var isSystem = false;
        for (var s = 0; s < systemWords.length; s++) {
          if (title.indexOf(systemWords[s]) !== -1) { isSystem = true; break; }
        }

        // Bundle detection and price threshold (used in multiple checks below)
        var slashBundle = (title.match(/\//g) || []).length >= 3;
        var isBundle = /\s\+\s/.test(title) || slashBundle || /\b(bundle|with|w\/|include[ds]?|including|plus)\b/i.test(title);
        var itemPrice = parseFloat(item.price && item.price.value);
        var priceHigh = !isNaN(itemPrice) && itemPrice > 80;
        var priceVeryHigh = !isNaN(itemPrice) && itemPrice > 150;
        // v3.2: "computer" singular only — excludes "Individual Computers" (brand name)
        var hasComputer = /\bcomputer\b(?!s)/i.test(title);

        // v3.2: Strip negative-context phrases before part checks
        var cleanTitle = title.replace(/\bno\s+(power supply|cable|adapter|charger|battery|mouse|keyboard|manual|disk|disc|drive|cord|power|psu)\b/gi, '');

        // v3.5: Definitive parts — never a computer, even with "vintage computer" in title
        // v3.5: Added datassette, datasette, chassis, cartridge, pcb, club, magazine, newsletter
        var definitiveParts = /\b(logic board|motherboard|mainboard|board only|psu|monitor|crt|display|printer|imagewriter|scandoubler|flickerfixer|gotek|sound sampler|kickstart|ram card|memory card|memory module|ram module|ram expansion|pcmcia|compact flash|cf card|repair kit|capacitor kit|resistor kit|datassette|datasette|chassis|cartridge|pcb|diagnostic|replacement|magazine|newsletter|club\s|emulation|emulator|bezel|faceplate)\b/i;

        // v3.4: Even if systemWords matched, override if definitive parts present (non-bundle only)
        if (isSystem && !isBundle && definitiveParts.test(cleanTitle)) {
          isSystem = false;
        }

        // v3.5: Game/software check — expanded patterns
        // "Game for Amiga 500" = game. "OLYMPIAD x Commodore 16" = game. "retro-gaming" = game.
        var isGameSoftware = (/\b(game|games|gaming|program|software|rom)\b/i.test(cleanTitle) && !isBundle) ||
                             (/\b(game|games)\b/i.test(cleanTitle) && /\b(floppy|disk|disc|cassette|tape|cartridge)\b/i.test(cleanTitle)) ||
                             /\b\w+\s+x\s+(commodore|amiga|atari|amstrad|sinclair|sega)/i.test(cleanTitle);

        // Step 2: Model pattern detection (before "computer" word so price/bundle can override)
        if (!isSystem) {
          var systemModelPatterns = /\b(c64|c128|vic-?20|c16|c116|plus\/?4|pet\b|cbm\b|a500|a600|a1000|a1200|a2000|a2500|a3000|a4000|cd32|cdtv|amiga\s+(500|600|1000|1200|2000|2500|3000|4000)|atari\s+(st|1040|520|2600|800|400|xl|xe|mega|jaguar|lynx|7800|5200)|amstrad\s+cpc|sinclair\s+(spectrum|zx\s*81|ql)|trs-?80|ti-?99|apple\s+(ii|iie|iic|iigs|lisa)|macintosh|imac|powerbook|power\s*mac|commodore\s+(64|128|16|116|vic|pet|plus)|ibm\s+(pc|at|xt|ps)|thinkpad|raspberry\s*pi|sam\s*coup)/i;
          if (systemModelPatterns.test(title)) {
            // Tier 1: never a computer, regardless of price or bundle
            // v3.5: Added datassette, datasette, chassis, cartridge, pcb, diagnostic, replacement
            var tier1Parts = /\b(cable|screw|capacitor|ribbon|sticker|decal|poster|mug|shirt|patch|hat|keychain|repair kit|capacitor kit|resistor kit|cassette|tape|book|connector|external|logic board|motherboard|mainboard|board only|ram card|memory card|memory module|ram module|ram expansion|pcmcia|compact flash|cf card|drive|sd card|psu|kickstart|scandoubler|flickerfixer|gotek|sound sampler|monitor|crt|display|printer|imagewriter|modem|scanner|datassette|datasette|chassis|cartridge|pcb|diagnostic|replacement|club|bezel|faceplate|housing|frame|shell)\b/i;
            // Tier 2: part indicators, overridable by high price (>$150) or bundle+computer
            var tier2Parts = /\b(keyboard|mouse|joystick|controller|gamepad|disks?|discs?|floppy|battery|chip|cpu|cover|case|fan|power supply|charger|adapter|adaptor|cords?|ram)\b/i;
            if (!tier1Parts.test(cleanTitle) && !isGameSoftware) {
              // v3.6: Keyboard/mouse/joystick can only be overridden by bundle context, not price alone
              // Prevents "Amiga 600 TS600 Mechanical Keyboard" $233 from being a computer
              var tier2Accessory = /\b(keyboard|mouse|joystick|controller|gamepad)\b/i.test(cleanTitle);
              var tier2Override = (isBundle && (hasComputer || priceHigh)) || (priceVeryHigh && !tier2Accessory);
              if (tier2Override) {
                isSystem = true;
              } else if (!tier2Parts.test(cleanTitle)) {
                isSystem = true;
              }
            }
          }
        }

        // Step 3: "computer" in title (bundle-aware modifier check)
        if (!isSystem && hasComputer) {
          if (isBundle) {
            // v3.5: Bundle with "computer" — but check for "for" pattern first
            // "RAM Module for Commodore 16 Computer" is an accessory, not a computer
            if (/\bfor\b/i.test(cleanTitle) && definitiveParts.test(cleanTitle)) {
              // Accessory FOR a computer
            } else {
              isSystem = true;
            }
          } else if (definitiveParts.test(cleanTitle)) {
            // Part listing with "computer" as keyword
          } else if (/\bfor\b/i.test(cleanTitle) && tier2Parts && /\b(keyboard|mouse|joystick|drive|disk|cable|adapter|power supply|charger|battery|cover|case|fan|chip|cpu|expansion|module)\b/i.test(cleanTitle)) {
            // v3.5: "for ... computer" with part words = accessory, not computer
          } else {
            var computerModifiers = ['cable', 'keyboard', 'mouse', 'adapter', 'power supply',
              'cover', 'case', 'fan', 'monitor', 'screen', 'stand', 'desk', 'table', 'shelf', 'bag',
              'charger', 'battery', 'screw', 'capacitor', 'ribbon', 'motherboard', 'logic board',
              'software', 'manual', 'guide', 'handbook', 'instruction', 'book', 'club', 'magazine',
              'newsletter', 'expansion', 'module', 'card'];
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

        // v3.6: Respect user's selected category.
        // When searching Parts or Merch, don't reclassify items out of that category.
        // Only when searching Computers do we want classification to downgrade parts.
        var finalCat = ebayCatName;
        var finalSub = ebayCatId;
        if (selectedCat === '175690' || selectedCat === '14906') {
          // User selected Parts or Merch — keep eBay's category, don't override with isMerch/isSystem
          // Still allow part-accessory and doc flags for fine-grained sorting within the selected category
          if (selectedCat === '175690' && isDoc) {
            finalCat = 'Vintage Manuals & Merchandise'; finalSub = '14906';
          }
        } else {
          if (isMerch) { finalCat = 'Vintage Manuals & Merchandise'; finalSub = '14906'; }
          else if (isDoc && ebayCatId !== '14906') { finalCat = 'Vintage Manuals & Merchandise'; finalSub = '14906'; }
          else if (isSystem) { finalCat = 'Vintage Computers & Mainframes'; finalSub = '162075'; }
          else if (isPartAccessory && (ebayCatId === '162075' || ebayCatId === '14906')) { finalCat = 'Vintage Parts & Accessories'; finalSub = '175690'; }
        }

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

      const results = [];
      for (const item of items) {
        const cls = classifyItem(item, category);
        if (!cls.catId || !item.itemWebUrl) continue;

        const price = parseFloat(item.price?.value);
        const listingUrl = new URL(item.itemWebUrl);
        for (const [key, value] of Object.entries(TRACKING_PARAMS)) {
          listingUrl.searchParams.set(key, value);
        }

        results.push({
          title: item.title,
          price: Number.isFinite(price) ? price : null,
          currency: item.price?.currency || marketInfo.currency,
          image: item.thumbnailImages?.[0]?.imageUrl || '',
          url: listingUrl.href,
          condition: item.condition || 'Unknown',
          conditionId: item.conditionId || '',
          category: cls.category,
          catName: KNOWN_CATS[cls.catId] || cls.category,
          categoryId: cls.catId,
          brand: item.brand || ''
        });
      }

      const queryTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 1);
      function relevance(title) {
        const normalized = (title || '').toLowerCase();
        return queryTerms.filter(term => normalized.includes(term)).length;
      }
      results.sort((a, b) => relevance(b.title) - relevance(a.title) || (a.price ?? 0) - (b.price ?? 0));

      const response = Response.json({
        query,
        priceGuideAvailable: false,
        marketplace,
        marketplaceName: marketInfo.name,
        currency: marketInfo.currency,
        currencySymbol: marketInfo.symbol,
        results,
        cached_at: new Date().toISOString()
      }, { headers: { ...corsHeaders, 'Cache-Control': 'public, max-age=300' } });

      try { await caches.default.put(cacheKey, response.clone()); } catch {}
      return response;
    } catch {
      return searchError(502, 'EBAY_UNAVAILABLE', 'eBay listings are temporarily unavailable. Try again shortly.');
    }
  }
};
