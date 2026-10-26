import bundledCoverImage from '../assets/images/chumphae_store_cover_1791516762661.jpg';
import { StoreSettings } from '../types';

export const STATIC_COVER_IMAGE: string = '/cover.jpg';
export const DEFAULT_COVER_IMAGE = bundledCoverImage || STATIC_COVER_IMAGE;
export const COVER_IMAGE_STORAGE_KEY = 'chumphae_latest_cover_image';

/**
 * Checks if a cover image URL is valid and usable across browsers
 */
export function isValidCoverUrl(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (trimmed.length === 0) return false;
  // Deprecated Vite local dev source path that 404s in production
  if (trimmed.startsWith('/src/')) return false;
  return true;
}

/**
 * Returns the active cover image URL with strict priority:
 * 1. settings.coverImageUrl (if valid and not old /src/ path)
 * 2. localStorage saved latest cover (if valid)
 * 3. DEFAULT_COVER_IMAGE (bundled Vite asset / public static fallback)
 */
export function getActiveCoverImage(settings?: Partial<StoreSettings> | null): string {
  if (isValidCoverUrl(settings?.coverImageUrl)) {
    return settings!.coverImageUrl!.trim();
  }

  try {
    const local = localStorage.getItem(COVER_IMAGE_STORAGE_KEY);
    if (isValidCoverUrl(local)) {
      return local!.trim();
    } else if (local && local.startsWith('/src/')) {
      // Clean up stale invalid /src/ reference from previous versions
      localStorage.removeItem(COVER_IMAGE_STORAGE_KEY);
    }
  } catch (e) {
    console.warn('Could not read cover image from localStorage:', e);
  }

  return DEFAULT_COVER_IMAGE;
}

/**
 * Permanently stores the latest cover image in localStorage
 */
export function saveActiveCoverImageLocally(url: string): void {
  if (!isValidCoverUrl(url)) return;
  try {
    localStorage.setItem(COVER_IMAGE_STORAGE_KEY, url);
  } catch (e) {
    console.warn('Could not save cover image to localStorage:', e);
  }
}

/**
 * Clears the local override if admin explicitly wants to reset to factory default
 */
export function clearActiveCoverImageLocally(): void {
  try {
    localStorage.removeItem(COVER_IMAGE_STORAGE_KEY);
  } catch (e) {
    console.warn('Could not clear cover image in localStorage:', e);
  }
}

/**
 * Checks whether the current cover is a custom image or system default
 */
export function isCustomCoverImage(settings?: Partial<StoreSettings> | null): boolean {
  const current = getActiveCoverImage(settings);
  return (
    isValidCoverUrl(current) &&
    current !== DEFAULT_COVER_IMAGE &&
    current !== STATIC_COVER_IMAGE &&
    current !== '/cover.jpg'
  );
}

