# How We Compress PDFs to an Exact Size in the Browser

Most online PDF tools take your file, upload it to a cloud server, apply a vague compression preset ("Low", "Medium", "High"), and return a smaller file—leaving you guessing whether it will actually fit a strict 100 KB or 1 MB upload portal.

**Weesize takes a fundamentally different approach:**
1. **100% On-Device Processing**: Your PDF never leaves your browser tab. All manipulation happens in WebAssembly and JavaScript client-side.
2. **Exact-Size Goal Engine**: When you land on `/compress-pdf-to-100kb`, the tool sets a numeric goal (100 KB) and iteratively optimizes image streams until the file meets the target—or honestly reports the closest legible floor.

---

## The Architecture: Why Uploading PDFs is Obsolete

PDF files are binary container formats holding text operators, embedded fonts, vector paths, and raster image streams. In 95% of oversized PDFs (especially scanned contracts or camera uploads), 90%+ of the file weight is stored in uncompressed or high-resolution JPEG/PNG streams.

```
+-----------------------------------------------------------------------+
|                              Browser Tab                              |
|                                                                       |
|  +--------------+    pdf-lib / pdf.js    +-------------------------+  |
|  | User PDF     | ---------------------> | Extract Image Streams   |  |
|  +--------------+                        +-------------------------+  |
|                                                       |               |
|                                                       v               |
|  +--------------+      @jsquash/jpeg     +-------------------------+  |
|  | Output PDF   | <--------------------- | Binary Search Optimizer |  |
|  +--------------+                        +-------------------------+  |
|                                                                       |
|                     NO NETWORK REQUESTS (0 BYTES OUT)                 |
+-----------------------------------------------------------------------+
```

### 1. Stream Extraction
Using `pdf-lib` and `pdfjs-dist` compiled for modern WebAssembly/ESM, Weesize parses the object graph without making external network calls. We extract XObject image streams while keeping text streams and font descriptors intact.

### 2. Binary-Search Quality & Dimension Scaling
To hit an exact size target like 100 KB:
- We measure the total non-image bytes (text, fonts, catalog structure).
- We compute the available budget for raster image streams.
- We perform a fast binary search over JPEG quality factors and canvas pixel scaling.
- If the original image is already smaller than the target or if further compression degrades legibility below acceptable thresholds, **the engine stops and retains the original**. Weesize never blurs text into unreadable artifacts just to hit an arbitrary number.

### 3. Privacy & Offline Proof
Because all encoding happens via WebAssembly inside a Web Worker thread:
- **No server cost or bandwidth wait**: Compression speed is governed by local CPU/GPU performance.
- **Offline Verified**: Load the application once, turn off Wi-Fi, and compress any sensitive document. It works completely offline.

---

## Open Source & Developer Community
Weesize is free, open source, and built with modern TypeScript, Vite, and WebAssembly. Check out the repository on GitHub to review our zero-request architecture or contribute!
