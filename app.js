'use strict';

/* ── Constants ─────────────────────────────────────────────── */
const STORAGE_KEY = 'cgi-ai-coverage-v1';

const PERMISSIONS = [
  { key: 'workQuestions', label: 'Can use work-related questions' },
  { key: 'specs',         label: 'Can use for specs' },
  { key: 'code',          label: 'Can use for code' },
  { key: 'agenticOwn',    label: 'Can use for agentic access' },
  { key: 'secrets',       label: 'Can use with secrets' },
];

const AI_APPLIED_SUBS = [
  { key: 'generative',  label: 'Generative' },
  { key: 'agentic',     label: 'Agentic' },
  { key: 'darkFactory', label: 'Dark Factory' },
];

const STEP_LABELS = ['Not started', 'Permissions', 'Applied', 'Benefits'];

const LIMITATIONS = [
  { key: 'mcpControl',           label: 'MCP control' },
  { key: 'confidentialTestData', label: 'Confidential Test Data' },
  { key: 'noInternetAccess',     label: 'No internet access' },
];

const ATTENTION_ITEMS = [
  { key: 'useWithoutPermissions', label: 'Use without permissions' },
];

const CLASSIFICATIONS = ['none', 'red', 'purple', 'grey'];
const CLASSIFICATION_LABELS = { none: 'Unclassified', red: 'Red', purple: 'Purple', grey: 'Grey' };

/* ── State ─────────────────────────────────────────────── */
let clients = [];
let anonymised = false;

/* ── Persistence ───────────────────────────────────────────── */
function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(clients));
  } catch (e) {
    console.error('Failed to save data:', e);
  }
}

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        clients = parsed.map(normaliseClient);
        return;
      }
    }
  } catch (e) {
    console.error('Failed to load data:', e);
  }
  clients = [];
}

/* Ensure backward-compatible shape when loading older snapshots */
function normaliseClient(c) {
  return {
    id: String(c.id || Date.now()),
    name: String(c.name || 'Unnamed'),
    classification: CLASSIFICATIONS.includes(c.classification) ? c.classification : c.classification === 'blue' ? 'purple' : 'none',
    permissions: {
      workQuestions: Boolean(c.permissions?.workQuestions),
      specs:         Boolean(c.permissions?.specs ?? c.permissions?.artifacts),
      code:          Boolean(c.permissions?.code ?? c.permissions?.artifacts),
      agenticOwn:    Boolean(c.permissions?.agenticOwn),
      secrets:       Boolean(c.permissions?.secrets),
    },
    aiApplied: {
      generative:  Boolean(c.aiApplied?.generative),
      agentic:     Boolean(c.aiApplied?.agentic),
      darkFactory: Boolean(c.aiApplied?.darkFactory),
    },
    aiBenefits:  Boolean(c.aiBenefits),
    limitations: {
      mcpControl:           Boolean(c.limitations?.mcpControl),
      confidentialTestData: Boolean(c.limitations?.confidentialTestData),
      noInternetAccess:     Boolean(c.limitations?.noInternetAccess),
    },
    attention: {
      // migrate from old limitations.useWithoutPermissions if present
      useWithoutPermissions: Boolean(c.attention?.useWithoutPermissions ?? c.limitations?.useWithoutPermissions),
    },
  };
}

/* Return display name — anonymised or real */
function displayName(client, index) {
  return anonymised ? `Client ${index + 1}` : client.name;
}

function createClient(name) {
  return normaliseClient({ id: Date.now().toString(), name });
}

/* ── Helpers ───────────────────────────────────────────────── */
function permCount(client) {
  return PERMISSIONS.filter(p => client.permissions[p.key]).length;
}

function isAiApplied(client) {
  return AI_APPLIED_SUBS.some(s => client.aiApplied[s.key]);
}

