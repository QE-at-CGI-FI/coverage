'use strict';

/* ── Constants ─────────────────────────────────────────────── */
const STORAGE_KEY = 'cgi-ai-coverage-v1';
const STORAGE_KEY_PARTNERS = 'cgi-ai-coverage-partners-v1';

const PERMISSIONS = [
  { key: 'workQuestions', label: 'Can use work-related questions' },
  { key: 'specs',         label: 'Can use for specs' },
  { key: 'code',          label: 'Can use for code' },
  { key: 'agenticOwn',    label: 'Can use for agentic access' },
  { key: 'secrets',       label: 'Can use with secrets' },
];

const AI_APPLIED_SUBS = [
  { key: 'generative',       label: 'Generative' },
  { key: 'reactiveAgentic',  label: 'Reactive Agentic' },
  { key: 'proactiveAgentic', label: 'Proactive Agentic' },
  { key: 'darkFactory',      label: 'Dark Factory' },
];

const AI_BENEFITS_SUBS = [
  { key: 'task',       label: 'Task' },
  { key: 'individual', label: 'Individual' },
  { key: 'project',    label: 'Project' },
];

const WIDTH_SUBS = [
  { key: 'pointSolutions', label: 'Point Solutions' },
  { key: 'systemic',       label: 'Systemic' },
];

const STEP_LABELS = ['Not started', 'Permissions', 'Applied', 'Benefits', 'Width'];

const TOOL_ITEMS = [
  { key: 'githubCopilot',  label: 'Github Copilot' },
  { key: 'amazonQ',        label: 'Amazon Q' },
  { key: 'codex',          label: 'Codex' },
  { key: 'claudeCode',     label: 'Claude Code' },
  { key: 'atlassianRovo',  label: 'Atlassian Rovo' },
];

const LIMITATION_GROUPS = [
  {
    subtitle: 'Settings',
    items: [
      { key: 'mcpControl',           label: 'MCP control' },
      { key: 'confidentialTestData', label: 'Confidential Test Data' },
      { key: 'noInternetAccess',     label: 'No internet access' },
    ]
  }
];
const LIMITATIONS = LIMITATION_GROUPS.flatMap(g => g.items);

const ATTENTION_ITEMS = [
  { key: 'useWithoutPermissions', label: 'Use without permissions' },
];

const CLASSIFICATIONS = ['none', 'red', 'purple', 'grey'];
const CLASSIFICATION_LABELS = { none: 'Unclassified', red: 'Red', purple: 'Purple', grey: 'Grey' };

/* ── State ─────────────────────────────────────────────── */
let clients = [];
let partners = [];
let anonymised = false;

/* ── Persistence ───────────────────────────────────────────── */
function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(clients));
  } catch (e) {
    console.error('Failed to save data:', e);
  }
}

function savePartners() {
  try {
    localStorage.setItem(STORAGE_KEY_PARTNERS, JSON.stringify(partners));
  } catch (e) {
    console.error('Failed to save partners:', e);
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

function loadPartners() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PARTNERS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        partners = parsed.map(normaliseClient);
        return;
      }
    }
  } catch (e) {
    console.error('Failed to load partners:', e);
  }
  partners = [];
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
      generative:       Boolean(c.aiApplied?.generative),
      reactiveAgentic:  Boolean(c.aiApplied?.reactiveAgentic ?? c.aiApplied?.agentic),
      proactiveAgentic: Boolean(c.aiApplied?.proactiveAgentic),
      darkFactory:      Boolean(c.aiApplied?.darkFactory),
    },
    aiBenefits: {
      task:       Boolean(c.aiBenefits?.task ?? (typeof c.aiBenefits === 'boolean' && c.aiBenefits)),
      individual: Boolean(c.aiBenefits?.individual),
      project:    Boolean(c.aiBenefits?.project),
    },
    tools: {
      githubCopilot:  Boolean(c.tools?.githubCopilot  ?? c.limitations?.githubCopilot),
      amazonQ:        Boolean(c.tools?.amazonQ         ?? c.limitations?.amazonQ),
      codex:          Boolean(c.tools?.codex           ?? c.limitations?.codex),
      claudeCode:     Boolean(c.tools?.claudeCode      ?? c.limitations?.claudeCode),
      atlassianRovo:  Boolean(c.tools?.atlassianRovo   ?? c.limitations?.atlassianRovo),
    },
    limitations: {
      mcpControl:           Boolean(c.limitations?.mcpControl),
      confidentialTestData: Boolean(c.limitations?.confidentialTestData),
      noInternetAccess:     Boolean(c.limitations?.noInternetAccess),
    },
    attention: {
      // migrate from old limitations.useWithoutPermissions if present
      useWithoutPermissions: Boolean(c.attention?.useWithoutPermissions ?? c.limitations?.useWithoutPermissions),
    },
    width: {
      pointSolutions: Boolean(c.width?.pointSolutions),
      systemic:       Boolean(c.width?.systemic),
    },
    partnerClients: Array.isArray(c.partnerClients)
      ? c.partnerClients.filter(s => typeof s === 'string' && s.trim())
      : [],
    highlightStory: typeof c.highlightStory === 'string' ? c.highlightStory : '',
  };
}

