// =====================
// SUPABASE CONFIG
// =====================
const SUPABASE_URL = 'https://gxbrlbmgdgpxubuumiay.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4YnJsYm1nZGdweHVidXVtaWF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1MDkyNzQsImV4cCI6MjA5MzA4NTI3NH0.9BI49523aYO39yRXwt05ci9kxrxPCYr6T2JZZGc0mus';

// =====================
// SCREEN NAVIGATION
// =====================
function showScreen(id, btn, isMobile) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + id).classList.add('active');
  if (isMobile) {
    document.querySelectorAll('.bnav-tab').forEach(t => t.classList.remove('active'));
  } else {
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  }
  btn.classList.add('active');
  const idx = ['feed', 'perf', 'trades', 'analytics'].indexOf(id);
  document.querySelectorAll('.nav-tab')[idx].classList.toggle('active', true);
  document.querySelectorAll('.bnav-tab')[idx].classList.toggle('active', true);
}

// =====================
// HELPERS
// =====================
function timeAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function formatPrice(val) {
  if (val == null) return '—';
  return '$' + parseFloat(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatConfidence(val) {
  if (val == null) return '—';
  const num = parseFloat(val);
  return (num < 1 ? (num * 100).toFixed(0) : num.toFixed(0)) + '%';
}

function strategyLabel(entryType) {
  const map = {
    'market': 'Market Order', 'limit': 'Limit Entry', 'stop': 'Stop Entry',
    'ema_cross': 'EMA Crossover', 'rsi': 'RSI Signal', 'breakout': 'Breakout',
  };
  if (!entryType) return 'Algo Signal';
  return map[entryType.toLowerCase()] || entryType;
}

// =====================
// RENDER SIGNAL ROW
// =====================
function renderSignalRow(signal) {
  const isBuy = ['buy', 'long'].includes(signal.direction?.toLowerCase());
  const dirClass = isBuy ? 'signal-buy' : 'signal-sell';
  const dirLabel = isBuy ? 'BUY' : 'SELL';
  const badgeClass = isBuy ? 'badge-green' : 'badge-red';
  const price = signal.entry_price != null
    ? parseFloat(signal.entry_price).toLocaleString('en-US', { minimumFractionDigits: 2 })
    : 'Market';
  const confidence = signal.confidence_score != null ? formatConfidence(signal.confidence_score)
    : (signal.ml_probability != null ? formatConfidence(signal.ml_probability) : null);

  return `
    <div class="signal-row">
      <div>
        <div class="signal-pair">${signal.symbol || 'XAU/USD'}</div>
        <div class="signal-meta">${strategyLabel(signal.entry_type)} · ${timeAgo(signal.timestamp)}</div>
      </div>
      <span class="signal-action ${dirClass}">${dirLabel}</span>
      <div class="signal-meta">${price}</div>
      ${confidence ? `<span class="badge ${badgeClass}">${confidence}</span>` : ''}
    </div>
  `;
}

// =====================
// FETCH ACTIVE SIGNAL (top 4 cards)
// =====================
async function loadActiveSignal() {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/signals?status=eq.Active&limit=1`,
      { headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` } }
    );
    const data = await res.json();
    const s = data[0];
    if (!s) return;

    const symbolEl = document.getElementById('stat-symbol');
    const reasonEl = document.getElementById('stat-reason');
    const directionEl = document.getElementById('stat-signal');
    const confEl = document.getElementById('stat-confidence');

    if (symbolEl) symbolEl.textContent = s.symbol || '—';
    if (reasonEl) reasonEl.textContent = s.reason_code || '—';
    if (directionEl) {
      const isBuy = ['buy', 'long'].includes(s.direction?.toLowerCase());
      directionEl.textContent = s.direction?.toUpperCase() || '—';
      directionEl.style.color = isBuy ? 'var(--green)' : 'var(--red)';
    }
    if (confEl) confEl.textContent = formatConfidence(s.confidence_score);

  } catch (err) {
    console.error('Active signal fetch error:', err);
  }
}

