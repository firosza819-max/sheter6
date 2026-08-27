// dbService.js — Data-access layer for Shatir Store ERP.
// Strictly integrated with External Vercel API Endpoint.

import { storage } from './storage';

const API_ENDPOINT = 'https://shater5-nu.vercel.app/api/productsController';
const INVOICES_API_ENDPOINT = 'https://shater5-nu.vercel.app/api/invoicesController';
const DELETE_API_ENDPOINT = 'https://shater5-nu.vercel.app/api/deleteController';

// ---------- AUTH HELPER ----------
export function getAuthHeaders() {
  const token = localStorage.getItem('token') || sessionStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
}

// ---------- INVENTORY ----------

export async function fetchInventory() {
  let products;
  try {
    const res = await fetch(API_ENDPOINT, {
      method: 'GET',
      headers: getAuthHeaders(),
    });

    if (!res.ok) {
      throw new Error(`Server returned status: ${res.status}`);
    }

    products = await res.json();
  } catch (err) {
    console.warn('Error fetching inventory from API, using cached data:', err);
    products = await loadCachedInventory();
  }

  products = (products || []).map(normalizeProduct);
  await storage.cacheProducts(products);
  return products;
}

export async function loadCachedInventory() {
  return (await storage.loadCachedProducts()) || [];
}

export async function createProduct(p) {
  const row = {
    sku: p.sku || 'SKU-' + Date.now(),
    name: p.name,
    quantity: Number(p.quantity) || 0,
    cost_price: Number(p.cost_price) || 0,
    selling_price: Number(p.selling_price) || 0,
    category: p.category || 'عام',
    low_stock_threshold: Number(p.low_stock_threshold) || 5,
  };

  let created;
  try {
    const res = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(row),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.message || 'فشل إضافة المنتج');
    }

    const data = await res.json();
    created = data.product || data;
  } catch (err) {
    console.error('Error creating product via API:', err);
    throw err;
  }

  return normalizeProduct(created);
}

export async function updateProduct(id, patch) {
  const clean = {
    id,
    name: patch.name,
    sku: patch.sku,
    category: patch.category,
    quantity: Number(patch.quantity),
    cost_price: Number(patch.cost_price),
    selling_price: Number(patch.selling_price),
    low_stock_threshold: Number(patch.low_stock_threshold),
  };

  let updated;
  try {
    const res = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(clean),
    });

    if (!res.ok) {
      throw new Error('فشل تحديث بيانات المنتج');
    }

    const data = await res.json();
    updated = data.product || data;
  } catch (err) {
    console.error('Error updating product via API:', err);
    throw err;
  }

  return normalizeProduct(updated);
}

export async function saveProduct(product) {
  if (product.id) {
    return updateProduct(product.id, product);
  }
  return createProduct(product);
}

export async function deleteProduct(id) {
  try {
    const res = await fetch(`${DELETE_API_ENDPOINT}?id=${id}&target=product&resource=product`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || errData.message || 'فشل حذف المنتج من الخادم');
    }

    // تحديث التخزين المحلي بعد حذف المنتج بنجاح
    const cachedProducts = await loadCachedInventory();
    const updatedProducts = cachedProducts.filter((p) => String(p.id) !== String(id));
    await storage.cacheProducts(updatedProducts);

    return await res.json();
  } catch (err) {
    console.error('Error deleting product via API:', err);
    throw err;
  }
}

// ---------- INVOICES ----------

export async function fetchInvoices() {
  let rows;
  try {
    const res = await fetch(INVOICES_API_ENDPOINT, {
      method: 'GET',
      headers: getAuthHeaders(),
    });

    if (!res.ok) {
      throw new Error(`Server returned status: ${res.status}`);
    }

    rows = await res.json();
  } catch (err) {
    console.warn('Error fetching invoices from API, using cached data:', err);
    rows = await loadCachedInvoices();
  }

  rows = (rows || []).map(normalizeInvoice);
  await storage.cacheInvoices(rows);
  return rows;
}

export async function loadCachedInvoices() {
  return (await storage.loadCachedInvoices()) || [];
}

export async function fetchInvoiceItems(invoiceId) {
  let rows = [];
  try {
    const allInvoices = await fetchInvoices();
    const targetInv = (allInvoices || []).find((inv) => String(inv.id) === String(invoiceId));
    rows = targetInv?.items || targetInv?.invoice_items || [];
  } catch (err) {
    console.warn(`Failed to fetch items for invoice ${invoiceId}, falling back to local cache:`, err);
    try {
      const cachedInvoices = await loadCachedInvoices();
      const targetInv = (cachedInvoices || []).find((inv) => String(inv.id) === String(invoiceId));
      rows = targetInv?.items || [];
    } catch (e) {
      rows = [];
    }
  }

  return (rows || []).map(normalizeInvoiceItem);
}

export async function deleteInvoice(id) {
  try {
    const res = await fetch(`${DELETE_API_ENDPOINT}?id=${id}&target=invoice`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || errData.message || 'فشل حذف الفاتورة من الخادم');
    }

    // تحديث التخزين المحلي بعد الحذف بنجاح
    const cachedInvoices = await loadCachedInvoices();
    const updatedInvoices = cachedInvoices.filter((inv) => String(inv.id) !== String(id));
    await storage.cacheInvoices(updatedInvoices);

    return await res.json();
  } catch (err) {
    console.error('Error deleting invoice via API:', err);
    throw err;
  }
}

export async function processPurchaseInvoice(data) {
  return processInvoice('PURCHASE', data);
}