/* Return display name — anonymised or real */
function displayName(entity, index, entityType = 'Client') {
  return anonymised ? `${entityType} ${index + 1}` : entity.name;
}

function createClient(name) {
  return normaliseClient({ id: Date.now().toString(), name });
}

function createPartner(name) {
  return normaliseClient({ id: Date.now().toString(), name });
}

/* Find an entity by id in either clients or partners */
function findById(id) {
  const inClients = clients.find(c => c.id === id);
  if (inClients) return { entity: inClients, save: saveData, isPartner: false };
  const inPartners = partners.find(p => p.id === id);
  if (inPartners) return { entity: inPartners, save: savePartners, isPartner: true };
  return null;
}

/* ── Helpers ───────────────────────────────────────────────── */
function permCount(client) {
  return PERMISSIONS.filter(p => client.permissions[p.key]).length;
}

function isAiApplied(client) {
  return AI_APPLIED_SUBS.some(s => client.aiApplied[s.key]);
}

function hasBenefits(client) {
  return AI_BENEFITS_SUBS.some(s => client.aiBenefits[s.key]);
}

function hasWidth(client) {
  return WIDTH_SUBS.some(s => client.width[s.key]);
}

function progressLevel(client) {
  if (hasWidth(client)) return 4;
  if (hasBenefits(client)) return 3;
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
  const pCnt = permCount(client);
  const pTot = PERMISSIONS.length;
  const pSt  = pCnt === 0 ? 'inactive' : pCnt < pTot ? 'partial' : 'complete';

  const aCnt = AI_APPLIED_SUBS.filter(s => client.aiApplied[s.key]).length;
  const aTot = AI_APPLIED_SUBS.length;
  const aSt  = aCnt === 0 ? 'inactive' : aCnt < aTot ? 'partial' : 'complete';

  const bCnt = AI_BENEFITS_SUBS.filter(s => client.aiBenefits[s.key]).length;
  const bTot = AI_BENEFITS_SUBS.length;
  const bSt  = bCnt === 0 ? 'inactive' : bCnt < bTot ? 'partial' : 'complete';

  const wCnt = WIDTH_SUBS.filter(s => client.width[s.key]).length;
  const wTot = WIDTH_SUBS.length;
  const wSt  = wCnt === 0 ? 'inactive' : wCnt < wTot ? 'partial' : 'complete';

  const l1   = pSt !== 'inactive' && aSt !== 'inactive';
  const l2   = aSt !== 'inactive' && bSt !== 'inactive';
  const l3   = bSt !== 'inactive' && wSt !== 'inactive';

  return `
    <div class="progress-steps">
      <div class="step-node ${pSt}" title="AI Permissions: ${pCnt}/${pTot}">${pCnt}/${pTot}</div>
      <div class="step-line${l1 ? ' lit' : ''}"></div>
      <div class="step-node ${aSt}" title="AI Applied: ${aCnt}/${aTot}">${aCnt}/${aTot}</div>
      <div class="step-line${l2 ? ' lit' : ''}"></div>
      <div class="step-node ${bSt}" title="AI Benefits: ${bCnt}/${bTot}">${bCnt}/${bTot}</div>
      <div class="step-line${l3 ? ' lit' : ''}"></div>
      <div class="step-node ${wSt}" title="Width: ${wCnt}/${wTot}">${wCnt}/${wTot}</div>
      <span class="step-label-text">${STEP_LABELS[progressLevel(client)]}</span>
    </div>`;
}

