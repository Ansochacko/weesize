export interface LocaleInfo {
  code: string;
  label: string;
  nativeLabel: string;
  dir: 'ltr' | 'rtl';
  htmlLang: string;
  reviewed: boolean;
}

export const SUPPORTED_LOCALES: LocaleInfo[] = [
  { code: 'en', label: 'English', nativeLabel: 'English', dir: 'ltr', htmlLang: 'en', reviewed: true },
  { code: 'hi', label: 'Hindi', nativeLabel: 'हिन्दी', dir: 'ltr', htmlLang: 'hi', reviewed: false },
  { code: 'es', label: 'Spanish', nativeLabel: 'Español', dir: 'ltr', htmlLang: 'es', reviewed: false },
  { code: 'pt-br', label: 'Portuguese (Brazil)', nativeLabel: 'Português (Brasil)', dir: 'ltr', htmlLang: 'pt-BR', reviewed: false },
  { code: 'id', label: 'Indonesian', nativeLabel: 'Bahasa Indonesia', dir: 'ltr', htmlLang: 'id', reviewed: false },
  { code: 'ar', label: 'Arabic', nativeLabel: 'العربية', dir: 'rtl', htmlLang: 'ar', reviewed: false },
  { code: 'fr', label: 'French', nativeLabel: 'Français', dir: 'ltr', htmlLang: 'fr', reviewed: false },
  { code: 'de', label: 'German', nativeLabel: 'Deutsch', dir: 'ltr', htmlLang: 'de', reviewed: false },
  { code: 'fil', label: 'Filipino', nativeLabel: 'Filipino', dir: 'ltr', htmlLang: 'fil', reviewed: false },
  { code: 'bn', label: 'Bengali', nativeLabel: 'বাংলা', dir: 'ltr', htmlLang: 'bn', reviewed: false },
  { code: 'ur', label: 'Urdu', nativeLabel: 'اردو', dir: 'rtl', htmlLang: 'ur', reviewed: false },
];

