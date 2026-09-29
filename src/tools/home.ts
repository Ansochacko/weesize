import { detectFiles } from '../lib/detect';
import { dropZone, el } from '../lib/dom';
import { iconElement } from '../lib/icons';
import { sizeBar } from '../lib/size-bar';
import { toolById } from './registry';

export function mountHome(options: {
  dropHost: HTMLElement;
  suggestHost: HTMLElement;
  panel: HTMLElement;
  onPick: (route: string, files: File[]) => void;
}): { setHot(on: boolean): void; offer(files: File[]): void } {
  const drop = dropZone({
    title: 'Drop a PDF or image here',
    detail: 'or choose a file',
    accept: 'application/pdf,image/jpeg,image/png,image/webp,image/gif,.pdf,.jpg,.jpeg,.png,.webp,.gif,.docx,.xlsx,.pptx,.html,.htm',
    multiple: true,
    buttonLabel: 'Choose a file',
    onFiles: (files) => offer(files),
  });
  drop.el.classList.add('drop-hero');
  const folderInput = el('input', { class: 'file-input', type: 'file' });
  folderInput.multiple = true;
  folderInput.tabIndex = -1;
  folderInput.setAttribute('aria-hidden', 'true');
  folderInput.setAttribute('webkitdirectory', '');
  folderInput.addEventListener('change', () => {
    const files = [...(folderInput.files ?? [])];
    folderInput.value = '';
    if (files.length) offer(files);
  });
  const folderButton = el('button', { class: 'drop-folder', type: 'button' }, [
    iconElement('folder', { size: 14, className: 'icon-inline' }),
    ' Choose a folder',
  ]);
  folderButton.addEventListener('click', () => folderInput.click());
  const actions = el('div', { class: 'drop-actions' }, [
    drop.el.querySelector('.btn') ?? el('span'),
    folderButton,
    folderInput,
  ]);
  const note = drop.el.querySelector('.local-note');
  const copy = drop.el.querySelector('.drop-title')?.parentElement;
  if (copy) {
    copy.querySelector('.btn')?.remove();
    note?.remove();
    copy.append(actions);
    if (note) copy.append(note);
  }
  options.dropHost.replaceChildren(drop.el);
  mountTargetSwitch();
  const demo = document.querySelector<HTMLElement>('#hero-demo');
  if (demo && demo.childElementCount === 0) mountDemo(demo);
  options.panel.replaceChildren(
    el('h2', { class: 'visually-hidden' }, ['Start']),
    el('p', { class: 'tool-intro' }, ['Drop a file above, or pick a tool. Nothing is uploaded.']),
  );
  const buttons = el('div', { class: 'suggest' });
  const status = el('p', { class: 'status', role: 'status' });
  options.suggestHost.replaceChildren(buttons, status);

  function offer(files: File[]): void {
    const found = detectFiles(files);
    buttons.replaceChildren();
    for (const choice of found.offers) {
      const tool = toolById(choice.route);
      const button = el('button', { class: choice.primary ? 'btn primary suggest-btn' : 'btn quiet suggest-btn', type: 'button' }, [
        ...(tool ? [iconElement(tool.icon, { size: 16, className: 'icon-inline' }), ' '] : []),
        choice.label,
      ]);
      button.addEventListener('click', () => options.onPick(choice.route, choice.files));
      buttons.append(button);
    }
    const message = [found.note, found.warning].filter(Boolean).join(' ');
    status.textContent = message;
    status.dataset.tone = found.note && found.offers.length === 0 ? 'bad' : 'neutral';
    buttons.hidden = found.offers.length === 0;
    document.querySelector<HTMLElement>('.scan-launch')?.toggleAttribute('hidden', found.offers.length > 0);
  }

  return {
    setHot(on) {
      drop.setHot(on);
    },
    offer,
  };
}

function mountTargetSwitch(): void {
  const tabs = {
    photo: document.querySelector<HTMLButtonElement>('#tab-target-photo'),
    signature: document.querySelector<HTMLButtonElement>('#tab-target-signature'),
    pdf: document.querySelector<HTMLButtonElement>('#tab-target-pdf'),
  };
  const panels = {
    photo: document.querySelector<HTMLElement>('#chips-photo'),
    signature: document.querySelector<HTMLElement>('#chips-signature'),
    pdf: document.querySelector<HTMLElement>('#chips-pdf'),
  };
  if (!tabs.photo || !tabs.signature || !tabs.pdf || !panels.photo || !panels.signature || !panels.pdf) return;

  const setTargetType = (type: 'photo' | 'signature' | 'pdf') => {
    (['photo', 'signature', 'pdf'] as const).forEach((t) => {
      const active = t === type;
      tabs[t]?.classList.toggle('is-active', active);
      tabs[t]?.setAttribute('aria-selected', active ? 'true' : 'false');
      if (panels[t]) panels[t]!.hidden = !active;
    });

    try {
      localStorage.setItem('weesize-target-type', type);
    } catch {}
  };

  const keys: Array<'photo' | 'signature' | 'pdf'> = ['photo', 'signature', 'pdf'];
  keys.forEach((key, idx) => {
    const btn = tabs[key];
    if (!btn) return;
    btn.addEventListener('click', () => setTargetType(key));
    btn.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        const next = keys[(idx + 1) % keys.length]!;
        tabs[next]?.focus();
        setTargetType(next);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        const prev = keys[(idx - 1 + keys.length) % keys.length]!;
        tabs[prev]?.focus();
        setTargetType(prev);
      }
    });
  });

  let saved = 'photo';
  try {
    saved = localStorage.getItem('weesize-target-type') || 'photo';
  } catch {}
  setTargetType((['photo', 'signature', 'pdf'] as const).includes(saved as any) ? (saved as any) : 'photo');
}

function mountDemo(host: HTMLElement): void {
  const size = el('span', { class: 'num demo-size' }, ['4.8 MB']);
  const chip = el('p', { class: 'file-chip' }, ['report.pdf ', size]);
  const barHost = el('div');
  host.append(chip, barHost);
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const paint = (shrunk: boolean) => {
    size.textContent = shrunk ? '184 KB' : '4.8 MB';
    barHost.replaceChildren(
      sizeBar({
        before: 4.8 * 1024 * 1024,
        after: shrunk ? 184 * 1024 : 4.8 * 1024 * 1024,
        limit: 200 * 1024,
        limitLabel: '200 KB',
        ...(shrunk ? {} : { hold: true }),
      }),
    );
  };
  paint(reduced);
  if (reduced || document.documentElement.dataset.lite === 'on') return;
  const cycle = () => {
    paint(false);
    window.setTimeout(() => paint(true), 700);
  };
  cycle();
  window.setInterval(cycle, 4200);
}
