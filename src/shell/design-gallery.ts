import { el } from '../lib/dom';
import { iconElement } from '../lib/icons';
import { sizeBar } from '../lib/size-bar';

/** Design gallery showing every component and state in light and dark mode per Section 8. */
export function mountDesignGallery(panel: HTMLElement): void {
  panel.replaceChildren();
  const stage = el('div', { class: 'design-stage' });
  stage.append(pane('light'), pane('dark'));
  panel.append(
    el('h1', undefined, ['Design System Specification']),
    el('p', { class: 'tool-intro' }, [
      'Classic, professional institutional aesthetic across both light and dark modes. Preserves exact tokens, typography scale, 4/6/8px radii, and 1px borders.',
    ]),
    stage,
  );
}

function pane(theme: 'light' | 'dark'): HTMLElement {
  const body = el('div', { class: 'icon-pane design-pane', 'data-theme': theme });
  body.style.background = 'var(--page)';
  body.style.color = 'var(--ink)';
  body.style.padding = '32px';
  body.style.border = '1px solid var(--rule)';
  body.style.borderRadius = '8px';
  body.style.display = 'flex';
  body.style.flexDirection = 'column';
  body.style.gap = '28px';

  // Section: Theme Header
  const head = el('div', undefined, [
    el('p', { class: 'eyebrow' }, [`Theme: ${theme === 'light' ? 'Light (Primary)' : 'Dark'}`]),
    el('h2', { class: 'inspector-title' }, [`${theme === 'light' ? 'Light Theme' : 'Dark Theme'} Specimen`]),
    el('p', { class: 'lede' }, ['High-contrast, authoritative typography and restrained institutional color palette.']),
  ]);
  body.append(head);

  // Section 1: Typography Scale
  const typoBox = el('div', { class: 'sheet' }, [
    el('h3', undefined, ['1. Typography Scale (IBM Plex)']),
    el('h1', { style: 'margin-top: 12px' }, ['H1 Serif 40/48 600 (-0.01em)']),
    el('h2', { style: 'margin-top: 8px' }, ['H2 Serif 28/36 600 Authoritative']),
    el('h3', { style: 'margin-top: 8px' }, ['H3 Sans 20/28 600 Section Subhead']),
    el('p', { class: 'lede' }, ['Lead 18/28 Sans 400 — Used for subtitles and introductory text.']),
    el('p', { style: 'font-size: 16px; line-height: 26px; margin-top: 8px' }, [
      'Body 16/26 Sans 400 — Standard reading copy for articles, guides, and marketing descriptions. Max line length 68ch.',
    ]),
    el('p', { style: 'font-size: 14px; line-height: 20px; color: var(--ink-2); margin-top: 6px' }, [
      'UI 14/20 Sans 400-500 — Application controls, form fields, and table contents.',
    ]),
    el('p', { style: 'font-size: 13px; line-height: 20px; color: var(--ink-3); margin-top: 4px' }, [
      'Small 13/20 Sans — Secondary details, badges, and breadcrumb trails.',
    ]),
    el('p', { style: 'font-size: 12px; line-height: 16px; font-weight: 500; letter-spacing: 0.02em; color: var(--ink-3); margin-top: 4px' }, [
      'CAPTION 12/16 SANS 500 — METADATA LABELS AND SYSTEM HINTS',
    ]),
    el('p', { class: 'size-display' }, ['32/40 Mono 500: 4.8 MB → 184 KB']),
  ]);
  body.append(typoBox);

  // Section 2: Buttons & Actions
  const btnBox = el('div', { class: 'sheet' }, [
    el('h3', undefined, ['2. Buttons & Actions']),
    el('div', { style: 'display: flex; flex-wrap: wrap; gap: 12px; margin-top: 16px; align-items: center' }, [
      el('button', { class: 'btn primary', type: 'button' }, ['Primary Button (40px, 4px radius)']),
      el('button', { class: 'btn quiet', type: 'button' }, ['Secondary Button']),
      el('button', { class: 'btn quiet text-link-btn', type: 'button' }, ['Text Link Action']),
      el('button', { class: 'btn primary', disabled: 'true', type: 'button' }, ['Disabled Button']),
      el('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Sample Icon' }, [
        iconElement('download', { size: 16 }),
      ]),
    ]),
  ]);
  body.append(btnBox);

  // Section 3: Signature Size Bar Instrument
  const barBox = el('div', { class: 'sheet' }, [
    el('h3', undefined, ['3. Signature Size Bar Instrument']),
    el('p', { class: 'lede' }, ['Measuring rule with 10% tick marks, 2px warning limit line, and Mono 500 readout.']),
    el('p', { style: 'font-size: 13px; font-weight: 600; margin-top: 16px' }, ['State A: Within limit (Fits, turns green with checkmark)']),
    sizeBar({ before: 4.8 * 1024 * 1024, after: 184 * 1024, limit: 200 * 1024, limitLabel: '200 KB' }),
    el('p', { style: 'font-size: 13px; font-weight: 600; margin-top: 24px' }, ['State B: Goal before compression']),
    sizeBar({ before: 2.4 * 1024 * 1024, after: 2.4 * 1024 * 1024, limit: 500 * 1024, limitLabel: '500 KB', goal: true }),
  ]);
  body.append(barBox);

  // Section 4: Progress Bar
  const progBox = el('div', { class: 'sheet' }, [
    el('h3', undefined, ['4. Determinate Progress Bar']),
    el('div', { class: 'progress-wrap' }, [
      el('div', { class: 'progress-track' }, [
        el('div', { class: 'progress-fill', style: 'width: 37%' }),
      ]),
      el('div', { class: 'progress-text' }, [
        el('span', undefined, ['Compressing page 14 of 38']),
        el('a', { href: '#', class: 'text-link-btn' }, ['Cancel']),
      ]),
    ]),
  ]);
  body.append(progBox);

  // Section 5: Tool Cards & Grid
  const cardBox = el('div', { class: 'sheet' }, [
    el('h3', undefined, ['5. Tool Cards (Equal Heights, 1px Border, 6px Radius)']),
    el('div', { class: 'tool-grid', style: 'grid-template-columns: repeat(2, 1fr); margin-top: 16px' }, [
      el('a', { class: 'tool-card', href: '#/compress-pdf' }, [
        el('span', { class: 'tool-top' }, [
          el('span', { class: 'tool-icon' }, [iconElement('compress-pdf', { size: 20 })]),
          el('span', { class: 'badge' }, ['On device']),
        ]),
        el('span', { class: 'tool-copy' }, [
          el('span', { class: 'tool-name' }, ['Compress PDF']),
          el('span', { class: 'tool-desc' }, ['Make a PDF smaller with precise target size or strength limits.']),
        ]),
        el('span', { class: 'tool-meta' }, [el('span', undefined, ['Optimize']), el('span', undefined, ['Client-side'])]),
      ]),
      el('a', { class: 'tool-card', href: '#/merge-pdf' }, [
        el('span', { class: 'tool-top' }, [
          el('span', { class: 'tool-icon' }, [iconElement('merge-pdf', { size: 20 })]),
          el('span', { class: 'badge' }, ['On device']),
        ]),
        el('span', { class: 'tool-copy' }, [
          el('span', { class: 'tool-name' }, ['Merge PDF']),
          el('span', { class: 'tool-desc' }, ['Combine multiple documents in the exact order you need.']),
        ]),
        el('span', { class: 'tool-meta' }, [el('span', undefined, ['Organize']), el('span', undefined, ['Client-side'])]),
      ]),
    ]),
  ]);
  body.append(cardBox);

  // Section 6: Steps & Accordion
  const stepsBox = el('div', { class: 'sheet' }, [
    el('h3', undefined, ['6. Numbered Steps & Accordion FAQ']),
    el('div', { class: 'how-row', style: 'margin-top: 16px' }, [
      el('div', { class: 'how-step' }, [
        el('span', { class: 'how-num' }, ['1']),
        el('h3', undefined, ['Choose a file']),
        el('p', undefined, ['Select or drop a PDF or photo into the workspace.']),
      ]),
      el('div', { class: 'how-step' }, [
        el('span', { class: 'how-num' }, ['2']),
        el('h3', undefined, ['Set your target']),
        el('p', undefined, ['Pick an exact size limit or strength goal.']),
      ]),
      el('div', { class: 'how-step' }, [
        el('span', { class: 'how-num' }, ['3']),
        el('h3', undefined, ['Download']),
        el('p', undefined, ['Get your file instantly without leaving your browser.']),
      ]),
    ]),
    el('div', { class: 'faq-list', style: 'margin-top: 24px' }, [
      el('details', { class: 'faq-item', open: 'true' }, [
        el('summary', undefined, ['Are my files sent to any server? ', el('span', { class: 'faq-chevron' }, ['▾'])]),
        el('div', { class: 'faq-body' }, [
          'No. Weesize processes documents entirely inside your browser using JavaScript and WebAssembly.',
        ]),
      ]),
    ]),
  ]);
  body.append(stepsBox);

  // Section 7: Comparison Table
  const tableBox = el('div', { class: 'sheet' }, [
    el('h3', undefined, ['7. Comparison Table (1px Rules, Zebra Stripes)']),
    el('table', { class: 'comparison-table' }, [
      el('thead', undefined, [
        el('tr', undefined, [
          el('th', undefined, ['Feature']),
          el('th', undefined, ['Weesize (Classic)']),
          el('th', undefined, ['Traditional Web Tools']),
        ]),
      ]),
      el('tbody', undefined, [
        el('tr', undefined, [
          el('td', undefined, ['File Processing']),
          el('td', undefined, ['100% on your device (Client-side)']),
          el('td', undefined, ['Uploaded to cloud servers']),
        ]),
        el('tr', undefined, [
          el('td', undefined, ['Upload Limit']),
          el('td', undefined, ['No limits, completely free']),
          el('td', undefined, ['Paywalls after 2 files']),
        ]),
        el('tr', undefined, [
          el('td', undefined, ['Exact Target Size']),
          el('td', undefined, ['Yes, down to precise KB targets']),
          el('td', undefined, ['Rough quality percentages only']),
        ]),
      ]),
    ]),
  ]);
  body.append(tableBox);

  // Section 8: Result State
  const resBox = el('div', { class: 'sheet' }, [
    el('h3', undefined, ['8. Result State']),
    el('div', { class: 'result-card', style: 'margin-top: 16px' }, [
      el('h2', { class: 'result-title' }, ['Your file is ready']),
      el('p', { class: 'result-filename' }, ['quarterly-report-2026.pdf']),
      sizeBar({ before: 4.8 * 1024 * 1024, after: 184 * 1024, limit: 200 * 1024, limitLabel: '200 KB' }),
      el('div', { class: 'action-row', style: 'margin-top: 16px' }, [
        el('button', { class: 'btn primary', type: 'button' }, ['Download']),
        el('button', { class: 'btn quiet', type: 'button' }, ['Check before sharing']),
        el('button', { class: 'btn quiet text-link-btn', type: 'button' }, ['Start over']),
      ]),
    ]),
  ]);
  body.append(resBox);

  return body;
}
