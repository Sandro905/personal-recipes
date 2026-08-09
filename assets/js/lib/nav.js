// Barra applicazione condivisa dalle tre pagine: marchio, link, lingua,
// tema e menu a scomparsa sul telefono.
// I controlli esistono in due copie (in barra da tablet in su, nel menu sul
// telefono): qui si agganciano per attributo, non per id, così restano una
// sola logica.

import { LANGS, setLang } from './i18n.js';
import { el } from './data.js';

/** Icone: inline, così non dipendiamo da nessun font o CDN. */
export const icons = {
  menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
  leaf: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/><path d="M2 21c0-3 1.85-5.36 5.08-6"/></svg>',
  sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4"/></svg>',
  moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  chevron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>',
  minus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M5 12h14"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  mark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3v8a3 3 0 0 0 6 0V3"/><path d="M9 11v10"/><path d="M17 3c-1.5 2-2 4-2 6v3h3"/><path d="M18 12v9"/></svg>',
};

const PAGES = [
  { key: 'home', href: 'index.html', icon: 'book' },
  { key: 'foods', href: 'alimenti.html', icon: 'leaf' }
];

/**
 * Aggancia barra e menu.
 * @param {object} opts
 * @param {(path: string) => string} opts.t  dizionario già risolto
 * @param {string} opts.lang
 * @param {string} opts.active  'home' | 'foods' | null
 * @param {() => string} opts.toggleTheme  ritorna il tema applicato
 */
export function initNav({ t, lang, active, toggleTheme }) {
  document.documentElement.lang = lang;

  const brand = document.querySelector('[data-brand-name]');
  if (brand) brand.textContent = t('site.title');

  /* --- link di navigazione, in barra e nel menu --- */
  for (const host of document.querySelectorAll('[data-navlinks]')) {
    const withIcons = host.hasAttribute('data-with-icons');
    host.replaceChildren(
      ...PAGES.map((page) => {
        const link = el('a', { href: `${page.href}?lang=${lang}` });
        if (withIcons) link.insertAdjacentHTML('afterbegin', icons[page.icon]);
        link.append(document.createTextNode(t(`nav.${page.key}`)));
        if (page.key === active) link.setAttribute('aria-current', 'page');
        return link;
      })
    );
    host.setAttribute('aria-label', t('nav.sections'));
  }

  /* --- lingua --- */
  for (const host of document.querySelectorAll('[data-langs]')) {
    host.setAttribute('aria-label', t('nav.lang'));
    host.replaceChildren(
      ...LANGS.map((code) =>
        el('button', {
          type: 'button',
          text: code.toUpperCase(),
          'aria-pressed': String(code === lang),
          onclick: () => {
            setLang(code);
            const url = new URL(location.href);
            url.searchParams.set('lang', code);
            location.href = url.toString();
          }
        })
      )
    );
  }

  /* --- tema --- */
  const paintTheme = (button) => {
    const dark =
      document.documentElement.dataset.theme === 'dark' ||
      (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
    button.innerHTML = dark ? icons.sun : icons.moon;
    if (button.hasAttribute('data-theme-label')) {
      button.append(document.createTextNode(t(dark ? 'nav.themeLight' : 'nav.themeDark')));
    }
    button.setAttribute('aria-label', t('nav.theme'));
    button.title = t('nav.theme');
  };
  const themeButtons = [...document.querySelectorAll('[data-theme-toggle]')];
  for (const button of themeButtons) {
    paintTheme(button);
    button.addEventListener('click', () => {
      toggleTheme();
      for (const other of themeButtons) paintTheme(other);
    });
  }

  /* --- menu a scomparsa --- */
  const burger = document.querySelector('[data-burger]');
  const drawer = document.querySelector('[data-drawer]');
  const scrim = document.querySelector('[data-scrim]');
  if (!burger || !drawer || !scrim) return;

  burger.innerHTML = icons.menu;
  burger.setAttribute('aria-label', t('nav.menu'));
  const closeBtn = drawer.querySelector('[data-drawer-close]');
  if (closeBtn) {
    closeBtn.innerHTML = icons.close;
    closeBtn.setAttribute('aria-label', t('nav.close'));
  }
  const title = drawer.querySelector('[data-drawer-title]');
  if (title) title.textContent = t('nav.menu');
  for (const node of drawer.querySelectorAll('[data-label]')) {
    node.textContent = t(`nav.${node.dataset.label}`);
  }

  let open = false;

  function setOpen(next) {
    if (open === next) return;
    open = next;
    burger.setAttribute('aria-expanded', String(next));
    document.body.classList.toggle('is-locked', next);

    if (next) {
      scrim.hidden = false;
      drawer.hidden = false;
      // un frame prima di animare, altrimenti la transizione non parte
      requestAnimationFrame(() => {
        scrim.classList.add('is-open');
        drawer.classList.add('is-open');
      });
      (drawer.querySelector('a, button') ?? drawer).focus({ preventScroll: true });
    } else {
      scrim.classList.remove('is-open');
      drawer.classList.remove('is-open');
      const hide = () => { scrim.hidden = true; drawer.hidden = true; };
      drawer.addEventListener('transitionend', hide, { once: true });
      // se le transizioni sono disattivate, transitionend non arriva mai
      setTimeout(hide, 350);
      burger.focus({ preventScroll: true });
    }
  }

  burger.addEventListener('click', () => setOpen(!open));
  scrim.addEventListener('click', () => setOpen(false));
  closeBtn?.addEventListener('click', () => setOpen(false));
  drawer.addEventListener('click', (event) => {
    if (event.target.closest('a')) setOpen(false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && open) setOpen(false);
  });
  // il menu è solo per il telefono: se si allarga, torna tutto in barra
  matchMedia('(min-width: 768px)').addEventListener('change', (event) => {
    if (event.matches) setOpen(false);
  });
}