export const UI_STRINGS: Record<string, Record<string, string>> = {
  en: {
    tagline: 'Get any file to the exact size any form needs, anywhere in the world.',
    subtag: '100% on-device. Your files never leave your browser.',
    searchPlaceholder: 'Search tools or form presets…',
    dropTitle: 'Drop files here',
    dropSub: 'or click to browse from this device',
    chooseFiles: 'Choose files',
    compress: 'Compress',
    compressPdf: 'Compress PDF',
    compressImage: 'Compress image',
    signatureResizer: 'Signature resizer',
    idPhoto: 'ID & passport photo',
    imagesToPdf: 'Images to PDF',
    exactSize: 'Exact size',
    targetSize: 'Target size',
    verifiedRule: 'Verified upload rules',
    customRule: 'Custom form rule',
    customPlaceholder: 'e.g. JPG, 20–50 KB, 200×230 px',
    applyRule: 'Apply rule',
    cleanPaper: 'Clean background to white',
    darkenInk: 'Darken pen ink',
    crop: 'Crop',
    download: 'Download',
    downloadSheet: 'Download print sheet',
    switchSuggestion: 'Weesize is available in {lang}. Switch?',
    switchBtn: 'Switch',
    dismiss: 'Dismiss',
    allTools: 'All tools',
    popularTools: 'Popular tools',
    comingSoon: 'Coming soon',
    offlineReady: 'Processed on your device',
    toolsTitle: 'Tools',
    convertTitle: 'Convert',
    companyTitle: 'Company',
    legalTitle: 'Legal',
    about: 'About',
    privacy: 'Privacy',
    guides: 'Guides',
    brand: 'Brand',
  },
  hi: {
    tagline: 'दुनिया के किसी भी फॉर्म के लिए किसी भी फ़ाइल को सटीक आकार में बदलें।',
    subtag: '100% आपके डिवाइस पर। आपकी फाइलें कभी अपलोड नहीं होती हैं।',
    searchPlaceholder: 'टूल या फॉर्म नियम खोजें…',
    dropTitle: 'फ़ाइलें यहाँ छोड़ें',
    dropSub: 'या अपने डिवाइस से चुनें',
    chooseFiles: 'फ़ाइलें चुनें',
    compress: 'कंप्रेस करें',
    compressPdf: 'PDF कंप्रेस करें',
    compressImage: 'फ़ोटो कंप्रेस करें',
    signatureResizer: 'हस्ताक्षर रिसाइज़र',
    idPhoto: 'पासपोर्ट और ID फ़ोटो',
    imagesToPdf: 'फ़ोटो से PDF बनाएं',
    exactSize: 'सटीक आकार',
    targetSize: 'लक्षित आकार (KB)',
    verifiedRule: 'सत्यापित नियम',
    customRule: 'कस्टम फॉर्म नियम',
    customPlaceholder: 'उदा. JPG, 20–50 KB, 200×230 px',
    applyRule: 'नियम लागू करें',
    cleanPaper: 'पृष्ठभूमि सफ़ेद करें',
    darkenInk: 'स्याही गहरी करें',
    crop: 'क्रॉप करें',
    download: 'डाउनलोड करें',
    downloadSheet: 'प्रिंट शीट डाउनलोड करें',
    switchSuggestion: 'Weesize हिन्दी में भी उपलब्ध है। बदलें?',
    switchBtn: 'हिन्दी चुनें',
    dismiss: 'हटाएं',
    allTools: 'सभी टूल्स',
    popularTools: 'लोकप्रिय टूल्स',
    comingSoon: 'जल्द आ रहा है',
    offlineReady: 'आपके डिवाइस पर प्रोसेस हुआ',
    toolsTitle: 'टूल्स',
    convertTitle: 'कन्वर्ट',
    companyTitle: 'कंपनी',
    legalTitle: 'कानूनी',
    about: 'हमारे बारे में',
    privacy: 'गोपनीयता',
    guides: 'गाइड',
    brand: 'ब्रांड',
  },
  es: {
    tagline: 'Adapta cualquier archivo al tamaño exacto que pide cualquier formulario en el mundo.',
    subtag: '100% en tu dispositivo. Tus archivos nunca salen de tu navegador.',
    searchPlaceholder: 'Buscar herramientas o requisitos…',
    dropTitle: 'Arrastra tus archivos aquí',
    dropSub: 'o haz clic para seleccionar de tu dispositivo',
    chooseFiles: 'Seleccionar archivos',
    compress: 'Comprimir',
    compressPdf: 'Comprimir PDF',
    compressImage: 'Comprimir imagen',
    signatureResizer: 'Redimensionar firma',
    idPhoto: 'Foto de carné y pasaporte',
    imagesToPdf: 'Imágenes a PDF',
    exactSize: 'Tamaño exacto',
    targetSize: 'Tamaño objetivo',
    verifiedRule: 'Requisitos verificados',
    customRule: 'Requisito personalizado',
    customPlaceholder: 'ej. JPG, 20–50 KB, 200×230 px',
    applyRule: 'Aplicar requisito',
    cleanPaper: 'Fondo blanco limpio',
    darkenInk: 'Oscurecer tinta',
    crop: 'Recortar',
    download: 'Descargar',
    downloadSheet: 'Descargar hoja de impresión',
    switchSuggestion: 'Weesize está disponible en Español. ¿Cambiar?',
    switchBtn: 'Cambiar a Español',
    dismiss: 'Cerrar',
    allTools: 'Todas las herramientas',
    popularTools: 'Herramientas populares',
    comingSoon: 'Próximamente',
    offlineReady: 'Procesado en tu dispositivo',
    toolsTitle: 'Herramientas',
    convertTitle: 'Convertir',
    companyTitle: 'Compañía',
    legalTitle: 'Legal',
    about: 'Acerca de',
    privacy: 'Privacidad',
    guides: 'Guías',
    brand: 'Marca',
  },
  'pt-br': {
    tagline: 'Ajuste qualquer arquivo para o tamanho exato de qualquer formulário no mundo.',
    subtag: '100% no seu dispositivo. Seus arquivos nunca saem do seu navegador.',
    searchPlaceholder: 'Pesquisar ferramentas ou formulários…',
    dropTitle: 'Arraste arquivos aqui',
    dropSub: 'ou clique para escolher do dispositivo',
    chooseFiles: 'Escolher arquivos',
    compress: 'Comprimir',
    compressPdf: 'Comprimir PDF',
    compressImage: 'Comprimir imagem',
    signatureResizer: 'Redimensionar assinatura',
    idPhoto: 'Foto 3x4 e passaporte',
    imagesToPdf: 'Imagens para PDF',
    exactSize: 'Tamanho exato',
    targetSize: 'Tamanho desejado',
    verifiedRule: 'Regras verificadas',
    customRule: 'Regra personalizada',
    customPlaceholder: 'ex. JPG, 20–50 KB, 200×230 px',
    applyRule: 'Aplicar regra',
    cleanPaper: 'Fundo branco limpo',
    darkenInk: 'Escurecer tinta',
    crop: 'Cortar',
    download: 'Baixar',
    downloadSheet: 'Baixar folha de impressão',
    switchSuggestion: 'Weesize está disponível em Português. Mudar?',
    switchBtn: 'Mudar para Português',
    dismiss: 'Fechar',
    allTools: 'Todas as ferramentas',
    popularTools: 'Ferramentas populares',
    comingSoon: 'Em breve',
    offlineReady: 'Processado no seu dispositivo',
    toolsTitle: 'Ferramentas',
    convertTitle: 'Converter',
    companyTitle: 'Empresa',
    legalTitle: 'Legal',
    about: 'Sobre',
    privacy: 'Privacidade',
    guides: 'Guias',
    brand: 'Marca',
  },
  id: {
    tagline: 'Ubah ukuran file apa pun agar sesuai dengan formulir apa pun di seluruh dunia.',
    subtag: '100% di perangkat Anda. File Anda tidak pernah diunggah.',
    searchPlaceholder: 'Cari alat atau syarat formulir…',
    dropTitle: 'Tarik file ke sini',
    dropSub: 'atau klik untuk memilih dari perangkat',
    chooseFiles: 'Pilih file',
    compress: 'Kompres',
    compressPdf: 'Kompres PDF',
    compressImage: 'Kompres Foto',
    signatureResizer: 'Ubah Ukuran Tanda Tangan',
    idPhoto: 'Pas Foto & Visa',
    imagesToPdf: 'Foto ke PDF',
    exactSize: 'Ukuran tepat',
    targetSize: 'Target ukuran',
    verifiedRule: 'Aturan terverifikasi',
    customRule: 'Aturan khusus',
    customPlaceholder: 'cth. JPG, 20–50 KB, 200×230 px',
    applyRule: 'Terapkan aturan',
    cleanPaper: 'Bersihkan latar jadi putih',
    darkenInk: 'Pertajam tinta pulpen',
    crop: 'Potong',
    download: 'Unduh',
    downloadSheet: 'Unduh lembar cetak',
    switchSuggestion: 'Weesize tersedia dalam Bahasa Indonesia. Beralih?',
    switchBtn: 'Beralih ke Bahasa Indonesia',
    dismiss: 'Tutup',
    allTools: 'Semua alat',
    popularTools: 'Alat populer',
    comingSoon: 'Segera hadir',
    offlineReady: 'Diproses di perangkat Anda',
    toolsTitle: 'Alat',
    convertTitle: 'Konversi',
    companyTitle: 'Perusahaan',
    legalTitle: 'Hukum',
    about: 'Tentang',
    privacy: 'Privasi',
    guides: 'Panduan',
    brand: 'Merek',
  },
  ar: {
    tagline: 'اضبط أي ملف للحجم المطلوب لأي استمارة في أي مكان بالعالم.',
    subtag: '١٠٠٪ على جهازك فقط. ملفاتك لا تغادر متصفحك أبداً.',
    searchPlaceholder: 'ابحث عن الأدوات أو شروط التقديم…',
    dropTitle: 'اسحب الملفات هنا',
    dropSub: 'أو انقر للاختيار من جهازك',
    chooseFiles: 'اختر الملفات',
    compress: 'ضغط',
    compressPdf: 'ضغط PDF',
    compressImage: 'ضغط الصور',
    signatureResizer: 'تعديل حجم التوقيع',
    idPhoto: 'صور الجوازات والهوية',
    imagesToPdf: 'تحويل الصور إلى PDF',
    exactSize: 'الحجم الدقيق',
    targetSize: 'الحجم المستهدف',
    verifiedRule: 'شروط معتمدة',
    customRule: 'قاعدة مخصصة',
    customPlaceholder: 'مثال: JPG, 20–50 KB, 200×230 px',
    applyRule: 'تطبيق القاعدة',
    cleanPaper: 'تبييض الخلفية وإزالة الظلال',
    darkenInk: 'تغميق حبر التوقيع',
    crop: 'قص الصورة',
    download: 'تحميل',
    downloadSheet: 'تحميل ورقة الطباعة',
    switchSuggestion: 'موقع Weesize متوفر باللغة العربية. هل ترغب بالتبديل؟',
    switchBtn: 'التبديل إلى العربية',
    dismiss: 'إلغاء',
    allTools: 'جميع الأدوات',
    popularTools: 'الأدوات الشائعة',
    comingSoon: 'قريباً',
    offlineReady: 'تمت المعالجة على جهازك',
    toolsTitle: 'الأدوات',
    convertTitle: 'تحويل',
    companyTitle: 'عن الموقع',
    legalTitle: 'قانوني',
    about: 'حول',
    privacy: 'الخصوصية',
    guides: 'الدلائل',
    brand: 'الهوية',
  },
  fr: {
    tagline: 'Obtenez n’importe quel fichier à la taille exacte requise par n’importe quel formulaire.',
    subtag: '100% sur votre appareil. Vos fichiers ne quittent jamais votre navigateur.',
    searchPlaceholder: 'Rechercher un outil ou un formulaire…',
    dropTitle: 'Déposez vos fichiers ici',
    dropSub: 'ou cliquez pour parcourir',
    chooseFiles: 'Choisir des fichiers',
    compress: 'Compresser',
    compressPdf: 'Compresser PDF',
    compressImage: 'Compresser image',
    signatureResizer: 'Redimensionner signature',
    idPhoto: 'Photo d’identité & passeport',
    imagesToPdf: 'Images en PDF',
    exactSize: 'Taille exacte',
    targetSize: 'Taille cible',
    verifiedRule: 'Règles vérifiées',
    customRule: 'Règle personnalisée',
    customPlaceholder: 'ex. JPG, 20–50 Ko, 200×230 px',
    applyRule: 'Appliquer',
    cleanPaper: 'Nettoyer le fond en blanc',
    darkenInk: 'Assombrir l’encre',
    crop: 'Recadrer',
    download: 'Télécharger',
    downloadSheet: 'Télécharger la planche photo',
    switchSuggestion: 'Weesize est disponible en Français. Changer?',
    switchBtn: 'Passer en Français',
    dismiss: 'Fermer',
    allTools: 'Tous les outils',
    popularTools: 'Outils populaires',
    comingSoon: 'Bientôt disponible',
    offlineReady: 'Traité sur votre appareil',
    toolsTitle: 'Outils',
    convertTitle: 'Convertir',
    companyTitle: 'Entreprise',
    legalTitle: 'Légal',
    about: 'À propos',
    privacy: 'Confidentialité',
    guides: 'Guides',
    brand: 'Marque',
  },
  de: {
    tagline: 'Bringen Sie jede Datei auf die exakte Größe, die jedes Formular weltweit verlangt.',
    subtag: '100% auf Ihrem Gerät. Dateien verlassen niemals Ihren Browser.',
    searchPlaceholder: 'Werkzeuge oder Formularregeln suchen…',
    dropTitle: 'Dateien hier ablegen',
    dropSub: 'oder klicken zum Auswählen',
    chooseFiles: 'Dateien auswählen',
    compress: 'Komprimieren',
    compressPdf: 'PDF komprimieren',
    compressImage: 'Bild komprimieren',
    signatureResizer: 'Unterschrift anpassen',
    idPhoto: 'Passfoto & Ausweisfoto',
    imagesToPdf: 'Bilder zu PDF',
    exactSize: 'Exakte Größe',
    targetSize: 'Zielgröße',
    verifiedRule: 'Geprüfte Vorgaben',
    customRule: 'Eigene Vorgabe',
    customPlaceholder: 'z.B. JPG, 20–50 KB, 200×230 px',
    applyRule: 'Regel anwenden',
    cleanPaper: 'Hintergrund weiß bereinigen',
    darkenInk: 'Tinte verstärken',
    crop: 'Zuschneiden',
    download: 'Herunterladen',
    downloadSheet: 'Druckbogen herunterladen',
    switchSuggestion: 'Weesize ist auf Deutsch verfügbar. Wechseln?',
    switchBtn: 'Auf Deutsch wechseln',
    dismiss: 'Schließen',
    allTools: 'Alle Werkzeuge',
    popularTools: 'Beliebte Werkzeuge',
    comingSoon: 'Demnächst',
    offlineReady: 'Auf Ihrem Gerät verarbeitet',
    toolsTitle: 'Werkzeuge',
    convertTitle: 'Konvertieren',
    companyTitle: 'Unternehmen',
    legalTitle: 'Rechtliches',
    about: 'Über uns',
    privacy: 'Datenschutz',
    guides: 'Anleitungen',
    brand: 'Marke',
  },
  fil: {
    tagline: 'Kunin ang anumang file sa eksaktong sukat na kailangan ng anumang form sa buong mundo.',
    subtag: '100% sa iyong device. Hindi umaalis ang iyong mga file sa iyong browser.',
    searchPlaceholder: 'Maghanap ng tools o patakaran ng form…',
    dropTitle: 'I-drop ang mga file dito',
    dropSub: 'o mag-click upang pumili mula sa device',
    chooseFiles: 'Pumili ng mga file',
    compress: 'I-compress',
    compressPdf: 'I-compress ang PDF',
    compressImage: 'I-compress ang Larawan',
    signatureResizer: 'I-resize ang Pirma',
    idPhoto: 'ID at Passport Photo',
    imagesToPdf: 'Larawan patungong PDF',
    exactSize: 'Eksaktong Sukat',
    targetSize: 'Target na Sukat',
    verifiedRule: 'Beripikadong Patakaran',
    customRule: 'Pasadya na Patakaran',
    customPlaceholder: 'hal. JPG, 20–50 KB, 200×230 px',
    applyRule: 'Ilapat ang patakaran',
    cleanPaper: 'Linisin ang background sa puti',
    darkenInk: 'Paitimin ang tinta ng pirma',
    crop: 'I-crop',
    download: 'I-download',
    downloadSheet: 'I-download ang print sheet',
    switchSuggestion: 'Available ang Weesize sa Filipino. Lumipat?',
    switchBtn: 'Lumipat sa Filipino',
    dismiss: 'Isara',
    allTools: 'Lahat ng Tools',
    popularTools: 'Mga Patok na Tools',
    comingSoon: 'Paparating na',
    offlineReady: 'Pinroseso sa iyong device',
    toolsTitle: 'Tools',
    convertTitle: 'I-convert',
    companyTitle: 'Kumpanya',
    legalTitle: 'Legal',
    about: 'Tungkol',
    privacy: 'Privacy',
    guides: 'Mga Gabay',
    brand: 'Brand',
  },
  bn: {
    tagline: 'বিশ্বের যেকোনো ফর্মের জন্য যেকোনো ফাইল ঠিক নির্দিষ্ট মাপে প্রস্তুত করুন।',
    subtag: '১০০% আপনার ডিভাইসে। কোনো ফাইল সার্ভারে আপলোড হয় না।',
    searchPlaceholder: 'টুল বা ফর্মের নিয়ম খুঁজুন…',
    dropTitle: 'এখানে ফাইল ছেড়ে দিন',
    dropSub: 'অথবা ফাইল নির্বাচন করুন',
    chooseFiles: 'ফাইল বেছে নিন',
    compress: 'কম্প্রেস করুন',
    compressPdf: 'PDF কম্প্রেস করুন',
    compressImage: 'ছবি কম্প্রেস করুন',
    signatureResizer: 'স্বাক্ষর রিসাইজার',
    idPhoto: 'পাসপোর্ট ও আইডি ছবি',
    imagesToPdf: 'ছবি থেকে PDF তৈরি',
    exactSize: 'নির্দিষ্ট মাপ',
    targetSize: 'কাঙ্ক্ষিত মাপ (KB)',
    verifiedRule: 'যাচাইকৃত নিয়মাবলী',
    customRule: 'কাস্টম নিয়ম',
    customPlaceholder: 'যেমন: JPG, 20–50 KB, 200×230 px',
    applyRule: 'নিয়ম প্রয়োগ করুন',
    cleanPaper: 'সাদা ব্যাকগ্রাউন্ড পরিষ্কার করুন',
    darkenInk: 'কালি স্পষ্ট ও গাঢ় করুন',
    crop: 'ক্রপ করুন',
    download: 'ডাউনলোড',
    downloadSheet: 'প্রিন্ট শিট ডাউনলোড করুন',
    switchSuggestion: 'Weesize বাংলায় উপলব্ধ। ভাষা পরিবর্তন করবেন?',
    switchBtn: 'বাংলায় পরিবর্তন করুন',
    dismiss: 'বাতিল',
    allTools: 'সব টুলস',
    popularTools: 'জনপ্রিয় টুলস',
    comingSoon: 'শীঘ্রই আসছে',
    offlineReady: 'আপনার ডিভাইসে প্রক্রিয়াজাত',
    toolsTitle: 'টুলস',
    convertTitle: 'রূপান্তর',
    companyTitle: 'প্রতিষ্ঠান',
    legalTitle: 'আইনি',
    about: 'সম্পর্কে',
    privacy: 'গোপনীয়তা',
    guides: 'নির্দেশিকা',
    brand: 'ব্র্যান্ড',
  },
  ur: {
    tagline: 'دنیا کے کسی بھی فارم کے لیے کسی بھی فائل کو بالکل درست سائز میں تبدیل کریں۔',
    subtag: '١٠٠٪ آپ کے آلے پر۔ آپ کی فائلیں کبھی بھی براؤزر سے باہر نہیں جاتیں۔',
    searchPlaceholder: 'ٹولز یا فارم کے تقاضے تلاش کریں…',
    dropTitle: 'فائلیں یہاں ڈراپ کریں',
    dropSub: 'یا اپنے آلے سے منتخب کریں',
    chooseFiles: 'فائلیں منتخب کریں',
    compress: 'کمپریس کریں',
    compressPdf: 'PDF کمپریس کریں',
    compressImage: 'تصویر کمپریس کریں',
    signatureResizer: 'دستخط کا سائز درست کریں',
    idPhoto: 'پاسپورٹ اور شناختی تصویر',
    imagesToPdf: 'تصاویر سے PDF بنائیں',
    exactSize: 'درست سائز',
    targetSize: 'مطلوبہ سائز (KB)',
    verifiedRule: 'تصدیق شدہ تقاضے',
    customRule: 'اپنی مرضی کی شرط',
    customPlaceholder: 'مثال: JPG, 20–50 KB, 200×230 px',
    applyRule: 'شرط لاگو کریں',
    cleanPaper: 'پس منظر بالکل سفید کریں',
    darkenInk: 'روشنائی گہری اور واضح کریں',
    crop: 'کراپ کریں',
    download: 'ڈاؤن لوڈ کریں',
    downloadSheet: 'پرنٹ شیٹ ڈاؤن لوڈ کریں',
    switchSuggestion: 'Weesize اردو میں بھی دستیاب ہے۔ کیا آپ تبدیل کرنا چاہتے ہیں؟',
    switchBtn: 'اردو منتخب کریں',
    dismiss: 'بند کریں',
    allTools: 'تمام ٹولز',
    popularTools: 'مقبول ٹولز',
    comingSoon: 'جلد آ رہا ہے',
    offlineReady: 'آپ کے آلے پر عمل ہوا',
    toolsTitle: 'ٹولز',
    convertTitle: 'تبدیل کریں',
    companyTitle: 'کمپنی',
    legalTitle: 'قانونی',
    about: 'ہمارے بارے میں',
    privacy: 'رازداری',
    guides: 'رہنما',
    brand: 'برانڈ',
  },
};

