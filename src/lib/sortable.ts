const EASE = 'cubic-bezier(.2,.7,.2,1)';

export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function snapshot(container: ParentNode): Map<string, DOMRect> {
  const frames = new Map<string, DOMRect>();
  container.querySelectorAll<HTMLElement>('[data-id]').forEach((node) => {
    const id = node.dataset.id;
    if (!id || node.classList.contains('sort-origin') || node.hidden) return;
    frames.set(id, node.getBoundingClientRect());
  });
  return frames;
}

function play(container: ParentNode, first: Map<string, DOMRect>): void {
  if (prefersReducedMotion()) return;
  container.querySelectorAll<HTMLElement>('[data-id]').forEach((node) => {
    const id = node.dataset.id;
    if (!id || node.classList.contains('sort-origin') || node.hidden) return;
    const start = first.get(id);
    if (!start) return;
    const end = node.getBoundingClientRect();
    const dx = start.left - end.left;
    const dy = start.top - end.top;
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
    for (const animation of node.getAnimations()) animation.cancel();
    node.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }], {
      duration: 200,
      easing: EASE,
    });
  });
}

export function flip(container: ParentNode, mutate: () => void): void {
  const first = snapshot(container);
  mutate();
  play(container, first);
}

export function playStack(container: HTMLElement): Promise<void> {
  if (prefersReducedMotion()) return Promise.resolve();
  const items = [...container.querySelectorAll<HTMLElement>('[data-id]')];
  if (items.length < 2) return Promise.resolve();
  const anchor = items[0]?.getBoundingClientRect();
  if (!anchor) return Promise.resolve();
  const animations = items.map((item, index) => {
    const rect = item.getBoundingClientRect();
    const dx = anchor.left - rect.left + Math.min(index, 8) * 2;
    const dy = anchor.top - rect.top + Math.min(index, 8) * 3;
    const tilt = index === 0 ? 0 : 1.4;
    return item.animate(
      [
        { transform: 'translate(0, 0) rotate(0deg)' },
        { transform: `translate(${dx}px, ${dy}px) rotate(${tilt}deg)` },
      ],
      { duration: 220, easing: EASE, fill: 'forwards' },
    );
  });
  return Promise.all(animations.map((animation) => animation.finished.catch(() => undefined))).then(
    () =>
      new Promise((resolve) => {
        window.setTimeout(() => {
          for (const item of items) {
            for (const animation of item.getAnimations()) animation.cancel();
          }
          resolve();
        }, 260);
      }),
  );
}

export interface SortableOptions {
  layout: 'grid' | 'list';
  getItems: () => HTMLElement[];
  onReorder: (fromIndex: number, toIndex: number) => void;
  onReorderMany?: (indexes: number[], toIndex: number) => void;
  canDrag?: (item: HTMLElement) => boolean;
}

interface DragSession {
  pointerId: number;
  pointerType: string;
  origins: HTMLElement[];
  indexes: number[];
  placeholder: HTMLElement;
  label: HTMLElement;
  ghost: HTMLElement;
  grabX: number;
  grabY: number;
  originLeft: number;
  originTop: number;
}

type Phase = 'idle' | 'pending' | 'drag' | 'keyboard' | 'settling';

let busySortable: Sortable | null = null;

class Sortable {
  private phase: Phase = 'idle';
  private pointerId = -1;
  private pointerType = 'mouse';
  private startX = 0;
  private startY = 0;
  private pointX = 0;
  private pointY = 0;
  private pendingItem: HTMLElement | null = null;
  private holdTimer = 0;
  private session: DragSession | null = null;
  private raf = 0;
  private reorderAt = 0;
  private anchorId: string | null = null;
  private suppressClick = false;
  private readonly live: HTMLElement;
  private readonly onPointerDown: (event: PointerEvent) => void;
  private readonly onPointerMove: (event: PointerEvent) => void;
  private readonly onPointerUp: (event: PointerEvent) => void;
  private readonly onPointerCancel: (event: PointerEvent) => void;
  private readonly onKeyDown: (event: KeyboardEvent) => void;
  private readonly onClick: (event: MouseEvent) => void;
  private readonly onDocDown: (event: PointerEvent) => void;
  private readonly onTouchMove: (event: TouchEvent) => void;
  private readonly onContextMenu: (event: Event) => void;
  private readonly onBlur: () => void;
  private readonly onResize: () => void;
  private readonly onWindowKey: (event: KeyboardEvent) => void;
  private readonly observer: MutationObserver;

