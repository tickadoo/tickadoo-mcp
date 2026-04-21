import type { SqlClient } from "./telemetry.js";

export interface TelemetryDashboardVolume {
  total24h: number;
  bookings24h: number;
  conversion: number;
}

export interface TelemetryDashboardToolRow {
  tool_name: string;
  calls: number;
  errors: number;
  avg_latency_ms: number;
  conversion: number;
}

export interface TelemetryDashboardHostRow {
  host_hint: string;
  calls: number;
}

export interface TelemetryDashboardCityRow {
  city: string | null;
  calls: number;
}

export interface TelemetryDashboardProductRow {
  slug: string;
  shown: number;
}

export interface TelemetryDashboardPayload {
  volume: TelemetryDashboardVolume;
  byTool: TelemetryDashboardToolRow[];
  byHost: TelemetryDashboardHostRow[];
  byCity: TelemetryDashboardCityRow[];
  topProducts: TelemetryDashboardProductRow[];
}

export const TELEMETRY_DASHBOARD_HTML = String.raw`<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>tickadoo telemetry</title>
<style>
  body{font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;max-width:1200px;margin:20px auto;padding:0 20px;color:#111}
  h1{font-size:20px;margin:0 0 20px}
  h2{font-size:15px;margin:28px 0 8px;color:#555;font-weight:600}
  table{border-collapse:collapse;width:100%;font-size:13px}
  th,td{border-bottom:1px solid #eee;padding:6px 10px;text-align:left}
  th{background:#f6f6f7;font-weight:600}
  .num{text-align:right;font-variant-numeric:tabular-nums}
  .muted{color:#888}
  #login{display:none;margin:40px 0;padding:20px;border:1px solid #eee;border-radius:6px;max-width:420px}
  #login input{padding:8px 10px;font:inherit;width:100%;box-sizing:border-box;margin:8px 0}
  #login button{padding:8px 16px;font:inherit;cursor:pointer}
  #main{display:none}
</style></head><body>
<h1>tickadoo agent telemetry <span class="muted">last 24h</span></h1>
<div id="login">
  <p>Enter admin token to view telemetry.</p>
  <input id="tokenInput" type="password" autocomplete="current-password" placeholder="admin token">
  <button id="tokenSubmit" type="button">Unlock</button>
  <p id="loginError" class="muted"></p>
</div>
<div id="main">
<h2>Volume</h2>
<table id="volume"><thead><tr><th>metric</th><th class="num">value</th></tr></thead><tbody></tbody></table>
<h2>Calls by tool (24h)</h2>
<table id="byTool"><thead><tr><th>tool</th><th class="num">calls</th><th class="num">errors</th><th class="num">avg latency</th><th class="num">conversion</th></tr></thead><tbody></tbody></table>
<h2>Calls by host (24h)</h2>
<table id="byHost"><thead><tr><th>host</th><th class="num">calls</th></tr></thead><tbody></tbody></table>
<h2>Top cities (7d)</h2>
<table id="byCity"><thead><tr><th>city</th><th class="num">calls</th></tr></thead><tbody></tbody></table>
<h2>Top products shown (7d)</h2>
<table id="topProducts"><thead><tr><th>slug</th><th class="num">shown</th></tr></thead><tbody></tbody></table>
</div>
<script>
(function () {
  var TOKEN_KEY = 'tickadoo_admin_token';
  var login = document.getElementById('login');
  var main = document.getElementById('main');
  var loginError = document.getElementById('loginError');
  var tokenInput = document.getElementById('tokenInput');
  var tokenSubmit = document.getElementById('tokenSubmit');

  function showLogin(message) {
    login.style.display = 'block';
    main.style.display = 'none';
    loginError.textContent = message || '';
    tokenInput.value = '';
    tokenInput.focus();
  }

  function showDashboard() {
    login.style.display = 'none';
    main.style.display = 'block';
  }

  function addRow(selector, cells) {
    var tr = document.createElement('tr');
    cells.forEach(function (cell, index) {
      var td = document.createElement('td');
      td.textContent = String(cell);
      if (index > 0) td.className = 'num';
      tr.appendChild(td);
    });
    document.querySelector(selector + ' tbody').appendChild(tr);
  }

  function clearTables() {
    ['#volume', '#byTool', '#byHost', '#byCity', '#topProducts'].forEach(function (selector) {
      var tbody = document.querySelector(selector + ' tbody');
      while (tbody.firstChild) tbody.removeChild(tbody.firstChild);
    });
  }

  function renderDashboard(data) {
    clearTables();
    addRow('#volume', ['total calls 24h', data.volume.total24h]);
    addRow('#volume', ['bookings 24h', data.volume.bookings24h]);
    addRow('#volume', ['conversion 24h', (data.volume.conversion * 100).toFixed(2) + '%']);
    data.byTool.forEach(function (row) {
      addRow('#byTool', [row.tool_name, row.calls, row.errors, row.avg_latency_ms + 'ms', (row.conversion * 100).toFixed(1) + '%']);
    });
    data.byHost.forEach(function (row) { addRow('#byHost', [row.host_hint, row.calls]); });
    data.byCity.forEach(function (row) { addRow('#byCity', [row.city || '(unknown)', row.calls]); });
    data.topProducts.forEach(function (row) { addRow('#topProducts', [row.slug, row.shown]); });
  }

  function load(token) {
    fetch('/admin/telemetry.json', {
      headers: { 'Authorization': 'Bearer ' + token },
      cache: 'no-store',
    }).then(function (response) {
      if (response.status === 401) {
        try { sessionStorage.removeItem(TOKEN_KEY); } catch (e) {}
        showLogin('Invalid token.');
        return null;
      }
      if (!response.ok) {
        throw new Error('HTTP ' + response.status);
      }
      return response.json();
    }).then(function (data) {
      if (data) {
        showDashboard();
        renderDashboard(data);
      }
    }).catch(function (error) {
      var p = document.createElement('p');
      p.className = 'muted';
      p.textContent = 'Failed to load telemetry: ' + String(error);
      main.appendChild(p);
      showDashboard();
    });
  }

  tokenSubmit.addEventListener('click', function () {
    var token = tokenInput.value.trim();
    if (!token) return;
    try { sessionStorage.setItem(TOKEN_KEY, token); } catch (e) {}
    load(token);
  });
  tokenInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') tokenSubmit.click();
  });

  var stored = null;
  try { stored = sessionStorage.getItem(TOKEN_KEY); } catch (e) {}
  if (stored) {
    load(stored);
  } else {
    showLogin('');
  }
})();
</script></body></html>`;