// =====================
// FETCH SIGNAL STREAM (rows below)
// =====================
async function loadSignals() {
  const container = document.getElementById('signal-stream');
  if (!container) return;

  container.innerHTML = `<div style="padding:20px 0;text-align:center;color:var(--text3);font-size:13px;">Loading signals...</div>`;

  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/signals?order=timestamp.desc&limit=4`,
      { headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` } }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const signals = await res.json();

    if (!signals.length) {
      container.innerHTML = `<div style="padding:20px 0;text-align:center;color:var(--text3);font-size:13px;">No signals yet.</div>`;
      return;
    }
    container.innerHTML = signals.map(renderSignalRow).join('');

  } catch (err) {
    console.error('Supabase fetch error:', err);
    container.innerHTML = `<div style="padding:20px 0;text-align:center;color:var(--red);font-size:13px;">Failed to load signals.</div>`;
  }
}

// =====================
// LOAD TRADES SCREEN
// =====================
async function loadTrades() {
  loadOpenTrade();
  loadPastTrades();
}

async function loadOpenTrade() {
  const container = document.getElementById('open-trade-container');
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/orders?status=eq.open&limit=1`,
      { headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` } }
    );
    const data = await res.json();
    const t = data[0];

    const subEl = document.getElementById('trades-sub');

    if (!t) {
      container.innerHTML = `<div class="card" style="text-align:center;padding:2rem;color:var(--text3);">No open trade right now.</div>`;
      if (subEl) subEl.textContent = 'No open positions';
      return;
    }

    if (subEl) subEl.textContent = `1 open position · ${t.symbol}`;

    const isBuy = ['buy', 'long'].includes(t.direction?.toLowerCase());
    const pnlColor = t.pnl > 0 ? 'var(--green)' : t.pnl < 0 ? 'var(--red)' : 'var(--text2)';
    const pnlSign = t.pnl > 0 ? '+' : '';

    let rr = '—';
    if (t.entry_price && t.stop_loss && t.take_profit) {
      const risk = Math.abs(t.entry_price - t.stop_loss);
      const reward = Math.abs(t.take_profit - t.entry_price);
      rr = `1:${(reward / risk).toFixed(1)}`;
    }

    container.innerHTML = `
      <div class="trade-card" style="border-color:rgba(6,214,160,0.25);">
        <div class="trade-header">
          <div>
            <div style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:3px;">${t.symbol} · ${t.direction?.toUpperCase()}</div>
            <div class="trade-pair" style="color:var(--gold)">${t.symbol}</div>
            <div style="font-size:11px;color:var(--text2);margin-top:2px;">${t.order_type || 'Market'} · Opened ${timeAgo(t.opened_at)}</div>
          </div>
          <div>
            <div class="trade-pnl" style="color:${pnlColor}">${t.pnl != null ? pnlSign + '$' + parseFloat(t.pnl).toFixed(2) : '—'}</div>
            <div style="font-size:11px;color:var(--text3);text-align:right;margin-top:2px;">Unrealized P&L</div>
          </div>
        </div>
        <div class="trade-grid">
          <div class="trade-stat"><div class="trade-stat-label">Entry Price</div><div class="trade-stat-val">${formatPrice(t.entry_price)}</div></div>
          <div class="trade-stat"><div class="trade-stat-label">Fill Price</div><div class="trade-stat-val" style="color:var(--gold)">${formatPrice(t.fill_price)}</div></div>
          <div class="trade-stat"><div class="trade-stat-label">R:R</div><div class="trade-stat-val" style="color:var(--gold)">${rr}</div></div>
          <div class="trade-stat"><div class="trade-stat-label">Stop Loss</div><div class="trade-stat-val" style="color:var(--red)">${formatPrice(t.stop_loss)}</div></div>
          <div class="trade-stat"><div class="trade-stat-label">Take Profit</div><div class="trade-stat-val" style="color:var(--green)">${formatPrice(t.take_profit)}</div></div>
          <div class="trade-stat"><div class="trade-stat-label">Order ID</div><div class="trade-stat-val" style="font-size:11px;">${t.broker_order_id || '—'}</div></div>
        </div>
      </div>`;
  } catch (err) {
    console.error('Open trade error:', err);
    document.getElementById('open-trade-container').innerHTML = `<div style="color:var(--red);font-size:13px;padding:12px 0;">Failed to load open trade.</div>`;
  }
}

