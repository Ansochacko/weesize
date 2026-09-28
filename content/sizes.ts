import { localFacts, why, type Seed } from './factory';
import { IMAGE_SIZE_SLUGS, PDF_SIZE_SLUGS } from '../src/seo/routes';

function label(kb: number): string {
  return kb >= 1024 && kb % 1024 === 0 ? `${kb / 1024} MB` : `${kb} KB`;
}

function neighbors(slug: string, family: string[]): string[] {
  const index = family.indexOf(slug);
  return [family[index - 1], family[index + 1]].filter((item): item is string => Boolean(item));
}

const PDF_KB: Record<string, number> = {
  'compress-pdf-to-20kb': 20,
  'compress-pdf-to-50kb': 50,
  'compress-pdf-to-100kb': 100,
  'compress-pdf-to-150kb': 150,
  'compress-pdf-to-200kb': 200,
  'compress-pdf-to-300kb': 300,
  'compress-pdf-to-500kb': 500,
  'compress-pdf-to-1mb': 1024,
  'compress-pdf-to-2mb': 2048,
  'compress-pdf-to-5mb': 5120,
  'compress-pdf-to-10mb': 10240,
};

const PDF_SCENE: Record<string, string> = {
  'compress-pdf-to-20kb':
    'Twenty kilobytes is a short plain-text note, not a photograph of a page. A one-page letter exported from a word processor can land near it. A phone picture of the same letter usually cannot, because sharp pixels weigh more than 20 KB. Use this target for a tiny text PDF. A 50-page packet or a color scan will not reach it while the words stay legible, and the tool should stop rather than blur the page into compliance.',
  'compress-pdf-to-50kb':
    'Fifty kilobytes fits a one-page text letter and sometimes a very clean black-and-white scan of a short form. It does not fit a color photo of an identity page at a size a person can check. If the source is already a text export, Light or Recommended is enough. If it is a camera scan, expect to miss 50 KB. Keep the readable file and show the size you actually achieved.',
  'compress-pdf-to-100kb':
    'One hundred kilobytes is what people type when a form says “small PDF” and never defines small. A one- or two-page grayscale scan of a typed form can approach it. A color photo of a certificate often cannot unless it is cropped tight. This page sets 100 KB as the goal. It will not claim the download is 100 KB if the pages do not get there. A muddy seal is worse than a 180 KB file a clerk can read.',
  'compress-pdf-to-150kb':
    'One hundred and fifty kilobytes gives a little more room than a 100 KB form: a two-page grayscale packet or a one-page scan with a small logo. It is still tight for a color brochure. Use it when the instructions say “under 200 KB” and you want a margin. The honest result may land above 150 KB with the pictures still recognizable, which is the result to keep.',
  'compress-pdf-to-200kb':
    'Two hundred kilobytes covers a short grayscale letter and sometimes three clean pages. It is large enough that body text and a signature can stay sharp, and small enough for a slow mailbox. Color photos of whiteboards will overshoot. Prefer this over 20 KB whenever a person has to read the page. The original is kept if the new file is not actually smaller.',
  'compress-pdf-to-300kb':
    'Three hundred kilobytes suits a four- or five-page text packet, or two careful grayscale scans. It is a poor target for a photo deck; those belong nearer a megabyte if the pictures matter. Use 300 KB when someone said “a few hundred kilobytes” and the source is mostly words. The compressor will not throw away the text to hit the number. Files already under 300 KB should be left alone.',
  'compress-pdf-to-500kb':
    'Five hundred kilobytes fits a short report with a couple of images, or about six grayscale scan pages. It is large next to a 100 KB form and small next to a packet of phone photos. Choose it when the figures matter and nobody demanded a tiny cap. Recommended strength is usually enough. Strong is for when images, not fonts, are still pushing you over the line.',
  'compress-pdf-to-1mb':
    'One megabyte holds a modest slide export or about ten scan pages that are not huge color photos. It is a comfortable size for mail systems that accept ordinary attachments, without this page inventing a vendor’s cap. Use 1 MB when the packet should feel light and a chart should still look like itself. A file already under a megabyte does not need another pass.',
  'compress-pdf-to-2mb':
    'Two megabytes is enough for a longer scanned packet or a short photo essay inside a PDF. Recommended compression cleans phone photos here without the brittle look of a tiny target. Use 2 MB for something you will read on a laptop, not for a form that asked for a stamp-sized upload. Efficient text pages will barely move, and that is the correct outcome.',
  'compress-pdf-to-5mb':
    'Five megabytes is a large but reasonable size for a design review: several color pages, a portfolio excerpt, a long notebook scan. It is the wrong goal if a form asked for 100 KB. Use it to stop a 40 MB photo PDF from being rude while the images stay recognizable. Start with Recommended and go stronger only if you are still well above 5 MB.',
  'compress-pdf-to-10mb':
    'Ten megabytes is a ceiling for a big packet, not a diet. A photo set or a long color scan can aim here so it moves more politely without looking like a thumbnail. A 12 MB file that is “all text” usually hides images or a broken export; Repair PDF or a fresh export may matter more than another squeeze. Ten megabytes will not make a 200-page scan tiny. It makes an oversized one less oversized.',
};

