// פורטל ספקים — לוגיקת צד לקוח בלבד (דמו, ללא בקאנד)

const state = {
  screen: 'phone',        // phone | otp | panel
  phone: '',
  activeTab: 'pending',   // pending | approved | cancelled
  sel: {},                // בחירה מרובה: { orderId: true }
  confirmMode: 'approve', // approve | cancelAck — מצב המודאל המרוכז
  rejectId: null,         // ההזמנה שממתינה לסיבת "לא ניתן לבטל"
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

// השורות הניתנות לבחירה מרובה בלשונית הנוכחית (לפי הסינון הפעיל)
function selectableRows() {
  if (state.activeTab === 'pending') return byTab('pending');
  if (state.activeTab === 'cancelled') return byTab('cancelled').filter(o => o.needsConfirm);
  return [];
}

function selectedRows() {
  return selectableRows().filter(o => state.sel[o.id]);
}

function statusTag(o) {
  const severe = o.status === 'pending' && o.hours > 24;
  const needsConfirm = o.status === 'cancelled' && o.needsConfirm;
  let cls, label;
  if (o.status === 'pending') {
    if (severe) { cls = 'tag-overdue'; label = t('tagOverdue'); }
    else { cls = 'tag-pending'; label = t('tagPending'); }
  } else if (o.status === 'approved') {
    cls = 'tag-approved'; label = t('tagApproved');
  } else if (needsConfirm) {
    cls = 'tag-cancel-confirm'; label = t('tagCancelNeedsConfirm');
  } else if (o.cancelResolution === 'rejected') {
    cls = 'tag-cannot-cancel'; label = t('tagCannotCancel');
  } else {
    cls = 'tag-cancelled'; label = t('tagCancelled');
  }
  return { cls, label, severe, needsConfirm };
}

function tagHtml(o) {
  const t2 = statusTag(o);
  return `<span class="tag ${t2.cls}">${t2.label}</span>`;
}

function rowClass(o) {
  const t2 = statusTag(o);
  if (t2.needsConfirm) return 'row-needs-confirm';
  if (t2.severe) return 'row-severe';
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
  showToast(t('toastApproveSingle'));
}

// אישור קבלת ביטול — ההזמנה נשארת "בוטלה"
function confirmCancel(id) {
  const o = state.orders.find(x => x.id === id);
  if (o) { o.needsConfirm = false; o.cancelResolution = 'confirmed'; }
  delete state.sel[id];
  render();
  showToast(t('toastCancelAck'));
}

// "לא ניתן לבטל" — נפתח מודאל עם שדה סיבה חובה
function openRejectModal(id) {
  state.rejectId = id;
  const o = state.orders.find(x => x.id === id);
  $('reject-order-ref').textContent = o ? `#${o.no} · ${o.cust}` : '';
  const input = $('reject-reason');
  input.value = '';
  input.classList.remove('field-invalid');
  $('reject-error').hidden = true;
  $('modal-reject').hidden = false;
  input.focus();
}

function closeRejectModal() {
  state.rejectId = null;
  $('modal-reject').hidden = true;
}

// אותה פעולה כמו אישור קבלת ביטול בצד הספק, אך עם סטטוס סופי שונה וסיבה מתועדת
function doReject() {
  const reason = $('reject-reason').value.trim();
  if (!reason) {
    $('reject-reason').classList.add('field-invalid');
    $('reject-error').hidden = false;
    $('reject-reason').focus();
    return;
  }
  const o = state.orders.find(x => x.id === state.rejectId);
  if (o) { o.needsConfirm = false; o.cancelResolution = 'rejected'; o.rejectReason = reason; }
  delete state.sel[state.rejectId];
  closeRejectModal();
  render();
  showToast(t('toastCannotCancel'));
}

// ביצוע הפעולה המרוכזת מתוך המודאל, לפי המצב הפעיל
function doBulkConfirm() {
  const rows = selectedRows();
  if (state.confirmMode === 'approve') {
    const stamp = nowStamp();
    rows.forEach(o => { o.status = 'approved'; o.approvedAt = stamp; });
    showToast(rows.length === 1 ? t('toastApprovedOne') : t('toastApprovedMany', { n: rows.length }));
  } else {
    rows.forEach(o => { o.needsConfirm = false; o.cancelResolution = 'confirmed'; });
    showToast(rows.length === 1 ? t('toastCancelAck') : t('toastCancelAckMany', { n: rows.length }));
  }
  state.sel = {};
  $('modal-confirm').hidden = true;
  render();
}

function toggleSel(id) {
  if (state.sel[id]) delete state.sel[id];
  else state.sel[id] = true;
  render();
}

function toggleAll() {
  const vis = selectableRows();
  const all = vis.length > 0 && vis.every(o => state.sel[o.id]);
  vis.forEach(o => { if (all) delete state.sel[o.id]; else state.sel[o.id] = true; });
  render();
}

function openConfirmModal() {
  if (selectedRows().length === 0) return;
  state.confirmMode = state.activeTab === 'pending' ? 'approve' : 'cancelAck';
  $('modal-confirm').hidden = false;
  render();
}

function exportExcel() {
  const rows = byTab(state.activeTab);
  const head = ['thOrderNo', 'thOrderDate', 'thCustomer', 'fCustEmail', 'fCustPhone', 'thProduct', 'fSku', 'thQty', 'thCity', 'fStreet', 'fShipDesc', 'fShipNotes', 'fTotal', 'thStatus'].map(k => t(k));
  const statusLabel = o => {
    if (o.status === 'pending') return t('csvStatusPending');
    if (o.status === 'approved') return t('csvStatusApproved');
    return o.cancelResolution === 'rejected' ? t('csvStatusCannotCancel') : t('csvStatusCancelled');
  };
  const csvCell = v => `"${String(v).replace(/"/g, '""')}"`;
  const lines = [head.map(csvCell).join(',')];
  rows.forEach(o => {
    lines.push([o.no, o.date, o.cust, o.email, o.phone, o.prod, o.sku, o.qty, o.city, o.street, o.shipDesc, o.notes, o.amt, statusLabel(o)].map(csvCell).join(','));
  });
  // BOM כדי שאקסל יזהה עברית ב-UTF-8
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `supplier-orders-${state.activeTab}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
  showToast(t('toastExport'));
}

/* ---------- רינדור ---------- */

function render() {
  renderScreens();
  if (state.screen !== 'panel') return;
  renderCounts();
  renderTabs();
  renderFilters();
  renderListTools();
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
  document.querySelectorAll('.tab').forEach(tb => {
    tb.classList.toggle('active', tb.dataset.tab === state.activeTab);
  });
}

function renderFilters() {
  document.querySelectorAll('.seg-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.mode === state.dateMode);
  });
  $('filter-day').hidden = state.dateMode !== 'day';
  $('filter-range').hidden = state.dateMode !== 'range';
}

// סרגל "בחר הכל" — מוצג בלשוניות עם פעולה מרוכזת, לפי הסינון הפעיל
function renderListTools() {
  const vis = selectableRows();
  $('list-tools').hidden = vis.length === 0;
  if (vis.length === 0) return;
  const all = vis.every(o => state.sel[o.id]);
  $('select-all-btn').textContent = all ? t('clearSelection') : t('selectAll');
}

function renderBulkBar() {
  const selected = selectedRows();
  $('bulk-bar').hidden = selected.length === 0;
  if (selected.length === 0) return;
  $('bulk-count').textContent = t('selectedCount', { n: selected.length });
  const btn = $('open-confirm-btn');
  const isApprove = state.activeTab === 'pending';
  btn.className = isApprove ? 'btn btn-primary btn-sm' : 'btn btn-danger btn-sm';
  btn.innerHTML = isApprove
    ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> ${t('approveHandling')} (${selected.length})`
    : `${t('ackCancel')} (${selected.length})`;
}

function renderTable() {
  const tab = state.activeTab;
  const rows = byTab(tab);
  const head = $('table-head');
  const body = $('table-body');
  const empty = $('empty-state');

  const emptyKey = { pending: 'emptyPending', approved: 'emptyApproved', cancelled: 'emptyCancelled' };
  empty.hidden = rows.length > 0;
  empty.textContent = t(emptyKey[tab]);

  // חיווי ההתראה בלשונית מבוטלות מנוהל גם ב-renderBulkBar; ברירת מחדל כאן
  const hasCancelPending = byTab('cancelled').some(o => o.needsConfirm);
  $('cancel-alert').hidden = !(tab === 'cancelled' && hasCancelPending && selectedRows().length === 0);

  const vis = selectableRows();
  const allChecked = vis.length > 0 && vis.every(o => state.sel[o.id]);

  if (tab === 'pending') {
    head.innerHTML = `<tr>
      <th class="col-check"><input type="checkbox" class="check" id="check-all" ${allChecked ? 'checked' : ''}></th>
      <th>${t('thOrderNo')}</th><th>${t('thOrderDate')}</th><th>${t('thCustomer')}</th><th>${t('thProduct')}</th><th>${t('thCity')}</th>
      <th class="col-center">${t('thQty')}</th><th>${t('thAmount')}</th><th>${t('thTag')}</th><th class="col-action">${t('thAction')}</th>
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
            ${t('rowApprove')}
          </button>
        </td>
      </tr>`).join('');
  } else if (tab === 'approved') {
    head.innerHTML = `<tr>
      <th class="col-first">${t('thOrderNo')}</th><th>${t('thOrderDate')}</th><th>${t('thApprovedAt')}</th><th>${t('thCustomer')}</th><th>${t('thProduct')}</th><th>${t('thCity')}</th>
      <th class="col-center">${t('thQty')}</th><th>${t('thAmount')}</th><th>${t('thStatus')}</th>
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
        <td class="col-tag"><span class="tag tag-approved">${t('tagApproved')}</span></td>
      </tr>`).join('');
  } else {
    head.innerHTML = `<tr>
      <th class="col-check"><input type="checkbox" class="check" id="check-all" ${allChecked ? 'checked' : ''} ${vis.length === 0 ? 'disabled' : ''}></th>
      <th>${t('thOrderNo')}</th><th>${t('thOrderDate')}</th><th>${t('thCustomer')}</th><th>${t('thProduct')}</th><th>${t('thCity')}</th>
      <th class="col-center">${t('thQty')}</th><th>${t('thAmount')}</th><th>${t('thTag')}</th><th class="col-action">${t('thAction')}</th>
    </tr>`;
    body.innerHTML = rows.map(o => `
      <tr class="${rowClass(o)}" data-id="${o.id}">
        <td class="col-check" data-stop>${o.needsConfirm ? `<input type="checkbox" class="check row-check" data-id="${o.id}" ${state.sel[o.id] ? 'checked' : ''}>` : ''}</td>
        <td class="col-no">#${o.no}</td>
        <td class="col-date">${o.date}</td>
        <td class="col-cust">${esc(o.cust)}</td>
        <td class="col-prod">${esc(o.prod)}</td>
        <td class="col-city">${esc(o.city)}</td>
        <td class="col-qty">${o.qty}</td>
        <td class="col-amt">${fmtMoney(o.amt)}</td>
        <td class="col-tag">${tagHtml(o)}</td>
        <td class="col-action" data-stop>
          ${o.needsConfirm
            ? `<button class="row-cancel-btn" data-cancel="${o.id}">${t('ackCancel')}</button>
               <button class="row-reject-btn" data-reject="${o.id}">${t('cannotCancel')}</button>`
            : '<span class="dash-muted">—</span>'}
        </td>
      </tr>`).join('');
  }

  const checkAll = $('check-all');
  if (checkAll) checkAll.addEventListener('change', toggleAll);
}