function buildRow(client, index, entityType = 'Client') {
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
  const name  = displayName(client, index, entityType);
  const editable = !anonymised;
  const hasLimits    = LIMITATIONS.some(l => client.limitations[l.key]);
  const hasTools     = TOOL_ITEMS.some(t => client.tools[t.key]);
  const hasAttention = ATTENTION_ITEMS.some(a => client.attention[a.key]);
  const isPartnerRow = entityType === 'Partner';
  const partnerClientCount = isPartnerRow ? (client.partnerClients || []).length : 0;
  const partnerClientsTitle = partnerClientCount ? partnerClientCount + ' client(s) linked' : 'No clients linked';

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
        ${!isPartnerRow ? `<button class="btn-limitations${hasLimits ? ' has-limits' : ''}"
                data-id="${escapeHtml(client.id)}"
                data-action="open-limitations"
                title="${hasLimits ? 'Limitations identified' : 'No limitations set'}"
                aria-label="Limitations">★</button>` : ''}
        <button class="btn-tools${hasTools ? ' has-tools' : ''}"
                data-id="${escapeHtml(client.id)}"
                data-action="open-tools"
                title="${hasTools ? 'Tools tracked' : 'No tools tracked'}"
                aria-label="Tools">♥</button>
        <button class="btn-attention${hasAttention ? ' has-attention' : ''}"
                data-id="${escapeHtml(client.id)}"
                data-action="open-attention"
                title="${hasAttention ? 'Attention: action required' : 'No attention items'}"
                aria-label="Attention">!</button>
        ${isPartnerRow ? `<button class="btn-partner-clients${partnerClientCount ? ' has-clients' : ''}"
                data-id="${escapeHtml(client.id)}"
                data-action="open-partner-clients"
                title="${partnerClientsTitle}"
                aria-label="Linked clients">◉</button>` : ''}
        ${isPartnerRow ? `<button class="btn-highlight-story${client.highlightStory ? ' has-story' : ''}"
                data-id="${escapeHtml(client.id)}"
                data-action="open-highlight-story"
                title="${client.highlightStory ? 'Highlight story recorded' : 'No highlight story yet'}"
                aria-label="Highlight story">★</button>` : ''}
      </td>
      ${perms}
      ${appliedCells}
      ${AI_BENEFITS_SUBS.map(s => `
      <td class="check-cell">
        <input type="checkbox"
               data-id="${escapeHtml(client.id)}"
               data-field="aiBenefits.${s.key}"
               aria-label="AI Benefits: ${s.label}"
               ${client.aiBenefits[s.key] ? 'checked' : ''} />
      </td>`).join('')}
      ${WIDTH_SUBS.map(s => `
      <td class="check-cell">
        <input type="checkbox"
               data-id="${escapeHtml(client.id)}"
               data-field="width.${s.key}"
               aria-label="Width: ${s.label}"
               ${client.width[s.key] ? 'checked' : ''} />
      </td>`).join('')}
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
        <td colspan="16" class="empty-state">
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
  const benefits = clients.filter(c => hasBenefits(c)).length;
  const pct      = n => total ? `${Math.round(n / total * 100)}%` : '0%';

  document.getElementById('stat-total').textContent       = total;
  document.getElementById('stat-permissions').textContent = pct(withPerm);
  document.getElementById('stat-applied').textContent     = pct(applied);
  document.getElementById('stat-benefits').textContent    = pct(benefits);
}

function renderPartnersTable() {
  const tbody      = document.getElementById('partners-tbody');
  const searchTerm = document.getElementById('partners-search-input').value.trim().toLowerCase();

  const filtered = (!anonymised && searchTerm)
    ? partners.filter(p => p.name.toLowerCase().includes(searchTerm))
    : partners;

  const sorted = [...filtered].sort((a, b) => a.name.localeCompare(b.name));

  if (sorted.length === 0) {
    const msg = partners.length === 0
      ? 'No partners yet. Click "+ Add Partner" to get started.'
      : 'No partners match your search.';
    tbody.innerHTML = `
      <tr>
        <td colspan="16" class="empty-state">
          <div class="empty-icon">📋</div>
          <div>${msg}</div>
        </td>
      </tr>`;
  } else {
    tbody.innerHTML = sorted.map((p, i) => buildRow(p, i, 'Partner')).join('');
  }

  updatePartnersStats();
}