async function loadPastTrades() {
  const container = document.getElementById('past-trades-container');
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/orders?status=eq.closed&order=closed_at.desc&limit=10`,
      { headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` } }
    );
    const data = await res.json();

    if (!data.length) {
      container.innerHTML = `<div style="padding:16px 0;text-align:center;color:var(--text3);font-size:13px;">No past trades yet.</div>`;
      return;
    }

    container.innerHTML = `
      <table class="log-table">
        <thead>
          <tr>
            <th>Symbol</th>
            <th>Direction</th>
            <th>Entry</th>
            <th>Fill</th>
            <th>P&L</th>
            <th>Closed</th>
          </tr>
        </thead>
        <tbody>
          ${data.map(t => {
            const isBuy = ['buy', 'long'].includes(t.direction?.toLowerCase());
            const pnlColor = t.pnl > 0 ? 'var(--green)' : t.pnl < 0 ? 'var(--red)' : 'var(--text2)';
            const pnlSign = t.pnl > 0 ? '+' : '';
            return `
              <tr>
                <td style="color:var(--gold);font-weight:600;">${t.symbol}</td>
                <td><span class="signal-action ${isBuy ? 'signal-buy' : 'signal-sell'}">${t.direction?.toUpperCase()}</span></td>
                <td>${formatPrice(t.entry_price)}</td>
                <td>${formatPrice(t.fill_price)}</td>
                <td style="color:${pnlColor};font-weight:700;">${t.pnl != null ? pnlSign + '$' + parseFloat(t.pnl).toFixed(2) : '—'}</td>
                <td style="color:var(--text3)">${t.closed_at ? timeAgo(t.closed_at) : '—'}</td>
              </tr>`;
          }).join('')}
        </tbody>
      </table>`;
  } catch (err) {
    console.error('Past trades error:', err);
    container.innerHTML = `<div style="color:var(--red);font-size:13px;padding:12px 0;">Failed to load past trades.</div>`;
  }
}


async function loadAnalytics() {
  loadAnalyticsSignal();
  loadSignalAccuracy();
  loadSystemEvents();
}

async function loadAnalyticsSignal() {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/signals?status=eq.Active&limit=1`,
      { headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` } }
    );
    const data = await res.json();
    const s = data[0];
    if (!s) return;

    const isBuy = ['buy', 'long'].includes(s.direction?.toLowerCase());

    document.getElementById('an-signal-type').textContent = `● ${s.direction?.toUpperCase()} SIGNAL · ${s.status}`;
    document.getElementById('an-signal-type').style.color = isBuy ? 'var(--green)' : 'var(--red)';
    document.getElementById('an-signal-title').textContent = `${s.symbol} ${s.direction?.toUpperCase()} Signal`;
    document.getElementById('an-signal-desc').textContent = s.reason_code
      ? `Reason: ${s.reason_code} · Regime: ${s.ml_regime_label || '—'}`
      : 'Active signal from algo engine.';
    document.getElementById('an-entry').textContent = s.entry_price ? formatPrice(s.entry_price) : 'Market';
    document.getElementById('an-sl').textContent = formatPrice(s.stop_loss);
    document.getElementById('an-tp').textContent = formatPrice(s.take_profit);
    document.getElementById('an-conf').textContent = formatConfidence(s.confidence_score);
    document.getElementById('an-entry-type').textContent = strategyLabel(s.entry_type);
    document.getElementById('an-regime').textContent = s.ml_regime_label || '—';
    document.getElementById('an-mlprob').textContent = formatConfidence(s.ml_probability);
    document.getElementById('an-valid').textContent = s.valid_until
      ? new Date(s.valid_until).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';

    // R:R calculation
    if (s.entry_price && s.stop_loss && s.take_profit) {
      const risk = Math.abs(s.entry_price - s.stop_loss);
      const reward = Math.abs(s.take_profit - s.entry_price);
      document.getElementById('an-rr').textContent = `1:${(reward / risk).toFixed(1)}`;
    }
  } catch (err) { console.error('Analytics signal error:', err); }
}

