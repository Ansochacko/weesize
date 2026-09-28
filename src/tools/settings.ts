import { brandName } from '../brand';
import { el } from '../lib/dom';
import { erasePrefs, loadPrefs, savePrefs, type Prefs } from '../lib/prefs';

const LEVELS: Record<NonNullable<Prefs['compressLevel']>, string> = {
  light: 'Light',
  recommended: 'Recommended',
  strong: 'Strong',
};

export function mountSettings(panel: HTMLElement, onErase: () => void): void {
  const level = el('p', undefined, [`${brandName()} has not saved a compression level yet.`]);
  const status = el('p', { class: 'status', role: 'status' });
  const erase = el('button', { class: 'btn quiet', type: 'button' }, ['Erase saved preferences']);
  erase.addEventListener('click', () => {
    void erasePrefs().then(() => {
      try {
        localStorage.removeItem('weesize-theme');
      } catch {
        /* Already empty. */
      }
      onErase();
      level.textContent = `${brandName()} has not saved a compression level yet.`;
      status.textContent = 'Saved preferences were erased from this browser.';
      status.dataset.tone = 'neutral';
    });
  });

  const lite = el('button', { class: 'btn quiet', type: 'button', 'data-action': 'toggle-lite' }, ['Use lite mode']);
  lite.addEventListener('click', () => {
    const on = document.documentElement.dataset.lite === 'on';
    if (on) delete document.documentElement.dataset.lite;
    else document.documentElement.dataset.lite = 'on';
    void savePrefs({ lite: !on });
    lite.textContent = on ? 'Use lite mode' : 'Leave lite mode';
  });
  panel.append(
    el('h2', { class: 'visually-hidden' }, ['Settings']),
    el('p', { class: 'tool-intro' }, [
      `${brandName()} keeps the theme and the last compression level on this device. Your files are not saved here.`,
    ]),
    el('h3', undefined, ['Theme']),
    el('p', undefined, ['Use the sun or moon button in the top bar to switch between light and dark.']),
    el('h3', undefined, ['Saved on this device']),
    level,
    lite,
    el('p', undefined, ['A downloadable private model is not published with this version. Nothing is fetched for chat.']),
    erase,
    status,
    el('h3', undefined, ['Licenses']),
    el('p', undefined, [
      'pdf-lib is MIT. pdf.js is Apache-2.0. JSZip is used under the MIT option. fflate is MIT. MozJPEG, bundled for Maximum squeeze, is BSD, IJG, and zlib. Geist is the SIL Open Font License. IBM Plex Sans outlines the wordmark and is also OFL. Vite and the service worker tooling are MIT. TypeScript is Apache-2.0. The full list is in THIRD_PARTY_LICENSES at the root of this project.',
    ]),
  );

  void loadPrefs().then((prefs) => {
    const chosen = prefs.compressLevel ? LEVELS[prefs.compressLevel] : null;
    level.textContent = chosen
      ? `Last compression level: ${chosen}.`
      : `${brandName()} has not saved a compression level yet.`;
  });
}