function updatePartnersStats() {
  const total    = partners.length;
  const withPerm = partners.filter(p => permCount(p) > 0).length;
  const applied  = partners.filter(p => isAiApplied(p)).length;
  const benefits = partners.filter(p => hasBenefits(p)).length;
  const pct      = n => total ? `${Math.round(n / total * 100)}%` : '0%';

  document.getElementById('pstat-total').textContent       = total;
  document.getElementById('pstat-permissions').textContent = pct(withPerm);
  document.getElementById('pstat-applied').textContent     = pct(applied);
  document.getElementById('pstat-benefits').textContent    = pct(benefits);
}

function renderSummary() {
  const container = document.getElementById('summary-chart');
  if (clients.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">📊</div><div>No data yet.</div></div>';
    return;
  }

  const TOTAL_STEPS = 13; // 5 perms + 3 applied + 3 benefits + 2 width
  const sorted = [...clients].sort((a, b) => a.name.localeCompare(b.name));
  container.innerHTML = sorted.map((client, i) => {
    const cnt           = permCount(client);
    const appliedCount  = AI_APPLIED_SUBS.filter(s => client.aiApplied[s.key]).length;
    const benefitsCount = AI_BENEFITS_SUBS.filter(s => client.aiBenefits[s.key]).length;
    const widthCount    = WIDTH_SUBS.filter(s => client.width[s.key]).length;
    const steps = cnt + appliedCount + benefitsCount + widthCount;
    const pct   = Math.round(steps / TOTAL_STEPS * 100);
    const pw    = (cnt           / TOTAL_STEPS * 100).toFixed(1);
    const aw    = (appliedCount  / TOTAL_STEPS * 100).toFixed(1);
    const bw    = (benefitsCount / TOTAL_STEPS * 100).toFixed(1);
    const ww    = (widthCount    / TOTAL_STEPS * 100).toFixed(1);
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
          <div class="summary-segment" style="width:${bw}%;background:var(--green)"     title="AI Benefits (${benefitsCount}/3)"></div>
          <div class="summary-segment" style="width:${ww}%;background:var(--blue,#4a90d9)" title="Width (${widthCount}/2)"></div>
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

  const found = findById(id);
  if (!found) return;
  const { entity: client, save: saveEntity, isPartner: entityIsPartner } = found;

  if (field.startsWith('permissions.')) {
    const key = field.slice('permissions.'.length);
    client.permissions[key] = el.checked;
  } else if (field.startsWith('aiApplied.')) {
    const key = field.slice('aiApplied.'.length);
    client.aiApplied[key] = el.checked;
  } else if (field.startsWith('aiBenefits.')) {
    const key = field.slice('aiBenefits.'.length);
    client.aiBenefits[key] = el.checked;
  } else if (field.startsWith('width.')) {
    const key = field.slice('width.'.length);
    client.width[key] = el.checked;
  } else {
    client[field] = el.checked;
  }

  saveEntity();
  if (entityIsPartner) renderPartnersTable();
  else renderTable();
}

function onTableBlur(e) {
  const el = e.target;
  if (!el.classList.contains('client-name')) return;
  const { id } = el.dataset;
  const found = findById(id);
  if (!found) return;
  const { entity: client, save: saveEntity, isPartner: entityIsPartner } = found;

  const newName = el.textContent.trim();
  if (!newName) {
    el.textContent = client.name; // revert blank
    return;
  }
  if (newName !== client.name) {
    client.name = newName;
    saveEntity();
    if (entityIsPartner) {
      updatePartnersStats();
    } else {
      renderSummary();
      updateStats();
    }
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
    const found = findById(id);
    if (found) {
      const { entity: client, save: saveEntity, isPartner: entityIsPartner } = found;
      const next = (CLASSIFICATIONS.indexOf(client.classification) + 1) % CLASSIFICATIONS.length;
      client.classification = CLASSIFICATIONS[next];
      saveEntity();
      if (entityIsPartner) renderPartnersTable();
      else {
        renderTable();
        if (document.getElementById('tab-summary').classList.contains('active')) renderSummary();
      }
    }
    return;
  }

  // Limitations
  const limBtn = e.target.closest('[data-action="open-limitations"]');
  if (limBtn) {
    openLimitationsModal(limBtn.dataset.id);
    return;
  }

  // Tools
  const toolBtn = e.target.closest('[data-action="open-tools"]');
  if (toolBtn) {
    openToolsModal(toolBtn.dataset.id);
    return;
  }

  // Attention
  const attBtn = e.target.closest('[data-action="open-attention"]');
  if (attBtn) {
    openAttentionModal(attBtn.dataset.id);
    return;
  }

  // Partner clients
  const pcBtn = e.target.closest('[data-action="open-partner-clients"]');
  if (pcBtn) {
    openPartnerClientsModal(pcBtn.dataset.id);
    return;
  }

  // Highlight story
  const hsBtn = e.target.closest('[data-action="open-highlight-story"]');
  if (hsBtn) {
    openHighlightStoryModal(hsBtn.dataset.id);
    return;
  }

  // Delete
  const btn = e.target.closest('.btn-delete');
  if (!btn) return;
  const { id } = btn.dataset;
  const found = findById(id);
  const name  = found ? found.entity.name : 'this entry';

  if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
  if (found && found.isPartner) {
    partners = partners.filter(p => p.id !== id);
    savePartners();
    renderPartnersTable();
  } else {
    clients = clients.filter(c => c.id !== id);
    saveData();
    renderTable();
    renderSummary();
  }
}

/* ── Limitations Modal ────────────────────────────────────── */
function openLimitationsModal(clientId) {
  const found = findById(clientId);
  if (!found) return;
  const { entity: client } = found;

  const overlay = document.getElementById('limitations-overlay');
  document.getElementById('limitations-title').textContent =
    `Limitations: ${anonymised ? 'Entity' : client.name}`;

  const list = document.getElementById('limitations-list');
  list.innerHTML = LIMITATION_GROUPS.map(group => `
    <div class="limitations-group">
      <div class="limitations-subtitle">${escapeHtml(group.subtitle)}</div>
      ${group.items.map(l => `
        <label class="limitations-item">
          <input type="checkbox"
                 data-lim-id="${escapeHtml(client.id)}"
                 data-limitation="${l.key}"
                 ${client.limitations[l.key] ? 'checked' : ''} />
          ${escapeHtml(l.label)}
        </label>`).join('')}
    </div>`).join('');

  list.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', () => {
      const innerFound = findById(cb.dataset.limId);
      if (!innerFound) return;
      const { entity: c, save: saveEntity } = innerFound;
      c.limitations[cb.dataset.limitation] = cb.checked;
      const hasLimits = LIMITATIONS.some(l => c.limitations[l.key]);
      const iconBtn = document.querySelector(
        `[data-action="open-limitations"][data-id="${CSS.escape(c.id)}"]`);
      if (iconBtn) {
        iconBtn.classList.toggle('has-limits', hasLimits);
        iconBtn.title = hasLimits ? 'Limitations identified' : 'No limitations set';
      }
      saveEntity();
    });
  });

  overlay.classList.add('active');
  document.getElementById('limitations-close').focus();
}