function progressLevel(client) {
  if (client.aiBenefits)   return 3;
  if (isAiApplied(client)) return 2;
  if (permCount(client) > 0) return 1;
  return 0;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ── Rendering ─────────────────────────────────────────────── */
function buildProgressSteps(client) {
  const cnt  = permCount(client);
  const pSt  = cnt === 0 ? 'inactive' : cnt < 4 ? 'partial' : 'complete';
  const aSt  = isAiApplied(client) ? 'complete' : 'inactive';
  const bSt  = client.aiBenefits ? 'complete' : 'inactive';
  const l1   = pSt === 'complete' && aSt === 'complete';
  const l2   = aSt === 'complete' && bSt === 'complete';

  return `
    <div class="progress-steps">
      <div class="step-node ${pSt}" title="AI Permissions: ${cnt}/4">${cnt}/4</div>
      <div class="step-line${pSt !== 'inactive' && aSt !== 'inactive' ? ' lit' : ''}"></div>
      <div class="step-node ${aSt}" title="AI Applied">A</div>
      <div class="step-line${l1 ? ' lit' : ''}"></div>
      <div class="step-node ${bSt}" title="AI Benefits">B</div>
      <span class="step-label-text">${STEP_LABELS[progressLevel(client)]}</span>
    </div>`;
}

function buildRow(client, index) {
  const perms = PERMISSIONS.map(p => `
    <td class="check-cell">
      <input type="checkbox"
             data-id="${escapeHtml(client.id)}"
             data-field="permissions.${p.key}"
             aria-label="${escapeHtml(p.label)}"
             ${client.permissions[p.key] ? 'checked' : ''} />
    </td>`).join('');

  const appliedCells = AI_APPLIED_SUBS.map(s => `
    <td class="check-cell">
      <input type="checkbox"
             data-id="${escapeHtml(client.id)}"
             data-field="aiApplied.${s.key}"
             aria-label="AI Applied: ${s.label}"
             ${client.aiApplied[s.key] ? 'checked' : ''} />
    </td>`).join('');

  const cls   = client.classification;
  const name  = displayName(client, index);
  const editable = !anonymised;
  const hasLimits    = LIMITATIONS.some(l => client.limitations[l.key]);
  const hasAttention = ATTENTION_ITEMS.some(a => client.attention[a.key]);

  return `
    <tr data-id="${escapeHtml(client.id)}">
      <td class="client-cell">
        <button class="classification-dot cls-${cls}"
                data-id="${escapeHtml(client.id)}"
                data-action="cycle-classification"
                title="Classification: ${CLASSIFICATION_LABELS[cls]} (click to change)"
                aria-label="Classification: ${CLASSIFICATION_LABELS[cls]}"></button>
        <span class="client-name"
              contenteditable="${editable}"
              spellcheck="false"
              data-id="${escapeHtml(client.id)}"
              data-field="name"
              role="textbox"
              aria-label="Client name"
              ${anonymised ? 'style="pointer-events:none;user-select:none;"' : ''}>${escapeHtml(name)}</span>
        <button class="btn-limitations${hasLimits ? ' has-limits' : ''}"
                data-id="${escapeHtml(client.id)}"
                data-action="open-limitations"
                title="${hasLimits ? 'Limitations identified' : 'No limitations set'}"
                aria-label="Limitations">★</button>
        <button class="btn-attention${hasAttention ? ' has-attention' : ''}"
                data-id="${escapeHtml(client.id)}"
                data-action="open-attention"
                title="${hasAttention ? 'Attention: action required' : 'No attention items'}"
                aria-label="Attention">!</button>
      </td>
      ${perms}
      ${appliedCells}
      <td class="check-cell">
        <input type="checkbox"
               data-id="${escapeHtml(client.id)}"
               data-field="aiBenefits"
               aria-label="AI Benefits"
               ${client.aiBenefits ? 'checked' : ''} />
      </td>
      <td>${buildProgressSteps(client)}</td>
      <td class="check-cell">
        <button class="btn-delete"
                data-id="${escapeHtml(client.id)}"
                aria-label="Delete ${escapeHtml(client.name)}">✕</button>
      </td>
    </tr>`;
}

function renderTable() {
  const tbody      = document.getElementById('coverage-tbody');
  const searchTerm = document.getElementById('search-input').value.trim().toLowerCase();

  // When anonymised, search is disabled (names are hidden)
  const filtered = (!anonymised && searchTerm)
    ? clients.filter(c => c.name.toLowerCase().includes(searchTerm))
    : clients;

  const sorted = [...filtered].sort((a, b) => a.name.localeCompare(b.name));

  if (sorted.length === 0) {
    const msg = clients.length === 0
      ? 'No clients yet. Click "+ Add Client" to get started.'
      : 'No clients match your search.';
    tbody.innerHTML = `
      <tr>
        <td colspan="11" class="empty-state">
          <div class="empty-icon">📋</div>
          <div>${msg}</div>
        </td>
      </tr>`;
  } else {
    tbody.innerHTML = sorted.map((c, i) => buildRow(c, i)).join('');
  }

  updateStats();
}

function updateStats() {
  const total    = clients.length;
  const withPerm = clients.filter(c => permCount(c) > 0).length;
  const applied  = clients.filter(c => isAiApplied(c)).length;
  const benefits = clients.filter(c => c.aiBenefits).length;
  const pct      = n => total ? `${Math.round(n / total * 100)}%` : '0%';

  document.getElementById('stat-total').textContent       = total;
  document.getElementById('stat-permissions').textContent = pct(withPerm);
  document.getElementById('stat-applied').textContent     = pct(applied);
  document.getElementById('stat-benefits').textContent    = pct(benefits);
}

function renderSummary() {
  const container = document.getElementById('summary-chart');
  if (clients.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">📊</div><div>No data yet.</div></div>';
    return;
  }

  const TOTAL_STEPS = 8; // 4 perms + 3 applied + 1 benefits
  const sorted = [...clients].sort((a, b) => a.name.localeCompare(b.name));
  container.innerHTML = sorted.map((client, i) => {
    const cnt          = permCount(client);
    const appliedCount = AI_APPLIED_SUBS.filter(s => client.aiApplied[s.key]).length;
    const steps = cnt + appliedCount + (client.aiBenefits ? 1 : 0);
    const pct   = Math.round(steps / TOTAL_STEPS * 100);
    const pw    = (cnt          / TOTAL_STEPS * 100).toFixed(1);
    const aw    = (appliedCount / TOTAL_STEPS * 100).toFixed(1);
    const bw    = (client.aiBenefits ? 1/TOTAL_STEPS*100 : 0).toFixed(1);
    const name  = displayName(client, i);
    const cls   = client.classification;

    return `
      <div class="summary-row">
        <div class="summary-client-name">
          <span class="summary-cls-dot cls-${cls}" title="${CLASSIFICATION_LABELS[cls]}"></span>
          <span title="${anonymised ? '' : escapeHtml(client.name)}">${escapeHtml(name)}</span>
        </div>
        <div class="summary-bar-wrap">
          <div class="summary-segment" style="width:${pw}%;background:var(--cgi-red)"   title="${cnt} permission(s)"></div>
          <div class="summary-segment" style="width:${aw}%;background:var(--amber)"     title="AI Applied (${appliedCount}/3)"></div>
          <div class="summary-segment" style="width:${bw}%;background:var(--green)"     title="AI Benefits"></div>
        </div>
        <div class="summary-pct">${pct}%</div>
      </div>`;
  }).join('');
}

/* ── Event delegation: table ───────────────────────────────── */
function onTableChange(e) {
  const el = e.target;
  if (el.type !== 'checkbox') return;
  const { id, field } = el.dataset;
  if (!id) return;

  const client = clients.find(c => c.id === id);
  if (!client) return;

  if (field.startsWith('permissions.')) {
    const key = field.slice('permissions.'.length);
    client.permissions[key] = el.checked;
  } else if (field.startsWith('aiApplied.')) {
    const key = field.slice('aiApplied.'.length);
    client.aiApplied[key] = el.checked;
  } else {
    client[field] = el.checked;
  }

  saveData();
  renderTable();
}

function onTableBlur(e) {
  const el = e.target;
  if (!el.classList.contains('client-name')) return;
  const { id } = el.dataset;
  const client = clients.find(c => c.id === id);
  if (!client) return;

  const newName = el.textContent.trim();
  if (!newName) {
    el.textContent = client.name; // revert blank
    return;
  }
  if (newName !== client.name) {
    client.name = newName;
    saveData();
    renderSummary();
    updateStats();
  }
}

/* Prevent newlines in the editable span */
function onTableKeydown(e) {
  if (e.target.classList.contains('client-name') && e.key === 'Enter') {
    e.preventDefault();
    e.target.blur();
  }
}

function onTableClick(e) {
  // Classification dot cycle
  const dot = e.target.closest('[data-action="cycle-classification"]');
  if (dot) {
    const { id } = dot.dataset;
    const client = clients.find(c => c.id === id);
    if (client) {
      const next = (CLASSIFICATIONS.indexOf(client.classification) + 1) % CLASSIFICATIONS.length;
      client.classification = CLASSIFICATIONS[next];
      saveData();
      renderTable();
      if (document.getElementById('tab-summary').classList.contains('active')) renderSummary();
    }
    return;
  }

  // Limitations
  const limBtn = e.target.closest('[data-action="open-limitations"]');
  if (limBtn) {
    openLimitationsModal(limBtn.dataset.id);
    return;
  }

  // Attention
  const attBtn = e.target.closest('[data-action="open-attention"]');
  if (attBtn) {
    openAttentionModal(attBtn.dataset.id);
    return;
  }

  // Delete
  const btn = e.target.closest('.btn-delete');
  if (!btn) return;
  const { id } = btn.dataset;
  const client = clients.find(c => c.id === id);
  const name   = client ? client.name : 'this client';

  if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
  clients = clients.filter(c => c.id !== id);
  saveData();
  renderTable();
  renderSummary();
}

/* ── Limitations Modal ────────────────────────────────────── */
function openLimitationsModal(clientId) {
  const client = clients.find(c => c.id === clientId);
  if (!client) return;

  const overlay = document.getElementById('limitations-overlay');
  document.getElementById('limitations-title').textContent =
    `Limitations: ${anonymised ? 'Client' : client.name}`;

  const list = document.getElementById('limitations-list');
  list.innerHTML = LIMITATIONS.map(l => `
    <label class="limitations-item">
      <input type="checkbox"
             data-lim-id="${escapeHtml(client.id)}"
             data-limitation="${l.key}"
             ${client.limitations[l.key] ? 'checked' : ''} />
      ${escapeHtml(l.label)}
    </label>`).join('');

  list.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', () => {
      const c = clients.find(x => x.id === cb.dataset.limId);
      if (!c) return;
      c.limitations[cb.dataset.limitation] = cb.checked;
      const hasLimits = LIMITATIONS.some(l => c.limitations[l.key]);
      const iconBtn = document.querySelector(
        `[data-action="open-limitations"][data-id="${CSS.escape(c.id)}"]`);
      if (iconBtn) {
        iconBtn.classList.toggle('has-limits', hasLimits);
        iconBtn.title = hasLimits ? 'Limitations identified' : 'No limitations set';
      }
      saveData();
    });
  });

  overlay.classList.add('active');
  document.getElementById('limitations-close').focus();
}