export async function fetchTelemetryDashboard(sql: SqlClient): Promise<TelemetryDashboardPayload> {
  const volumeRows = await sql<{ total24h: number; bookings24h: number }>`
    SELECT
      (SELECT count(*)::int FROM agent_calls WHERE created_at > now() - interval '24 hours') AS total24h,
      (SELECT count(*)::int FROM agent_call_bookings WHERE booked_at > now() - interval '24 hours') AS bookings24h
  `;
  const volumeBase = volumeRows[0] ?? { total24h: 0, bookings24h: 0 };
  const volume = {
    ...volumeBase,
    conversion: volumeBase.total24h > 0 ? volumeBase.bookings24h / volumeBase.total24h : 0,
  };

  const byTool = await sql<TelemetryDashboardToolRow>`
    SELECT
      ac.tool_name,
      count(*)::int AS calls,
      count(*) FILTER (WHERE ac.is_error)::int AS errors,
      coalesce(round(avg(ac.latency_ms))::int, 0) AS avg_latency_ms,
      coalesce((count(DISTINCT acb.booking_id)::real / NULLIF(count(*), 0)::real), 0) AS conversion
    FROM agent_calls ac
    LEFT JOIN agent_call_bookings acb ON acb.agent_call_id = ac.id
    WHERE ac.created_at > now() - interval '24 hours'
    GROUP BY ac.tool_name
    ORDER BY calls DESC
  `;

  const byHost = await sql<TelemetryDashboardHostRow>`
    SELECT host_hint, count(*)::int AS calls
    FROM agent_calls
    WHERE created_at > now() - interval '24 hours'
    GROUP BY host_hint
    ORDER BY calls DESC
  `;

  const byCity = await sql<TelemetryDashboardCityRow>`
    SELECT input_args->>'city' AS city, count(*)::int AS calls
    FROM agent_calls
    WHERE created_at > now() - interval '7 days' AND input_args ? 'city'
    GROUP BY city
    ORDER BY calls DESC
    LIMIT 20
  `;

  const topProducts = await sql<TelemetryDashboardProductRow>`
    SELECT unnest(ac.top_product_ids) AS slug, count(*)::int AS shown
    FROM agent_calls ac
    WHERE ac.created_at > now() - interval '7 days'
    GROUP BY slug
    ORDER BY shown DESC
    LIMIT 20
  `;

  return { volume, byTool, byHost, byCity, topProducts };
}
