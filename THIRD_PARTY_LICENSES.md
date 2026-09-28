# Third-party licenses

Weesize ships only permissive licenses. File bytes are never sent to these projects. None of the runtime dependencies are GPL, AGPL, or LGPL.

JSZip is published as `MIT OR GPL-3.0-or-later`. Weesize uses it under the MIT terms only.

IBM Plex Sans is the SIL Open Font License 1.1. That license is not AGPL, GPL, or LGPL. The font is self-hosted. Schibsted Grotesk may still be installed but is not loaded.

opentype.js is MIT and is a build tool only. It outlines the wordmark from the local IBM Plex file. It is not shipped in the page. sharp and resvg-js were not added: resvg-js is MPL-2.0 and sharp pulls in LGPL libvips. App icons are encoded by the existing MIT-compatible PNG writer. Open Graph images are SVG for the same reason.

No ONNX models, Jpegli, qpdf, JBIG2, or SSIMULACRA2 builds are bundled yet. They will be added only with a permissive license, and JBIG2 symbol matching will not be enabled.

## Runtime

| Name | License |
| --- | --- |
| pdf-lib 1.17.1 | MIT |
| pdfjs-dist 6.3.289 | Apache-2.0 |
| jszip 3.10.2 | MIT (chosen from MIT OR GPL-3.0-or-later) |
| fflate 0.8.3 | MIT |
| @jsquash/jpeg 1.6.0 | Apache-2.0 |
| MozJPEG (codec inside @jsquash/jpeg) | BSD-3-Clause, Independent JPEG Group, zlib |
| geist 1.7.2 | SIL Open Font License 1.1 |
| @fontsource/ibm-plex-sans | SIL Open Font License 1.1 |

## Build tools

| Name | License |
| --- | --- |
| vite | MIT |
| vite-plugin-pwa | MIT |
| typescript | Apache-2.0 |
| vitest | MIT |

## Not bundled

These are named in the product plan and are not in this build: onnxruntime-web, image-q, Jpegli, SSIMULACRA2, qpdf, a CCITT G4 encoder, jbig2enc, and PP-OCRv5. They stay out until each one can be built from a permissive source and checked. JBIG2 symbol matching and pattern substitution will not be used.
