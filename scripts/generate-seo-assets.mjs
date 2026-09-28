import * as fs from 'node:fs';
import * as path from 'node:path';

// 1. Build seo/keywords.csv
const KEYWORDS = [
  // Cluster A: Exact Size (High Opportunity - Competitors only have generic pages)
  {
    keyword: 'compress pdf to 100kb',
    language: 'en',
    cluster: 'A. Exact size',
    intent: 'transactional',
    ourUrl: 'https://weesize.com/compress-pdf-to-100kb',
    owners: '11zon, iLovePDF (generic), Smallpdf (generic), PDF24',
    difficulty: 'Medium (38)',
    notes: 'iLovePDF has no 100kb page; ranks generic page. Weesize can win with exact-size slider and on-device processing.',
    priority: 'P1',
    needsValidation: 'yes (est. 40k-70k/mo global)'
  },
  {
    keyword: 'compress pdf to 200kb',
    language: 'en',
    cluster: 'A. Exact size',
    intent: 'transactional',
    ourUrl: 'https://weesize.com/compress-pdf-to-200kb',
    owners: '11zon, Duplichecker, iLovePDF (generic)',
    difficulty: 'Low-Medium (29)',
    notes: 'Government & job portal file upload requirement. Direct exact-size landing page dominates generic pages.',
    priority: 'P1',
    needsValidation: 'yes (est. 30k-50k/mo global)'
  },
  {
    keyword: 'compress pdf to 500kb',
    language: 'en',
    cluster: 'A. Exact size',
    intent: 'transactional',
    ourUrl: 'https://weesize.com/compress-pdf-to-500kb',
    owners: '11zon, Adobe (generic), iLovePDF (generic)',
    difficulty: 'Low-Medium (32)',
    notes: 'Common academic and portal submission ceiling. Weesize slider hits exact target without upload.',
    priority: 'P1',
    needsValidation: 'yes (est. 25k-45k/mo global)'
  },
  {
    keyword: 'compress pdf to 1mb',
    language: 'en',
    cluster: 'A. Exact size',
    intent: 'transactional',
    ourUrl: 'https://weesize.com/compress-pdf-to-1mb',
    owners: 'iLovePDF (generic), Smallpdf, PDF24',
    difficulty: 'Medium (36)',
    notes: 'Standard email attachment ceiling. Dedicated landing page gives specific guidance and instant tool.',
    priority: 'P1',
    needsValidation: 'yes (est. 20k-35k/mo global)'
  },
  {
    keyword: 'compress pdf to 2mb',
    language: 'en',
    cluster: 'A. Exact size',
    intent: 'transactional',
    ourUrl: 'https://weesize.com/compress-pdf-to-2mb',
    owners: '11zon, PDFgear, iLovePDF (generic)',
    difficulty: 'Low (24)',
    notes: 'Immigration & legal filings limit. High commercial intent for professionals.',
    priority: 'P1',
    needsValidation: 'yes (est. 15k-25k/mo global)'
  },
  {
    keyword: 'compress pdf to 50kb',
    language: 'en',
    cluster: 'A. Exact size',
    intent: 'transactional',
    ourUrl: 'https://weesize.com/compress-pdf-to-50kb',
    owners: '11zon, Pi7, Duplichecker',
    difficulty: 'Low (22)',
    notes: 'Very strict upload portals (banking, exams). Requires high image compression and font optimization.',
    priority: 'P1',
    needsValidation: 'yes (est. 15k-30k/mo global)'
  },
  {
    keyword: 'compress pdf to 20kb',
    language: 'en',
    cluster: 'A. Exact size',
    intent: 'transactional',
    ourUrl: 'https://weesize.com/compress-pdf-to-20kb',
    owners: 'Pi7, 11zon',
    difficulty: 'Low (19)',
    notes: 'Signature and ID upload portals in India/Asia. Very underserved by major Western tools.',
    priority: 'P1',
    needsValidation: 'yes (est. 10k-20k/mo global)'
  },
  {
    keyword: 'compress pdf to 300kb',
    language: 'en',
    cluster: 'A. Exact size',
    intent: 'transactional',
    ourUrl: 'https://weesize.com/compress-pdf-to-300kb',
    owners: '11zon, PDF2Go, Smallpdf',
    difficulty: 'Low (25)',
    notes: 'Visa portal requirement for Canadian & European visas.',
    priority: 'P2',
    needsValidation: 'yes (est. 8k-15k/mo global)'
  },
  {
    keyword: 'compress pdf to 5mb',
    language: 'en',
    cluster: 'A. Exact size',
    intent: 'transactional',
    ourUrl: 'https://weesize.com/compress-pdf-to-5mb',
    owners: 'iLovePDF (generic), Adobe (generic)',
    difficulty: 'Low (21)',
    notes: 'Large report compression for client emails.',
    priority: 'P2',
    needsValidation: 'yes (est. 10k-18k/mo global)'
  },
  {
    keyword: 'compress image to 20kb',
    language: 'en',
    cluster: 'A. Exact size',
    intent: 'transactional',
    ourUrl: 'https://weesize.com/compress-image-to-20kb',
    owners: 'Pi7, SimpleImageResizer, 11zon',
    difficulty: 'Low (20)',
    notes: 'Massive volume in Asia/India for government exam forms. Weesize compresses in browser with no upload.',
    priority: 'P1',
    needsValidation: 'yes (est. 50k-90k/mo global)'
  },
  {
    keyword: 'compress image to 50kb',
    language: 'en',
    cluster: 'A. Exact size',
    intent: 'transactional',
    ourUrl: 'https://weesize.com/compress-image-to-50kb',
    owners: 'Pi7, 11zon, Duplichecker',
    difficulty: 'Low (22)',
    notes: 'ID photos, passport scans. Weesize provides instant preview and dimension crop.',
    priority: 'P1',
    needsValidation: 'yes (est. 40k-70k/mo global)'
  },
  {
    keyword: 'compress image to 100kb',
    language: 'en',
    cluster: 'A. Exact size',
    intent: 'transactional',
    ourUrl: 'https://weesize.com/compress-image-to-100kb',
    owners: 'TinyPNG, 11zon, JPEG-Optimizer',
    difficulty: 'Medium (30)',
    notes: 'Web publishing & profile uploads. Client-side mozjpeg wasm gives superior quality.',
    priority: 'P1',
    needsValidation: 'yes (est. 35k-60k/mo global)'
  },
  {
    keyword: 'compress image to 200kb',
    language: 'en',
    cluster: 'A. Exact size',
    intent: 'transactional',
    ourUrl: 'https://weesize.com/compress-image-to-200kb',
    owners: '11zon, Img2Go',
    difficulty: 'Low (18)',
    notes: 'Application forms requiring high quality photos under 200 KB.',
    priority: 'P2',
    needsValidation: 'yes (est. 15k-25k/mo global)'
  },

  // Cluster B: Privacy & Uncapped / Offline
  {
    keyword: 'compress pdf without uploading',
    language: 'en',
    cluster: 'B. Privacy & free modifiers',
    intent: 'transactional',
    ourUrl: 'https://weesize.com/compress-pdf-without-uploading',
    owners: 'Reddit, PDFgear blog, StackOverflow',
    difficulty: 'Low (16)',
    notes: 'High intent privacy audience. Weesize is literally the only web tool that does this 100% in browser.',
    priority: 'P1',
    needsValidation: 'yes (est. 5k-12k/mo global)'
  },
  {
    keyword: 'offline pdf tools free',
    language: 'en',
    cluster: 'B. Privacy & free modifiers',
    intent: 'informational',
    ourUrl: 'https://weesize.com/lite',
    owners: 'PDF24, PDFgear, Stirling-PDF',
    difficulty: 'Medium (31)',
    notes: 'Weesize PWA installs offline and processes without an active internet connection.',
    priority: 'P1',
    needsValidation: 'yes (est. 8k-15k/mo global)'
  },
  {
    keyword: 'pdf compressor no watermark',
    language: 'en',
    cluster: 'B. Privacy & free modifiers',
    intent: 'transactional',
    ourUrl: 'https://weesize.com/compress-pdf',
    owners: 'Smallpdf, iLovePDF, Adobe',
    difficulty: 'Medium (34)',
    notes: 'Users angry at free trials adding branding stamps. Weesize guarantees clean output.',
    priority: 'P1',
    needsValidation: 'yes (est. 12k-25k/mo global)'
  },
  {
    keyword: 'pdf tools no sign up',
    language: 'en',
    cluster: 'B. Privacy & free modifiers',
    intent: 'transactional',
    ourUrl: 'https://weesize.com/tools',
    owners: 'PDF24, Sejda (with daily limits)',
    difficulty: 'Low-Medium (26)',
    notes: 'High friction complaint against Smallpdf/iLovePDF login walls. Weesize has zero accounts.',
    priority: 'P1',
    needsValidation: 'yes (est. 10k-20k/mo global)'
  },
  {
    keyword: 'private pdf merger',
    language: 'en',
    cluster: 'B. Privacy & free modifiers',
    intent: 'transactional',
    ourUrl: 'https://weesize.com/merge-pdf-private',
    owners: 'PDFsam, Stirling-PDF',
    difficulty: 'Low (14)',
    notes: 'Lawyers, financial analysts, doctors merging confidential patient/client files.',
    priority: 'P1',
    needsValidation: 'yes (est. 4k-9k/mo global)'
  },
  {
    keyword: 'open source pdf tools',
    language: 'en',
    cluster: 'B. Privacy & free modifiers',
    intent: 'informational',
    ourUrl: 'https://weesize.com/about',
    owners: 'Stirling-PDF GitHub, PDFtk, PDFsam',
    difficulty: 'Medium (35)',
    notes: 'Developers & security auditors looking for inspectable code.',
    priority: 'P2',
    needsValidation: 'yes (est. 7k-14k/mo global)'
  },

  // Cluster C: Format Converters
  {
    keyword: 'heic to pdf',
    language: 'en',
    cluster: 'C. Format converters',
    intent: 'transactional',
    ourUrl: 'https://weesize.com/heic-to-pdf',
    owners: 'CloudConvert, iLovePDF, Zamzar',
    difficulty: 'Medium (42)',
    notes: 'iPhone users taking document photos. Converting directly in-browser solves Apple HEIC headaches.',
    priority: 'P1',
    needsValidation: 'yes (est. 35k-70k/mo global)'
  },
  {
    keyword: 'webp to pdf',
    language: 'en',
    cluster: 'C. Format converters',
    intent: 'transactional',
    ourUrl: 'https://weesize.com/webp-to-pdf',
    owners: 'CloudConvert, Convertio, iLovePDF',
    difficulty: 'Low-Medium (28)',
    notes: 'Saved images from Google Images / Chrome need converting to PDF for documents.',
    priority: 'P1',
    needsValidation: 'yes (est. 25k-45k/mo global)'
  },
  {
    keyword: 'avif to pdf',
    language: 'en',
    cluster: 'C. Format converters',
    intent: 'transactional',
    ourUrl: 'https://weesize.com/avif-to-pdf',
    owners: 'Convertio, CloudConvert',
    difficulty: 'Low (18)',
    notes: 'Emerging modern image format. Browser natively decodes AVIF; converts to PDF instantly.',
    priority: 'P2',
    needsValidation: 'yes (est. 8k-16k/mo global)'
  },
  {
    keyword: 'png to pdf no watermark',
    language: 'en',
    cluster: 'C. Format converters',
    intent: 'transactional',
    ourUrl: 'https://weesize.com/png-to-pdf',
    owners: 'Smallpdf, iLovePDF, Adobe',
    difficulty: 'Low-Medium (27)',
    notes: 'Transparent PNG screenshots to clean PDF.',
    priority: 'P2',
    needsValidation: 'yes (est. 15k-30k/mo global)'
  },

  // Cluster D: Devices & Use Cases
  {
    keyword: 'compress pdf for email',
    language: 'en',
    cluster: 'D. Use cases and devices',
    intent: 'informational/transactional',
    ourUrl: 'https://weesize.com/compress-pdf-for-email',
    owners: 'Adobe Acrobat guide, Smallpdf, Lifewire',
    difficulty: 'Medium (38)',
    notes: 'Huge evergreen intent (Outlook 20MB limit, Gmail 25MB limit). Exact presets for email.',
    priority: 'P1',
    needsValidation: 'yes (est. 20k-40k/mo global)'
  },
  {
    keyword: 'compress pdf for whatsapp',
    language: 'en',
    cluster: 'D. Use cases and devices',
    intent: 'transactional',
    ourUrl: 'https://weesize.com/compress-pdf-for-whatsapp',
    owners: 'Smallpdf blog, Tech blogs',
    difficulty: 'Low-Medium (24)',
    notes: 'WhatsApp document sending limit (100MB / mobile data conservation).',
    priority: 'P2',
    needsValidation: 'yes (est. 10k-22k/mo global)'
  },
  {
    keyword: 'compress pdf on iphone without app',
    language: 'en',
    cluster: 'D. Use cases and devices',
    intent: 'transactional',
    ourUrl: 'https://weesize.com/compress-pdf-iphone',
    owners: 'Apple Support discussions, Macworld',
    difficulty: 'Medium (32)',
    notes: 'Safari iOS handles Web Workers and canvas smoothly without installing an App Store app.',
    priority: 'P1',
    needsValidation: 'yes (est. 18k-35k/mo global)'
  },
  {
    keyword: 'compress pdf on mac free',
    language: 'en',
    cluster: 'D. Use cases and devices',
    intent: 'informational/transactional',
    ourUrl: 'https://weesize.com/compress-pdf-mac',
    owners: 'Macworld, 9to5Mac, Adobe',
    difficulty: 'Medium (35)',
    notes: 'Mac Preview Quartz filters often ruin text quality. Weesize maintains clean text.',
    priority: 'P2',
    needsValidation: 'yes (est. 15k-28k/mo global)'
  },

  // Cluster E: Official Upload Requirements (Presets)
  {
    keyword: 'us passport photo size 600x600',
    language: 'en',
    cluster: 'E. Official requirements',
    intent: 'transactional',
    ourUrl: 'https://weesize.com/id-photo',
    owners: 'Travel.state.gov (official), PhotoAi, 123passportphoto',
    difficulty: 'Medium (41)',
    notes: 'Weesize ID photo preset crops to 600x600 px and exports print sheet without retouches.',
    priority: 'P1',
    needsValidation: 'yes (est. 30k-60k/mo global)'
  },
  {
    keyword: 'dv lottery photo tool',
    language: 'en',
    cluster: 'E. Official requirements',
    intent: 'transactional',
    ourUrl: 'https://weesize.com/get-it-accepted',
    owners: 'Travel.state.gov, GreenCardPhoto',
    difficulty: 'Medium (44)',
    notes: 'Millions of applicants search every Autumn (October-November).',
    priority: 'P1',
    needsValidation: 'yes (est. 60k-120k/mo seasonal)'
  },
  {
    keyword: 'schengen visa photo requirements',
    language: 'en',
    cluster: 'E. Official requirements',
    intent: 'informational',
    ourUrl: 'https://weesize.com/get-it-accepted',
    owners: 'SchengenVisaInfo, Official embassy portals',
    difficulty: 'Medium (39)',
    notes: '35x45mm dimension preset and light grey background requirement.',
    priority: 'P2',
    needsValidation: 'yes (est. 20k-40k/mo global)'
  },

  // Cluster F: Competitor Alternatives
  {
    keyword: 'ilovepdf alternative',
    language: 'en',
    cluster: 'F. Alternatives',
    intent: 'commercial/transactional',
    ourUrl: 'https://weesize.com/compare/ilovepdf-alternative',
    owners: 'AlternativeTo, Reddit, Slant',
    difficulty: 'Medium (37)',
    notes: 'Target users looking for unthrottled, ad-free, private alternatives to iLovePDF.',
    priority: 'P1',
    needsValidation: 'yes (est. 15k-30k/mo global)'
  },
  {
    keyword: 'smallpdf alternative free',
    language: 'en',
    cluster: 'F. Alternatives',
    intent: 'commercial/transactional',
    ourUrl: 'https://weesize.com/compare/smallpdf-alternative',
    owners: 'AlternativeTo, TechRadar, Reddit',
    difficulty: 'Medium (39)',
    notes: 'Smallpdf imposes harsh 2-documents-per-day limits. Weesize has zero limits.',
    priority: 'P1',
    needsValidation: 'yes (est. 12k-25k/mo global)'
  },
  {
    keyword: 'free pdf tools like ilovepdf',
    language: 'en',
    cluster: 'F. Alternatives',
    intent: 'commercial/transactional',
    ourUrl: 'https://weesize.com/compare/ilovepdf-alternative',
    owners: 'Google SERP, Quora, Medium',
    difficulty: 'Low-Medium (26)',
    notes: 'Direct match for brand comparison page.',
    priority: 'P1',
    needsValidation: 'yes (est. 8k-16k/mo global)'
  },

  // Cluster G: Head Terms (Long Term Authority)
  {
    keyword: 'compress pdf',
    language: 'en',
    cluster: 'G. Head terms',
    intent: 'transactional',
    ourUrl: 'https://weesize.com/compress-pdf',
    owners: 'iLovePDF, Smallpdf, Adobe, PDF24',
    difficulty: 'Very High (88)',
    notes: 'Top tier competitive keyword. Requires substantial backlink authority; build niche exact-size ranks first.',
    priority: 'P3',
    needsValidation: 'yes (est. 2M-4M/mo global)'
  },
  {
    keyword: 'merge pdf',
    language: 'en',
    cluster: 'G. Head terms',
    intent: 'transactional',
    ourUrl: 'https://weesize.com/merge-pdf',
    owners: 'iLovePDF, Smallpdf, Adobe',
    difficulty: 'Very High (85)',
    notes: 'High volume head term.',
    priority: 'P3',
    needsValidation: 'yes (est. 1.5M-3M/mo global)'
  },
  {
    keyword: 'jpg to pdf',
    language: 'en',
    cluster: 'G. Head terms',
    intent: 'transactional',
    ourUrl: 'https://weesize.com/jpg-to-pdf',
    owners: 'iLovePDF, Smallpdf, Adobe',
    difficulty: 'Very High (84)',
    notes: 'High volume head term.',
    priority: 'P3',
    needsValidation: 'yes (est. 1M-2.5M/mo global)'
  },

  // International Natural Phrasing (German, Spanish, French, Portuguese, Indonesian, Hindi, Turkish)
  {
    keyword: 'pdf verkleinern',
    language: 'de',
    cluster: 'A. Exact size',
    intent: 'transactional',
    ourUrl: 'https://weesize.com/de/pdf-verkleinern',
    owners: 'PDF24, Smallpdf (de), Adobe (de)',
    difficulty: 'High (62)',
    notes: 'Natural colloquial German term (more search volume than technical "pdf komprimieren").',
    priority: 'P1',
    needsValidation: 'yes (est. 250k-400k/mo DACH)'
  },
  {
    keyword: 'pdf verkleinern auf 100kb',
    language: 'de',
    cluster: 'A. Exact size',
    intent: 'transactional',
    ourUrl: 'https://weesize.com/de/pdf-verkleinern-100kb',
    owners: '11zon, PDF24 Forum',
    difficulty: 'Low (18)',
    notes: 'Specific German exact-size query. Virtually no authority tool has a tailored page.',
    priority: 'P1',
    needsValidation: 'yes (est. 8k-18k/mo DACH)'
  },
  {
    keyword: 'pdf zusammenfügen',
    language: 'de',
    cluster: 'G. Head terms',
    intent: 'transactional',
    ourUrl: 'https://weesize.com/de/pdf-zusammenfuegen',
    owners: 'PDF24, iLovePDF (de)',
    difficulty: 'High (58)',
    notes: 'Primary German phrase for merging PDFs.',
    priority: 'P2',
    needsValidation: 'yes (est. 200k-350k/mo DACH)'
  },
  {
    keyword: 'comprimir pdf',
    language: 'es',
    cluster: 'G. Head terms',
    intent: 'transactional',
    ourUrl: 'https://weesize.com/es/comprimir-pdf',
    owners: 'iLovePDF (es), Smallpdf (es), Adobe (es)',
    difficulty: 'High (70)',
    notes: 'Top Spanish query for PDF compression across LATAM & Spain.',
    priority: 'P2',
    needsValidation: 'yes (est. 800k-1.5M/mo global Spanish)'
  },
  {
    keyword: 'comprimir pdf a 100kb',
    language: 'es',
    cluster: 'A. Exact size',
    intent: 'transactional',
    ourUrl: 'https://weesize.com/es/comprimir-pdf-100kb',
    owners: '11zon, Duplichecker',
    difficulty: 'Low (20)',
    notes: 'Huge search demand for academic submissions in Mexico, Colombia, Spain, Argentina.',
    priority: 'P1',
    needsValidation: 'yes (est. 25k-50k/mo Spanish)'
  },
  {
    keyword: 'unir pdf',
    language: 'es',
    cluster: 'G. Head terms',
    intent: 'transactional',
    ourUrl: 'https://weesize.com/es/unir-pdf',
    owners: 'iLovePDF (es), Smallpdf (es)',
    difficulty: 'High (68)',
    notes: 'Standard Spanish phrase for merging PDFs.',
    priority: 'P2',
    needsValidation: 'yes (est. 600k-1M/mo Spanish)'
  },
  {
    keyword: 'compresser pdf',
    language: 'fr',
    cluster: 'G. Head terms',
    intent: 'transactional',
    ourUrl: 'https://weesize.com/fr/compresser-pdf',
    owners: 'iLovePDF (fr), Adobe (fr)',
    difficulty: 'High (64)',
    notes: 'Top French search term.',
    priority: 'P2',
    needsValidation: 'yes (est. 400k-700k/mo Francophone)'
  },
  {
    keyword: 'reduire taille pdf gratuit sans telechargement',
    language: 'fr',
    cluster: 'B. Privacy & free modifiers',
    intent: 'transactional',
    ourUrl: 'https://weesize.com/fr/compresser-pdf-sans-upload',
    owners: 'Forum comments, tech tips',
    difficulty: 'Low (15)',
    notes: 'Natural French query for "without uploading / local".',
    priority: 'P1',
    needsValidation: 'yes (est. 6k-14k/mo Francophone)'
  },
  {
    keyword: 'comprimir pdf 100kb',
    language: 'pt',
    cluster: 'A. Exact size',
    intent: 'transactional',
    ourUrl: 'https://weesize.com/pt/comprimir-pdf-100kb',
    owners: '11zon, iLovePDF (generic pt)',
    difficulty: 'Low-Medium (22)',
    notes: 'High demand in Brazil for judicial portals (PJe, ESAJ limits).',
    priority: 'P1',
    needsValidation: 'yes (est. 30k-60k/mo Brazil/Portugal)'
  },
  {
    keyword: 'kompres pdf ke 200kb',
    language: 'id',
    cluster: 'A. Exact size',
    intent: 'transactional',
    ourUrl: 'https://weesize.com/id/kompres-pdf-200kb',
    owners: '11zon, local tech portals',
    difficulty: 'Low (16)',
    notes: 'Huge volume in Indonesia for CPNS (civil service exams) strictly capped at 200 KB.',
    priority: 'P1',
    needsValidation: 'yes (est. 40k-80k/mo Indonesia)'
  }
];

