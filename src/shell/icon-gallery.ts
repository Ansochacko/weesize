import { brandName } from '../brand';
import { el } from '../lib/dom';
import { iconElement, toolIcons, uiIcons, type IconName, type ToolCategory } from '../lib/icons';

const ORDER: ToolCategory[] = ['Optimize', 'Organize', 'Convert to PDF', 'Convert from PDF', 'Edit', 'Security', 'Smart', 'Workflows'];

export function mountIconGallery(panel: HTMLElement): void {
  panel.replaceChildren();
  const toggle = el('button', { class: 'btn quiet', type: 'button' }, ['Show keyline grid']);
  let grid = false;
  toggle.addEventListener('click', () => {
    grid = !grid;
    toggle.textContent = grid ? 'Hide keyline grid' : 'Show keyline grid';
    panel.querySelectorAll('.icon-sample.is-24').forEach((node) => node.classList.toggle('show-grid', grid));
  });
  const stage = el('div', { class: 'icon-stage' });
  stage.append(pane('light'), pane('dark'));
  panel.append(el('h2', undefined, ['Icons']), el('p', { class: 'tool-intro' }, [`Every ${brandName()} icon at 16, 20 and 24 px.`]), toggle, stage);
}

function pane(theme: 'light' | 'dark'): HTMLElement {
  const body = el('div', { class: 'icon-pane', 'data-theme': theme });
  body.append(el('h3', undefined, [theme === 'light' ? 'Light' : 'Dark']));
  for (const category of ORDER) {
    const tools = Object.entries(toolIcons).filter((entry) => entry[1].category === category);
    body.append(group(category, tools.map(([id, tool]) => ({ id: id as IconName, label: tool.name }))));
  }
  body.append(group('Interface', Object.keys(uiIcons).map((id) => ({ id: id as IconName, label: id }))));
  return body;
}

function group(title: string, items: Array<{ id: IconName; label: string }>): HTMLElement {
  const grid = el('div', { class: 'icon-grid' });
  for (const item of items) {
    const sizes = el('div', { class: 'icon-sizes' });
    for (const size of [16, 20, 24]) {
      const frame = el('span', { class: size === 24 ? 'icon-sample is-24' : 'icon-sample' });
      frame.append(iconElement(item.id, { size }));
      sizes.append(frame);
    }
    grid.append(el('figure', { class: 'icon-figure' }, [sizes, el('figcaption', undefined, [item.label])]));
  }
  return el('section', { class: 'icon-group' }, [el('h3', undefined, [title]), grid]);
}