  constructor(
    private readonly container: HTMLElement,
    private readonly options: SortableOptions,
  ) {
    this.live = document.createElement('div');
    this.live.className = 'visually-hidden';
    this.live.setAttribute('aria-live', 'polite');
    this.live.setAttribute('aria-atomic', 'true');
    (container.parentElement ?? document.body).append(this.live);

    this.onPointerDown = (event) => this.pointerDown(event);
    this.onPointerMove = (event) => this.pointerMove(event);
    this.onPointerUp = (event) => this.pointerUp(event);
    this.onPointerCancel = (event) => {
      if (this.session && event.pointerId === this.session.pointerId) void this.finish(false);
      else if (this.phase === 'pending' && event.pointerId === this.pointerId) this.clearPending();
    };
    this.onKeyDown = (event) => this.keyDown(event);
    this.onClick = (event) => this.click(event);
    this.onDocDown = (event) => this.docDown(event);
    this.onTouchMove = (event) => {
      if (this.phase === 'drag') event.preventDefault();
    };
    this.onContextMenu = (event) => {
      if (this.phase === 'pending' || this.phase === 'drag') event.preventDefault();
    };
    this.onBlur = () => {
      if (this.phase === 'drag' || this.phase === 'keyboard') void this.finish(false);
    };
    this.onResize = () => {
      if (this.phase === 'drag' || this.phase === 'keyboard') void this.finish(false);
    };
    this.onWindowKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (this.phase !== 'drag' && this.phase !== 'keyboard') return;
      event.preventDefault();
      void this.finish(false);
    };
    this.observer = new MutationObserver(() => this.roving());

