/* =========================================================
 * Açılış Takip — ürün açılış tarihi & otomatik SKT hesabı
 * ========================================================= */

/** Kategoriler ve "açıldıktan sonra tüketme süresi" (gün) ön tanımları */
const CATEGORIES = [
  { id: 'sut',        label: '🥛 Süt & Süt Ürünleri',        days: 7 },
  { id: 'et',         label: '🥩 Et / Tavuk / Şarküteri',     days: 3 },
  { id: 'icecek',     label: '🧃 Meyve Suyu / İçecek',        days: 7 },
  { id: 'konserve',   label: '🥫 Konserve / Salça',           days: 7 },
  { id: 'sos',        label: '🍅 Sos / Ketçap / Mayonez',     days: 60 },
  { id: 'recel',      label: '🍯 Reçel / Bal / Sürülebilir',  days: 90 },
  { id: 'yag',        label: '🫒 Sıvı Yağ',                   days: 180 },
  { id: 'kuru',       label: '🌾 Kuru Gıda (makarna, bakliyat)', days: 365 },
  { id: 'kozmetik-krem', label: '🧴 Krem / Losyon',           days: 180 },
  { id: 'kozmetik-goz',  label: '👁️ Maskara / Eyeliner',      days: 90 },
  { id: 'kozmetik-ruj',  label: '💄 Ruj / Gloss',             days: 365 },
  { id: 'parfum',     label: '🌸 Parfüm',                     days: 730 },
  { id: 'gunes',      label: '☀️ Güneş Kremi',                days: 365 },
  { id: 'ilac',       label: '💊 Şurup / İlaç',               days: 30 },
  { id: 'diger',      label: '📦 Diğer',                      days: null },
];

/** Open Food Facts kategori anahtar kelimeleri → bizim kategoriler */
const OFF_CATEGORY_MAP = [
  { match: ['milk', 'cheese', 'yogurt', 'yoghurt', 'dairies', 'dairy', 'cream', 'butter', 'kefir', 'ayran'], id: 'sut' },
  { match: ['meat', 'poultry', 'chicken', 'sausage', 'salami', 'ham', 'charcuterie', 'fish', 'seafood'], id: 'et' },
  { match: ['juice', 'beverage', 'drink', 'soda', 'nectar'], id: 'icecek' },
  { match: ['canned', 'tomato-paste', 'pickle'], id: 'konserve' },
  { match: ['sauce', 'ketchup', 'mayonnaise', 'mustard', 'dressing'], id: 'sos' },
  { match: ['jam', 'honey', 'spread', 'marmalade', 'chocolate-spread', 'hazelnut-spread'], id: 'recel' },
  { match: ['oil', 'olive-oil', 'sunflower-oil'], id: 'yag' },
  { match: ['pasta', 'rice', 'cereal', 'legume', 'flour', 'biscuit', 'snack', 'grocery', 'dried'], id: 'kuru' },
];

const state = {
  products: [],
  currentPhotoBlob: null,   // formda seçilen fotoğraf
  currentDetailId: null,
  scanner: null,
  viewStack: ['view-list'],
};

const $ = (id) => document.getElementById(id);