// Write seo/keywords.csv
const header = 'keyword,language,cluster,intent,our URL,current ranking owner(s),difficulty estimate,opportunity notes,priority,needs volume validation yes/no\n';
const rows = KEYWORDS.map(k => `"${k.keyword}","${k.language}","${k.cluster}","${k.intent}","${k.ourUrl}","${k.owners}","${k.difficulty}","${k.notes}","${k.priority}","${k.needsValidation}"`).join('\n');
fs.writeFileSync('seo/keywords.csv', header + rows);
console.log(`Generated seo/keywords.csv with ${KEYWORDS.length} prioritized entries.`);

// 2. Build research/traffic-model.csv
const MODEL_DATA = [
  { cluster: 'A. Exact Size PDFs (100kb, 200kb, 500kb, 1mb, 2mb, 5mb)', pages: 12, estSearchVolMin: 180000, estSearchVolMax: 260000, targetRank: '1-3', avgCtr: 0.16, estMonthlyClicks: 35200, notes: 'Direct competitor void; exact intent match.' },
  { cluster: 'A. Exact Size Images (20kb, 50kb, 100kb, 200kb)', pages: 8, estSearchVolMin: 140000, estSearchVolMax: 220000, targetRank: '1-3', avgCtr: 0.16, estMonthlyClicks: 28800, notes: 'Massive Asian/Latin portal demand for exam uploads.' },
  { cluster: 'B. Privacy, Offline & Uncapped Modifiers', pages: 10, estSearchVolMin: 45000, estSearchVolMax: 80000, targetRank: '1-4', avgCtr: 0.12, estMonthlyClicks: 7500, notes: 'Zero upload differentiator attracts tech & privacy users.' },
  { cluster: 'C. Modern Format Converters (HEIC, WebP, AVIF to PDF/JPG)', pages: 8, estSearchVolMin: 80000, estSearchVolMax: 150000, targetRank: '2-5', avgCtr: 0.08, estMonthlyClicks: 9200, notes: 'Fast conversion on mobile without uploading.' },
  { cluster: 'D. Use Cases & Devices (Email, WhatsApp, iPhone, Mac)', pages: 12, estSearchVolMin: 65000, estSearchVolMax: 110000, targetRank: '2-5', avgCtr: 0.07, estMonthlyClicks: 6125, notes: 'Evergreen transactional help queries.' },
  { cluster: 'E. Official Presets (Passports, Visas, Government Specs)', pages: 15, estSearchVolMin: 90000, estSearchVolMax: 160000, targetRank: '2-4', avgCtr: 0.09, estMonthlyClicks: 11250, notes: 'High intent: users need exact verification.' },
  { cluster: 'F. Competitor Comparison & Alternatives (iLovePDF, Smallpdf)', pages: 5, estSearchVolMin: 35000, estSearchVolMax: 65000, targetRank: '3-5', avgCtr: 0.06, estMonthlyClicks: 3000, notes: 'High conversion audience switching from throttled tools.' },
  { cluster: 'International Localized Hubs (DE, ES, FR, PT, ID)', pages: 40, estSearchVolMin: 120000, estSearchVolMax: 200000, targetRank: '3-6', avgCtr: 0.05, estMonthlyClicks: 8000, notes: 'Translating high-opportunity exact-size terms into key languages.' }
];

