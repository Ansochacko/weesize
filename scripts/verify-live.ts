import { brandOrigin } from '../src/brand.ts';

const urlsToVerify = [
  '/',
  '/compress-image-to-20kb',
  '/resize-signature-to-20kb',
  '/compress-pdf-to-100kb',
  '/tools',
  '/about',
  '/privacy',
  '/sitemap.xml',
  '/robots.txt',
];

console.log(`=== Verifying Live Pages on ${brandOrigin()} ===`);

async function verifyUrl(path: string): Promise<boolean> {
  const url = `${brandOrigin()}${path}`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'WeesizeVerification/1.0' } });
    if (!res.ok) {
      console.error(`❌ [${res.status}] ${url}`);
      return false;
    }
    const text = await res.text();

    // Verification checks
    if (path.endsWith('.xml') || path.endsWith('.txt')) {
      console.log(`✅ [${res.status}] ${url} (${text.length} bytes)`);
      return true;
    }

    // Tool pages should NOT contain Popular tools or home view content before tool
    if (path !== '/' && path !== '/tools') {
      const hasHomeHero = text.includes('hero-panel precision-card');
      const hasLeakingHome = text.includes('id="view-home"') && !text.includes('id="view-home" hidden');
      if (hasHomeHero || hasLeakingHome) {
        console.warn(`⚠️ Warning: ${url} may contain home page content`);
      }
    }

    console.log(`✅ [${res.status}] ${url} (${text.length} bytes)`);
    return true;
  } catch (err) {
    console.error(`❌ Error fetching ${url}:`, err instanceof Error ? err.message : err);
    return false;
  }
}

async function run(): Promise<void> {
  let allOk = true;
  for (const path of urlsToVerify) {
    const ok = await verifyUrl(path);
    if (!ok) allOk = false;
  }
  if (allOk) {
    console.log('=== All live URLs verified successfully ===');
  } else {
    console.warn('=== Some live URL checks failed or returned non-200 ===');
  }
}

void run();