import type { Faq } from '../src/seo/document';

const CUSTOM_SIZE_FAQS: Record<string, Faq[]> = {
  'compress-pdf-to-100kb': [
    {
      q: 'How do I compress a PDF to under 100 KB without losing text readability?',
      a: 'Add your PDF to the Weesize compressor. The client-side engine re-encodes scanned images to optimal resolution while preserving vector text and fonts intact. Because text streams remain untouched, words stay completely sharp at 100 KB.',
    },
    {
      q: 'Can a multi-page scanned document reach 100 KB?',
      a: 'A clean 1 to 2 page grayscale document can reach 100 KB comfortably. However, a multi-page color scan may require aggressive downsampling; if reaching 100 KB would make signatures unreadable, Weesize stops at the safe quality floor.',
    },
    {
      q: 'Why did my file land at 115 KB instead of exactly 100 KB?',
      a: 'Weesize treats 100 KB as a target ceiling, not a destructive cutoff. If compressing pictures further would blur essential numbers or stamps into illegibility, the compressor delivers the smallest readable copy rather than corrupting data.',
    },
    {
      q: 'Is it safe to compress confidential financial or legal forms to 100 KB here?',
      a: 'Yes. All compression operations run locally inside your browser via WebAssembly. Your confidential forms, contracts, and tax documents are never uploaded to remote servers, stored in databases, or viewed by third parties.',
    },
    {
      q: 'Can I use this 100 KB PDF compressor completely offline without Wi-Fi?',
      a: 'Yes. Because Weesize operates entirely client-side, you can load the page once, turn off your internet or switch to airplane mode, and compress files offline. The file processing never makes a network request.',
    },
  ],
  'compress-pdf-to-200kb': [
    {
      q: 'How do I reduce a PDF to 200 KB for government or job application portals?',
      a: 'Many civil service and job portals enforce a 200 KB attachment cap. Select your PDF on this page; Weesize automatically sets the compression target to 200 KB and shrinks embedded scans to fit the portal ceiling.',
    },
    {
      q: 'What types of documents can realistically fit under 200 KB?',
      a: 'Typical 2 to 4 page resumes, letters of recommendation, and grayscale certificates fit easily under 200 KB. High-resolution color photos of diplomas may need tight cropping to fit within 200 KB.',
    },
    {
      q: 'Will shrinking a PDF to 200 KB remove digital signatures or form fields?',
      a: 'No. Weesize optimizes image streams and redundant object structures without stripping interactive form elements or standard PDF text streams. Your document structure remains fully intact.',
    },
    {
      q: 'What happens if my file is already smaller than 200 KB?',
      a: 'If your document is already below 200 KB, Weesize detects this and returns the original file untouched. We never recompress or degrade an already compliant file.',
    },
    {
      q: 'Does compressing to 200 KB require an account or credit card?',
      a: 'No account, sign-up, or payment is required. All tools on Weesize are free forever with no daily document caps or hidden upgrade gates.',
    },
  ],
  'compress-pdf-to-500kb': [
    {
      q: 'How do I compress a PDF report to 500 KB for email attachments?',
      a: 'Select or drag your report into the compressor. The target is preset to 500 KB. The browser-based engine optimizes photographic figures and diagram bitmaps to deliver an email-friendly file.',
    },
    {
      q: 'Will charts and technical diagrams stay readable at 500 KB?',
      a: 'Yes. At 500 KB, there is ample byte budget for clean charts, diagrams, and corporate letterheads. The compressor balances compression ratio with edge sharpness so fine lines remain distinct.',
    },
    {
      q: 'Can I compress large 50 MB PDFs down to 500 KB?',
      a: 'If the 50 MB file consists of uncompressed scans or high-res photos, our Strong compression mode can often achieve a 90%+ size reduction toward 500 KB while keeping text perfectly legible.',
    },
    {
      q: 'Does Weesize place a watermark on the 500 KB output?',
      a: 'Never. Weesize produces clean, unmodified PDF documents without watermarks, stamps, or promotional links added to your pages.',
    },
    {
      q: 'How does client-side 500 KB compression protect my data?',
      a: 'Traditional PDF sites upload your document across the internet to their servers. Weesize processes the PDF entirely inside your browser local memory, ensuring zero data transmission.',
    },
  ],
  'compress-pdf-to-1mb': [
    {
      q: 'Why compress a PDF to 1 MB?',
      a: 'One megabyte is the standard safety threshold for corporate email systems and automated submission gateways. Files under 1 MB rarely bounce or trigger spam attachment filters.',
    },
    {
      q: 'What fits comfortably in a 1 MB PDF file?',
      a: 'A 1 MB PDF easily accommodates 10 to 20 pages of mixed text and color diagrams, or a comprehensive presentation slide deck exported from PowerPoint or Keynote.',
    },
    {
      q: 'How does Weesize achieve 1 MB compression faster than other sites?',
      a: 'Because files are processed directly on your computer or mobile device without uploading across slow network uplinks, processing completes in milliseconds without server queues.',
    },
    {
      q: 'Will bookmarks and page numbers remain when compressing to 1 MB?',
      a: 'Yes. Document outlines, bookmarks, annotations, and internal links are preserved during the image optimization pass.',
    },
    {
      q: 'Can I run this 1 MB compression tool on an iPhone or Android phone?',
      a: 'Yes. Weesize is built with responsive client-side WebAssembly that works smoothly in mobile Safari, Chrome, and Firefox on iOS and Android devices.',
    },
  ],
  'compress-image-to-20kb': [
    {
      q: 'How do I compress an image to under 20 KB?',
      a: 'Choose or drag your image into Weesize. The tool automatically sets the target size to 20 KB, adjusts the pixel dimensions, and applies balanced compression locally in your browser.',
    },
    {
      q: 'What image formats can be compressed to 20 KB?',
      a: 'Weesize supports JPEG, PNG, WebP, and AVIF. For a 20 KB target, JPEG and WebP produce the cleanest results for photos and avatars.',
    },
    {
      q: 'Will compressing to 20 KB blur faces or text?',
      a: 'At 20 KB, pixel dimensions are reduced to fit the tight file budget. For passport headshots and avatars, faces remain clear and recognizable. Highly detailed text or fine line drawings are better suited for 50 KB or 100 KB.',
    },
    {
      q: 'Are my photos uploaded to a cloud server to shrink them?',
      a: 'No. Everything runs in your browser using canvas and WebAssembly. Your photos never leave your device.',
    },
    {
      q: 'Can I compress images to 20 KB without an internet connection?',
      a: 'Yes. Once the page is loaded, the image compressor works completely offline, with zero network requests.',
    },
  ],
  'compress-image-to-50kb': [
    {
      q: 'How can I reduce a photo to under 50 KB for an online application form?',
      a: 'Many job, exam, and government portals cap ID photos at 50 KB. Drop your photo here; Weesize optimizes dimensions and compression to bring the file under 50 KB while preserving facial clarity.',
    },
    {
      q: 'Which image format is best for a 50 KB file size limit?',
      a: 'JPEG is the most widely accepted format for portals and applications. If your source is PNG, Weesize can export as JPEG to maximize quality within 50 KB.',
    },
    {
      q: 'Does compressing to 50 KB remove camera EXIF or GPS data?',
      a: 'Yes. When Weesize re-encodes the photo, privacy-sensitive metadata such as GPS coordinates, camera model, and capture timestamps are stripped.',
    },
    {
      q: 'Can I compress multiple photos to 50 KB?',
      a: 'Yes, you can drop or select multiple images in succession. Each photo is compressed quickly on your device.',
    },
    {
      q: 'Is there any cost, sign-up, or watermark on 50 KB images?',
      a: 'None. Weesize is 100% free with no watermark, no account required, and no limits.',
    },
  ],
  'compress-image-to-100kb': [
    {
      q: 'How do I compress an image to 100 KB without noticeable loss in quality?',
      a: 'Drop your image into the compressor. At 100 KB, photographic details, colors, and textures remain sharp. Weesize balances downscaling and encoding quality right on your device.',
    },
    {
      q: 'Why is 100 KB a recommended size for web photos?',
      a: 'A 100 KB image loads almost instantly even on mobile networks while providing sufficient resolution for column photos, product images, and article headers.',
    },
    {
      q: 'Can a large 5 MB or 10 MB smartphone photo shrink to 100 KB?',
      a: 'Yes. Modern smartphones take photos with 12 to 48 megapixels that take up 5 MB to 15 MB. Weesize safely scales the image dimensions to web resolutions, achieving a 95%+ size reduction to reach 100 KB.',
    },
    {
      q: 'Does Weesize store or log my photos?',
      a: 'Never. All compression runs client-side inside your browser sandbox. No photo is ever sent to or stored on any server.',
    },
    {
      q: 'Will this tool work on mobile phones?',
      a: 'Yes. The tool runs smoothly on iPhone, iPad, Android phones, tablets, and desktop computers directly in any modern browser.',
    },
  ],
  'compress-image-to-200kb': [
    {
      q: 'When should I choose a 200 KB image compression target?',
      a: 'Use 200 KB when you need crisp, high-resolution visuals for full-width banners, portfolio galleries, or email attachments where detail matters.',
    },
    {
      q: 'How does Weesize compress images to 200 KB locally?',
      a: 'Weesize uses client-side WebAssembly and HTML5 canvas APIs to decode, scale, and re-encode the image in local browser memory without uploading a single byte.',
    },
    {
      q: 'Can I compress screenshots to 200 KB and keep text sharp?',
      a: 'Yes. At 200 KB, screenshots of interfaces and documents retain sharp typography and crisp UI elements.',
    },
    {
      q: 'What if my image is already smaller than 200 KB?',
      a: 'If your file is already under 200 KB, Weesize preserves your original file without unnecessary recompression.',
    },
    {
      q: 'Are there any file size limits or daily quotas?',
      a: 'There are no file size limits and no daily usage quotas. You can compress as many images as you need.',
    },
  ],
};