export async function processSalesInvoice(data) {
  return processInvoice('SALE', data);
}

async function processInvoice(type, data) {
  const items = (data.items || []).map((it) => ({
    product_id: it.product_id || it.id,
    product_name: it.product_name || it.name || it.item_name,
    product_sku: it.product_sku || it.sku,
    category: it.category || 'عام',
    quantity: Number(it.quantity),
    unit_price: Number(it.unit_price || it.price),
    subtotal: Number(it.subtotal || (Number(it.quantity) * Number(it.unit_price || it.price))),
    created_at: it.created_at || new Date().toISOString()
  }));

  const total = Number(data.total_amount) || items.reduce((s, i) => s + i.subtotal, 0);

  const rawPartyName = data.party_name ?? data.customer_name ?? data.customerName ?? data.supplierName ?? data.party ?? data.client_name;
  const partyName = (typeof rawPartyName === 'string' && rawPartyName.trim() !== '') ? rawPartyName.trim() : (rawPartyName || '');

  const paidAmount = Number(data.paid_amount) || 0;
  const previousBalance = Number(data.previous_balance) || 0;
  const notes = data.notes || '';
  const taxAmount = Number(data.tax_amount) || 0;

  const payload = {
    type,
    total_amount: total,
    tax_amount: taxAmount,
    party_name: partyName,
    customer_name: partyName,
    supplierName: partyName,
    paid_amount: paidAmount,
    previous_balance: previousBalance,
    notes,
    items,
    created_by: data.created_by || null,
  };

  let invoice;
  try {
    const res = await fetch(INVOICES_API_ENDPOINT, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.message || 'فشل حفظ الفاتورة');
    }

    const resData = await res.json();
    invoice = resData.invoice || resData;
  } catch (err) {
    console.error('Error processing invoice via API:', err);
    throw err;
  }

  const normalized = normalizeInvoice(invoice);
  if (normalized) {
    if (!normalized.items || normalized.items.length === 0) {
      normalized.items = items.map(normalizeInvoiceItem);
    }
    const cached = await loadCachedInvoices();
    await storage.cacheInvoices([normalized, ...cached]);
  }
  return normalized;
}

// ---------- USERS ----------

export async function fetchUsers() {
  return [];
}

export async function toggleUserStatus(userId, status) {
  return null;
}

// ---------- STATS (admin dashboard) ----------

export async function fetchStats() {
  const [products, invoices] = await Promise.all([fetchInventory(), fetchInvoices()]);
  return {
    totalRevenue: invoices.filter((i) => i.type === 'SALE' || i.type === 'بيع').reduce((s, i) => s + (i.total_amount || 0), 0),
    totalPurchases: invoices.filter((i) => i.type === 'PURCHASE' || i.type === 'شراء').reduce((s, i) => s + (i.total_amount || 0), 0),
    inventoryValue: products.reduce((s, p) => s + ((p.quantity || 0) * (p.cost_price || 0)), 0),
    lowStock: products.filter((p) => p.quantity <= (p.low_stock_threshold ?? 5)).length,
    productCount: products.length,
  };
}

// ---------- NORMALIZERS ----------

function normalizeProduct(p) {
  if (!p) return null;
  return {
    id: p.id,
    sku: p.sku || '',
    name: p.name || 'منتج غير محدد',
    quantity: Number(p.quantity || 0),
    cost_price: Number(p.cost_price || 0),
    selling_price: Number(p.selling_price || 0),
    category: p.category || 'عام',
    low_stock_threshold: Number(p.low_stock_threshold ?? 5),
    updated_at: p.updated_at,
  };
}

function normalizeInvoice(i) {
  if (!i) return null;
  const rawItems = i.items || i.invoice_items || [];

  const party = i.party_name || i.customer_name || i.partyName || i.customerName || i.supplierName || i.client_name || '';

  return {
    id: i.id,
    invoice_number: i.invoice_number || i.id,
    type: i.type,
    total_amount: Number(i.total_amount || 0),
    tax_amount: Number(i.tax_amount || 0),
    created_by: i.created_by,
    created_at: i.created_at || new Date().toISOString(),
    customer_name: party,
    party_name: party,
    supplierName: party,
    customerName: party,
    client_name: party,
    paid_amount: Number(i.paid_amount || 0),
    remaining_amount: Number(i.remaining_amount || 0),
    previous_balance: Number(i.previous_balance || 0),
    notes: i.notes || '',
    items: Array.isArray(rawItems) ? rawItems.map(normalizeInvoiceItem) : [],
  };
}

function normalizeInvoiceItem(it) {
  if (!it) return null;
  const productName = it.product_name || it.item_name || it.name || it.title || it.products?.name || it.product?.name || 'صنف غير مسمى';
  const productSku = it.product_sku || it.sku || it.products?.sku || it.product?.sku || '';
  const category = it.category || it.products?.category || it.product?.category || 'عام';
  const qty = Number(it.quantity || it.qty || 0);
  const price = Number(it.unit_price || it.price || 0);
  const subtotal = Number(it.subtotal || (qty * price));
  const createdAt = it.created_at || new Date().toISOString();

  return {
    id: it.id || Math.random().toString(36).substring(2, 9),
    invoice_id: it.invoice_id,
    product_id: it.product_id,
    quantity: qty,
    unit_price: price,
    subtotal: subtotal,
    product_name: productName,
    product_sku: productSku,
    category: category,
    created_at: createdAt,
  };
}

function normalizeUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    full_name: u.full_name,
    email: u.email,
    role: u.role,
    is_active: u.is_active ?? true,
    created_at: u.created_at,
  };
}