    container.addEventListener('pointerdown', this.onPointerDown);
    container.addEventListener('click', this.onClick);
    container.addEventListener('keydown', this.onKeyDown);
    container.addEventListener('dragstart', (event) => event.preventDefault());
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerCancel);
    window.addEventListener('touchmove', this.onTouchMove, { passive: false });
    window.addEventListener('contextmenu', this.onContextMenu);
    window.addEventListener('blur', this.onBlur);
    window.addEventListener('resize', this.onResize);
    window.addEventListener('keydown', this.onWindowKey);
    window.addEventListener('orientationchange', this.onResize);
    document.addEventListener('pointerdown', this.onDocDown, true);
    if (!container.hasAttribute('tabindex')) container.tabIndex = -1;
    this.observer.observe(container, { childList: true });
    this.roving();
  }

  destroy(): void {
    if (this.phase === 'drag' || this.phase === 'keyboard') void this.finish(false);
    this.clearPending();
    this.observer.disconnect();
    this.container.removeEventListener('pointerdown', this.onPointerDown);
    this.container.removeEventListener('click', this.onClick);
    this.container.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointercancel', this.onPointerCancel);
    window.removeEventListener('touchmove', this.onTouchMove);
    window.removeEventListener('contextmenu', this.onContextMenu);
    window.removeEventListener('blur', this.onBlur);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('keydown', this.onWindowKey);
    window.removeEventListener('orientationchange', this.onResize);
    document.removeEventListener('pointerdown', this.onDocDown, true);
    this.live.remove();
    if (busySortable === this) busySortable = null;
  }

  private items(): HTMLElement[] {
    return this.options.getItems().filter((item) => item.isConnected);
  }

  private noun(count: number): string {
    if (this.options.layout === 'list') return count === 1 ? 'Item' : 'Items';
    return count === 1 ? 'Page' : 'Pages';
  }

  private say(text: string): void {
    this.live.textContent = '';
    this.live.textContent = text;
  }

  private roving(): void {
    if (this.phase !== 'idle' && this.phase !== 'pending') return;
    const nodes = this.items().filter((item) => !item.hidden && !item.classList.contains('sort-origin'));
    if (nodes.length === 0) return;
    const current = nodes.find((node) => node === document.activeElement) ?? nodes.find((node) => node.tabIndex === 0) ?? nodes[0];
    for (const node of nodes) node.tabIndex = node === current ? 0 : -1;
  }

  private selectedItems(): HTMLElement[] {
    return this.items().filter((item) => item.classList.contains('is-selected') && !item.hidden);
  }

  private setSelected(nodes: HTMLElement[]): void {
    const chosen = new Set(nodes);
    for (const item of this.items()) {
      const on = chosen.has(item);
      item.classList.toggle('is-selected', on);
      item.dataset.chosen = on ? 'true' : 'false';
      if (item.getAttribute('role') === 'option') item.setAttribute('aria-selected', on ? 'true' : 'false');
    }
    this.container.dispatchEvent(new CustomEvent('row-select'));
  }

  private clearSelection(announce: boolean): void {
    if (this.selectedItems().length === 0) return;
    this.setSelected([]);
    if (announce) this.say('Selection cleared.');
  }

  private docDown(event: PointerEvent): void {
    if (this.phase !== 'idle') return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest('button, a, input, textarea, select, label')) return;
    const item = target.closest<HTMLElement>('[data-id]');
    if (item && this.items().includes(item)) return;
    this.clearSelection(false);
  }

  private click(event: MouseEvent): void {
    if (this.suppressClick) {
      this.suppressClick = false;
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    const item = this.itemFrom(event.target);
    if (!item || !this.items().includes(item)) return;
    if (event.target instanceof Element && event.target.closest('button, a, input, textarea, select')) return;
    const all = this.items();
    const index = all.indexOf(item);
    if (index < 0) return;
    if (event.shiftKey) {
      if (!this.anchorId) this.anchorId = item.dataset.id ?? null;
      const anchor = all.findIndex((entry) => entry.dataset.id === this.anchorId);
      const from = anchor >= 0 ? anchor : index;
      const start = Math.min(from, index);
      const end = Math.max(from, index);
      this.setSelected(all.slice(start, end + 1));
      return;
    }
    this.anchorId = item.dataset.id ?? null;
    if (event.metaKey || event.ctrlKey) {
      const next = this.selectedItems().filter((entry) => entry !== item);
      if (!item.classList.contains('is-selected')) next.push(item);
      this.setSelected(next);
      return;
    }
    this.setSelected([item]);
  }

  private itemFrom(target: EventTarget | null): HTMLElement | null {
    if (!(target instanceof Element)) return null;
    return target.closest<HTMLElement>('[data-id]');
  }

  private interactiveTarget(target: EventTarget | null): boolean {
    return target instanceof Element && Boolean(target.closest('button, a, input, textarea, select, label'));
  }

  private pointerDown(event: PointerEvent): void {
    if (this.phase === 'drag' || this.phase === 'keyboard' || this.phase === 'settling') return;
    if (event.button !== 0) return;
    if (this.interactiveTarget(event.target)) return;
    const item = this.itemFrom(event.target);
    if (!item || !this.container.contains(item)) return;
    if (this.options.canDrag && !this.options.canDrag(item)) return;
    if (busySortable && busySortable !== this) return;
    this.pointerId = event.pointerId;
    this.pointerType = event.pointerType;
    this.startX = event.clientX;
    this.startY = event.clientY;
    this.pointX = event.clientX;
    this.pointY = event.clientY;
    this.pendingItem = item;
    this.phase = 'pending';
    if (event.pointerType === 'touch') {
      this.holdTimer = window.setTimeout(() => this.beginPointerDrag(), 250);
    }
  }

  private pointerMove(event: PointerEvent): void {
    if (event.pointerId !== this.pointerId) return;
    this.pointX = event.clientX;
    this.pointY = event.clientY;
    if (this.phase === 'pending') {
      const distance = Math.hypot(event.clientX - this.startX, event.clientY - this.startY);
      if (this.pointerType === 'touch') {
        if (distance > 10) this.clearPending();
        return;
      }
      if (distance >= 5) this.beginPointerDrag();
      return;
    }
  }

  private pointerUp(event: PointerEvent): void {
    if (event.pointerId !== this.pointerId) return;
    if (this.phase === 'pending') this.clearPending();
    else if (this.phase === 'drag') void this.finish(true);
  }

  private clearPending(): void {
    window.clearTimeout(this.holdTimer);
    this.holdTimer = 0;
    if (this.phase === 'pending') this.phase = 'idle';
    this.pendingItem = null;
    this.pointerId = -1;
  }

  private beginPointerDrag(): void {
    const item = this.pendingItem;
    window.clearTimeout(this.holdTimer);
    this.holdTimer = 0;
    if (!item || this.phase !== 'pending') return;
    if (busySortable) return;
    const group = this.dragGroup(item);
    this.openSession(group, item, this.startX, this.startY, false);
    if (this.pointerType === 'touch' && typeof navigator.vibrate === 'function') navigator.vibrate(8);
    this.kick();
  }

  private dragGroup(primary: HTMLElement): HTMLElement[] {
    const all = this.items();
    if (!primary.classList.contains('is-selected')) return [primary];
    const selected = all.filter((item) => item.classList.contains('is-selected'));
    return selected.length > 1 ? selected : [primary];
  }

  private openSession(group: HTMLElement[], primary: HTMLElement, x: number, y: number, keyboard: boolean): void {
    const all = this.items();
    const indexes = group.map((item) => all.indexOf(item)).filter((index) => index >= 0);
    const rect = primary.getBoundingClientRect();
    const placeholder = document.createElement('li');
    placeholder.className = 'sort-placeholder';
    placeholder.setAttribute('aria-hidden', 'true');
    placeholder.style.height = `${rect.height}px`;
    const label = document.createElement('span');
    label.className = 'sort-label';
    placeholder.append(label);
    const parent = primary.parentElement;
    if (!parent) {
      this.phase = 'idle';
      this.pendingItem = null;
      return;
    }
    const first = snapshot(this.container);
    parent.insertBefore(placeholder, primary);
    for (const item of group) {
      item.classList.add('sort-origin');
      item.hidden = true;
    }
    play(this.container, first);
    const grabX = x - rect.left;
    const grabY = y - rect.top;
    const ghost = this.buildGhost(group, primary, rect.width, rect.height);
    const ghostX = keyboard ? rect.left : this.pointX - grabX;
    const ghostY = keyboard ? rect.top : this.pointY - grabY;
    ghost.style.transform = this.ghostTransform(ghostX, ghostY, true);
    document.body.append(ghost);
    document.body.classList.add('sort-dragging');
    const session: DragSession = {
      pointerId: this.pointerId,
      pointerType: this.pointerType,
      origins: group,
      indexes,
      placeholder,
      label,
      ghost,
      grabX,
      grabY,
      originLeft: rect.left,
      originTop: rect.top,
    };
    this.session = session;
    this.phase = keyboard ? 'keyboard' : 'drag';
    busySortable = this;
    this.reorderAt = 0;
    this.writeLabel();
    if (keyboard) {
      const page = (indexes[0] ?? 0) + 1;
      this.say(
        `Picked up ${this.noun(1).toLowerCase()} ${page}. Use arrow keys to move, Space to drop, Escape to cancel.`,
      );
      this.container.focus({ preventScroll: true });
    }
  }

  private buildGhost(group: HTMLElement[], primary: HTMLElement, width: number, height: number): HTMLElement {
    const ghost = document.createElement('div');
    ghost.className = 'sort-ghost';
    ghost.style.width = `${width}px`;
    ghost.style.height = `${height}px`;
    const shown = group.slice(0, 3);
    const ordered = [...shown.filter((item) => item !== primary), primary];
    ordered.forEach((item, index) => {
      const layer = this.cloneCard(item);
      layer.classList.add('sort-layer');
      const depth = ordered.length - 1 - index;
      if (depth > 0 && !prefersReducedMotion()) layer.style.transform = `translate(${depth * 6}px, ${depth * 6}px)`;
      ghost.append(layer);
    });
    if (group.length > 1) {
      const badge = document.createElement('span');
      badge.className = 'sort-count';
      badge.textContent = `${group.length} ${this.noun(group.length).toLowerCase()}`;
      ghost.append(badge);
    }
    return ghost;
  }

  private cloneCard(item: HTMLElement): HTMLElement {
    const clone = item.cloneNode(true) as HTMLElement;
    clone.hidden = false;
    clone.classList.remove('sort-origin', 'is-selected');
    clone.removeAttribute('id');
    clone.removeAttribute('tabindex');
    clone.querySelectorAll('button, a, input, textarea, select, .page-tools, .row-actions').forEach((node) => node.remove());
    const sourceCanvases = [...item.querySelectorAll('canvas')];
    const cloneCanvases = [...clone.querySelectorAll('canvas')];
    sourceCanvases.forEach((source, index) => {
      const dest = cloneCanvases[index];
      if (!(dest instanceof HTMLCanvasElement)) return;
      dest.width = source.width;
      dest.height = source.height;
      dest.getContext('2d')?.drawImage(source, 0, 0);
    });
    const sourceImage = item.querySelector('img');
    if (!(sourceImage instanceof HTMLImageElement) || sourceImage.hidden || !sourceImage.getAttribute('src')) {
      clone.querySelector('img')?.remove();
    }
    return clone;
  }

  private ghostTransform(x: number, y: number, lifted: boolean): string {
    const lift = lifted && !prefersReducedMotion() ? ' scale(1.04) rotate(2deg)' : '';
    return `translate3d(${x}px, ${y}px, 0)${lift}`;
  }

  private kick(): void {
    if (this.raf) return;
    this.raf = window.requestAnimationFrame(() => this.frame());
  }

  private frame(): void {
    this.raf = 0;
    if (this.phase !== 'drag' || !this.session) return;
    const session = this.session;
    const x = this.pointX - session.grabX;
    const y = this.pointY - session.grabY;
    session.ghost.style.transform = this.ghostTransform(x, y, true);
    this.autoScroll();
    this.followPointer();
    this.raf = window.requestAnimationFrame(() => this.frame());
  }

  private autoScroll(): void {
    const zone = 70;
    const max = 16;
    let delta = 0;
    if (this.pointY < zone) delta = -((zone - this.pointY) / zone) * max;
    else if (this.pointY > window.innerHeight - zone) delta = ((this.pointY - (window.innerHeight - zone)) / zone) * max;
    if (delta !== 0) window.scrollBy(0, delta);
    const scroller = scrollableAncestor(this.container);
    if (!scroller || delta === 0) return;
    const rect = scroller.getBoundingClientRect();
    let inner = 0;
    if (this.pointY < rect.top + zone) inner = -((rect.top + zone - this.pointY) / zone) * max;
    else if (this.pointY > rect.bottom - zone) inner = ((this.pointY - (rect.bottom - zone)) / zone) * max;
    if (inner !== 0) scroller.scrollTop += inner;
  }

  private followPointer(): void {
    const session = this.session;
    if (!session) return;
    if (performance.now() < this.reorderAt) return;
    const stack = document.elementsFromPoint(this.pointX, this.pointY);
    const hit = stack.find((node) => node instanceof HTMLElement && !node.closest('.sort-ghost'));
    if (!(hit instanceof HTMLElement)) return;
    if (hit === session.placeholder || hit.closest('.sort-placeholder')) return;
    const item = hit.closest<HTMLElement>('[data-id]');
    if (!item || !this.container.contains(item) || item.classList.contains('sort-origin') || item.hidden) return;
    const rect = item.getBoundingClientRect();
    const before = this.options.layout === 'grid' ? this.pointX < rect.left + rect.width / 2 : this.pointY < rect.top + rect.height / 2;
    if (!this.movePlaceholder(item, before)) return;
    this.reorderAt = performance.now() + 120;
  }

  private movePlaceholder(target: HTMLElement, before: boolean): boolean {
    const session = this.session;
    if (!session) return false;
    const sibling = before ? visualNeighbor(target, 'previous') : visualNeighbor(target, 'next');
    if (sibling === session.placeholder) return false;
    const first = snapshot(this.container);
    const parent = target.parentElement;
    if (!parent) return false;
    parent.insertBefore(session.placeholder, before ? target : target.nextElementSibling);
    play(this.container, first);
    this.writeLabel();
    if (this.phase === 'keyboard') {
      const place = session.placeholder.getBoundingClientRect();
      session.ghost.style.transform = this.ghostTransform(place.left, place.top, true);
      const position = this.slotIndex() + 1;
      const page = (session.indexes[0] ?? 0) + 1;
      const total = this.items().length;
      this.say(`${this.noun(1)} ${page}, position ${position} of ${total}.`);
    }
    return true;
  }

  private writeLabel(): void {
    const session = this.session;
    if (!session) return;
    const position = this.slotIndex() + 1;
    session.label.textContent = this.options.layout === 'grid' ? `Moves to page ${position}` : `Moves to position ${position}`;
  }

  private slotIndex(): number {
    const session = this.session;
    if (!session) return 0;
    const slots = [...this.container.children].filter((node) => {
      if (!(node instanceof HTMLElement)) return false;
      if (node === session.placeholder) return true;
      if (node.classList.contains('sort-origin') || node.hidden) return false;
      return node.hasAttribute('data-id');
    });
    const index = slots.indexOf(session.placeholder);
    return index < 0 ? 0 : index;
  }

  private sameOrder(): boolean {
    const session = this.session;
    if (!session) return true;
    const to = this.slotIndex();
    const sorted = [...session.indexes].sort((a, b) => a - b);
    const count = this.items().length;
    const rest = Array.from({ length: count }, (_, index) => index).filter((index) => !sorted.includes(index));
    const next = rest.slice();
    next.splice(to, 0, ...sorted);
    return next.every((value, index) => value === index);
  }

  private async finish(commit: boolean): Promise<void> {
    const session = this.session;
    if (!session || this.phase === 'settling' || this.phase === 'idle') return;
    const keyboard = this.phase === 'keyboard';
    this.phase = 'settling';
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    if (!commit) this.restorePlaceholder(session);
    const place = session.placeholder.getBoundingClientRect();
    if (!prefersReducedMotion()) {
      const animation = session.ghost.animate(
        [{ transform: session.ghost.style.transform }, { transform: `translate3d(${place.left}px, ${place.top}px, 0)` }],
        { duration: 150, easing: EASE, fill: 'forwards' },
      );
      await animation.finished.catch(() => undefined);
    }
    const changed = commit && !this.sameOrder();
    const indexes = [...session.indexes].sort((a, b) => a - b);
    const to = this.slotIndex();
    session.ghost.remove();
    session.placeholder.remove();
    for (const item of session.origins) {
      item.hidden = false;
      item.classList.remove('sort-origin');
    }
    document.body.classList.remove('sort-dragging');
    this.session = null;
    this.phase = 'idle';
    this.pointerId = -1;
    this.pendingItem = null;
    if (busySortable === this) busySortable = null;
    if (!keyboard) {
      this.suppressClick = true;
      window.setTimeout(() => {
        this.suppressClick = false;
      }, 400);
    }
    this.roving();
    if (!changed) return;
    const from = indexes[0] ?? 0;
    const position = to + 1;
    if (indexes.length > 1) this.say(`${indexes.length} ${this.noun(indexes.length).toLowerCase()} moved to position ${position}.`);
    else this.say(`${this.noun(1)} ${from + 1} moved to position ${position}.`);
    if (indexes.length > 1 && this.options.onReorderMany) this.options.onReorderMany(indexes, to);
    else this.options.onReorder(from, to);
  }

  private restorePlaceholder(session: DragSession): void {
    const primary = session.origins[0];
    const parent = primary?.parentElement;
    if (!primary || !parent) return;
    const first = snapshot(this.container);
    parent.insertBefore(session.placeholder, primary);
    play(this.container, first);
  }

  private keyDown(event: KeyboardEvent): void {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
    if (event.key === 'Escape') {
      if (this.phase === 'drag' || this.phase === 'keyboard') {
        event.preventDefault();
        void this.finish(false);
        return;
      }
      if (this.selectedItems().length > 0 && this.container.contains(document.activeElement)) {
        event.preventDefault();
        this.clearSelection(true);
      }
      return;
    }
    if (this.phase === 'keyboard') {
      this.keyboardDrag(event);
      return;
    }
    if (this.phase !== 'idle') return;
    if (this.interactiveTarget(event.target)) return;
    const item = this.itemFrom(event.target);
    if (!item || event.target !== item) return;
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      this.pickupKeyboard(item);
      return;
    }
    if (event.key.startsWith('Arrow')) this.moveFocus(event, item);
  }

  private pickupKeyboard(item: HTMLElement): void {
    if (this.options.canDrag && !this.options.canDrag(item)) return;
    if (busySortable) return;
    const group = this.dragGroup(item);
    const rect = item.getBoundingClientRect();
    this.pointerType = 'keyboard';
    this.openSession(group, item, rect.left + 8, rect.top + 8, true);
  }

  private keyboardDrag(event: KeyboardEvent): void {
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      void this.finish(true);
      return;
    }
    if (!event.key.startsWith('Arrow')) return;
    event.preventDefault();
    const session = this.session;
    if (!session) return;
    const slots = this.slotNodes();
    const index = slots.indexOf(session.placeholder);
    if (index < 0) return;
    const cols = this.options.layout === 'list' ? 1 : columnsOf(slots);
    let next = index;
    if (event.key === 'ArrowRight') next = index + 1;
    else if (event.key === 'ArrowLeft') next = index - 1;
    else if (event.key === 'ArrowDown') next = index + cols;
    else if (event.key === 'ArrowUp') next = index - cols;
    next = Math.max(0, Math.min(slots.length - 1, next));
    if (next === index) return;
    const target = slots[next];
    if (!target || target === session.placeholder) return;
    if (target.hasAttribute('data-id')) this.movePlaceholder(target, next < index);
    else if (next > index) {
      const after = visualNeighbor(session.placeholder, 'next');
      if (after instanceof HTMLElement && after.hasAttribute('data-id')) this.movePlaceholder(after, false);
    }
  }

  private slotNodes(): HTMLElement[] {
    const session = this.session;
    if (!session) return [];
    return [...this.container.children].filter((node): node is HTMLElement => {
      if (!(node instanceof HTMLElement)) return false;
      if (node === session.placeholder) return true;
      if (node.classList.contains('sort-origin') || node.hidden) return false;
      return node.hasAttribute('data-id');
    });
  }

  private moveFocus(event: KeyboardEvent, item: HTMLElement): void {
    const nodes = this.items().filter((entry) => !entry.hidden);
    const index = nodes.indexOf(item);
    if (index < 0) return;
    const cols = this.options.layout === 'list' ? 1 : columnsOf(nodes);
    let next = index;
    if (event.key === 'ArrowRight') next = index + 1;
    else if (event.key === 'ArrowLeft') next = index - 1;
    else if (event.key === 'ArrowDown') next = index + cols;
    else if (event.key === 'ArrowUp') next = index - cols;
    else return;
    const card = nodes[next];
    if (!card) return;
    event.preventDefault();
    for (const node of nodes) node.tabIndex = node === card ? 0 : -1;
    card.focus();
  }
}

function visualNeighbor(item: Element, direction: 'previous' | 'next'): Element | null {
  let node = direction === 'previous' ? item.previousElementSibling : item.nextElementSibling;
  while (node instanceof HTMLElement && (node.hidden || node.classList.contains('sort-origin'))) {
    node = direction === 'previous' ? node.previousElementSibling : node.nextElementSibling;
  }
  return node;
}

function columnsOf(nodes: HTMLElement[]): number {
  const first = nodes[0];
  if (!first) return 1;
  const rects = nodes.map((node) => node.getBoundingClientRect());
  const top = rects[0]?.top ?? 0;
  let count = 0;
  for (const rect of rects) {
    if (Math.abs(rect.top - top) > 8) break;
    count += 1;
  }
  return Math.max(1, count);
}

function scrollableAncestor(element: HTMLElement): HTMLElement | null {
  let node = element.parentElement;
  while (node && node !== document.body) {
    const style = getComputedStyle(node);
    if (/(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight + 1) return node;
    node = node.parentElement;
  }
  return null;
}

export function createSortable(container: HTMLElement, options: SortableOptions): { destroy(): void } {
  const sortable = new Sortable(container, options);
  return {
    destroy() {
      sortable.destroy();
    },
  };
}