function closeLimitationsModal() {
  document.getElementById('limitations-overlay').classList.remove('active');
}

/* ── Attention Modal ─────────────────────────────────────────── */
function openAttentionModal(clientId) {
  const client = clients.find(c => c.id === clientId);
  if (!client) return;

  const overlay = document.getElementById('attention-overlay');
  document.getElementById('attention-title').textContent =
    `Attention: ${anonymised ? 'Client' : client.name}`;

  const list = document.getElementById('attention-list');
  list.innerHTML = ATTENTION_ITEMS.map(a => `
    <label class="limitations-item">
      <input type="checkbox"
             data-att-id="${escapeHtml(client.id)}"
             data-attention="${a.key}"
             ${client.attention[a.key] ? 'checked' : ''} />
      ${escapeHtml(a.label)}
    </label>`).join('');

  list.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', () => {
      const c = clients.find(x => x.id === cb.dataset.attId);
      if (!c) return;
      c.attention[cb.dataset.attention] = cb.checked;
      const hasAttention = ATTENTION_ITEMS.some(a => c.attention[a.key]);
      const iconBtn = document.querySelector(
        `[data-action="open-attention"][data-id="${CSS.escape(c.id)}"]`);
      if (iconBtn) {
        iconBtn.classList.toggle('has-attention', hasAttention);
        iconBtn.title = hasAttention ? 'Attention: action required' : 'No attention items';
      }
      saveData();
    });
  });

  overlay.classList.add('active');
  document.getElementById('attention-close').focus();
}

