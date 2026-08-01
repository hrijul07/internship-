/* ============================================================
   SubTrack — script.js
   Saara logic yahan hai: localStorage, UI updates, events sab
   Comments Hinglish mein hain (as requested!)
============================================================ */

'use strict';

/* ============================================================
   1. STATE — App ka sara data yahan store hoga (in-memory)
      localStorage se load bhi yahan hoga
============================================================ */

// Default app state — pehli baar open karo tab yahi load hoga
let appState = {
  budget: 0,                // Monthly budget (₹)
  subscriptions: [],        // Array of subscription objects
  expenses: [],             // Array of expense objects
};

// Subscription ka ek "template" object kaisa dikhta hai:
// { id, name, cost, cycle: 'monthly'|'yearly', date }

// Expense ka "template":
// { id, desc, amount, category, date }

// Edit mode ke liye — kis subscription ko edit kar rahe hain
let editingSubId = null;

// Current expense filter
let currentExpFilter = 'All';

/* ============================================================
   2. LOCALSTORAGE — Data save / load karna
============================================================ */

// State ko localStorage mein save karo
function saveState() {
  localStorage.setItem('subtrack_state', JSON.stringify(appState));
}

// localStorage se state load karo (agar pehle se saved hai)
function loadState() {
  const saved = localStorage.getItem('subtrack_state');
  if (saved) {
    try {
      appState = JSON.parse(saved);
    } catch (e) {
      console.warn('SubTrack: State parse error, fresh start karenge.');
    }
  }
}

/* ============================================================
   3. UTILITY FUNCTIONS — Chhote chhote helpers
============================================================ */

