/* A conservative title check for the Systems view. eBay's category can include parts. */
const appleIIModel = /\bapple\s*(?:ii(?!i)|2(?!\d)|\]\[)(?:\s*\(?\s*(gs|e|c(?:\s*(?:plus|\+)|\+)?|plus|\+)(?=\W|$))?(?=\W|$)/;
export function looksLikeComputer(title) {
  const text = (title || '').toLowerCase().replace(/[’']/g, '').replace(/[–—]/g, '-').trim();
  if (!text || /\b(?:no computer included|computer not included|computer sold separately)\b/.test(text)) return false;

  // A computer sold with a peripheral, or without its power supply, can still be a system.
  // Inspect the lead item so "power supply with Commodore 64 compatibility" stays excluded.
  const lead = listingSubject(text);
  const part = /\b(?:accessor(?:y|ies)|adapter|adaptor|artwork|badge|battery|bezel|book|box only|bracket|bags?|cables?|cards?|caps?|capacitors?|cartridge|cases?|casing|cassette|chassis|chips?|connector|controllers?|convert[eo]r|covers?|cpu|datassette|datasette|decals?|diagnostic|dis[ck]ettes?|dis[ck]s?|(?:data |dis[ck] |tape )?drives?|display|dongle|eprom|expansion|faceplate|fan|flash|floppy|games?|gasket|genlock|gotek|guide|handbook|housing|interface|joystick|keycaps?|keyboard|key fobs?|keychains?|kit|label|logic boards?|magazine|manuals?|membrane|memory|mixers?|modem|modulator|modules?|monitor|motherboards?|mainboards?|mouse|packaging|patent|patch|pcb|pla|plugs?|port protection|poster|power supply|power brick|power cord|printer|prototyping|psu|ram|recap|replica|replacement|resistors?|ribbon|rom|scart|schematics?|sequencer|synthesi[sz]er|screen|screws?|shell|sockets?|software|stickers?|switch|tapes?|transformer|t[ -]?shirt|user port|video out|workbench|wrench)\b/;
  // Built-in keyboards are often mentioned in complete computer titles. Missing keys
  // and parts-or-repair language describe condition and do not make a listing a part.
  const subject = lead.replace(/\b(?:missing|damaged|broken)\s+(?:a\s+)?(?:keys?|keycaps?|keyboard)\b/g, '')
    .replace(/\b(?:home computer|microcomputer)\s+keyboard\s+console\b/g, 'home computer')
    .replace(/\bkeyboard computer\b/g, 'computer');
  if (part.test(subject) || /\b(?:for use with|fits|compatible with|fits for|empty box|bare board|system unit box|parts (?:lot|bundle)|unit not included)\b/.test(subject)) return false;
  if (/\band\b/.test(lead) && part.test(text.split(/\band\b/)[0])) return false;

  const model = /\b(?:c\s?64c?|c128d?|vic[ -]?20|vc[ -]?20|plus[ /-]?4|commodore\s+(?:64c?|128d?|16|116|pet|sx[ -]?64)|amiga(?:\s+(?:a?[1-4]000|[56]00\+?|1200|2500))?|atari\s+(?:st|ste|mega|falcon|tt|[48]00|[1-9]\d*\s*(?:xl|xe))|(?:amstrad\s+)?cpc[ -]?(?:464|664|6128)|(?:sinclair\s+)?zx[ -]?(?:80|81|spectrum)|trs[ -]?80|tandy\s+(?:1000|2000|color computer)|ti[ -]?99(?:\/4a)?|apple\s+(?:ii(?:e|c|gs)?|lisa|mac\b)|macintosh|imac|powerbook|power\s*mac|ibm\s+(?:pc|xt|at|ps\/2)|thinkpad|msx2?|sam\s+coup[eé]|bbc\s+micro|acorn\s+(?:electron|archimedes)|sharp\s+x68000|pc[ -]?98\d*|raspberry\s+pi)\b/;
  const computer = /\b(?:computer|microcomputer|mainframe|workstation|laptop|desktop pc|system unit)\b/;
  // "Computer" alone is a common search keyword on unrelated listings. Require a
  // model, or an explicit system description with a recognizable maker/era.
  if (computer.test(subject) && (model.test(subject) ||
      /\b(?:vintage|retro|home|personal|desktop|portable|commodore|atari|apple|amstrad|ibm|acorn|tandy|sinclair|compaq|dell|toshiba|hewlett.packard|olivetti|digital|packard bell)\b/.test(subject))) return true;

  // Model-only titles are common, but long unmatched tails are often game names.
  const match = subject.match(appleIIModel) || subject.match(model);
  if (!match) return false;
  const tail = subject.slice(match.index + match[0].length).replace(/[^a-z0-9]+/g, ' ').trim();
  if (!tail || /^(?:c64c?|c128d?|vic20|vic 20|plus 4|a\d{3,4}|\d{3,4})$/.test(tail)) return true;
  return /\b(?:untested|non working|not working|no power|as is|faulty|repair|tested|working|powers on|boxed|complete|breadbin|breadbox|bundle|unit only)\b/.test(tail)
    && !/\b(?:program|music|mastertronic|simulator|the game|software|tape|floppy|cartridge)\b/.test(text);
}

function listingSubject(text) {
  return text.split(/\s+(?:with|w\/|incl\.?|include[sd]?|including|comes with|without|no)\s+|\s+\+\s+/)[0];
}

// Keep explicit Apple II searches within the requested hardware family. eBay also
// returns Macintosh II and Classic II because their titles contain "Apple" and "II".
function requestedAppleII(keyword, brand) {
  const query = keyword.toLowerCase().trim();
  const explicitApple = /^apple\s+/.test(query);
  if (!explicitApple && brand !== 'Apple') return null;
  const model = query.replace(/^apple\s+/, '').replace(/\s+/g, '');
  const aliases = {
    'ii': 'family', '2': 'family', '][': 'family',
    'ii+': 'plus', 'iiplus': 'plus', '2plus': 'plus', '][+': 'plus',
    'iie': 'e', '2e': 'e', 'iic': 'c', '2c': 'c',
    'iic+': 'cplus', 'iicplus': 'cplus', '2cplus': 'cplus',
    'iigs': 'gs', '2gs': 'gs'
  };
  return Object.hasOwn(aliases, model) ? aliases[model] : null;
}

export function requestedSystemRank(title, keyword, brand) {
  const requested = requestedAppleII(keyword, brand);
  if (!requested) return 1;
  const text = title.toLowerCase();
  if (matchesAppleII(text, requested)) return 2;
  // Mac II models are useful secondary results for a broad Apple II search.
  if (requested === 'family' && !/\b(?:prop|replica|clone|compatible)\b/.test(text) &&
      /\b(?:macintosh|mac)\s+(?:(?:classic|lc|performa)\s+)?ii(?:ci|cx|fx|si|vi|vx|x)?\b/.test(text)) return 1;
  return 0;
}

function matchesAppleII(text, requested) {
  if (/\b(?:macintosh|imac|powerbook|stylewriter|clone|compatible|text processing|strategy|diskware|knockoff|prop|speechlab|itt[ -]?2020|mimic systems)\b/.test(text)) return false;
  if (/\bfor\s+(?:an?\s+)?apple\s*(?:ii|2|\]\[)/.test(text)) return false;
  const match = text.match(appleIIModel);
  if (!match) return false;
  const lead = listingSubject(text);
  const leadingModel = lead.match(appleIIModel);
  if (!leadingModel) return false;
  const prefix = lead.slice(0, leadingModel.index).replace(/[^a-z0-9]+/g, ' ').trim();
  const suffix = lead.slice(leadingModel.index + leadingModel[0].length).trim();
  // Model names are often compatibility keywords for software. A bare model is
  // sufficient, but a descriptive title should identify the computer or its unit.
  const neutralPrefix = /^(?:(?:vintage|retro|rare|original|early|boxed|untested|tested|working|apple)\s*)*$/;
  const neutralSuffix = /^(?:[\s.,()#-]|\b(?:untested|working|boxed|complete|europlus|tested)\b)*$/;
  if (!/\b(?:computer|microcomputer|unit only|main unit|a2s\d{3,5})\b/.test(lead) &&
      !(neutralPrefix.test(prefix) && neutralSuffix.test(suffix))) return false;
  if (/\b(?:soundchaser|flight trainer|word juggler)\b/.test(lead)) return false;
  const variant = (match[1] || '').replace(/\s+/g, '');
  if (requested === 'family') return true;
  if (requested === 'plus') return /^(?:plus|\+)$/.test(variant);
  if (requested === 'cplus') return /^(?:cplus|c\+)$/.test(variant);
  return variant === requested;
}