function renderCards() {
  const tab = state.activeTab;
  const rows = byTab(tab);
  $('cards-list').innerHTML = rows.map(o => {
    const meta = [
      `<span><b>${o.date.split(' ')[0]}</b></span>`,
      `<span>${esc(o.city)}</span>`,
      `<span>${t('metaQty')} <b>${o.qty}</b></span>`,
      `<span><b>${fmtMoney(o.amt)}</b></span>`,
    ];
    if (tab === 'approved') meta.splice(1, 0, `<span>${t('metaApproved')} <b>${o.approvedAt.split(' ')[0]}</b></span>`);

    let actions = '';
    if (tab === 'pending') {
      actions = `<div class="order-card-actions" data-stop>
        <button class="row-approve-btn" data-approve="${o.id}">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          ${t('rowApprove')}
        </button>
      </div>`;
    } else if (tab === 'cancelled' && o.needsConfirm) {
      actions = `<div class="order-card-actions" data-stop>
        <button class="row-cancel-btn" data-cancel="${o.id}">${t('ackCancel')}</button>
        <button class="row-reject-btn" data-reject="${o.id}">${t('cannotCancel')}</button>
      </div>`;
    }

    const selectable = tab === 'pending' || (tab === 'cancelled' && o.needsConfirm);
    const check = selectable
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
  // מודאל אישור מרוכז
  const selected = selectedRows();
  const isApprove = state.confirmMode === 'approve';
  $('confirm-title').textContent = t(isApprove ? 'confirmApproveTitle' : 'confirmCancelTitle');
  $('confirm-desc').textContent = t(isApprove ? 'confirmApproveDesc' : 'confirmCancelDesc');
  const doBtn = $('do-confirm-btn');
  doBtn.className = isApprove ? 'btn btn-primary' : 'btn btn-danger';
  doBtn.innerHTML = isApprove
    ? `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> ${t('approveHandling')}`
    : t('ackCancel');
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
  const tg = statusTag(o);
  $('detail-no').textContent = o.no;
  $('detail-tag').innerHTML = tagHtml(o);
  $('detail-sub').textContent = `${o.cust} · ${o.date}`;
  const fields = [
    ['fSupplier', supplierDisplayName()], ['fOrderNo', '#' + o.no], ['fOrderDate', o.date],
    ['fCustName', o.cust], ['fCustEmail', o.email], ['fCustPhone', o.phone],
    ['fProduct', o.prod], ['fSku', o.sku], ['fVariation', o.variation],
    ['fVarSku', o.varSku], ['fQty', String(o.qty)], ['fCity', o.city],
    ['fStreet', o.street], ['fHouse', o.house], ['fApt', o.apt],
    ['fShipDesc', o.shipDesc], ['fShipNotes', o.notes],
    ['fInternalShip', fmtMoney(o.internalShip)], ['fTotal', fmtMoney(o.amt)],
    ['fDelivery', o.deliveryTime],
  ];
  if (o.rejectReason) fields.push(['fRejectReason', o.rejectReason]);
  $('detail-grid').innerHTML = fields.map(([key, value]) => `
    <div class="detail-cell">
      <div class="detail-cell-label">${esc(t(key))}</div>
      <div class="detail-cell-value">${esc(value)}</div>
    </div>`).join('');
  $('approve-detail-btn').hidden = o.status !== 'pending';
  $('cancel-detail-btn').hidden = !tg.needsConfirm;
  $('reject-detail-btn').hidden = !tg.needsConfirm;
}

function supplierDisplayName() {
  return LANG === 'en' && SUPPLIER.nameEn ? SUPPLIER.nameEn : SUPPLIER.name;
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
    Object.assign(state, { screen: 'phone', phone: '', sel: {}, detailId: null, rejectId: null });
    $('phone-input').value = '';
    $('otp-input').value = '';
    $('modal-confirm').hidden = true;
    $('modal-reject').hidden = true;
    render();
  });

  // לשוניות — הבחירה מתאפסת במעבר לשונית
  document.querySelectorAll('.tab').forEach(tb => {
    tb.addEventListener('click', () => { state.activeTab = tb.dataset.tab; state.sel = {}; render(); });
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
  $('select-all-btn').addEventListener('click', toggleAll);
  $('clear-sel-btn').addEventListener('click', () => { state.sel = {}; render(); });
  $('open-confirm-btn').addEventListener('click', openConfirmModal);
  $('close-confirm-btn').addEventListener('click', () => { $('modal-confirm').hidden = true; });
  $('do-confirm-btn').addEventListener('click', doBulkConfirm);

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
  $('reject-detail-btn').addEventListener('click', () => {
    const id = state.detailId;
    state.detailId = null;
    render();
    if (id) openRejectModal(id);
  });

  // מודאל סיבת "לא ניתן לבטל"
  $('close-reject-btn').addEventListener('click', closeRejectModal);
  $('do-reject-btn').addEventListener('click', doReject);
  $('reject-reason').addEventListener('input', () => {
    $('reject-reason').classList.remove('field-invalid');
    $('reject-error').hidden = true;
  });

  // האצלת אירועים לשורות טבלה ולכרטיסים
  document.querySelector('.panel-body').addEventListener('click', e => {
    const approveBtn = e.target.closest('[data-approve]');
    if (approveBtn) { approveOne(approveBtn.dataset.approve); return; }
    const cancelBtn = e.target.closest('[data-cancel]');
    if (cancelBtn) { confirmCancel(cancelBtn.dataset.cancel); return; }
    const rejectBtn = e.target.closest('[data-reject]');
    if (rejectBtn) { openRejectModal(rejectBtn.dataset.reject); return; }
    const check = e.target.closest('.row-check');
    if (check) { toggleSel(check.dataset.id); return; }
    if (e.target.closest('[data-stop]')) return;
    const row = e.target.closest('[data-id]');
    if (row) { state.detailId = row.dataset.id; render(); }
  });
}

applyStaticI18n();
$('supplier-name').textContent = supplierDisplayName();
$('supplier-avatar').textContent = supplierDisplayName().charAt(0);
bindEvents();
render();
