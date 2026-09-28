import fs from 'node:fs';

const p100 = fs.readFileSync('dist/compress-pdf-to-100kb/index.html', 'utf8');
console.log('--- 100KB Page ---');
console.log('Title:', p100.match(/<title>(.*?)<\/title>/)?.[1]);
console.log('Description:', p100.match(/name="description" content="(.*?)"/)?.[1]);
console.log('FAQPage Schema present:', p100.includes('"@type":"FAQPage"') || p100.includes('@type":"FAQPage'));
console.log('OG Title:', p100.match(/property="og:title" content="(.*?)"/)?.[1]);
console.log('Twitter Title:', p100.match(/name="twitter:title" content="(.*?)"/)?.[1]);

const alt = fs.readFileSync('dist/alternatives/ilovepdf/index.html', 'utf8');
console.log('\n--- iLovePDF Alternative Page ---');
console.log('Title:', alt.match(/<title>(.*?)<\/title>/)?.[1]);
console.log('Description:', alt.match(/name="description" content="(.*?)"/)?.[1]);
console.log('Compare Table HTML present:', alt.includes('compare-table'));
console.log('FAQ present:', alt.includes('FAQPage'));

const coreCompress = fs.readFileSync('dist/compress-pdf/index.html', 'utf8');
console.log('\n--- Compress PDF Tool ---');
console.log('Title:', coreCompress.match(/<title>(.*?)<\/title>/)?.[1]);
console.log('Description:', coreCompress.match(/name="description" content="(.*?)"/)?.[1]);