// Unique ID generate karna (timestamp + random)
function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// ₹ format karna — Indian style
function fmt(n) {
  return '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

// Date ko readable format mein convert karna
function fmtDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

// Aaj ki date YYYY-MM-DD format mein
function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

// Toast notification dikhao — success ya error
function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast show ${type}`;
  setTimeout(() => { t.className = 'toast'; }, 2800);
}

/* ============================================================
   4. SUBSCRIPTION LOGIC
============================================================ */

// Monthly cost calculate karo (yearly wale ko 12 se divide)
function subMonthlyCost(sub) {
  if (sub.cycle === 'yearly') return sub.cost / 12;
  return sub.cost;
}

// Total monthly subscription cost
function totalSubCost() {
  return appState.subscriptions.reduce((sum, s) => sum + subMonthlyCost(s), 0);
}

// Subscription add karo ya update karo
function addOrUpdateSubscription() {
  const name = document.getElementById('sub-name').value.trim();
  const cost = parseFloat(document.getElementById('sub-cost').value);
  const cycle = document.getElementById('sub-cycle').value;
  const date  = document.getElementById('sub-date').value;

  // Validation — sab fields bharni chahiye
  if (!name) { showToast('Service ka naam bharo!', 'error'); return; }
  if (!cost || cost <= 0) { showToast('Valid cost bharo!', 'error'); return; }
  if (!date) { showToast('Billing date select karo!', 'error'); return; }

  if (editingSubId) {
    // Edit mode — existing subscription update karo
    const idx = appState.subscriptions.findIndex(s => s.id === editingSubId);
    if (idx !== -1) {
      appState.subscriptions[idx] = { id: editingSubId, name, cost, cycle, date };
    }
    showToast('Subscription update ho gayi! ✅');
    cancelSubEdit();
  } else {
    // Naya subscription add karo
    appState.subscriptions.push({ id: genId(), name, cost, cycle, date });
    showToast('Subscription add ho gayi! 🎉');
  }

  clearSubForm();
  saveState();
  renderSubscriptions();
  updateDashboard();
}

// Form clear karna
function clearSubForm() {
  document.getElementById('sub-name').value = '';
  document.getElementById('sub-cost').value = '';
  document.getElementById('sub-cycle').value = 'monthly';
  document.getElementById('sub-date').value = '';
}

// Subscription delete karna
function deleteSubscription(id) {
  if (!confirm('Is subscription ko delete karein?')) return;
  appState.subscriptions = appState.subscriptions.filter(s => s.id !== id);
  saveState();
  renderSubscriptions();
  updateDashboard();
  showToast('Subscription delete ho gayi!', 'error');
}

// Edit mode shuru karna — form mein data fill karo
function editSubscription(id) {
  const sub = appState.subscriptions.find(s => s.id === id);
  if (!sub) return;

  editingSubId = id;
  document.getElementById('sub-name').value  = sub.name;
  document.getElementById('sub-cost').value  = sub.cost;
  document.getElementById('sub-cycle').value = sub.cycle;
  document.getElementById('sub-date').value  = sub.date;

  document.getElementById('sub-form-title').textContent = 'Edit Subscription';
  document.getElementById('sub-submit-btn').textContent = 'Update Subscription';
  document.getElementById('sub-cancel-btn').style.display = 'inline-flex';

  // Form tak scroll karo smoothly
  document.querySelector('.form-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Edit cancel karna
function cancelSubEdit() {
  editingSubId = null;
  clearSubForm();
  document.getElementById('sub-form-title').textContent = 'Add Subscription';
  document.getElementById('sub-submit-btn').textContent = 'Add Subscription';
  document.getElementById('sub-cancel-btn').style.display = 'none';
}

// Subscriptions list render karna
function renderSubscriptions() {
  const container = document.getElementById('sub-list');
  const subs = appState.subscriptions;

  // Total dikhao
  document.getElementById('sub-total-display').textContent =
    `${fmt(totalSubCost())} / month`;

  if (subs.length === 0) {
    container.innerHTML = '<p class="empty-state">No subscriptions added yet. Add your first one above!</p>';
    return;
  }

  container.innerHTML = subs.map(s => `
    <div class="sub-item">
      <div>
        <div class="sub-item-name">${escHtml(s.name)}</div>
        <div class="sub-item-date">Next: ${fmtDate(s.date)}</div>
      </div>
      <span class="sub-item-cycle cycle-${s.cycle}">${s.cycle}</span>
      <div class="sub-item-cost">${fmt(s.cost)}<span style="font-size:0.65rem;color:var(--text-muted);font-weight:400">
        ${s.cycle === 'yearly' ? '/yr' : '/mo'}
      </span></div>
      <div class="sub-item-actions">
        <button class="btn btn--edit" onclick="editSubscription('${s.id}')">Edit</button>
        <button class="btn btn--danger" onclick="deleteSubscription('${s.id}')">Delete</button>
      </div>
    </div>
  `).join('');
}

/* ============================================================
   5. EXPENSE LOGIC
============================================================ */

// Expense add karna
function addExpense() {
  const desc     = document.getElementById('exp-desc').value.trim();
  const amount   = parseFloat(document.getElementById('exp-amount').value);
  const category = document.getElementById('exp-category').value;
  const date     = document.getElementById('exp-date').value;

  if (!desc) { showToast('Description bharo!', 'error'); return; }
  if (!amount || amount <= 0) { showToast('Valid amount bharo!', 'error'); return; }
  if (!date) { showToast('Date select karo!', 'error'); return; }

  appState.expenses.push({ id: genId(), desc, amount, category, date });
  showToast('Expense add ho gayi! 💸');

  // Form clear karo
  document.getElementById('exp-desc').value = '';
  document.getElementById('exp-amount').value = '';
  document.getElementById('exp-date').value = todayStr();

  saveState();
  renderExpenses();
  updateDashboard();
}

// Expense delete karna
function deleteExpense(id) {
  appState.expenses = appState.expenses.filter(e => e.id !== id);
  saveState();
  renderExpenses();
  updateDashboard();
  showToast('Expense delete ho gayi!', 'error');
}

// Filter apply karna (category button click)
function filterExpenses(btn) {
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  currentExpFilter = btn.dataset.cat;
  renderExpenses();
}

// Category ke dot ka color class
const CAT_CLASS = {
  Food: 'cat-Food',
  Transport: 'cat-Transport',
  Bills: 'cat-Bills',
  Shopping: 'cat-Shopping',
  Others: 'cat-Others',
};

// Expenses render karna
function renderExpenses() {
  const container = document.getElementById('exp-list');
  let exps = [...appState.expenses].reverse(); // Newest first

  if (currentExpFilter !== 'All') {
    exps = exps.filter(e => e.category === currentExpFilter);
  }

  if (exps.length === 0) {
    container.innerHTML = '<p class="empty-state">Koi expense nahi mili. Upar se add karo!</p>';
    return;
  }

  container.innerHTML = exps.map(e => `
    <div class="exp-item">
      <span class="exp-cat-dot ${CAT_CLASS[e.category] || 'cat-Others'}"></span>
      <div class="exp-item-info">
        <div class="exp-item-desc">${escHtml(e.desc)}</div>
        <div class="exp-item-meta">${e.category} · ${fmtDate(e.date)}</div>
      </div>
      <div class="exp-item-amount">-${fmt(e.amount)}</div>
      <button class="btn btn--danger" onclick="deleteExpense('${e.id}')">✕</button>
    </div>
  `).join('');
}

/* ============================================================
   6. BUDGET LOGIC
============================================================ */

// Budget save karna
function setBudget() {
  const val = parseFloat(document.getElementById('budget-input').value);
  if (!val || val <= 0) {
    showToast('Valid budget amount bharo!', 'error');
    return;
  }
  appState.budget = val;
  saveState();
  updateBudgetSection();
  updateDashboard();
  showToast('Budget save ho gaya! 🎯');
}

// Budget section update karna
function updateBudgetSection() {
  const budget  = appState.budget;
  const spent   = totalSpent();
  const remaining = budget - spent;
  const pct     = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;

  document.getElementById('bud-budget').textContent    = fmt(budget);
  document.getElementById('bud-spent').textContent     = fmt(spent);
  document.getElementById('bud-remaining').textContent = fmt(Math.max(remaining, 0));

  // Ring update karna — SVG stroke-dashoffset
  // Circumference = 2 * π * r = 2 * 3.14159 * 80 ≈ 502.65
  const circumference = 502.65;
  const offset = circumference - (pct / 100) * circumference;
  const ring = document.getElementById('ring-fill');
  if (ring) ring.style.strokeDashoffset = offset;

  // Ring color change karo agar overspent
  if (pct >= 90) {
    ring.style.stroke = '#ff5f6d'; // danger red
  } else if (pct >= 70) {
    ring.style.stroke = '#ffb347'; // warning orange
  } else {
    ring.style.stroke = 'url(#ringGrad)';
  }

  document.getElementById('ring-percent').textContent = Math.round(pct) + '%';

  // Input mein current budget fill karo
  if (budget > 0) {
    document.getElementById('budget-input').value = budget;
  }

  // Tip box update karna
  const tipEl = document.getElementById('budget-tip');
  if (budget === 0) {
    tipEl.textContent = '💡 Upar budget set karo tracking shuru karne ke liye.';
    tipEl.style.borderColor = 'rgba(255,179,71,0.2)';
    tipEl.style.color = 'var(--warn)';
  } else if (pct >= 100) {
    tipEl.textContent = `🚨 Budget exceed ho gaya! Aapne ₹${fmt(Math.abs(remaining))} zyada kharcha kiya.`;
    tipEl.style.borderColor = 'rgba(255,95,109,0.3)';
    tipEl.style.color = 'var(--danger)';
  } else if (pct >= 80) {
    tipEl.textContent = `⚠️ Budget ka ${Math.round(pct)}% use ho chuka hai. Thoda sambhal ke kharcho!`;
    tipEl.style.borderColor = 'rgba(255,179,71,0.25)';
    tipEl.style.color = 'var(--warn)';
  } else {
    tipEl.textContent = `✅ Bahut acha! Budget ka sirf ${Math.round(pct)}% use hua hai.`;
    tipEl.style.borderColor = 'rgba(198,241,53,0.2)';
    tipEl.style.color = 'var(--accent)';
  }
}

/* ============================================================
   7. TOTALS CALCULATION
============================================================ */

// Sirf manual expenses ka total (subscriptions exclude)
function totalManualExpenses() {
  return appState.expenses.reduce((s, e) => s + e.amount, 0);
}

// Total spent = manual expenses + subscription monthly cost
function totalSpent() {
  return totalManualExpenses() + totalSubCost();
}

/* ============================================================
   8. DASHBOARD UPDATE
============================================================ */

function updateDashboard() {
  const budget    = appState.budget;
  const subs      = totalSubCost();
  const expenses  = totalSpent();
  const remaining = budget - expenses;
  const pct       = budget > 0 ? Math.min((expenses / budget) * 100, 100) : 0;

  // Summary cards
  document.getElementById('db-budget').textContent    = fmt(budget);
  document.getElementById('db-expenses').textContent  = fmt(expenses);
  document.getElementById('db-subs').textContent      = fmt(subs);

  const remEl = document.getElementById('db-remaining');
  remEl.textContent = fmt(Math.max(remaining, 0));

  // Red color agar overspent
  remEl.style.color = remaining < 0 ? 'var(--danger)' : 'var(--text)';

  const remLabel = document.getElementById('db-remaining-label');
  remLabel.textContent = remaining < 0 ? 'Over budget! 🚨' : 'Budget – Expenses';

  // Progress bar
  const fill = document.getElementById('budget-progress-fill');
  fill.style.width = pct + '%';
  fill.className = 'progress-fill' + (pct >= 80 ? ' danger' : '');

  const pctLabel = document.getElementById('budget-percent-label');
  pctLabel.textContent = Math.round(pct) + '%';

  // Category breakdown bars render karna
  renderCategoryBars(expenses);

  // Budget section bhi update karo
  updateBudgetSection();
}

// Category breakdown bars — kaunsi category mein kitna kharcha
function renderCategoryBars(totalExp) {
  const container = document.getElementById('category-bars');

  // Categories ka totals nikalo
  const cats = {
    Food: 0, Transport: 0, Bills: 0, Shopping: 0, Others: 0
  };

  appState.expenses.forEach(e => {
    if (cats.hasOwnProperty(e.category)) cats[e.category] += e.amount;
  });

  // Subscriptions bhi ek separate category
  const subTotal = totalSubCost();

  // All categories ek array mein
  const catArr = [
    { label: '🔄 Subscriptions', value: subTotal, cls: 'cat-Subs' },
    { label: '🍔 Food',       value: cats.Food,      cls: 'cat-Food' },
    { label: '🚗 Transport',  value: cats.Transport, cls: 'cat-Transport' },
    { label: '💡 Bills',      value: cats.Bills,     cls: 'cat-Bills' },
    { label: '🛍️ Shopping',  value: cats.Shopping,  cls: 'cat-Shopping' },
    { label: '📦 Others',     value: cats.Others,    cls: 'cat-Others' },
  ].filter(c => c.value > 0);

  if (catArr.length === 0) {
    container.innerHTML = '<p class="empty-state">No expenses yet. Add some in the Expenses tab.</p>';
    return;
  }

  const maxVal = Math.max(...catArr.map(c => c.value), 1);

  container.innerHTML = catArr.map(c => {
    const pct = (c.value / maxVal) * 100;
    return `
      <div class="cat-bar-row">
        <div class="cat-bar-label">${c.label}</div>
        <div class="cat-bar-track">
          <div class="cat-bar-fill ${c.cls}" style="width:${pct}%"></div>
        </div>
        <div class="cat-bar-amount">${fmt(c.value)}</div>
      </div>
    `;
  }).join('');
}

/* ============================================================
   9. NAVIGATION — Sections switch karna
============================================================ */

function switchSection(sectionName) {
  // Saare sections hide karo
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  // Saare nav items deactivate karo
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  // Target section show karo
  const targetSection = document.getElementById('section-' + sectionName);
  if (targetSection) targetSection.classList.add('active');

  // Target nav item activate karo
  const targetNav = document.querySelector(`.nav-item[data-section="${sectionName}"]`);
  if (targetNav) targetNav.classList.add('active');

  // Mobile mein sidebar band karo
  closeSidebar();
}

/* ============================================================
   10. SIDEBAR — Mobile open/close
============================================================ */

function openSidebar() {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('overlay').classList.add('active');
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('overlay').classList.remove('active');
}

/* ============================================================
   11. SVG GRADIENT for ring — inject karna
============================================================ */

function injectRingGradient() {
  // SVG mein gradient define karo
  const svg = document.querySelector('.budget-ring');
  if (!svg) return;

  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  defs.innerHTML = `
    <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#c6f135"/>
      <stop offset="100%" stop-color="#3df5c1"/>
    </linearGradient>
  `;
  svg.prepend(defs);

  // Ring stroke set karo
  const ring = document.getElementById('ring-fill');
  if (ring) ring.style.stroke = 'url(#ringGrad)';
}

/* ============================================================
   12. XSS PROTECTION — User input ko safe karna
============================================================ */

function escHtml(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

/* ============================================================
   13. DATE DISPLAY — Topbar mein aaj ki date
============================================================ */

function setCurrentDate() {
  const d = new Date();
  const opts = { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' };
  document.getElementById('currentDate').textContent =
    d.toLocaleDateString('en-IN', opts);
}

/* ============================================================
   14. INIT — App start karna
============================================================ */

function init() {
  // Pehle saved state load karo
  loadState();

  // Today ka date set karo form fields mein
  const dateInputs = ['sub-date', 'exp-date'];
  dateInputs.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = todayStr();
  });

  // Topbar date
  setCurrentDate();

  // SVG gradient inject karo
  injectRingGradient();

  // Navigation events bind karo
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      switchSection(item.dataset.section);
    });
  });

  // Hamburger menu
  document.getElementById('hamburger').addEventListener('click', openSidebar);
  document.getElementById('sidebarClose').addEventListener('click', closeSidebar);
  document.getElementById('overlay').addEventListener('click', closeSidebar);

  // Initial render
  renderSubscriptions();
  renderExpenses();
  updateDashboard();

  console.log('✅ SubTrack initialized! Sab kuch ready hai.');
}

// DOM load hone ke baad init call karo
document.addEventListener('DOMContentLoaded', init);
