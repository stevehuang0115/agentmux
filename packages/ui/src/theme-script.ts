/**
 * The no-flash theme script, kept free of React so a server component (the
 * Cloud portal's layout) can import it from `@crewly/ui/theme-script`
 * without pulling in the client-only component bundle.
 *
 * @module theme-script
 */

/** localStorage key holding the viewer's ThemeMode. */
export const THEME_STORAGE_KEY = 'crewly-theme';

const DARK_QUERY = '(prefers-color-scheme: dark)';

/**
 * ES5 source for an inline <head>/<body> script that applies the stored or
 * system theme before first paint (no flash). Keep it syntax-old: it runs
 * before anything is transpiled for the page.
 */
export const THEME_INIT_SCRIPT =
  "(function(){try{var m=null;try{m=window.localStorage.getItem('" +
  THEME_STORAGE_KEY +
  "')}catch(e){}var d=false;try{d=!!(window.matchMedia&&window.matchMedia('" +
  DARK_QUERY +
  "').matches)}catch(e){}var t=(m==='light'||m==='dark')?m:(d?'dark':'light');document.documentElement.setAttribute('data-theme',t)}catch(e){}})();";

