import { localFacts, why, type Seed } from './factory';

export const toolSeedsB: Seed[] = [
  {
    path: 'redact',
    kind: 'tool',
    h1: 'Redact a Photo or PDF',
    keyword: 'redact pdf',
    title: 'Redact a Photo or PDF – Black Out Text | Weesize',
    description: 'Free tool to permanently black out text in PDF and image files on your device with no upload. Redacted PDFs are flattened so text cannot be copied.',
    toolId: 'redact',
    essay:
      'Redact confidential details like account numbers, home addresses, phone numbers, and signatures from PDFs and photos. Black boxes are permanently baked into flattened image layers so underlying text streams cannot be selected or copied. All redaction runs in local browser memory without uploading sensitive files.',
    steps: [
      'Choose a PDF, JPG, PNG, or WebP file to load into the visual editor.',
      'Drag across the document with mouse or finger to draw solid black redaction boxes.',
      'Select your output format (PDF, JPG, or PNG) and download your permanently redacted file.',
    ],
    points: why('redaction permanently flattens documents into image layers right on your device with zero cloud upload.'),
    facts: localFacts(
      'Redact a photo or PDF',
      'Solid black fill is baked into the rendered bitmap, completely destroying hidden text layers.',
      'Check official requirements before submitting; some visa and exam portals require unredacted originals.',
      'Download as a flattened PDF or export pages as clean JPG/PNG image files.',
    ),
    faqs: [
      {
        q: 'Is my file uploaded to an online server for redaction?',
        a: 'No. The entire redaction process runs in your browser memory via WebAssembly and HTML5 Canvas. Your sensitive document never leaves your device.',
      },
      {
        q: 'Can someone copy the blacked-out text or remove the boxes?',
        a: 'No. Unlike basic PDF editors that draw rectangles over vector text, Weesize flattens pages into raster images before applying redactions. There is zero underlying text layer in the output PDF.',
      },
      {
        q: 'Does redacting an image remove camera GPS and EXIF data?',
        a: 'Yes. Exported JPG and PNG images are freshly re-encoded from canvas, permanently stripping all embedded EXIF tags and GPS coordinates.',
      },
      {
        q: 'Can I redact multi-page PDF documents?',
        a: 'Yes. You can navigate between pages, apply redactions on any page, and export a multi-page flattened PDF or a ZIP containing all page images.',
      },
      {
        q: 'Can I run this redaction tool offline without internet?',
        a: 'Yes. Once loaded, Weesize operates completely offline. You can disconnect Wi-Fi and black out sensitive data with zero network calls.',
      },
    ],
    related: ['compress-pdf', 'compress-image', 'merge-pdf', 'image-to-pdf', 'check-pdf-before-sending'],
    guides: ['guides/is-it-safe-to-upload-pdfs', 'guides/organize-pages-before-you-send'],
    intent: 'transactional',
    priority: 1,
    keywords: ['redact pdf', 'redact image', 'black out text in pdf', 'black out sensitive information', 'pdf redactor free', 'flatten pdf redaction'],
  },
  {
    path: 'image-to-pdf',
    kind: 'tool',
    h1: 'Image to PDF Converter',
    keyword: 'image to pdf',
    title: 'Image to PDF – Convert JPG to PDF Free | Weesize',
    description: 'Free image to PDF converter. Combine JPG, PNG, and WebP into one PDF document on your device with no upload. Reorder pages and choose A4 or fit size.',
    toolId: 'images',
    essay:
      'Combine multiple JPG, PNG, and WebP photos into a clean, unified PDF document. Arrange images in the exact sequence desired, choose standard A4 or original image sizing, and download instantly. Everything runs directly on your computer or phone without transmitting data.',
    steps: [
      'Select or drop JPG, PNG, or WebP pictures into the converter.',
      'Arrange the page order using drag-and-drop or accessibility arrow buttons.',
      'Choose page size, orientation, and margins, then click Create PDF to download.',
    ],
    points: why('images are embedded directly into a PDF in local memory without uploading files.'),
    facts: localFacts(
      'Image to PDF',
      'Images are combined in the exact order displayed on screen.',
      'Supports auto-orientation, standard A4/Letter sheets, and zero-margin fit.',
      'Processes unlimited images rapidly on your computer or mobile phone.',
    ),
    faqs: [
      {
        q: 'Can I combine multiple photos into a single PDF?',
        a: 'Yes. Drop multiple images at once or add more files anytime. You can reorder them easily before generating the PDF.',
      },
      {
        q: 'Will my pictures lose quality during PDF creation?',
        a: 'Weesize embeds your images at full resolution by default, ensuring photos, receipts, and scans remain sharp.',
      },
      {
        q: 'Are my photos sent to an external server?',
        a: 'No. The conversion runs entirely client-side inside your browser sandbox. No file is ever transmitted over the network.',
      },
      {
        q: 'Can I compress the resulting PDF to fit form size limits?',
        a: 'Yes. After creating your PDF, click "Compress to exact size" to shrink the document to 100 KB, 200 KB, or any custom target.',
      },
      {
        q: 'Does this image to PDF tool work without Wi-Fi?',
        a: 'Yes. The image embedding engine runs fully client-side. You can create PDFs offline without any active internet connection.',
      },
    ],
    related: ['compress-pdf', 'pdf-to-image', 'merge-pdf', 'compress-image', 'redact'],
    guides: ['guides/shrink-photos-for-applications', 'guides/is-it-safe-to-upload-pdfs'],
    intent: 'transactional',
    priority: 1,
    keywords: ['jpg to pdf', 'image to pdf', 'combine images into pdf', 'convert photos to pdf', 'png to pdf', 'multiple images to one pdf'],
  },
  {
    path: 'pdf-to-image',
    kind: 'tool',
    h1: 'PDF to Image Converter',
    keyword: 'pdf to jpg',
    title: 'PDF to Image – Convert PDF to JPG or PNG | Weesize',
    description: 'Convert PDF pages into high-resolution JPG or PNG images on your device with no upload. Free, fast extractor with standard and 2x HD quality.',
    toolId: 'pdf-images',
    essay:
      'Extract pages from any PDF as standalone JPG or PNG images. Select specific page ranges or convert the entire document with selectable resolution up to 2x high-definition rendering. Renders directly in browser memory without sending documents to cloud servers.',
    steps: [
      'Select or drop a PDF document into the tool.',
      'Specify page ranges to extract (or leave blank for all pages).',
      'Choose output format (JPG or PNG) and quality, then click Convert.',
    ],
    points: why('PDF pages are rendered onto local canvas elements with zero server interaction.'),
    facts: localFacts(
      'PDF to Image',
      'Outputs high-clarity JPG for photographs or lossless PNG for text documents.',
      'Single pages download directly as image files; multi-page extractions download as a convenient ZIP.',
      'Fast, private client-side rendering with no file transfer delays.',
    ),
    faqs: [
      {
        q: 'Which format should I choose: JPG or PNG?',
        a: 'Choose JPG for photographic scans and smaller file sizes. Choose PNG for sharp text, line drawings, and official forms where lossless clarity is needed.',
      },
      {
        q: 'How do I extract only specific pages from a large PDF?',
        a: 'Enter your desired page numbers in the range field (e.g. 1-3, 5). The tool will only render and export those specific pages.',
      },
      {
        q: 'Does converting a PDF to images upload my document?',
        a: 'No. Rendering is performed 100% locally on your device using WebAssembly. Your documents stay strictly private.',
      },
      {
        q: 'Can I resize the extracted images to an exact KB target for a portal?',
        a: 'Yes. After downloading, click "Compress image to exact size" to fit the extracted images into 20 KB, 50 KB, or 100 KB form budgets.',
      },
      {
        q: 'Can I extract PDF pages as images on mobile phones?',
        a: 'Yes. The converter runs smoothly on iOS and Android devices directly in Safari or Chrome without installing apps.',
      },
    ],
    related: ['image-to-pdf', 'compress-image', 'split-pdf', 'compress-pdf', 'redact'],
    guides: ['guides/is-it-safe-to-upload-pdfs', 'guides/split-a-pdf-by-page-range'],
    intent: 'transactional',
    priority: 1,
    keywords: ['pdf to jpg', 'pdf to png', 'pdf to image', 'convert pdf to jpeg', 'extract pdf pages as images', 'pdf page extractor'],
  },
  {
    path: 'resize-image-pixels',
    kind: 'tool',
    h1: 'Resize Image in Pixels, CM or MM',
    keyword: 'resize image in pixels',
    title: 'Resize Image in Pixels, CM or MM Free | Weesize',
    description: 'Free tool to resize image in pixels, cm, or mm with custom DPI and aspect ratio lock. Processed on your device with no upload. Preview file size.',
    toolId: 'resize-pixels',
    essay:
      'Change image dimensions in exact pixels or print units (centimeters / millimeters at 300 DPI). Features aspect ratio lock, JPG/PNG output choice, and live file size preview before download. All pixel scaling executes in local browser memory with zero network requests.',
    steps: [
      'Choose a JPG, PNG, WebP, or AVIF image to resize.',
      'Select pixels (px), centimeters (cm), or millimeters (mm) and enter width/height.',
      'Preview estimated file size and click Download to save your resized image.',
    ],
    points: why('image scaling is computed directly on your device GPU and canvas with no data transmission.'),
    facts: localFacts(
      'Resize Image in Pixels',
      'Switch freely between pixels, centimeters, and millimeters with configurable DPI (default 300 DPI).',
      'Aspect ratio locking prevents unintended stretching or distortion.',
      'Live output pixel dimensions and estimated file weight displayed before export.',
    ),
    faqs: [
      {
        q: 'What is the difference between resizing pixels and compressing file size?',
        a: 'Resizing changes the physical pixel grid (e.g. 1920×1080 to 800×600 px). Compressing reduces the storage weight in KB/MB while maintaining dimensions. Both help fit online form limits.',
      },
      {
        q: 'How do I convert centimeters or millimeters to pixels?',
        a: 'Select CM or MM mode and enter your dimensions. Weesize automatically calculates pixels using standard 300 DPI print density (or custom DPI).',
      },
      {
        q: 'Will my resized photo be distorted?',
        a: 'No. The "Keep aspect ratio" option is enabled by default, ensuring width and height scale proportionally without stretching.',
      },
      {
        q: 'Can I compress the resized photo to an exact KB target afterward?',
        a: 'Yes. Click "Compress to exact KB size" after downloading to bring the resized image under 20 KB, 50 KB, or 100 KB.',
      },
      {
        q: 'Are my pictures uploaded to resize them?',
        a: 'No. Canvas scaling is performed locally on your device. Your pictures never leave your browser sandbox.',
      },
    ],
    related: ['compress-image', 'signature-resizer', 'id-photo', 'image-to-pdf', 'redact'],
    guides: ['guides/shrink-photos-for-applications', 'guides/is-it-safe-to-upload-pdfs'],
    intent: 'transactional',
    priority: 1,
    keywords: ['resize image in pixels', 'resize image in cm', 'change image dimensions', 'resize photo pixels', 'resize image mm 300 dpi', 'photo dimension changer'],
  },
  {
    path: 'heic-to-jpg',
    kind: 'tool',
    h1: 'HEIC to JPG Converter',
    keyword: 'heic to jpg',
    title: 'HEIC to JPG – Convert iPhone Photos Free | Weesize',
    description: 'Free HEIC to JPG converter for iPhone photos. Batch convert Apple HEIC and HEIF photos to standard JPG or PNG format on your device with no upload.',
    toolId: 'heic',
    essay:
      'Convert Apple iPhone HEIC and HEIF photos into universally compatible JPG or PNG images. Process single photos or batches at once without uploading private family photos to third-party cloud servers. Runs entirely in your browser with complete privacy.',
    steps: [
      'Select or drop your iPhone HEIC/HEIF photos into the converter.',
      'Choose output format: standard JPG or lossless PNG.',
      'Click Convert to JPG to download individual photos or a ZIP archive.',
    ],
    points: why('HEIC photo decoding and JPG encoding happen locally in your browser memory.'),
    facts: localFacts(
      'HEIC to JPG',
      'Converts iPhone HEIC photos to standard JPEG compatible with all portals and websites.',
      'Batch processing allows converting multiple camera roll photos simultaneously.',
      'Private and secure: zero photos are transferred across the internet.',
    ),
    faqs: [
      {
        q: 'Why do iPhone photos save as HEIC instead of JPG?',
        a: 'Apple uses High Efficiency Image Container (HEIC) to save storage space on iOS devices. However, many websites, government portals, and Windows apps require standard JPG.',
      },
      {
        q: 'Can I convert multiple HEIC photos at the same time?',
        a: 'Yes. Drop multiple HEIC files into Weesize; they will be converted in batch and packaged into a ZIP archive for easy download.',
      },
      {
        q: 'Does converting HEIC to JPG upload my private photos?',
        a: 'No. All image decoding and re-encoding are executed on your device using client-side technologies. Your photos never leave your device.',
      },
      {
        q: 'Can I shrink the converted JPGs to fit email or upload size caps?',
        a: 'Yes. Click "Compress to exact KB size" after converting to reduce the file size to 50 KB, 100 KB, or 200 KB.',
      },
      {
        q: 'Does this HEIC converter work on Windows and Android?',
        a: 'Yes. You can open Weesize on any modern browser on Windows, Mac, iOS, or Android to convert HEIC photos easily.',
      },
    ],
    related: ['compress-image', 'image-to-pdf', 'resize-image-pixels', 'id-photo'],
    guides: ['guides/shrink-photos-for-applications', 'guides/is-it-safe-to-upload-pdfs'],
    intent: 'transactional',
    priority: 1,
    keywords: ['heic to jpg', 'convert iphone photo to jpg', 'heif to jpg', 'heic to png', 'apple photo converter', 'batch heic to jpg'],
  },
];