/* ---------- Yardımcılar ---------- */

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDays(isoDate, days) {
  const d = new Date(isoDate + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function daysUntil(isoDate) {
  const now = new Date(todayISO() + 'T00:00:00');
  const target = new Date(isoDate + 'T00:00:00');
  return Math.round((target - now) / 86400000);
}

function formatDate(isoDate) {
  if (!isoDate) return '—';
  return new Date(isoDate + 'T00:00:00').toLocaleDateString('tr-TR', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

/** Açılış tarihi + süre ve (varsa) etiket SKT'sinden nihai son kullanma tarihini hesaplar */
function computeExpiry(openedAt, shelfLifeDays, printedExpiry) {
  let computed = null;
  if (openedAt && shelfLifeDays) computed = addDays(openedAt, Number(shelfLifeDays));
  if (computed && printedExpiry) return computed < printedExpiry ? computed : printedExpiry;
  return computed || printedExpiry || null;
}

function expiryBadge(expiresAt) {
  if (!expiresAt) return { cls: 'ok', text: 'Süre yok' };
  const d = daysUntil(expiresAt);
  if (d < 0) return { cls: 'expired', text: `${Math.abs(d)} gün geçti!` };
  if (d === 0) return { cls: 'warn', text: 'Bugün son gün!' };
  if (d <= 3) return { cls: 'warn', text: `${d} gün kaldı` };
  return { cls: 'ok', text: `${d} gün kaldı` };
}

function toast(msg, ms = 2600) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.add('hidden'), ms);
}

/* ---------- Görünüm geçişleri ---------- */

function showView(id, { push = true } = {}) {
  document.querySelectorAll('.view').forEach((v) => v.classList.add('hidden'));
  $(id).classList.remove('hidden');
  if (push && state.viewStack[state.viewStack.length - 1] !== id) state.viewStack.push(id);
  if (id !== 'view-scan') stopScanner();
}

function goBack() {
  state.viewStack.pop();
  const prev = state.viewStack[state.viewStack.length - 1] || 'view-list';
  showView(prev, { push: false });
  if (prev === 'view-list') renderList();
}

document.querySelectorAll('[data-back]').forEach((b) => b.addEventListener('click', goBack));

/* ---------- Liste ---------- */

async function renderList() {
  state.products = await ProductDB.getAll();
  const list = $('product-list');
  const empty = $('empty-state');
  const summary = $('summary-bar');
  list.innerHTML = '';

  if (!state.products.length) {
    empty.classList.remove('hidden');
    summary.classList.add('hidden');
    return;
  }
  empty.classList.add('hidden');

  const sorted = [...state.products].sort((a, b) => {
    if (!a.expiresAt) return 1;
    if (!b.expiresAt) return -1;
    return a.expiresAt.localeCompare(b.expiresAt);
  });

  const expired = sorted.filter((p) => p.expiresAt && daysUntil(p.expiresAt) < 0).length;
  const soon = sorted.filter((p) => p.expiresAt && daysUntil(p.expiresAt) >= 0 && daysUntil(p.expiresAt) <= 3).length;
  if (expired || soon) {
    const parts = [];
    if (expired) parts.push(`⛔ ${expired} ürünün süresi geçti`);
    if (soon) parts.push(`⚠️ ${soon} ürünün süresi dolmak üzere`);
    summary.textContent = parts.join(' · ');
    summary.classList.remove('hidden');
  } else {
    summary.classList.add('hidden');
  }

  for (const p of sorted) {
    const card = document.createElement('div');
    card.className = 'product-card';
    card.addEventListener('click', () => showDetail(p.id));

    let thumb;
    if (p.photo) {
      thumb = document.createElement('img');
      thumb.className = 'product-thumb';
      thumb.src = URL.createObjectURL(p.photo);
    } else {
      thumb = document.createElement('div');
      thumb.className = 'product-thumb';
      const cat = CATEGORIES.find((c) => c.id === p.category);
      thumb.textContent = cat ? cat.label.split(' ')[0] : '📦';
    }

    const info = document.createElement('div');
    info.className = 'product-info';
    const name = document.createElement('div');
    name.className = 'product-name';
    name.textContent = p.name;
    const meta = document.createElement('div');
    meta.className = 'product-meta';
    meta.textContent = `Açılış: ${formatDate(p.openedAt)} · SKT: ${formatDate(p.expiresAt)}`;
    info.append(name, meta);

    const badge = document.createElement('span');
    const b = expiryBadge(p.expiresAt);
    badge.className = `badge ${b.cls}`;
    badge.textContent = b.text;

    card.append(thumb, info, badge);
    list.appendChild(card);
  }
}

/* ---------- Barkod tarama ---------- */

async function startScanner() {
  showView('view-scan');
  $('scan-status').textContent = 'Kamera başlatılıyor…';
  try {
    state.scanner = new Html5Qrcode('scanner');
    await state.scanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 250, height: 160 } },
      (decodedText) => onBarcodeScanned(decodedText),
      () => {} // kare kare hata mesajlarını yoksay
    );
    $('scan-status').textContent = 'Barkodu çerçeve içine hizalayın';
  } catch (err) {
    $('scan-status').textContent =
      'Kamera açılamadı. Tarayıcı izinlerini kontrol edin veya barkodu elle girin.';
    console.error(err);
  }
}

