import { el } from './dom';

export function armCancel(row: HTMLElement, onCancel: () => void): { stop(): void } {
  let stopped = false;
  const button = el('button', { class: 'btn quiet cancel', type: 'button' }, ['Cancel']);
  button.hidden = true;
  const timer = window.setTimeout(() => {
    if (!stopped) button.hidden = false;
  }, 2000);
  button.addEventListener('click', () => {
    button.disabled = true;
    button.textContent = 'Stopping…';
    onCancel();
  });
  row.append(button);
  return {
    stop() {
      stopped = true;
      window.clearTimeout(timer);
      button.remove();
    },
  };
}