export const pdfSizeSeeds: Seed[] = PDF_SIZE_SLUGS.map((slug) => {
  const kb = PDF_KB[slug] ?? 100;
  const name = label(kb);
  const customTitle =
    slug === 'compress-pdf-to-100kb'
      ? 'Compress PDF to 100 KB – Free, No Upload | Weesize'
      : slug === 'compress-pdf-to-200kb'
        ? 'Compress PDF to 200 KB – Free, No Upload | Weesize'
        : slug === 'compress-pdf-to-500kb'
          ? 'Compress PDF to 500 KB – Free, No Upload | Weesize'
          : slug === 'compress-pdf-to-1mb'
            ? 'Compress PDF to 1 MB – Free, No Upload | Weesize'
            : slug === 'compress-pdf-to-2mb'
              ? 'Compress PDF to 2 MB – Free, No Upload | Weesize'
              : `Compress PDF to ${name} – Free, No Upload | Weesize`;
  const customDesc =
    slug === 'compress-pdf-to-100kb'
      ? 'Compress PDF to 100 KB or less in seconds. Free, unlimited, and 100% private: files stay on your device with no upload. Select your file to shrink.'
      : slug === 'compress-pdf-to-200kb'
        ? 'Compress PDF to 200 KB for job and visa applications. Free, instant, and private: files stay on your device with no upload. Drop your PDF to start.'
        : slug === 'compress-pdf-to-500kb'
          ? 'Compress PDF to 500 KB while keeping text and diagrams crisp. Free, no limits, and 100% private with no upload. Drop your document to compress.'
          : slug === 'compress-pdf-to-1mb'
            ? 'Compress PDF to under 1 MB for easy email attachments. Free, fast, and 100% private: runs in your browser with no upload. Select your PDF now.'
            : slug === 'compress-pdf-to-2mb'
              ? 'Compress PDF to 2 MB for portal uploads and email. Free, unlimited, and 100% private: processed on your device with no upload. Drop your PDF now.'
              : `Compress PDF to ${name} or less in your browser. Free, unlimited, and 100% private: files stay on your device with no upload. Try it free now.`;
  return {
    path: slug,
    kind: 'size',
    h1: `Compress PDF to ${name}`,
    keyword: `compress pdf to ${name.toLowerCase()}`,
    title: customTitle,
    description: customDesc,
    toolId: 'compress',
    presetKb: kb,
    essay: PDF_SCENE[slug] ?? '',
    steps: [
      `Add the PDF. This page already sets the goal at ${name}.`,
      'Compress on this device. Text is not rewritten. Images shrink only while the new file is smaller.',
      `Read the size your system reports. If it is above ${name}, that is the floor for this file, not a failed upload.`,
    ],
    points: why(`the ${name} goal is applied here, and the PDF is not posted to a compressor.`),
    facts: localFacts(
      `Compress PDF to ${name}`,
      `${name} changes how hard images are squeezed. It does not delete pages or retype the words.`,
      `Skip a ${name} goal when the pages are already smaller, or when a color scan must stay sharp for an official check.`,
      `Compare the downloaded size with ${name}, then read a heading and a signature. Legibility outranks the exact number.`,
    ),
    faqs: CUSTOM_SIZE_FAQS[slug],
    related: ['compress-pdf', 'compress-image', 'pdf-to-jpg', 'repair-pdf', 'merge-pdf', 'split-pdf'],
    neighbors: ['compress-pdf', ...neighbors(slug, PDF_SIZE_SLUGS)],
    guides: ['guides/why-is-my-pdf-so-large', 'guides/reduce-pdf-size-without-losing-quality', 'guides/is-it-safe-to-upload-pdfs'],
    intent: 'transactional',
    priority: slug === 'compress-pdf-to-100kb' || slug === 'compress-pdf-to-200kb' ? 1 : 2,
    keywords: [`compress pdf to ${name.toLowerCase()}`, `reduce pdf to ${name.toLowerCase()}`],
  };
});