const LANG_KEY = 'weesize-lang';

export function getSavedLocale(): string | null {
  try {
    if (typeof localStorage !== 'undefined') return localStorage.getItem(LANG_KEY);
    return null;
  } catch {
    return null;
  }
}

export function saveLocale(code: string): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(LANG_KEY, code);
  } catch {
    // Ignore storage issues
  }
}

export function detectBrowserLocale(): LocaleInfo {
  const saved = getSavedLocale();
  if (saved) {
    const found = SUPPORTED_LOCALES.find((l) => l.code === saved);
    if (found) return found;
  }
  const navLangs = (typeof navigator !== 'undefined' && navigator.languages) || (typeof navigator !== 'undefined' && [navigator.language || 'en']) || ['en'];
  for (const raw of navLangs) {
    const lower = raw.toLowerCase();
    if (lower.startsWith('hi')) return SUPPORTED_LOCALES.find((l) => l.code === 'hi')!;
    if (lower.startsWith('pt')) return SUPPORTED_LOCALES.find((l) => l.code === 'pt-br')!;
    if (lower.startsWith('es')) return SUPPORTED_LOCALES.find((l) => l.code === 'es')!;
    if (lower.startsWith('ar')) return SUPPORTED_LOCALES.find((l) => l.code === 'ar')!;
    if (lower.startsWith('ur')) return SUPPORTED_LOCALES.find((l) => l.code === 'ur')!;
    if (lower.startsWith('bn')) return SUPPORTED_LOCALES.find((l) => l.code === 'bn')!;
    if (lower.startsWith('fil') || lower.startsWith('tl')) return SUPPORTED_LOCALES.find((l) => l.code === 'fil')!;
    if (lower.startsWith('id')) return SUPPORTED_LOCALES.find((l) => l.code === 'id')!;
    if (lower.startsWith('fr')) return SUPPORTED_LOCALES.find((l) => l.code === 'fr')!;
    if (lower.startsWith('de')) return SUPPORTED_LOCALES.find((l) => l.code === 'de')!;
  }
  return SUPPORTED_LOCALES[0]!; // Default to English
}

let activeLocale = detectBrowserLocale();

export function currentLocale(): LocaleInfo {
  return activeLocale;
}

export function setLocale(code: string): void {
  const target = SUPPORTED_LOCALES.find((l) => l.code === code) ?? SUPPORTED_LOCALES[0]!;
  activeLocale = target;
  saveLocale(target.code);
  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.lang = target.htmlLang;
    document.documentElement.dir = target.dir;
  }
}

export function t(key: string, vars?: Record<string, string>): string {
  const dict = UI_STRINGS[activeLocale.code] ?? UI_STRINGS.en!;
  let text = dict[key] ?? UI_STRINGS.en![key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replaceAll(`{${k}}`, v);
    }
  }
  return text;
}

export function formatLocalizedNumber(num: number): string {
  try {
    return new Intl.NumberFormat(activeLocale.htmlLang).format(num);
  } catch {
    return String(num);
  }
}

export function formatLocalizedFileSize(bytes: number): string {
  const kb = bytes / 1024;
  if (kb >= 1024) {
    const mb = kb / 1024;
    return `${formatLocalizedNumber(Math.round(mb * 10) / 10)} MB`;
  }
  return `${formatLocalizedNumber(Math.round(kb))} KB`;
}
