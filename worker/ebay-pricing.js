// Ate Bit Tech — eBay Pricing Worker v2
// Per-category medians, 5-tier badges, full tracking params, conditionId fix, caching

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

    // --- Cache check (5-minute TTL) ---
    const cacheKey = new Request('https://cache.local/?q=' + encodeURIComponent(query));
    const cached = await caches.default.match(cacheKey);
    if (cached) {
      return cached;
    }

    const EBAY_APP_ID = 'YOUR_EBAY_APP_ID'; // Set via Cloudflare Worker secrets
    const EBAY_CERT_ID = 'YOUR_EBAY_CERT_ID'; // Set via Cloudflare Worker secrets
    const EBAY_SCOPE = 'https://api.ebay.com/oauth/api_scope';
    const CAMPAIGN_ID = '5339157717';
    const TRACKING_PARAMS = '&mkcid=1&mkrid=711-53200-19255-0&siteid=0&toolid=80006&mkevt=1';
    const base64 = btoa(EBAY_APP_ID + ':' + EBAY_CERT_ID);

    var KNOWN_CATS = {
      '162075': 'Vintage Computers & Mainframes',
      '175690': 'Vintage Parts & Accessories',
      '14906': 'Vintage Manuals & Merchandise',
      '4193': 'Other Vintage Computing'
    };

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
          items: [], soldCount: 0, marketMedian: null
        }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const ebayHeaders = {
        'Authorization': 'Bearer ' + accessToken,
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US'
      };

      // --- Fetch sold, BIN, and auction items in parallel ---
      var catFilter = '&category_ids=11189';
      const results = await Promise.allSettled([
        fetch('https://api.ebay.com/buy/browse/v1/item_summary/search?q=' + encodeURIComponent(query) + '&limit=200' + catFilter + '&filter=soldItems:{true}', { headers: ebayHeaders }).then(function(r) { return r.json(); }),
        fetch('https://api.ebay.com/buy/browse/v1/item_summary/search?q=' + encodeURIComponent(query) + '&limit=200' + catFilter + '&filter=buyingOptions:{FIXED_PRICE}', { headers: ebayHeaders }).then(function(r) { return r.json(); }),
        fetch('https://api.ebay.com/buy/browse/v1/item_summary/search?q=' + encodeURIComponent(query) + '&limit=200' + catFilter + '&filter=buyingOptions:{AUCTION}', { headers: ebayHeaders }).then(function(r) { return r.json(); })
      ]);

      var soldData = results[0].status === 'fulfilled' ? results[0].value : { itemSummaries: [] };
      var binData = results[1].status === 'fulfilled' ? results[1].value : { itemSummaries: [] };
      var aucData = results[2].status === 'fulfilled' ? results[2].value : { itemSummaries: [] };

      var soldItems = soldData.itemSummaries || [];
      var binItems = binData.itemSummaries || [];
      var aucItems = aucData.itemSummaries || [];

      // --- Median helper ---
      function median(arr) {
        if (arr.length === 0) return null;
        var mid = Math.floor(arr.length / 2);
        if (arr.length % 2 === 0) return (arr[mid - 1] + arr[mid]) / 2;
        return arr[mid];
      }

      // --- Global sold median ---
      var soldPrices = soldItems
        .map(function(i) { return parseFloat(i.price && i.price.value); })
        .filter(function(v) { return !isNaN(v); })
        .sort(function(a, b) { return a - b; });
      var marketMedian = median(soldPrices);

      // --- Per-category medians ---
      var categoryMedians = {};
      var categoryCounts = {};
      for (var catId in KNOWN_CATS) {
        var prices = soldItems
          .filter(function(i) {
            var cats = i.categories || [];
            for (var j = 0; j < cats.length; j++) {
              if (cats[j].categoryId === catId) return true;
            }
            return false;
          })
          .map(function(i) { return parseFloat(i.price && i.price.value); })
          .filter(function(v) { return !isNaN(v); })
          .sort(function(a, b) { return a - b; });
        categoryCounts[catId] = prices.length;
        categoryMedians[catId] = median(prices);
      }

      var computerMedian = categoryMedians['162075'];
      var computerCount = categoryCounts['162075'];

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

        // Browse API: conditionId is plain string, condition is plain string
        var condId = item.conditionId || '';
        var condName = item.condition || 'Unknown';
        var title = (item.title || '').toLowerCase();

        // Layer 2: Title refinement
        var antiPatterns = ['patch', 'shirt', 'mug', 'sticker', 'fabric', 'iron-on', 'decal', 'poster', 'vinyl', 'art print', 'badge', 'pinback', 'button pin', 'hat', 'cap', 't-shirt', 'tshirt', 'keychain', 'lanyard', 'pennant', 'banner', 'flag', 'sign', 'plaque'];
        var isMerch = false;
        for (var a = 0; a < antiPatterns.length; a++) {
          var pat = antiPatterns[a];
          if (pat === 'print') {
            if (/\bprint(?!er)\b/.test(title)) { isMerch = true; break; }
          } else if (title.indexOf(pat) !== -1) { isMerch = true; break; }
        }

        var systemWords = ['computer system', 'desktop computer', 'complete system', 'home computer', 'personal computer', 'working computer', 'vintage computer', 'retro computer'];
        var isSystem = false;
        for (var s = 0; s < systemWords.length; s++) {
          if (title.indexOf(systemWords[s]) !== -1) { isSystem = true; break; }
        }
        if (!isSystem && title.indexOf('computer') !== -1) isSystem = true;

        var partWords = ['screw', 'key stem', 'keycap', 'spring', 'plunger', 'case shell', 'case cover', 'bottom case', 'top case', 'rf shield', 'heat sink', 'heatsink', 'mounting bracket', 'standoff', 'spacer', 'label', 'sticker label', 'serial sticker'];
        var isPart = false;
        for (var p = 0; p < partWords.length; p++) {
          if (title.indexOf(partWords[p]) !== -1) { isPart = true; break; }
        }

        var docWords = ['manual', 'guide', 'handbook', 'schematics', 'service manual', 'owners manual', 'user guide', 'reference guide', 'programming guide', 'technical manual', 'instruction', 'instructions', 'documentation'];
        var isDoc = false;
        for (var d = 0; d < docWords.length; d++) {
          if (title.indexOf(docWords[d]) !== -1) { isDoc = true; break; }
        }

        var finalCat = ebayCatName;
        var finalSub = ebayCatId;
        if (isMerch) { finalCat = 'Vintage Manuals & Merchandise'; finalSub = '14906'; }
        else if (isDoc && ebayCatId !== '14906') { finalCat = 'Vintage Manuals & Merchandise'; finalSub = '14906'; }
        else if (isSystem && (ebayCatId === '175690' || ebayCatId === '14906' || ebayCatId === '4193' || ebayCatId === '')) { finalCat = 'Vintage Computers & Mainframes'; finalSub = '162075'; }
        else if (isPart && ebayCatId === '162075') { finalCat = 'Vintage Parts & Accessories'; finalSub = '175690'; }

        // Layer 3: Price sanity
        var price = parseFloat(item.price && item.price.value);
        if (!isNaN(price) && !isMerch) {
          if (price < 25 && finalSub === '162075' && !isSystem) {
            finalCat = 'Vintage Parts & Accessories'; finalSub = '175690';
          }
        }

        return { catName: finalCat, catId: finalSub, condId: String(condId), condName: condName, isMerch: isMerch };
      }

      // --- Score items with per-category median ---
      function scoreItem(item) {
        var price = parseFloat(item.price && item.price.value);
        if (isNaN(price)) return null;
        var rawId = item.itemId || '';
        var parts = rawId.split('|');
        var itemId = parts.length > 1 ? parts[1] : rawId;
        if (!/^\d+$/.test(itemId)) return null;

        var cls = classifyItem(item);
        var medianForCat = categoryMedians[cls.catId] || marketMedian || 0;
        var catCount = categoryCounts[cls.catId] || 0;
        var vs = medianForCat ? ((medianForCat - price) / medianForCat) * 100 : 0;

        // 5-tier badge (matching store thresholds)
        var badge = 'FAIR', icon = '';
        if (vs >= 30) { badge = 'DEAL'; icon = 'FLAME'; }
        else if (vs >= 10) { badge = 'GOOD'; icon = 'THUMBS'; }
        else if (vs >= -10) { badge = 'FAIR'; icon = ''; }
        else if (vs >= -50) { badge = 'HIGH'; icon = 'SKULL'; }
        else { badge = 'WILD'; icon = 'SKULL'; }

        return {
          title: item.title || '',
          price: price,
          condition: cls.condName,
          conditionId: cls.condId,
          category: cls.catName,
          categoryId: cls.catId,
          itemId: itemId,
          vsMedian: Math.round(vs),
          badge: badge,
          icon: icon,
          ambassadorUrl: 'https://www.ebay.com/itm/' + itemId + '?campid=' + CAMPAIGN_ID + TRACKING_PARAMS,
          image: (item.thumbnailImages && item.thumbnailImages[0] && item.thumbnailImages[0].imageUrl) || '',
          bidCount: item.bidCount || 0,
          catMedian: medianForCat,
          catSampleSize: catCount
        };
      }

      var fixedPrice = binItems.map(scoreItem).filter(Boolean);
      var auctions = aucItems.map(scoreItem).filter(Boolean);

      var result = {
        query: query,
        generatedAt: new Date().toISOString(),
        marketMedian: marketMedian,
        computerMedian: computerMedian,
        computerCount: computerCount,
        soldCount: soldData.total || soldPrices.length,
        fixedPriceCount: binData.total || fixedPrice.length,
        auctionCount: aucData.total || auctions.length,
        categoryMedians: categoryMedians,
        items: fixedPrice,
        auctions: auctions.slice(0, 10)
      };

      const response = new Response(JSON.stringify(result), {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=300',
        }
      });

      // Cache the response
      caches.default.put(cacheKey, response.clone());

      return response;

    } catch (err) {
      console.error(JSON.stringify({ error: err.message, query: query, timestamp: Date.now() }));
      return new Response(JSON.stringify({
        error: 'Internal error',
        items: [], soldCount: 0, marketMedian: null
      }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
  }
};
