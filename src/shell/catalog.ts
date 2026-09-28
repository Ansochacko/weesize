import { el } from '../lib/dom';
import { iconElement } from '../lib/icons';
import { loadPrefs, savePrefs } from '../lib/prefs';
import { hrefFor, navigate } from '../router';
import { parseCommand, planLines, setPendingCommand } from '../lib/commands';
import {
  CATEGORIES,
  searchTools,
  TOOLS,
  popularTools,
  toolsIn,
  comingSoonTools,
  activeToolsCount,
  type ToolInfo,
} from '../tools/registry';

let recent: string[] = [];
let filterToolsFromSearch = (_query: string): void => undefined;

export function applyToolsSearch(query: string): void {
  filterToolsFromSearch(query);
}

export function noteRecent(id: string): void {
  recent = [id, ...recent.filter((item) => item !== id)].slice(0, 6);
  void savePrefs({ recent });
}

export function toolCard(tool: ToolInfo, isComingSoon = false): HTMLElement {
  const mark = el('span', { class: 'tool-icon', 'data-cat': tool.category }, [iconElement(tool.icon, { size: 18 })]);
  const top = el('span', { class: 'tool-top' }, [mark]);
  const isSoon = isComingSoon || tool.status === 'coming-soon';
  if (isSoon) {
    top.append(el('span', { class: 'badge badge-neutral' }, ['Coming soon']));
  } else if (tool.status === 'beta' || tool.badges?.includes('Beta')) {
    top.append(el('span', { class: 'badge badge-ok' }, ['Beta']));
  }
  const body = el('span', { class: 'tool-copy' }, [
    el('span', { class: 'tool-name' }, [tool.name]),
    el('span', { class: 'tool-desc' }, [tool.description]),
  ]);

  if (isSoon) {
    return el('div', {
      class: 'tool-card tool-card-muted',
      'data-tool': tool.id,
      'data-cat': tool.category,
      'aria-label': `${tool.name} – Coming soon`,
    }, [top, body]);
  }

  return el('a', {
    class: 'tool-card',
    href: hrefFor(tool.id),
    'data-tool': tool.id,
    'data-cat': tool.category,
    'aria-label': `${tool.name} – ${tool.description}`,
  }, [
    top,
    body,
  ]);
}