function stopScanner() {
  if (state.scanner) {
    const s = state.scanner;
    state.scanner = null;
    // stop() tarama hiç başlamadıysa senkron hata fırlatır
    try {
      s.stop().then(() => s.clear()).catch(() => {});
    } catch {
      try { s.clear(); } catch { /* yoksay */ }
    }
  }
}

async function onBarcodeScanned(code) {
  stopScanner();
  if (navigator.vibrate) navigator.vibrate(80);

  // Aynı barkod daha önce kaydedilmişse haber ver
  const existing = await ProductDB.findByBarcode(code);
  if (existing.length) {
    const last = existing[existing.length - 1];
    toast(`Bu ürün zaten kayıtlı (açılış: ${formatDate(last.openedAt)}). Yeni kayıt açılıyor.`, 3500);
  }

  openForm({ barcode: code });
  lookupProduct(code);
}

/* ---------- Open Food Facts ile otomatik doldurma ---------- */

async function lookupProduct(barcode) {
  const status = $('lookup-status');
  status.className = 'lookup-status';
  status.textContent = '🔎 Ürün bilgisi aranıyor…';
  status.classList.remove('hidden');

  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=product_name,product_name_tr,brands,categories_tags,image_front_small_url`,
      { signal: AbortSignal.timeout(8000) }
    );
    const data = await res.json();
    if (data.status !== 1 || !data.product) throw new Error('not found');

    const p = data.product;
    const name = [p.brands, p.product_name_tr || p.product_name].filter(Boolean).join(' ');
    if (name && !$('form-name').value) $('form-name').value = name;

    // Kategori tahmini → raf ömrü otomatik dolar
    const catId = guessCategory(p.categories_tags || []);
    if (catId) {
      $('form-category').value = catId;
      applyCategoryDefaults();
    }

    status.className = 'lookup-status ok';
    status.textContent = `✅ Ürün bulundu: ${name || 'İsimsiz ürün'}${catId ? ' — kategori ve süre otomatik seçildi' : ''}`;
  } catch (e) {
    status.className = 'lookup-status fail';
    status.textContent = 'ℹ️ Ürün veritabanında bulunamadı — bilgileri elle girebilirsiniz.';
  }
  updateExpiryPreview();
}

function guessCategory(tags) {
  const joined = tags.join(' ').toLowerCase();
  for (const rule of OFF_CATEGORY_MAP) {
    if (rule.match.some((kw) => joined.includes(kw))) return rule.id;
  }
  return null;
}

/* ---------- Form ---------- */

function fillCategorySelect() {
  const sel = $('form-category');
  sel.innerHTML = '';
  for (const c of CATEGORIES) {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.days ? `${c.label} (${c.days} gün)` : c.label;
    sel.appendChild(opt);
  }
  sel.value = 'diger';
}

function openForm({ barcode = '' } = {}) {
  $('product-form').reset();
  state.currentPhotoBlob = null;
  $('form-photo-preview').classList.add('hidden');
  $('lookup-status').classList.add('hidden');
  fillCategorySelect();
  $('form-barcode').value = barcode;
  $('form-opened').value = todayISO();
  updateExpiryPreview();
  showView('view-form');
}

function applyCategoryDefaults() {
  const cat = CATEGORIES.find((c) => c.id === $('form-category').value);
  if (cat && cat.days) $('form-shelflife').value = cat.days;
  updateExpiryPreview();
}

function updateExpiryPreview() {
  const box = $('expiry-preview');
  const expiry = computeExpiry(
    $('form-opened').value,
    $('form-shelflife').value,
    $('form-printed-expiry').value
  );
  if (!expiry) {
    box.classList.add('hidden');
    return;
  }
  const d = daysUntil(expiry);
  box.innerHTML = `📅 Hesaplanan son kullanma tarihi: <strong>${formatDate(expiry)}</strong> (${d >= 0 ? d + ' gün' : 'süresi geçmiş'})`;
  box.classList.remove('hidden');
}

/** Fotoğrafı küçültüp Blob olarak döndürür (hafızada yer kaplamasın diye) */
function resizePhoto(file, maxSize = 900) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('resize failed'))), 'image/jpeg', 0.82);
    };
    img.onerror = reject;
    img.src = url;
  });
}

async function onSubmitForm(e) {
  e.preventDefault();
  const openedAt = $('form-opened').value;
  const shelfLifeDays = $('form-shelflife').value ? Number($('form-shelflife').value) : null;
  const printedExpiry = $('form-printed-expiry').value || null;

  const product = {
    name: $('form-name').value.trim(),
    barcode: $('form-barcode').value.trim() || null,
    category: $('form-category').value,
    openedAt,
    shelfLifeDays,
    printedExpiry,
    expiresAt: computeExpiry(openedAt, shelfLifeDays, printedExpiry),
    photo: state.currentPhotoBlob,
    notes: $('form-notes').value.trim() || null,
    createdAt: new Date().toISOString(),
  };

  await ProductDB.add(product);
  toast('✅ Ürün kaydedildi');
  state.viewStack = ['view-list'];
  showView('view-list', { push: false });
  renderList();
}

/* ---------- Detay ---------- */

async function showDetail(id) {
  const p = await ProductDB.get(id);
  if (!p) return;
  state.currentDetailId = id;

  const b = expiryBadge(p.expiresAt);
  const cat = CATEGORIES.find((c) => c.id === p.category);
  const rows = [
    ['Barkod', p.barcode || '—'],
    ['Kategori', cat ? cat.label : '—'],
    ['Açılış tarihi', formatDate(p.openedAt)],
    ['Tüketme süresi', p.shelfLifeDays ? `${p.shelfLifeDays} gün` : '—'],
    ['Etiketteki SKT', formatDate(p.printedExpiry)],
    ['Son kullanma', formatDate(p.expiresAt)],
    ['Not', p.notes || '—'],
  ];

  const el = $('detail-content');
  el.innerHTML = '';

  if (p.photo) {
    const img = document.createElement('img');
    img.className = 'detail-photo';
    img.src = URL.createObjectURL(p.photo);
    el.appendChild(img);
  }

  const h = document.createElement('h2');
  h.textContent = p.name;
  el.appendChild(h);

  const banner = document.createElement('div');
  banner.className = `detail-banner ${b.cls}`;
  banner.textContent = b.text;
  el.appendChild(banner);

  const table = document.createElement('div');
  table.className = 'detail-rows';
  for (const [k, v] of rows) {
    const row = document.createElement('div');
    row.className = 'detail-row';
    const kEl = document.createElement('span');
    kEl.className = 'k';
    kEl.textContent = k;
    const vEl = document.createElement('span');
    vEl.className = 'v';
    vEl.textContent = v;
    row.append(kEl, vEl);
    table.appendChild(row);
  }
  el.appendChild(table);

  showView('view-detail');
}

/* ---------- Olaylar ---------- */

$('btn-add').addEventListener('click', () => showView('view-add-method'));
$('btn-method-scan').addEventListener('click', startScanner);
$('btn-method-photo').addEventListener('click', () => openForm());

$('btn-manual-barcode').addEventListener('click', () => {
  const code = $('manual-barcode').value.trim();
  if (!code) return toast('Önce barkod numarasını yazın');
  $('manual-barcode').value = '';
  onBarcodeScanned(code);
});

$('form-category').addEventListener('change', applyCategoryDefaults);
['form-opened', 'form-shelflife', 'form-printed-expiry'].forEach((id) =>
  $(id).addEventListener('input', updateExpiryPreview)
);

$('form-photo').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    state.currentPhotoBlob = await resizePhoto(file);
    const preview = $('form-photo-preview');
    preview.src = URL.createObjectURL(state.currentPhotoBlob);
    preview.classList.remove('hidden');
  } catch {
    toast('Fotoğraf işlenemedi');
  }
});

$('product-form').addEventListener('submit', onSubmitForm);

$('btn-delete').addEventListener('click', async () => {
  if (!state.currentDetailId) return;
  if (!confirm('Bu ürün kaydı silinsin mi?')) return;
  await ProductDB.remove(state.currentDetailId);
  state.currentDetailId = null;
  toast('Kayıt silindi');
  state.viewStack = ['view-list'];
  showView('view-list', { push: false });
  renderList();
});

/* ---------- Başlangıç ---------- */

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

renderList();
