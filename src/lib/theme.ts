export type AppTheme = 'light' | 'dark';

const STORAGE_KEY = 'cdlscore_theme';

function parseTheme(raw: string | null): AppTheme {
  if (raw === 'dark' || raw === 'navy') return 'dark';
  if (raw === 'light' || raw === 'cdl-score') return 'light';
  return 'light';
}

export function getStoredTheme(): AppTheme {
  return parseTheme(localStorage.getItem(STORAGE_KEY));
}

export function applyTheme(theme: AppTheme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(STORAGE_KEY, theme);
}

export const THEME_LABELS: Record<AppTheme, string> = {
  light: 'Light theme',
  dark: 'Night theme',
};
