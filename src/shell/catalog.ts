import { el } from '../lib/dom';
import { iconElement } from '../lib/icons';
import { loadPrefs, savePrefs } from '../lib/prefs';
import { hrefFor, navigate } from '../router';
import { parseCommand, planLines, setPendingCommand } from '../lib/commands';
import { CATEGORIES, searchTools, TOOLS, popularTools, type ToolInfo } from '../tools/registry';

let recent: string[] = [];
let filterToolsFromSearch = (_query: string): void => undefined;

export function applyToolsSearch(query: string): void {
  filterToolsFromSearch(query);
}

export function noteRecent(id: string): void {
  recent = [id, ...recent.filter((item) => item !== id)].slice(0, 6);
  void savePrefs({ recent });
}

export function toolCard(tool: ToolInfo): HTMLAnchorElement {
  const mark = el('span', { class: 'tool-icon', 'data-cat': tool.category }, [iconElement(tool.icon, { size: 18 })]);
  const top = el('span', { class: 'tool-top' }, [mark]);
  const badge = tool.badges?.[0] ?? (tool.state === 'limited' ? 'Limited' : null);
  if (badge) {
    const tone = tool.state === 'limited' ? 'warn' : badge.toLowerCase().includes('chrome') ? 'info' : 'ok';
    top.append(el('span', { class: `badge badge-${tone}` }, [badge]));
  } else if (tool.category === 'optimize' || tool.category === 'security') {
    top.append(el('span', { class: 'badge badge-ok' }, ['On device']));
  }
  const body = el('span', { class: 'tool-copy' }, [
    el('span', { class: 'tool-name' }, [tool.name]),
    el('span', { class: 'tool-desc' }, [tool.description]),
  ]);
  const metaLeft = CATEGORIES.find((item) => item.id === tool.category)?.label ?? 'Tool';
  const metaRight = tool.state === 'limited' ? 'Not in this version' : 'Client-side';
  const meta = el('span', { class: 'tool-meta' }, [
    el('span', undefined, [metaLeft]),
    el('span', undefined, [metaRight]),
  ]);
  return el('a', { class: 'tool-card', href: hrefFor(tool.id), 'data-tool': tool.id, 'data-cat': tool.category }, [
    top,
    body,
    meta,
  ]);
}