function closeLimitationsModal() {
  document.getElementById('limitations-overlay').classList.remove('active');
}

/* ── Tools Modal ──────────────────────────────────────────── */
function openToolsModal(clientId) {
  const found = findById(clientId);
  if (!found) return;
  const { entity: client } = found;

  const overlay = document.getElementById('tools-overlay');
  document.getElementById('tools-title').textContent =
    `Tools: ${anonymised ? 'Entity' : client.name}`;

  const list = document.getElementById('tools-list');
  list.innerHTML = TOOL_ITEMS.map(t => `
    <label class="limitations-item">
      <input type="checkbox"
             data-tool-id="${escapeHtml(client.id)}"
             data-tool="${t.key}"
             ${client.tools[t.key] ? 'checked' : ''} />
      ${escapeHtml(t.label)}
    </label>`).join('');

  list.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', () => {
      const innerFound = findById(cb.dataset.toolId);
      if (!innerFound) return;
      const { entity: c, save: saveEntity } = innerFound;
      c.tools[cb.dataset.tool] = cb.checked;
      const hasTools = TOOL_ITEMS.some(t => c.tools[t.key]);
      const iconBtn = document.querySelector(
        `[data-action="open-tools"][data-id="${CSS.escape(c.id)}"]`);
      if (iconBtn) {
        iconBtn.classList.toggle('has-tools', hasTools);
        iconBtn.title = hasTools ? 'Tools tracked' : 'No tools tracked';
      }
      saveEntity();
    });
  });

  overlay.classList.add('active');
  document.getElementById('tools-close').focus();
}

