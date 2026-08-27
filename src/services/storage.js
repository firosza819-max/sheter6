// storage.js — Capacitor Preferences wrapper for session + offline cache.
// Falls back to localStorage when Capacitor native bridge is unavailable (web dev).

import { Preferences } from '@capacitor/preferences';

const SESSION_KEY = 'shatir_session';
const PRODUCTS_CACHE = 'shatir_products_cache';
const INVOICES_CACHE = 'shatir_invoices_cache';
const THEME_KEY = 'shatir_theme';

async function set(key, value) {
  try {
    await Preferences.set({ key, value: JSON.stringify(value) });
  } catch {
    localStorage.setItem(key, JSON.stringify(value));
  }
}

async function get(key) {
  try {
    const { value } = await Preferences.get({ key });
    return value ? JSON.parse(value) : null;
  } catch {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  }
}

async function remove(key) {
  try {
    await Preferences.remove({ key });
  } catch {
    localStorage.removeItem(key);
  }
}

export const storage = {
  // ---- session ----
  async saveSession(user) {
    await set(SESSION_KEY, user);
  },
  async loadSession() {
    return get(SESSION_KEY);
  },
  async clearSession() {
    await remove(SESSION_KEY);
  },

  // ---- products cache ----
  async cacheProducts(products) {
    await set(PRODUCTS_CACHE, products);
  },
  async loadCachedProducts() {
    return get(PRODUCTS_CACHE);
  },

  // ---- invoices cache ----
  async cacheInvoices(invoices) {
    await set(INVOICES_CACHE, invoices);
  },
  async loadCachedInvoices() {
    return get(INVOICES_CACHE);
  },

  // ---- theme ----
  async saveTheme(theme) {
    await set(THEME_KEY, theme);
  },
  async loadTheme() {
    return get(THEME_KEY);
  },
};
