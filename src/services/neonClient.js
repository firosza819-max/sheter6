// neonClient.js — Neon Serverless PostgreSQL connection & Vercel API Client
//
// Uses @capacitor/core (CapacitorHttp) for HTTP requests to bypass CORS on mobile devices.
// Connects to Vercel API endpoints:
// - Auth: https://shater5.vercel.app/api/authController
// - Invoices: https://shater5.vercel.app/api/invoicesController
// - Products: https://shater5.vercel.app/api/productsController

import { CapacitorHttp } from '@capacitor/core';
import { neon } from '@neondatabase/serverless';

const NEON_CS = import.meta.env.VITE_NEON_CONNECTION_STRING;
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Vercel API Endpoint URLs
export const API_URLS = {
  AUTH: 'https://shater5.vercel.app/api/authController',
  INVOICES: 'https://shater5.vercel.app/api/invoicesController',
  PRODUCTS: 'https://shater5.vercel.app/api/productsController',
};

export const hasNeon = Boolean(NEON_CS);
export const hasFallback = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

if (!hasNeon && !hasFallback) {
  // eslint-disable-next-line no-console
  console.error(
    'No database connection configured. Set VITE_NEON_CONNECTION_STRING (Neon) or VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY.'
  );
}

// Neon SQL tagged-template client (only built when a connection string exists).
const sql = hasNeon ? neon(NEON_CS) : null;

/**
 * Run a parameterized SQL query against the database.
 * @param {string} text - SQL with $1, $2, ... placeholders
 * @param {any[]} params - parameter values
 * @returns {Promise<any[]>} rows
 */
export async function query(text, params = []) {
  if (hasNeon) {
    // neon() tagged template: pass the SQL string and params array.
    return sql(text, params);
  }
  throw new Error('Direct SQL query requires VITE_NEON_CONNECTION_STRING to be set.');
}

/**
 * Helper function using CapacitorHttp for external requests
 */
async function capHttpRequest(options) {
  const response = await CapacitorHttp.request(options);
  if (response.status < 200 || response.status >= 300) {
    const errorData = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
    throw new Error(`HTTP ${options.method} failed (${response.status}): ${errorData}`);
  }
  return response.data;
}

// ==========================================
// 1. Auth Services (Login / Session)
// ==========================================
export async function loginUser(credentials) {
  return await capHttpRequest({
    method: 'POST',
    url: API_URLS.AUTH,
    headers: { 'Content-Type': 'application/json' },
    data: credentials,
  });
}

// ==========================================
// 2. Invoices Services (Fetch & Save Invoices)
// ==========================================
export async function getInvoices(token) {
  return await capHttpRequest({
    method: 'GET',
    url: API_URLS.INVOICES,
    headers: {
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : '',
    },
  });
}

export async function createInvoice(invoiceData, token) {
  return await capHttpRequest({
    method: 'POST',
    url: API_URLS.INVOICES,
    headers: {
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : '',
    },
    data: invoiceData,
  });
}

// ==========================================
// 3. Products Services (Fetch & Save Products)
// ==========================================
export async function getProducts(token) {
  return await capHttpRequest({
    method: 'GET',
    url: API_URLS.PRODUCTS,
    headers: {
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : '',
    },
  });
}

export async function createProduct(productData, token) {
  return await capHttpRequest({
    method: 'POST',
    url: API_URLS.PRODUCTS,
    headers: {
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : '',
    },
    data: productData,
  });
}

// ==========================================
// Exported API Objects (Solves dbService.js Import Issue)
// ==========================================
export const productsApi = {
  getAll: getProducts,
  create: createProduct,
};

export const invoicesApi = {
  getAll: getInvoices,
  create: createInvoice,
};

// ==========================================
// Fallback RPC & Rest Methods (Supabase)
// ==========================================

/**
 * Run a PostgREST RPC function (used by the Supabase fallback path).
 * @param {string} fn - function name in the public schema
 * @param {object} args - arguments object
 * @returns {Promise<any>} response data
 */
export async function rpc(fn, args = {}) {
  if (!hasFallback) throw new Error('No database fallback configured.');
  const url = `${SUPABASE_URL}/rest/v1/rpc/${fn}`;
  return await capHttpRequest({
    method: 'POST',
    url,
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    data: args,
  });
}

/**
 * Generic PostgREST table helper (Supabase fallback). Returns all rows of a table.
 * @param {string} table
 * @param {object} opts - { select, order, filters: {col, op, val}[] }
 */
export async function restSelect(table, opts = {}) {
  if (!hasFallback) throw new Error('No database fallback configured.');
  const select = opts.select || '*';
  let url = `${SUPABASE_URL}/rest/v1/${table}?select=${encodeURIComponent(select)}`;
  if (opts.order) {
    url += `&order=${encodeURIComponent(opts.order.col + '.' + opts.order.desc)}`;
  }
  if (opts.filters) {
    for (const f of opts.filters) {
      url += `&${encodeURIComponent(f.col)}=${encodeURIComponent(f.op + '.' + f.val)}`;
    }
  }
  return await capHttpRequest({
    method: 'GET',
    url,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
  });
}

/**
 * Generic PostgREST insert (Supabase fallback).
 */
export async function restInsert(table, rows) {
  if (!hasFallback) throw new Error('No database fallback configured.');
  const url = `${SUPABASE_URL}/rest/v1/${table}`;
  return await capHttpRequest({
    method: 'POST',
    url,
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      Prefer: 'return=representation',
    },
    data: rows,
  });
}

/**
 * Generic PostgREST update (Supabase fallback).
 */
export async function restUpdate(table, filters, patch) {
  if (!hasFallback) throw new Error('No database fallback configured.');
  let url = `${SUPABASE_URL}/rest/v1/${table}`;
  for (const f of filters) {
    url += (url.includes('?') ? '&' : '?') + `${encodeURIComponent(f.col)}=${encodeURIComponent(f.op + '.' + f.val)}`;
  }
  return await capHttpRequest({
    method: 'PATCH',
    url,
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      Prefer: 'return=representation',
    },
    data: patch,
  });
}
