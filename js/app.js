// פורטל ספקים — לוגיקת צד לקוח בלבד (דמו, ללא בקאנד)

const state = {
  screen: 'phone',        // phone | otp | panel
  phone: '',
  activeTab: 'pending',   // pending | approved | cancelled
  sel: {},                // בחירה מרובה בלשונית ממתינות: { orderId: true }
  detailId: null,
  dateMode: 'all',        // all | day | range
  day: '', from: '', to: '',
  orders: DEMO_ORDERS.map(o => ({ ...o })),
};

const $ = id => document.getElementById(id);
let toastTimer = null;

/* ---------- עזרים ---------- */

function fmtMoney(n) { return '₪' + n.toLocaleString('en-US'); }

function nowStamp() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function dateMatch(o) {
  if (state.dateMode === 'day' && state.day) return o.iso === state.day;
  if (state.dateMode === 'range') {
    if (state.from && o.iso < state.from) return false;
    if (state.to && o.iso > state.to) return false;
  }
  return true;
}

function byTab(tab) {
  return state.orders.filter(o => o.status === tab && dateMatch(o));
}

function statusTag(o) {
  const severe = o.status === 'pending' && o.hours > 24;
  const needsConfirm = o.status === 'cancelled' && o.needsConfirm;
  let cls, label;
  if (o.status === 'pending') {
    if (severe) { cls = 'tag-overdue'; label = 'מעל 24 שעות'; }
    else { cls = 'tag-pending'; label = 'ממתין לטיפול'; }
  } else if (o.status === 'approved') {
    cls = 'tag-approved'; label = 'טופל';
  } else if (needsConfirm) {
    cls = 'tag-cancel-confirm'; label = 'בוטל · דרוש אישור';
  } else {
    cls = 'tag-cancelled'; label = 'בוטל';
  }
  return { cls, label, severe, needsConfirm };
}

function tagHtml(o) {
  const t = statusTag(o);
  return `<span class="tag ${t.cls}">${t.label}</span>`;
}