export function mountCatalog(popularHost: HTMLElement, catalogHost: HTMLElement, sidebar: HTMLElement, toolsHost: HTMLElement): void {
  if (!popularHost.querySelector('.tool-card')) {
    popularHost.append(el('p', { class: 'micro' }, ['Popular']));
    const popular = el('div', { class: 'tool-grid' });
    for (const tool of popularTools().slice(0, 8)) popular.append(toolCard(tool));
    popularHost.append(el('div', { class: 'tool-grid-wrap' }, [popular]));
  }

  const fill = (host: HTMLElement) => {
    CATEGORIES.forEach((category, index) => {
      const tools = TOOLS.filter((tool) => tool.category === category.id);
      if (!tools.length) return;
      const grid = el('div', { class: 'tool-grid' });
      for (const tool of tools) grid.append(toolCard(tool));
      const num = String(index + 1).padStart(2, '0');
      host.append(
        el('section', { class: 'tool-section' }, [
          el('header', { class: 'tool-section-head' }, [
            el('h2', undefined, [`${num} // ${category.label}`]),
            el('span', { class: 'tool-section-tag' }, [category.id.replace('-', ' ')]),
          ]),
          el('div', { class: 'tool-grid-wrap' }, [grid]),
        ]),
      );
    });
  };
  if (!catalogHost.querySelector('.tool-section')) fill(catalogHost);

  const homeFilters = document.querySelector('#home-filters');
  if (homeFilters && homeFilters.childElementCount === 0) {
    const applyHome = (category: string) => {
      const popularGrid = popularHost.querySelector('.tool-grid');
      if (popularGrid) {
        popularGrid.replaceChildren();
        const source = category === 'all' ? popularTools().slice(0, 8) : TOOLS.filter((tool) => tool.category === category);
        for (const tool of source) popularGrid.append(toolCard(tool));
      }
      for (const section of catalogHost.querySelectorAll<HTMLElement>('.tool-section')) {
        const title = section.querySelector('h2')?.textContent ?? '';
        const match = CATEGORIES.find((item) => title.includes(item.label));
        section.hidden = category !== 'all' && match?.id !== category;
      }
    };
    const homeChip = (id: string, label: string) => {
      const button = el('button', { class: 'chip', type: 'button', role: 'tab', 'aria-selected': id === 'all' ? 'true' : 'false', 'data-cat': id }, [label]);
      button.addEventListener('click', () => {
        for (const node of homeFilters.querySelectorAll('.chip')) {
          node.classList.remove('is-on');
          node.setAttribute('aria-selected', 'false');
        }
        button.classList.add('is-on');
        button.setAttribute('aria-selected', 'true');
        applyHome(id);
      });
      return button;
    };
    homeFilters.append(homeChip('all', `All tools (${TOOLS.length})`));
    for (const category of CATEGORIES) {
      const count = TOOLS.filter((tool) => tool.category === category.id).length;
      homeFilters.append(homeChip(category.id, `${category.label} (${count})`));
    }
    const firstHomeChip = homeFilters.querySelector('.chip');
    firstHomeChip?.classList.add('is-on');
    firstHomeChip?.setAttribute('aria-selected', 'true');
  }

  const crumbs = el('nav', { class: 'crumbs', 'aria-label': 'Breadcrumb' }, [
    el('a', { href: '#/' }, ['Home']),
    el('span', { 'aria-hidden': 'true' }, [' / ']),
    el('span', { 'aria-current': 'page' }, ['All tools']),
  ]);
  const all = el('div', { class: 'tools-head' }, [
    crumbs,
    el('h1', undefined, ['All tools']),
    el('p', { class: 'section-lede' }, ['Compress, convert, organize and edit PDFs and images on your device. Zero upload.']),
  ]);
  const chips = el('div', { class: 'tabs-underline', role: 'tablist', 'aria-label': 'Tool categories' });
  const results = el('div');
  toolsHost.replaceChildren(all, chips, results);
  let toolsQuery = new URLSearchParams(window.location.search).get('q') ?? '';

  const paintTools = (category: string, query: string) => {
    results.replaceChildren();
    if (category === 'all' && !query) {
      for (const cat of CATEGORIES) {
        const matched = TOOLS.filter((tool) => tool.category === cat.id);
        if (!matched.length) continue;
        const section = el('section', { class: 'tool-category-section' }, [
          el('header', { class: 'tool-category-head' }, [
            el('h3', undefined, [cat.label]),
          ]),
          el('div', { class: 'tool-grid-wrap' }, [
            el('div', { class: 'tool-grid' }, matched.map(toolCard)),
          ]),
        ]);
        results.append(section);
      }
    } else {
      const matched = searchTools(query).filter((tool) => category === 'all' || tool.category === category);
      const grid = el('div', { class: 'tool-grid' });
      for (const tool of matched) grid.append(toolCard(tool));
      if (!matched.length) grid.append(el('p', undefined, ['No tool matches that search.']));
      results.append(el('div', { class: 'tool-grid-wrap' }, [grid]));
    }
  };

  const chip = (id: string, label: string) => {
    const button = el('button', { class: 'tab-underline', type: 'button', role: 'tab', 'aria-selected': id === 'all' ? 'true' : 'false', 'data-cat': id }, [label]);
    button.addEventListener('click', () => {
      for (const node of chips.querySelectorAll('.tab-underline')) {
        node.classList.remove('is-active');
        node.setAttribute('aria-selected', 'false');
      }
      button.classList.add('is-active');
      button.setAttribute('aria-selected', 'true');
      paintTools(id, toolsQuery);
    });
    return button;
  };
  chips.append(chip('all', `All tools (${TOOLS.length})`));
  for (const category of CATEGORIES) {
    const count = TOOLS.filter((tool) => tool.category === category.id).length;
    chips.append(chip(category.id, `${category.label} (${count})`));
  }
  const firstChip = chips.querySelector('.tab-underline');
  firstChip?.classList.add('is-active');
  firstChip?.setAttribute('aria-selected', 'true');
  paintTools('all', toolsQuery);
  filterToolsFromSearch = (query: string) => {
    toolsQuery = query;
    const on = chips.querySelector<HTMLButtonElement>('.tab-underline.is-active');
    paintTools(on?.dataset.cat ?? 'all', query);
  };

  const megaGrid = document.querySelector<HTMLElement>('#mega-grid');
  if (megaGrid && megaGrid.childElementCount === 0) {
    for (const cat of CATEGORIES) {
      const tools = TOOLS.filter((tool) => tool.category === cat.id);
      const col = el('div', { class: 'mega-col' }, [
        el('h4', { class: 'mega-col-title' }, [cat.label]),
      ]);
      const list = el('div', { class: 'mega-col-list' });
      for (const tool of tools) {
        list.append(
          el('a', { href: hrefFor(tool.id) }, [
            iconElement(tool.icon, { size: 14 }),
            el('span', undefined, [tool.name]),
          ]),
        );
      }
      col.append(list);
      megaGrid.append(col);
    }
  }

  const megaWrap = document.querySelector<HTMLElement>('#tools-nav-wrap');
  const megaMenu = document.querySelector<HTMLElement>('#tools-mega-menu');
  const navToolsLink = document.querySelector<HTMLElement>('#nav-tools-link');
  if (megaWrap && megaMenu && navToolsLink) {
    let hideTimer: number | null = null;
    const showMenu = () => {
      if (hideTimer) {
        window.clearTimeout(hideTimer);
        hideTimer = null;
      }
      megaMenu.hidden = false;
      navToolsLink.setAttribute('aria-expanded', 'true');
    };
    const hideMenu = () => {
      hideTimer = window.setTimeout(() => {
        megaMenu.hidden = true;
        navToolsLink.setAttribute('aria-expanded', 'false');
      }, 180);
    };
    megaWrap.addEventListener('mouseenter', showMenu);
    megaWrap.addEventListener('mouseleave', hideMenu);
    megaWrap.addEventListener('focusin', showMenu);
    megaWrap.addEventListener('focusout', (e) => {
      if (!megaWrap.contains(e.relatedTarget as Node)) hideMenu();
    });
    megaMenu.addEventListener('click', (e) => {
      if (e.target instanceof HTMLAnchorElement) {
        megaMenu.hidden = true;
        navToolsLink.setAttribute('aria-expanded', 'false');
      }
    });
  }

  sidebar.replaceChildren();
  for (const category of CATEGORIES) {
    const tools = TOOLS.filter((tool) => tool.category === category.id);
    if (!tools.length) continue;
    const group = el('div', { class: 'side-group' });
    group.append(el('p', { class: 'side-label' }, [category.label]));
    for (const tool of tools) {
      group.append(
        el('a', { class: 'side-link', href: hrefFor(tool.id), 'data-tool': tool.id, 'data-tip': tool.name }, [
          iconElement(tool.icon, { size: 16 }),
          el('span', { class: 'side-text' }, [tool.name]),
        ]),
      );
    }
    sidebar.append(group);
  }
  const collapse = el('button', { class: 'icon-btn side-collapse', type: 'button' });
  collapse.setAttribute('aria-label', 'Hide tool names');
  collapse.dataset.tip = 'Hide tool names';
  collapse.append(iconElement('sidebar', { size: 16 }));
  collapse.addEventListener('click', () => {
    const collapsed = sidebar.classList.toggle('is-collapsed');
    const label = collapsed ? 'Show tool names' : 'Hide tool names';
    collapse.setAttribute('aria-label', label);
    collapse.dataset.tip = label;
  });
  sidebar.prepend(collapse, el('a', { class: 'side-link side-home', href: '/tools', 'data-tip': 'All tools' }, [iconElement('menu', { size: 16 }), el('span', { class: 'side-text' }, ['All tools'])]));
}

