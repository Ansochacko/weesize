export interface SizePageConfig {
  slug: string;
  targetKb: number;
  fileType: 'pdf' | 'image' | 'jpg';
  targetPhrase: string;
  title: string;
  description: string;
  h1: string;
  intro: string;
}

export const EXACT_SIZE_PAGES: SizePageConfig[] = [
  {
    slug: 'compress-pdf-to-150kb',
    targetKb: 150,
    fileType: 'pdf',
    targetPhrase: 'compress pdf to 150kb',
    title: 'Compress PDF to 150 KB – Free & Private | Weesize',
    description: 'Compress PDF to 150 KB or less in seconds. Free, unlimited, and 100% private: files stay on your device with no upload. Select your file now.',
    h1: 'Compress PDF to 150 KB',
    intro: 'Compress your PDF to fit under 150 KB for portal and form uploads. Text remains crisp and readable while images are optimized directly in your browser.',
  },
  {
    slug: 'compress-image-to-20kb',
    targetKb: 20,
    fileType: 'image',
    targetPhrase: 'resize image to 20kb',
    title: 'Resize Image to 20 KB – Exact File Size | Weesize',
    description: 'Compress and resize photos to under 20 KB for online application forms. 100% private, free, and processed entirely on your device with no upload.',
    h1: 'Resize Image to 20 KB',
    intro: 'Resize image file size to 20 KB or less. Scales dimensions and optimizes encoding so your photo or avatar fits online form requirements perfectly.',
  },
  {
    slug: 'compress-jpg-to-50kb',
    targetKb: 50,
    fileType: 'jpg',
    targetPhrase: 'jpg size 50 kb',
    title: 'JPG Size 50 KB – Compress Photo to 50 KB | Weesize',
    description: 'Reduce JPG photo size to 50 KB or less for government and job portal uploads. Free, instant, and 100% private: processed on your device.',
    h1: 'Compress JPG to 50 KB',
    intro: 'Make your JPG file size under 50 KB without losing clarity. Automatically balances dimensions and compression on your device with zero upload.',
  },
];