const modelHeader = 'cluster,pages,estSearchVolMin,estSearchVolMax,targetRank,avgCtr,estMonthlyClicks,notes\n';
const modelRows = MODEL_DATA.map(m => `"${m.cluster}",${m.pages},${m.estSearchVolMin},${m.estSearchVolMax},"${m.targetRank}",${m.avgCtr},${m.estMonthlyClicks},"${m.notes}"`).join('\n');
fs.writeFileSync('research/traffic-model.csv', modelHeader + modelRows);
console.log('Generated research/traffic-model.csv with mathematical path to 109,075 clicks/mo.');

// 3. Build research/outreach-targets.csv
const OUTREACH_TARGETS = [
  { name: 'AlternativeTo (iLovePDF page)', url: 'https://alternativeto.net/software/ilovepdf/', type: 'Directory / Alternative listing', angle: 'Suggest Weesize as free, open-source, client-side alternative with zero server uploads.', contact: 'Public submission form at alternativeto.net' },
  { name: 'AlternativeTo (Smallpdf page)', url: 'https://alternativeto.net/software/smallpdf/', type: 'Directory / Alternative listing', angle: 'List as truly unlimited free PDF tool without 2-file/day limits.', contact: 'Public submission form at alternativeto.net' },
  { name: 'PrivacyGuides Community', url: 'https://discuss.privacyguides.net/', type: 'Privacy Community', angle: 'Present client-side in-browser PDF processing architecture; zero network requests proof.', contact: 'Forum discussion post / Tool recommendation' },
  { name: 'Hacker News (Show HN)', url: 'https://news.ycombinator.com/show', type: 'Developer / Tech Hub', angle: 'Show HN: Weesize – Zero-upload PDF engine running entirely on WebAssembly in browser.', contact: 'Public Show HN submission' },
  { name: 'Reddit r/privacy', url: 'https://reddit.com/r/privacy', type: 'Community Resource', angle: 'Share breakdown of how online PDF tools send private data to servers vs client-side wasm.', contact: 'Community post / educational guide' },
  { name: 'Reddit r/freesoftware', url: 'https://reddit.com/r/freesoftware', type: 'Open Source Community', angle: 'Free, ad-free, account-free web PDF tools.', contact: 'Community post' },
  { name: 'University IT & Student Resource Hubs (e.g. UC Berkeley, Oxford, MIT student wikis)', url: 'https://calcentral.berkeley.edu/', type: 'Academic Resource', angle: 'Recommend Weesize to students for thesis/paper compression under portal limits without uploading thesis drafts to commercial servers.', contact: 'Student council / IT helpdesk suggestion' },
  { name: 'GitHub Awesome Lists (Awesome Privacy / Awesome WebAssembly)', url: 'https://github.com/pluja/awesome-privacy', type: 'GitHub Curation', angle: 'Add Weesize under Web-based Privacy Tools & PDF Tools.', contact: 'Pull Request on GitHub' }
];

const outreachHeader = 'name,url,type,angle,contact\n';
const outreachRows = OUTREACH_TARGETS.map(o => `"${o.name}","${o.url}","${o.type}","${o.angle}","${o.contact}"`).join('\n');
fs.writeFileSync('research/outreach-targets.csv', outreachHeader + outreachRows);
console.log('Generated research/outreach-targets.csv.');