function closeToolsModal() {
  document.getElementById('tools-overlay').classList.remove('active');
}

/* ── Attention Modal ─────────────────────────────────────────── */
function openAttentionModal(clientId) {
  const found = findById(clientId);
  if (!found) return;
  const { entity: client } = found;

  const overlay = document.getElementById('attention-overlay');
  document.getElementById('attention-title').textContent =
    `Attention: ${anonymised ? 'Entity' : client.name}`;

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
      const innerFound = findById(cb.dataset.attId);
      if (!innerFound) return;
      const { entity: c, save: saveEntity } = innerFound;
      c.attention[cb.dataset.attention] = cb.checked;
      const hasAttention = ATTENTION_ITEMS.some(a => c.attention[a.key]);
      const iconBtn = document.querySelector(
        `[data-action="open-attention"][data-id="${CSS.escape(c.id)}"]`);
      if (iconBtn) {
        iconBtn.classList.toggle('has-attention', hasAttention);
        iconBtn.title = hasAttention ? 'Attention: action required' : 'No attention items';
      }
      saveEntity();
    });
  });

  overlay.classList.add('active');
  document.getElementById('attention-close').focus();
}

function closeAttentionModal() {
  document.getElementById('attention-overlay').classList.remove('active');
}

/* ── Partner Clients Modal ─────────────────────────────────── */
function openPartnerClientsModal(partnerId) {
  const found = findById(partnerId);
  if (!found) return;
  const { entity: partner } = found;

  const overlay = document.getElementById('partner-clients-overlay');
  document.getElementById('partner-clients-title').textContent =
    `Clients: ${anonymised ? 'Partner' : partner.name}`;
  overlay.dataset.partnerId = partnerId;

  renderPartnerClientsList(partner);

  const input = document.getElementById('partner-clients-input');
  input.value = '';
  overlay.classList.add('active');
  requestAnimationFrame(() => input.focus());
}

function renderPartnerClientsList(partner) {
  const list = document.getElementById('partner-clients-list');
  if (partner.partnerClients.length === 0) {
    list.innerHTML = '<p class="partner-clients-empty">No clients linked yet.</p>';
    return;
  }
  list.innerHTML = partner.partnerClients.map((name, idx) => `
    <div class="partner-client-item">
      <span>${escapeHtml(name)}</span>
      <button class="btn-remove-client" data-idx="${idx}" aria-label="Remove ${escapeHtml(name)}">✕</button>
    </div>`).join('');

  list.querySelectorAll('.btn-remove-client').forEach(btn => {
    btn.addEventListener('click', () => {
      const overlay = document.getElementById('partner-clients-overlay');
      const pid = overlay.dataset.partnerId;
      const innerFound = findById(pid);
      if (!innerFound) return;
      const { entity: p, save: saveEntity } = innerFound;
      p.partnerClients.splice(Number(btn.dataset.idx), 1);
      saveEntity();
      updatePartnerClientsButton(p);
      renderPartnerClientsList(p);
    });
  });
}

function addPartnerClient() {
  const overlay = document.getElementById('partner-clients-overlay');
  const pid = overlay.dataset.partnerId;
  const found = findById(pid);
  if (!found) return;
  const { entity: partner, save: saveEntity } = found;
  const input = document.getElementById('partner-clients-input');
  const name = input.value.trim();
  if (!name) { input.focus(); return; }
  if (!partner.partnerClients.includes(name)) {
    partner.partnerClients.push(name);
    saveEntity();
    updatePartnerClientsButton(partner);
  }
  input.value = '';
  input.focus();
  renderPartnerClientsList(partner);
}

function updatePartnerClientsButton(partner) {
  const btn = document.querySelector(
    `[data-action="open-partner-clients"][data-id="${CSS.escape(partner.id)}"]`);
  if (!btn) return;
  const count = partner.partnerClients.length;
  btn.classList.toggle('has-clients', count > 0);
  btn.title = count > 0 ? `${count} client(s) linked` : 'No clients linked';
}