const IMAGE: Record<string, { h1: string; kb?: number; mime?: Seed['presetMime']; essay: string; keyword: string }> = {
  'compress-image-to-10kb': {
    h1: 'Compress image to 10 KB',
    kb: 10,
    keyword: 'compress image to 10kb',
    essay: 'Ten kilobytes is an icon or a tiny thumbnail, not a portrait. A small JPEG of a simple logo can live there. A face, a receipt, or a screenshot of text generally cannot, and the tool stops rather than emit gray noise. Keep the original for anything a person must read.',
  },
  'compress-image-to-20kb': {
    h1: 'Compress image to 20 KB',
    kb: 20,
    keyword: 'compress image to 20kb',
    essay: 'Twenty kilobytes fits a small avatar or a simple diagram. A photo of a document loses the small type before it hits this size. The page scales the long edge, then lowers JPEG or WebP quality, and reports the size it actually reached.',
  },
  'compress-image-to-30kb': {
    h1: 'Compress image to 30 KB',
    kb: 30,
    keyword: 'compress image to 30kb',
    essay: 'Thirty kilobytes can hold a small product photo and not a full-width hero. Screenshots of code become blotchy here. If the status line stops at a higher size, use that file. Do not re-export the blotchy one as if it had met the goal.',
  },
  'compress-image-to-50kb': {
    h1: 'Compress image to 50 KB',
    kb: 50,
    keyword: 'compress image to 50kb',
    essay: 'Fifty kilobytes is a realistic JPEG for a simple photo around 800 pixels wide. Foliage, text, and faces want more. PNG screenshots miss this target until the pixel dimensions come down, because PNG does not throw detail away with a quality slider.',
  },
  'compress-image-to-100kb': {
    h1: 'Compress image to 100 KB',
    kb: 100,
    keyword: 'compress image to 100kb',
    essay: 'One hundred kilobytes is a normal budget for a column photo. A 1600-pixel JPEG of an ordinary scene can land near it. A dense screenshot may not. Read any text in the picture after download. If you cannot, the target was too low for that shot.',
  },
  'compress-image-to-200kb': {
    h1: 'Compress image to 200 KB',
    kb: 200,
    keyword: 'compress image to 200kb',
    essay: 'Two hundred kilobytes keeps a listing photo or a slide image. Faces and printed text survive better here than at 20 KB. The new file is a fresh encode, so camera location data is not copied along. Leave pictures that are already under this size alone.',
  },
  'compress-image-to-500kb': {
    h1: 'Compress image to 500 KB',
    kb: 500,
    keyword: 'compress image to 500kb',
    essay: 'Five hundred kilobytes is a sharp web photo, not a stand-in for a camera RAW. Phone photos of several megabytes usually reach it without looking damaged. If the file is already near this size, compressing again does not add detail.',
  },
  'compress-image-to-1mb': {
    h1: 'Compress image to 1 MB',
    kb: 1024,
    keyword: 'compress image to 1mb',
    essay: 'One megabyte tames a large phone shot while keeping room to edit. It is the wrong target for an avatar. The tool resizes only when the long edge is above its working maximum, then encodes, and tells you the size it reached.',
  },
  'compress-jpg-to-20kb': {
    h1: 'Compress JPG to 20 KB',
    kb: 20,
    mime: 'image/jpeg',
    keyword: 'compress jpg to 20kb',
    essay: 'This page keeps the output as JPEG and aims at 20 KB, which forces a small pixel size. Use it for a thumbnail you will never zoom. A JPEG of a page of text will not stay sharp. If you needed PNG, use the PNG page instead.',
  },
  'compress-jpg-to-50kb': {
    h1: 'Compress JPG to 50 KB',
    kb: 50,
    mime: 'image/jpeg',
    keyword: 'compress jpg to 50kb',
    essay: 'Compress a JPEG toward 50 KB when a listing wants a small photo. Quality steps down and the long edge shrinks until the file is under the goal or the floor is hit. Simple objects survive. Screenshots do not. Check edges before you send the result.',
  },
  'compress-jpg-to-100kb': {
    h1: 'Compress JPG to 100 KB',
    kb: 100,
    mime: 'image/jpeg',
    keyword: 'compress jpg to 100kb',
    essay: 'A 100 KB JPEG is a normal inline photo. Start from the camera JPEG so you are not compressing an image that was already crushed. If the tool reports a higher size, the picture needed those bytes. Crop tighter and try again, or send the larger file.',
  },
  'compress-jpg-to-200kb': {
    h1: 'Compress JPG to 200 KB',
    kb: 200,
    mime: 'image/jpeg',
    keyword: 'compress jpg to 200kb',
    essay: 'Two hundred kilobytes is a polite JPEG for email and for a photo at half the screen. Detail in fabric and type usually survives. Prefer this over 20 KB when the image is evidence or a face. The new JPEG does not carry the camera’s GPS block.',
  },
  'resize-image-to-20kb': {
    h1: 'Resize image to 20 KB',
    kb: 20,
    keyword: 'resize image to 20kb',
    essay: 'Resizing to 20 KB changes pixel dimensions until the encoded file can fit. It is not a magical quality slider. The picture becomes small, which is what resize should mean. Use it for an avatar slot, not for a scan of a contract.',
  },
  'resize-image-to-50kb': {
    h1: 'Resize image to 50 KB',
    kb: 50,
    keyword: 'resize image to 50kb',
    essay: 'Fifty kilobytes of resized image is a small web graphic. You lose the ability to crop later. If you might print, keep the large file and only send the resized one. Neither copy is stored after you close the tab.',
  },
  'resize-image-to-100kb': {
    h1: 'Resize image to 100 KB',
    kb: 100,
    keyword: 'resize image to 100kb',
    essay: 'Resizing toward 100 KB suits a content image that should stay recognizable at a column width. A dense screenshot may stop above the goal because the pixels are the content. That stop is more useful than a blurry file that technically matched.',
  },
  'compress-png': {
    h1: 'Compress PNG',
    mime: 'image/png',
    keyword: 'compress png',
    essay: 'PNG gets smaller in a browser mainly by resizing, because it has no JPEG-style quality slider. Flat colors, screenshots, and logos are what PNG is for. Photographs usually belong in JPEG or WebP if you need them small. Transparency can stay in PNG; a JPEG would put a solid background behind a logo, so do not switch formats by accident.',
  },
  'reduce-photo-size': {
    h1: 'Reduce photo size',
    keyword: 'reduce photo size',
    essay: 'Phone photos are large because they are large in pixels and lightly compressed. This page scales the long edge and writes a new JPEG unless you picked another format. The original on disk stays until you overwrite it yourself. Location data is not copied into the download. A photo that is already a few hundred kilobytes may not shrink, and it should not be damaged to pretend.',
  },
};