function closeAttentionModal() {
  document.getElementById('attention-overlay').classList.remove('active');
}

/* ── Modal ─────────────────────────────────────────────────── */
function openModal() {
  const overlay = document.getElementById('modal-overlay');
  const input   = document.getElementById('new-client-name');
  overlay.classList.add('active');
  input.value = '';
  // Defer focus so the modal is visible first
  requestAnimationFrame(() => input.focus());
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('active');
}

function confirmAddClient() {
  const input = document.getElementById('new-client-name');
  const name  = input.value.trim();
  if (!name) {
    input.focus();
    return;
  }
  clients.push(createClient(name));
  saveData();
  renderTable();
  renderSummary();
  closeModal();
}

/* ── Tabs ──────────────────────────────────────────────────── */
function switchTab(tabId) {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
    btn.setAttribute('aria-selected', btn.dataset.tab === tabId);
  });
  document.querySelectorAll('.tab-content').forEach(pane => {
    pane.classList.toggle('active', pane.id === `tab-${tabId}`);
  });
  if (tabId === 'summary') renderSummary();
}

/* ── Bootstrap ─────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  loadData();
  renderTable();

  /* Tab switching */
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  /* Toolbar */
  document.getElementById('add-client-btn').addEventListener('click', openModal);
  document.getElementById('search-input').addEventListener('input', renderTable);

  /* Anonymize toggle */
  document.getElementById('anon-toggle').addEventListener('click', () => {
    anonymised = !anonymised;
    const btn = document.getElementById('anon-toggle');
    btn.setAttribute('aria-pressed', String(anonymised));
    btn.classList.toggle('active', anonymised);
    const searchInput = document.getElementById('search-input');
    searchInput.disabled = anonymised;
    searchInput.placeholder = anonymised ? 'Search disabled while anonymised' : 'Search clients…';
    renderTable();
    if (document.getElementById('tab-summary').classList.contains('active')) renderSummary();
  });

  /* Limitations modal */
  document.getElementById('limitations-close').addEventListener('click', closeLimitationsModal);
  document.getElementById('limitations-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeLimitationsModal();
  });

  /* Attention modal */
  document.getElementById('attention-close').addEventListener('click', closeAttentionModal);
  document.getElementById('attention-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeAttentionModal();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeLimitationsModal();
      closeAttentionModal();
      closeModal();
    }
  });

  /* Modal */
  document.getElementById('modal-cancel') .addEventListener('click', closeModal);
  document.getElementById('modal-confirm').addEventListener('click', confirmAddClient);
  document.getElementById('new-client-name').addEventListener('keydown', e => {
    if (e.key === 'Enter')  confirmAddClient();
    if (e.key === 'Escape') closeModal();
  });
  document.getElementById('modal-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal();
  });

  /* Table (delegated) */
  const tbody = document.getElementById('coverage-tbody');
  tbody.addEventListener('change',  onTableChange);
  tbody.addEventListener('blur',    onTableBlur,    { capture: true });
  tbody.addEventListener('keydown', onTableKeydown);
  tbody.addEventListener('click',   onTableClick);
});