function closePartnerClientsModal() {
  document.getElementById('partner-clients-overlay').classList.remove('active');
}

/* ── Highlight Story Modal ──────────────────────────────────── */
function openHighlightStoryModal(partnerId) {
  const found = findById(partnerId);
  if (!found) return;
  const { entity: partner } = found;

  const overlay = document.getElementById('highlight-story-overlay');
  document.getElementById('highlight-story-title').textContent =
    `Highlight Story: ${anonymised ? 'Person' : partner.name}`;
  overlay.dataset.partnerId = partnerId;

  document.getElementById('highlight-story-textarea').value = partner.highlightStory || '';

  overlay.classList.add('active');
  requestAnimationFrame(() => document.getElementById('highlight-story-textarea').focus());
}

function saveHighlightStory() {
  const overlay = document.getElementById('highlight-story-overlay');
  const pid = overlay.dataset.partnerId;
  const found = findById(pid);
  if (!found) return;
  const { entity: partner, save: saveEntity } = found;
  partner.highlightStory = document.getElementById('highlight-story-textarea').value.trim();
  saveEntity();

  const iconBtn = document.querySelector(
    `[data-action="open-highlight-story"][data-id="${CSS.escape(partner.id)}"]`);
  if (iconBtn) {
    iconBtn.classList.toggle('has-story', !!partner.highlightStory);
    iconBtn.title = partner.highlightStory ? 'Highlight story recorded' : 'No highlight story yet';
  }
  closeHighlightStoryModal();
}

function closeHighlightStoryModal() {
  document.getElementById('highlight-story-overlay').classList.remove('active');
}