async function loadSignalAccuracy() {
  const container = document.getElementById('signal-accuracy-list');
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/signals?select=symbol,direction,confidence_score,timestamp&order=timestamp.desc&limit=6`,
      { headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` } }
    );
    const data = await res.json();
    if (!data.length) { container.innerHTML = '<div style="color:var(--text3);font-size:12px;padding:8px 0;">No signals yet.</div>'; return; }

    container.innerHTML = data.map(s => {
      const conf = s.confidence_score != null ? parseFloat(s.confidence_score) : null;
      const pct = conf != null ? (conf < 1 ? conf * 100 : conf) : null;
      const color = pct >= 70 ? 'var(--green)' : pct >= 50 ? 'var(--gold)' : 'var(--red)';
      const isBuy = ['buy', 'long'].includes(s.direction?.toLowerCase());
      return `
        <div class="exec-row">
          <span style="font-family:var(--mono);font-size:11px;">${s.symbol} <span style="color:${isBuy ? 'var(--green)' : 'var(--red)'}">${s.direction?.toUpperCase()}</span></span>
          <span style="font-family:var(--mono);font-size:11px;color:${color}">${pct != null ? pct.toFixed(0) + '%' : '—'}</span>
        </div>`;
    }).join('');
  } catch (err) { console.error('Signal accuracy error:', err); }
}

async function loadSystemEvents() {
  const container = document.getElementById('system-events-log');
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/system_events?order=created_at.desc&limit=10`,
      { headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` } }
    );
    const data = await res.json();
    if (!data.length) { container.innerHTML = '<div style="padding:20px 0;text-align:center;color:var(--text3);font-size:13px;">No events yet.</div>'; return; }

    const severityColor = { info: 'var(--blue)', warning: 'var(--gold)', error: 'var(--red)' };
    const severityBadge = { info: 'badge-blue', warning: 'badge-gold', error: 'badge-red' };

    container.innerHTML = data.map(e => {
      const color = severityColor[e.severity] || 'var(--text2)';
      const badge = severityBadge[e.severity] || 'badge-blue';
      const payload = e.payload && Object.keys(e.payload).length
        ? Object.entries(e.payload).map(([k, v]) => `${k}: ${v}`).join(' · ')
        : null;
      return `
        <div class="algo-entry">
          <div class="algo-time">${new Date(e.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
          <div class="algo-content">
            <div class="algo-action" style="color:${color}">${e.event_type?.replace(/_/g, ' ')}</div>
            ${payload ? `<div class="algo-detail">${payload}</div>` : ''}
          </div>
          <span class="badge ${badge}" style="align-self:flex-start;text-transform:uppercase;">${e.severity}</span>
        </div>`;
    }).join('');
  } catch (err) { console.error('System events error:', err); }
}

// =====================
// INIT
// =====================
document.addEventListener('DOMContentLoaded', () => {
  loadActiveSignal();
  loadSignals();
  loadTrades();
  loadAnalytics();
  setInterval(() => { loadActiveSignal(); loadSignals(); loadTrades(); loadAnalytics(); }, 30000);
});