export function markCurrent(route: string): void {
  for (const link of document.querySelectorAll<HTMLAnchorElement>('.side-link')) {
    if (link.dataset.tool === route) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
}

export function mountPalette(dialog: HTMLElement, input: HTMLInputElement, list: HTMLElement): { open(): void; close(): void } {
  const paint = () => {
    const query = input.value.trim().toLowerCase();
    const hits = searchTools(input.value);
    const ordered = query
      ? hits
      : [...hits].sort((a, b) => recent.indexOf(a.id) - recent.indexOf(b.id) || 0);
    const shown = (query ? ordered : [...ordered.filter((tool) => recent.includes(tool.id)), ...ordered.filter((tool) => !recent.includes(tool.id))]).slice(0, 8);
    list.replaceChildren();
    const steps = parseCommand(input.value);
    if (steps) {
      const plan = el('div', { class: 'palette-plan' });
      for (const line of planLines(steps)) plan.append(el('p', undefined, [line]));
      plan.append(el('p', undefined, ['Nothing runs until you press Run.']));
      const run = el('button', { class: 'btn primary', type: 'button', 'data-action': 'confirm-command' }, ['Run']);
      const edit = el('button', { class: 'btn quiet', type: 'button' }, ['Edit']);
      run.addEventListener('click', () => {
        setPendingCommand(steps);
        close();
        navigate('commands');
      });
      edit.addEventListener('click', () => input.focus());
      plan.append(run, edit);
      list.append(plan);
    }
    for (const [index, tool] of shown.entries()) {
      const link = el('a', { href: hrefFor(tool.id), 'aria-selected': index === 0 ? 'true' : 'false' }, [
        iconElement(tool.icon, { size: 16 }),
        el('span', { class: 'palette-copy' }, [el('span', undefined, [tool.name]), el('span', { class: 'tool-desc' }, [tool.description])]),
      ]);
      link.addEventListener('click', close);
      list.append(link);
    }
  };
  function open(): void {
    dialog.hidden = false;
    document.getElementById('command-open')?.setAttribute('aria-expanded', 'true');
    input.value = '';
    paint();
    const tools = document.getElementById('view-tools');
    if (tools && !tools.hidden) applyToolsSearch('');
    input.focus();
  }
  function close(): void {
    dialog.hidden = true;
    document.getElementById('command-open')?.setAttribute('aria-expanded', 'false');
  }
  input.form?.addEventListener('submit', (event) => event.preventDefault());
  input.addEventListener('keydown', (event) => {
    const rows = [...list.querySelectorAll<HTMLAnchorElement>('a')];
    const current = rows.findIndex((row) => row.getAttribute('aria-selected') === 'true');
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const next = event.key === 'ArrowDown' ? Math.min(rows.length - 1, current + 1) : Math.max(0, current - 1);
      rows.forEach((row, index) => row.setAttribute('aria-selected', index === next ? 'true' : 'false'));
      rows[next]?.scrollIntoView({ block: 'nearest' });
    }
    if (event.key === 'Enter' && current >= 0) {
      event.preventDefault();
      rows[current]?.click();
    }
  });
  input.addEventListener('input', () => {
    paint();
    if (document.getElementById('view-tools') && !document.getElementById('view-tools')?.hidden) applyToolsSearch(input.value);
  });
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) close();
  });
  return { open, close };
}

export function loadRecent(): void {
  void loadPrefs().then((prefs) => {
    recent = prefs.recent ?? [];
  });
}