function rowClass(o) {
  const t = statusTag(o);
  if (t.needsConfirm) return 'row-needs-confirm';
  if (t.severe) return 'row-severe';
  return '';
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function showToast(msg) {
  $('toast-text').textContent = msg;
  $('toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $('toast').hidden = true; }, 2600);
}

/* ---------- פעולות ---------- */

function approveOne(id) {
  const o = state.orders.find(x => x.id === id);
  if (o && o.status === 'pending') {
    o.status = 'approved';
    o.approvedAt = nowStamp();
  }
  delete state.sel[id];
  render();
  showToast('ההזמנה אושרה לטיפול');
}

function approveSelected() {
  const stamp = nowStamp();
  let count = 0;
  state.orders.forEach(o => {
    if (state.sel[o.id] && o.status === 'pending') {
      o.status = 'approved';
      o.approvedAt = stamp;
      count++;
    }
  });
  state.sel = {};
  $('modal-confirm').hidden = true;
  render();
  showToast(count === 1 ? 'הזמנה אחת אושרה לטיפול' : `${count} הזמנות אושרו לטיפול`);
}

function confirmCancel(id) {
  const o = state.orders.find(x => x.id === id);
  if (o) o.needsConfirm = false;
  render();
  showToast('אישור קבלת הביטול נקלט');
}

function toggleSel(id) {
  if (state.sel[id]) delete state.sel[id];
  else state.sel[id] = true;
  render();
}

function toggleAll() {
  const vis = byTab('pending');
  const all = vis.length > 0 && vis.every(o => state.sel[o.id]);
  vis.forEach(o => { if (all) delete state.sel[o.id]; else state.sel[o.id] = true; });
  render();
}

function exportExcel() {
  const rows = byTab(state.activeTab);
  const head = ['מס\' הזמנה', 'תאריך הזמנה', 'שם לקוח', 'אימייל', 'טלפון', 'מוצר', 'מק"ט', 'כמות', 'עיר', 'רחוב', 'תיאור משלוח', 'הערות', 'עלות כולל מע"מ', 'סטטוס'];
  const label = { pending: 'ממתין', approved: 'טופל', cancelled: 'בוטל' };
  const csvCell = v => `"${String(v).replace(/"/g, '""')}"`;
  const lines = [head.map(csvCell).join(',')];
  rows.forEach(o => {
    lines.push([o.no, o.date, o.cust, o.email, o.phone, o.prod, o.sku, o.qty, o.city, o.street, o.shipDesc, o.notes, o.amt, label[o.status]].map(csvCell).join(','));
  });
  // BOM כדי שאקסל יזהה עברית ב-UTF-8
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `supplier-orders-${state.activeTab}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
  showToast('מייצא לאקסל לפי הסינון הנוכחי…');
}

/* ---------- רינדור ---------- */

function render() {
  renderScreens();
  if (state.screen !== 'panel') return;
  renderCounts();
  renderTabs();
  renderFilters();
  renderBulkBar();
  renderTable();
  renderCards();
  renderModals();
}

function renderScreens() {
  $('screen-phone').hidden = state.screen !== 'phone';
  $('screen-otp').hidden = state.screen !== 'otp';
  $('screen-panel').hidden = state.screen !== 'panel';
}

function renderCounts() {
  $('badge-pending').textContent = byTab('pending').length;
  $('badge-approved').textContent = byTab('approved').length;
  $('badge-cancelled').textContent = byTab('cancelled').length;
}

function renderTabs() {
  document.querySelectorAll('.tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === state.activeTab);
  });
}

function renderFilters() {
  document.querySelectorAll('.seg-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.mode === state.dateMode);
  });
  $('filter-day').hidden = state.dateMode !== 'day';
  $('filter-range').hidden = state.dateMode !== 'range';
}

function renderBulkBar() {
  const selected = byTab('pending').filter(o => state.sel[o.id]);
  const show = state.activeTab === 'pending' && selected.length > 0;
  $('bulk-bar').hidden = !show;
  if (show) {
    $('selected-count').textContent = selected.length;
    $('confirm-count').textContent = selected.length;
  }
  const hasCancelPending = byTab('cancelled').some(o => o.needsConfirm);
  $('cancel-alert').hidden = !(state.activeTab === 'cancelled' && hasCancelPending);
}

const TH = c => `<th class="${c || ''}">`;

function renderTable() {
  const tab = state.activeTab;
  const rows = byTab(tab);
  const head = $('table-head');
  const body = $('table-body');
  const empty = $('empty-state');

  const emptyMsg = {
    pending: 'אין הזמנות ממתינות בטווח שנבחר.',
    approved: 'אין הזמנות מאושרות בטווח שנבחר.',
    cancelled: 'אין הזמנות מבוטלות בטווח שנבחר.',
  };
  empty.hidden = rows.length > 0;
  empty.textContent = emptyMsg[tab];

  if (tab === 'pending') {
    const vis = byTab('pending');
    const allChecked = vis.length > 0 && vis.every(o => state.sel[o.id]);
    head.innerHTML = `<tr>
      <th class="col-check"><input type="checkbox" class="check" id="check-all" ${allChecked ? 'checked' : ''}></th>
      <th>מס' הזמנה</th><th>תאריך הזמנה</th><th>שם לקוח</th><th>מוצר</th><th>עיר</th>
      <th class="col-center">כמות</th><th>עלות כולל מע"מ</th><th>חיווי</th><th class="col-action">פעולה</th>
    </tr>`;
    body.innerHTML = rows.map(o => `
      <tr class="${rowClass(o)}" data-id="${o.id}">
        <td class="col-check" data-stop><input type="checkbox" class="check row-check" data-id="${o.id}" ${state.sel[o.id] ? 'checked' : ''}></td>
        <td class="col-no">#${o.no}</td>
        <td class="col-date">${o.date}</td>
        <td class="col-cust">${esc(o.cust)}</td>
        <td class="col-prod">${esc(o.prod)}</td>
        <td class="col-city">${esc(o.city)}</td>
        <td class="col-qty">${o.qty}</td>
        <td class="col-amt">${fmtMoney(o.amt)}</td>
        <td class="col-tag">${tagHtml(o)}</td>
        <td class="col-action" data-stop>
          <button class="row-approve-btn" data-approve="${o.id}">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            אשר טיפול
          </button>
        </td>
      </tr>`).join('');
    const checkAll = $('check-all');
    if (checkAll) checkAll.addEventListener('change', toggleAll);
  } else if (tab === 'approved') {
    head.innerHTML = `<tr>
      <th class="col-first">מס' הזמנה</th><th>תאריך הזמנה</th><th>אושר בתאריך</th><th>שם לקוח</th><th>מוצר</th><th>עיר</th>
      <th class="col-center">כמות</th><th>עלות כולל מע"מ</th><th>סטטוס</th>
    </tr>`;
    body.innerHTML = rows.map(o => `
      <tr data-id="${o.id}">
        <td class="col-no col-first">#${o.no}</td>
        <td class="col-date">${o.date}</td>
        <td class="col-approved-at">${o.approvedAt}</td>
        <td class="col-cust">${esc(o.cust)}</td>
        <td class="col-prod">${esc(o.prod)}</td>
        <td class="col-city">${esc(o.city)}</td>
        <td class="col-qty">${o.qty}</td>
        <td class="col-amt">${fmtMoney(o.amt)}</td>
        <td class="col-tag"><span class="tag tag-approved">טופל</span></td>
      </tr>`).join('');
  } else {
    head.innerHTML = `<tr>
      <th class="col-first">מס' הזמנה</th><th>תאריך הזמנה</th><th>שם לקוח</th><th>מוצר</th><th>עיר</th>
      <th class="col-center">כמות</th><th>עלות כולל מע"מ</th><th>חיווי</th><th class="col-action">פעולה</th>
    </tr>`;
    body.innerHTML = rows.map(o => `
      <tr class="${rowClass(o)}" data-id="${o.id}">
        <td class="col-no col-first">#${o.no}</td>
        <td class="col-date">${o.date}</td>
        <td class="col-cust">${esc(o.cust)}</td>
        <td class="col-prod">${esc(o.prod)}</td>
        <td class="col-city">${esc(o.city)}</td>
        <td class="col-qty">${o.qty}</td>
        <td class="col-amt">${fmtMoney(o.amt)}</td>
        <td class="col-tag">${tagHtml(o)}</td>
        <td class="col-action" data-stop>
          ${o.needsConfirm
            ? `<button class="row-cancel-btn" data-cancel="${o.id}">אישור קבלת ביטול</button>`
            : '<span class="dash-muted">—</span>'}
        </td>
      </tr>`).join('');
  }
}

function renderCards() {
  const tab = state.activeTab;
  const rows = byTab(tab);
  $('cards-list').innerHTML = rows.map(o => {
    const meta = [
      `<span><b>${o.date.split(' ')[0]}</b></span>`,
      `<span>${esc(o.city)}</span>`,
      `<span>כמות <b>${o.qty}</b></span>`,
      `<span><b>${fmtMoney(o.amt)}</b></span>`,
    ];
    if (tab === 'approved') meta.splice(1, 0, `<span>אושר <b>${o.approvedAt.split(' ')[0]}</b></span>`);

    let actions = '';
    if (tab === 'pending') {
      actions = `<div class="order-card-actions" data-stop>
        <button class="row-approve-btn" data-approve="${o.id}">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          אשר טיפול
        </button>
      </div>`;
    } else if (tab === 'cancelled' && o.needsConfirm) {
      actions = `<div class="order-card-actions" data-stop>
        <button class="row-cancel-btn" data-cancel="${o.id}">אישור קבלת ביטול</button>
      </div>`;
    }

    const check = tab === 'pending'
      ? `<input type="checkbox" class="check row-check" data-id="${o.id}" data-stop ${state.sel[o.id] ? 'checked' : ''}>`
      : '';

    return `<div class="order-card ${rowClass(o)}" data-id="${o.id}">
      <div class="order-card-top">
        <div class="order-card-no">${check}#${o.no}</div>
        ${tagHtml(o)}
      </div>
      <div class="order-card-cust">${esc(o.cust)}</div>
      <div class="order-card-prod">${esc(o.prod)}</div>
      <div class="order-card-meta">${meta.join('')}</div>
      ${actions}
    </div>`;
  }).join('');
}

function renderModals() {
  // מודאל אישור טיפול
  const selected = byTab('pending').filter(o => state.sel[o.id]);
  $('confirm-total').textContent = selected.length;
  $('confirm-list').innerHTML = selected.map(o => `
    <div class="confirm-row">
      <div class="confirm-row-main">
        <div class="confirm-row-title">#${o.no} · ${esc(o.cust)}</div>
        <div class="confirm-row-prod">${esc(o.prod)}</div>
      </div>
      <div class="confirm-row-amt">${fmtMoney(o.amt)}</div>
    </div>`).join('');

  // מודאל פרטי הזמנה
  const o = state.detailId ? state.orders.find(x => x.id === state.detailId) : null;
  $('modal-detail').hidden = !o;
  if (!o) return;
  const t = statusTag(o);
  $('detail-no').textContent = o.no;
  $('detail-tag').innerHTML = tagHtml(o);
  $('detail-sub').textContent = `${o.cust} · ${o.date}`;
  const fields = [
    ['ספק', SUPPLIER.name], ["מס' הזמנה", '#' + o.no], ['תאריך הזמנה', o.date],
    ['שם לקוח', o.cust], ['אימייל לקוח', o.email], ['טלפון לקוח', o.phone],
    ['מוצר', o.prod], ['מק"ט/ברקוד', o.sku], ['מאפייני וריאציה', o.variation],
    ['מק"ט וריאציה', o.varSku], ['כמות', String(o.qty)], ['עיר', o.city],
    ['רחוב', o.street], ['מספר בית', o.house], ['מספר דירה', o.apt],
    ['תיאור משלוח', o.shipDesc], ['הערות משלוח', o.notes],
    ['עלות משלוח פנימית', fmtMoney(o.internalShip)], ['עלות כולל מע"מ', fmtMoney(o.amt)],
    ['זמן אספקה', o.deliveryTime],
  ];
  $('detail-grid').innerHTML = fields.map(([label, value]) => `
    <div class="detail-cell">
      <div class="detail-cell-label">${esc(label)}</div>
      <div class="detail-cell-value">${esc(value)}</div>
    </div>`).join('');
  $('approve-detail-btn').hidden = o.status !== 'pending';
  $('cancel-detail-btn').hidden = !t.needsConfirm;
}

/* ---------- אירועים ---------- */

function bindEvents() {
  // התחברות
  $('send-code-btn').addEventListener('click', () => {
    state.phone = $('phone-input').value || '050-0000000';
    $('phone-masked').textContent = state.phone.replace(/\d(?=\d{4})/g, '•');
    state.screen = 'otp';
    render();
  });
  $('verify-btn').addEventListener('click', () => { state.screen = 'panel'; render(); });
  $('back-to-phone').addEventListener('click', () => { state.screen = 'phone'; $('otp-input').value = ''; render(); });
  $('resend-code').addEventListener('click', () => {});
  $('otp-input').addEventListener('input', e => {
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6);
  });
  $('logout-btn').addEventListener('click', () => {
    Object.assign(state, { screen: 'phone', phone: '', sel: {}, detailId: null });
    $('phone-input').value = '';
    $('otp-input').value = '';
    $('modal-confirm').hidden = true;
    render();
  });

  // לשוניות
  document.querySelectorAll('.tab').forEach(t => {
    t.addEventListener('click', () => { state.activeTab = t.dataset.tab; render(); });
  });

  // סינון תאריכים
  document.querySelectorAll('.seg-btn').forEach(b => {
    b.addEventListener('click', () => { state.dateMode = b.dataset.mode; render(); });
  });
  $('filter-day').addEventListener('input', e => { state.day = e.target.value; render(); });
  $('filter-from').addEventListener('input', e => { state.from = e.target.value; render(); });
  $('filter-to').addEventListener('input', e => { state.to = e.target.value; render(); });

  // ייצוא
  $('export-btn').addEventListener('click', exportExcel);

  // בחירה מרובה
  $('clear-sel-btn').addEventListener('click', () => { state.sel = {}; render(); });
  $('open-confirm-btn').addEventListener('click', () => {
    if (byTab('pending').some(o => state.sel[o.id])) $('modal-confirm').hidden = false;
  });
  $('close-confirm-btn').addEventListener('click', () => { $('modal-confirm').hidden = true; });
  $('do-approve-btn').addEventListener('click', approveSelected);

  // מודאל פרטים
  $('close-detail-btn').addEventListener('click', () => { state.detailId = null; render(); });
  $('close-detail-btn2').addEventListener('click', () => { state.detailId = null; render(); });
  $('modal-detail').addEventListener('click', e => {
    if (e.target === $('modal-detail')) { state.detailId = null; render(); }
  });
  $('approve-detail-btn').addEventListener('click', () => {
    const id = state.detailId;
    state.detailId = null;
    if (id) approveOne(id);
  });
  $('cancel-detail-btn').addEventListener('click', () => {
    const id = state.detailId;
    state.detailId = null;
    if (id) confirmCancel(id);
  });

  // האצלת אירועים לשורות טבלה ולכרטיסים
  document.querySelector('.panel-body').addEventListener('click', e => {
    const approveBtn = e.target.closest('[data-approve]');
    if (approveBtn) { approveOne(approveBtn.dataset.approve); return; }
    const cancelBtn = e.target.closest('[data-cancel]');
    if (cancelBtn) { confirmCancel(cancelBtn.dataset.cancel); return; }
    const check = e.target.closest('.row-check');
    if (check) { toggleSel(check.dataset.id); return; }
    if (e.target.closest('[data-stop]')) return;
    const row = e.target.closest('[data-id]');
    if (row) { state.detailId = row.dataset.id; render(); }
  });
}

$('supplier-name').textContent = SUPPLIER.name;
$('supplier-avatar').textContent = SUPPLIER.name.charAt(0);
bindEvents();
render();