export const imageSizeSeeds: Seed[] = IMAGE_SIZE_SLUGS.map((slug) => {
  const copy = IMAGE[slug];
  if (!copy) throw new Error(slug);
  const customTitle =
    slug === 'compress-image-to-20kb'
      ? 'Compress Image to 20 KB – Free, No Upload | Weesize'
      : slug === 'compress-image-to-50kb'
        ? 'Compress Image to 50 KB – Free, No Upload | Weesize'
        : slug === 'compress-image-to-100kb'
          ? 'Compress Image to 100 KB – Free, No Upload | Weesize'
          : slug === 'compress-image-to-200kb'
            ? 'Compress Image to 200 KB – Free, No Upload | Weesize'
            : undefined;
  const customDesc =
    slug === 'compress-image-to-20kb'
      ? 'Compress photos and pictures to under 20 KB for online applications and profile avatars. Free, private, processed on your device.'
      : slug === 'compress-image-to-50kb'
        ? 'Resize photos to under 50 KB for online applications and forms. JPG, PNG, WebP. Free, instant, processed on your device.'
        : slug === 'compress-image-to-100kb'
          ? 'Compress images to under 100 KB with sharp clarity. Free, unlimited, and 100% private: runs in your browser with no upload.'
          : slug === 'compress-image-to-200kb'
            ? 'Reduce image size to 200 KB for websites and email attachments. Free, high quality, and 100% private with no upload.'
            : `${copy.h1} in the browser. No upload. You get the size the picture can actually reach on this device.`;
  return {
    path: slug,
    kind: 'size',
    h1: copy.h1,
    keyword: copy.keyword,
    title: customTitle,
    description: customDesc,
    toolId: 'compress-images',
    ...(copy.kb !== undefined ? { presetKb: copy.kb } : {}),
    ...(copy.mime ? { presetMime: copy.mime } : {}),
    essay: copy.essay,
    steps: [
      'Drop the picture. The format and size goal on this page are already chosen.',
      'The browser encodes a new file. The original on disk is not overwritten.',
      'Read the status line for the size you got, then look at the subject before you send it.',
    ],
    points: why('the pixels never go to an image host.'),
    facts: localFacts(
      copy.h1,
      `${copy.h1} writes a new file. JPEG and WebP can lose detail on purpose. PNG gets smaller by having fewer pixels.`,
      `Skip ${copy.h1} when you still need the camera original for print or for an edit you have not done.`,
      `Open the ${copy.h1} download beside the original. Ringing edges mean you should use a larger target.`,
    ),
    faqs: CUSTOM_SIZE_FAQS[slug],
    related: ['compress-image', 'jpg-to-pdf', 'compress-pdf', 'png-to-jpg', 'jpg-to-webp', 'webp-to-jpg'],
    neighbors: ['compress-image', ...neighbors(slug, IMAGE_SIZE_SLUGS)],
    guides: ['guides/best-image-format-for-the-web', 'guides/shrink-photos-for-applications', 'guides/compress-images-for-email'],
    intent: 'transactional',
    priority: slug.includes('100kb') || slug.includes('50kb') || slug.includes('20kb') || slug.includes('200kb') ? 1 : 2,
    keywords: [copy.keyword],
  };
});