export function mountCatalog(popularHost: HTMLElement | null, catalogHost: HTMLElement | null, sidebar: HTMLElement, toolsHost: HTMLElement): void {
  if (popularHost && !popularHost.querySelector('.tool-card')) {
    const popular = el('div', { class: 'tool-grid' });
    for (const tool of popularTools().slice(0, 8)) popular.append(toolCard(tool));
    popularHost.append(el('div', { class: 'tool-grid-wrap' }, [popular]));
  }

  // Update dynamic tools counts everywhere
  const totalCount = activeToolsCount();
  document.querySelectorAll('.popular-more-link, .mega-all-link').forEach((link) => {
    link.textContent = `View all ${totalCount} tools →`;
  });

  const fill = (host: HTMLElement) => {
    CATEGORIES.forEach((category, index) => {
      const tools = toolsIn(category.id);
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

    const soon = comingSoonTools();
    if (soon.length) {
      const soonGrid = el('div', { class: 'tool-grid tool-grid-soon' });
      for (const tool of soon) soonGrid.append(toolCard(tool, true));
      host.append(
        el('section', { class: 'tool-section tool-section-soon' }, [
          el('header', { class: 'tool-section-head' }, [
            el('h2', undefined, ['Coming soon']),
            el('span', { class: 'tool-section-tag' }, ['in development']),
          ]),
          el('div', { class: 'tool-grid-wrap' }, [soonGrid]),
        ]),
      );
    }
  };
  if (catalogHost && !catalogHost.querySelector('.tool-section')) fill(catalogHost);

  const homeFilters = document.querySelector('#home-filters');
  if (homeFilters && homeFilters.childElementCount === 0 && popularHost && catalogHost) {
    const applyHome = (category: string) => {
      const popularGrid = popularHost.querySelector('.tool-grid');
      if (popularGrid) {
        popularGrid.replaceChildren();
        const source = category === 'all' ? popularTools().slice(0, 8) : toolsIn(category as any);
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
    homeFilters.append(homeChip('all', 'All'));
    for (const category of CATEGORIES) {
      if (toolsIn(category.id).length > 0) homeFilters.append(homeChip(category.id, category.label));
    }
  }

  // Tools page view (/tools)
  if (toolsHost.childElementCount === 0) {
    const head = el('div', { class: 'tools-page-head' }, [
      el('h1', undefined, ['All tools']),
      el('p', { class: 'lede' }, ['Every tool runs on your device. Nothing is uploaded or stored.']),
    ]);
    const chips = el('div', { class: 'tools-page-chips', role: 'tablist', 'aria-label': 'Filter tools by category' });
    const results = el('div', { class: 'tools-page-results' });
    toolsHost.append(head, chips, results);

    let toolsQuery = '';
    const paintTools = (category: string, query: string) => {
      results.replaceChildren();
      if (category === 'all' && !query) {
        for (const cat of CATEGORIES) {
          const matched = toolsIn(cat.id);
          if (!matched.length) continue;
          const section = el('section', { class: 'tool-category-section' }, [
            el('header', { class: 'tool-category-head' }, [
              el('h2', undefined, [cat.label]),
            ]),
            el('div', { class: 'tool-grid-wrap' }, [
              el('div', { class: 'tool-grid' }, matched.map((t) => toolCard(t))),
            ]),
          ]);
          results.append(section);
        }
        const soon = comingSoonTools();
        if (soon.length) {
          const soonSection = el('section', { class: 'tool-category-section tool-section-soon' }, [
            el('header', { class: 'tool-category-head' }, [
              el('h2', undefined, ['Coming soon']),
            ]),
            el('div', { class: 'tool-grid-wrap' }, [
              el('div', { class: 'tool-grid tool-grid-soon' }, soon.map((t) => toolCard(t, true))),
            ]),
          ]);
          results.append(soonSection);
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
    chips.append(chip('all', `All tools (${activeToolsCount()})`));
    for (const category of CATEGORIES) {
      const count = toolsIn(category.id).length;
      if (count > 0) chips.append(chip(category.id, `${category.label} (${count})`));
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
  }

  // Mega Menu Navigation
  const megaGrid = document.querySelector<HTMLElement>('#mega-grid');
  if (megaGrid && megaGrid.childElementCount === 0) {
    for (const cat of CATEGORIES) {
      const tools = toolsIn(cat.id);
      if (!tools.length) continue;
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

  // Sidebar
  sidebar.replaceChildren();
  for (const category of CATEGORIES) {
    const tools = toolsIn(category.id);
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
      : [
          ...recent.map((id) => TOOLS.find((tool) => tool.id === id)).filter((tool): tool is ToolInfo => Boolean(tool && tool.status !== 'coming-soon')),
          ...hits.filter((tool) => !recent.includes(tool.id)),
        ];
    list.replaceChildren();
    if (query) {
      const parsed = parseCommand(query);
      if (parsed) {
        const plan = el('div', { class: 'palette-plan' });
        const summaryText = parsed.map((step) => step.label).join(' → ');
        plan.append(el('p', { class: 'plan-head' }, ['Command recipe: ', el('strong', undefined, [summaryText])]));
        const lines = planLines(parsed);
        for (const line of lines) plan.append(el('p', { class: 'plan-step' }, [line]));
        const run = el('button', { class: 'btn primary plan-run', type: 'button' }, ['Set up this command →']);
        run.addEventListener('click', () => {
          setPendingCommand(parsed);
          close();
          navigate('commands');
        });
        plan.append(run);
        list.append(plan);
      }
    }
    for (const tool of ordered) {
      const row = el('button', { class: 'palette-item', type: 'button', 'data-tool': tool.id }, [
        iconElement(tool.icon, { size: 16 }),
        el('span', { class: 'palette-copy' }, [el('span', undefined, [tool.name]), el('span', { class: 'tool-desc' }, [tool.description])]),
        ...(tool.status === 'beta' ? [el('span', { class: 'badge badge-ok' }, ['Beta'])] : []),
      ]);
      row.addEventListener('click', () => {
        close();
        navigate(tool.id);
      });
      list.append(row);
    }
    if (!ordered.length) list.append(el('p', { class: 'palette-empty' }, ['No tools match that search.']));
  };

  const close = () => {
    dialog.hidden = true;
    input.value = '';
    document.querySelector('#command-open')?.setAttribute('aria-expanded', 'false');
  };

  const open = () => {
    dialog.hidden = false;
    document.querySelector('#command-open')?.setAttribute('aria-expanded', 'true');
    input.value = '';
    paint();
    input.focus();
  };

  input.addEventListener('input', paint);
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) close();
  });
  window.addEventListener('keydown', (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      if (dialog.hidden) open();
      else close();
    }
    if (event.key === 'Escape' && !dialog.hidden) close();
  });

  return { open, close };
}

export function loadRecent(): void {
  void loadPrefs().then((prefs) => {
    recent = prefs.recent ?? [];
  });
}