/* ── Import / Export ──────────────────────────────────────── */
function exportData() {
  const json = JSON.stringify(clients, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `ai-coverage-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importData(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const parsed = JSON.parse(e.target.result);
      if (!Array.isArray(parsed)) throw new Error('Expected a JSON array');
      if (!confirm(`Import ${parsed.length} client(s)? This will replace all current data.`)) return;
      clients = parsed.map(normaliseClient);
      saveData();
      renderTable();
      renderSummary();
    } catch (err) {
      alert(`Import failed: ${err.message}`);
    }
  };
  reader.readAsText(file);
}

/* ── Partners Import / Export ─────────────────────────────── */
function exportPartnersData() {
  const json = JSON.stringify(partners, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `ai-coverage-partners-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importPartnersData(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const parsed = JSON.parse(e.target.result);
      if (!Array.isArray(parsed)) throw new Error('Expected a JSON array');
      if (!confirm(`Import ${parsed.length} partner(s)? This will replace all current partner data.`)) return;
      partners = parsed.map(normaliseClient);
      savePartners();
      renderPartnersTable();
    } catch (err) {
      alert(`Import failed: ${err.message}`);
    }
  };
  reader.readAsText(file);
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

/* ── Add Partner Modal ─────────────────────────────────────── */
function openAddPartnerModal() {
  const overlay = document.getElementById('partner-modal-overlay');
  const input   = document.getElementById('new-partner-name');
  overlay.classList.add('active');
  input.value = '';
  requestAnimationFrame(() => input.focus());
}

function closeAddPartnerModal() {
  document.getElementById('partner-modal-overlay').classList.remove('active');
}

function confirmAddPartner() {
  const input = document.getElementById('new-partner-name');
  const name  = input.value.trim();
  if (!name) {
    input.focus();
    return;
  }
  partners.push(createPartner(name));
  savePartners();
  renderPartnersTable();
  closeAddPartnerModal();
}

/* ── Anonymize toggle ──────────────────────────────────────── */
function toggleAnonymize() {
  anonymised = !anonymised;
  ['anon-toggle', 'partners-anon-toggle'].forEach(id => {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.setAttribute('aria-pressed', String(anonymised));
    btn.classList.toggle('active', anonymised);
  });
  const searchInput = document.getElementById('search-input');
  searchInput.disabled = anonymised;
  searchInput.placeholder = anonymised ? 'Search disabled while anonymised' : 'Search clients…';
  const partnersSearchInput = document.getElementById('partners-search-input');
  partnersSearchInput.disabled = anonymised;
  partnersSearchInput.placeholder = anonymised ? 'Search disabled while anonymised' : 'Search partners…';
  renderTable();
  renderPartnersTable();
  if (document.getElementById('tab-summary').classList.contains('active')) renderSummary();
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
  if (tabId === 'partners') renderPartnersTable();
}

/* ── Bootstrap ─────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  loadData();
  loadPartners();
  renderTable();
  renderPartnersTable();

  /* Tab switching */
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  /* Toolbar */
  document.getElementById('add-client-btn').addEventListener('click', openModal);
  document.getElementById('search-input').addEventListener('input', renderTable);
  document.getElementById('export-btn').addEventListener('click', exportData);
  document.getElementById('import-btn').addEventListener('click', () => {
    const input = document.getElementById('import-file-input');
    input.value = '';
    input.click();
  });
  document.getElementById('import-file-input').addEventListener('change', (e) => {
    importData(e.target.files[0]);
  });

  /* Anonymize toggle */
  document.getElementById('anon-toggle').addEventListener('click', toggleAnonymize);

  /* Partners toolbar */
  document.getElementById('add-partner-btn').addEventListener('click', openAddPartnerModal);
  document.getElementById('partners-anon-toggle').addEventListener('click', toggleAnonymize);
  document.getElementById('partners-search-input').addEventListener('input', renderPartnersTable);
  document.getElementById('partners-export-btn').addEventListener('click', exportPartnersData);
  document.getElementById('partners-import-btn').addEventListener('click', () => {
    const input = document.getElementById('partners-import-file-input');
    input.value = '';
    input.click();
  });
  document.getElementById('partners-import-file-input').addEventListener('change', (e) => {
    importPartnersData(e.target.files[0]);
  });

  /* Limitations modal */
  document.getElementById('limitations-close').addEventListener('click', closeLimitationsModal);
  document.getElementById('limitations-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeLimitationsModal();
  });

  /* Tools modal */
  document.getElementById('tools-close').addEventListener('click', closeToolsModal);
  document.getElementById('tools-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeToolsModal();
  });

  /* Attention modal */
  document.getElementById('attention-close').addEventListener('click', closeAttentionModal);
  document.getElementById('attention-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeAttentionModal();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeLimitationsModal();
      closeToolsModal();
      closeAttentionModal();
      closePartnerClientsModal();
      closeHighlightStoryModal();
      closeModal();
      closeAddPartnerModal();
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

  /* Partner modal */
  document.getElementById('partner-modal-cancel') .addEventListener('click', closeAddPartnerModal);
  document.getElementById('partner-modal-confirm').addEventListener('click', confirmAddPartner);
  document.getElementById('new-partner-name').addEventListener('keydown', e => {
    if (e.key === 'Enter')  confirmAddPartner();
    if (e.key === 'Escape') closeAddPartnerModal();
  });
  document.getElementById('partner-modal-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeAddPartnerModal();
  });

  /* Partner clients modal */
  document.getElementById('partner-clients-close').addEventListener('click', closePartnerClientsModal);
  document.getElementById('partner-clients-add-btn').addEventListener('click', addPartnerClient);
  document.getElementById('partner-clients-input').addEventListener('keydown', e => {
    if (e.key === 'Enter')  addPartnerClient();
    if (e.key === 'Escape') closePartnerClientsModal();
  });
  document.getElementById('partner-clients-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closePartnerClientsModal();
  });

  /* Highlight story modal */
  document.getElementById('highlight-story-close').addEventListener('click', closeHighlightStoryModal);
  document.getElementById('highlight-story-save').addEventListener('click', saveHighlightStory);
  document.getElementById('highlight-story-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeHighlightStoryModal();
  });

  /* Table (delegated) */
  const tbody = document.getElementById('coverage-tbody');
  tbody.addEventListener('change',  onTableChange);
  tbody.addEventListener('blur',    onTableBlur,    { capture: true });
  tbody.addEventListener('keydown', onTableKeydown);
  tbody.addEventListener('click',   onTableClick);

  /* Partners table (delegated) */
  const ptbody = document.getElementById('partners-tbody');
  ptbody.addEventListener('change',  onTableChange);
  ptbody.addEventListener('blur',    onTableBlur,    { capture: true });
  ptbody.addEventListener('keydown', onTableKeydown);
  ptbody.addEventListener('click',   onTableClick);
});
