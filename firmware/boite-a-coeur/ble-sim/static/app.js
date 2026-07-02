const scanBtn = document.getElementById("scanBtn");
const disconnectBtn = document.getElementById("disconnectBtn");
const sendBtn = document.getElementById("sendBtn");
const deviceList = document.getElementById("deviceList");
const deviceEmpty = document.getElementById("deviceEmpty");
const statusLine = document.getElementById("statusLine");
const statusText = document.getElementById("statusText");
const logEl = document.getElementById("log");
const ssidInput = document.getElementById("ssid");
const passwordInput = document.getElementById("password");
const formatSelect = document.getElementById("format");
const showAllInput = document.getElementById("showAll");

let polling = false;

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || res.statusText);
  }
  return data;
}

function renderDevices(devices) {
  deviceList.innerHTML = "";
  if (!devices || devices.length === 0) {
    deviceEmpty.style.display = "block";
    return;
  }
  deviceEmpty.style.display = "none";
  for (const d of devices) {
    const li = document.createElement("li");
    const meta = document.createElement("div");
    meta.className = "device-meta";
    const name = document.createElement("strong");
    name.textContent = d.name || d.address;
    const sub = document.createElement("span");
    const rssi = d.rssi != null ? `RSSI ${d.rssi} dBm` : "RSSI n/a";
    sub.textContent = `${d.address} — ${rssi}`;
    meta.appendChild(name);
    meta.appendChild(sub);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "Connect";
    btn.addEventListener("click", () => connectDevice(d.address, btn));
    li.appendChild(meta);
    li.appendChild(btn);
    deviceList.appendChild(li);
  }
}

function renderLogs(logs) {
  if (!logs || logs.length === 0) {
    logEl.textContent = "";
    return;
  }
  logEl.innerHTML = logs
    .map((e) => {
      const t = new Date(e.ts * 1000).toLocaleTimeString();
      const cls = e.level === "error" ? "error" : "info";
      return `<span class="${cls}">[${t}] ${escapeHtml(e.message)}</span>`;
    })
    .join("\n");
  logEl.scrollTop = logEl.scrollHeight;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderStatus(status) {
  const connected = status.connected;
  statusLine.classList.toggle("connected", connected);
  if (connected) {
    statusText.textContent = `Connected — ${status.name || status.address}`;
  } else {
    statusText.textContent = "Disconnected";
  }
  disconnectBtn.disabled = !connected;
  sendBtn.disabled = !connected;
  renderDevices(status.devices);
  renderLogs(status.logs);
}

async function refreshStatus() {
  const status = await api("/api/status");
  renderStatus(status);
}

async function connectDevice(address, btn) {
  btn.disabled = true;
  btn.textContent = "Connecting...";
  try {
    await api("/api/connect", {
      method: "POST",
      body: JSON.stringify({ address }),
    });
    await refreshStatus();
  } catch (err) {
    console.error(err);
    alert(err.message);
    btn.disabled = false;
    btn.textContent = "Connect";
  }
}

scanBtn.addEventListener("click", async () => {
  scanBtn.disabled = true;
  scanBtn.textContent = "Scanning...";
  try {
    const data = await api("/api/scan", {
      method: "POST",
      body: JSON.stringify({
        timeout: 12,
        show_all: !!(showAllInput && showAllInput.checked),
      }),
    });
    renderDevices(data.devices);
    await refreshStatus();
  } catch (err) {
    console.error(err);
    alert(err.message);
  } finally {
    scanBtn.disabled = false;
    scanBtn.textContent = "Scan";
  }
});

disconnectBtn.addEventListener("click", async () => {
  try {
    await api("/api/disconnect", { method: "POST", body: "{}" });
    await refreshStatus();
  } catch (err) {
    console.error(err);
    alert(err.message);
  }
});

sendBtn.addEventListener("click", async () => {
  sendBtn.disabled = true;
  try {
    await api("/api/provision", {
      method: "POST",
      body: JSON.stringify({
        ssid: ssidInput.value,
        password: passwordInput.value,
        format: formatSelect.value,
      }),
    });
    await refreshStatus();
  } catch (err) {
    console.error(err);
    alert(err.message);
  } finally {
    sendBtn.disabled = false;
    await refreshStatus();
  }
});

function startPolling() {
  if (polling) return;
  polling = true;
  const tick = async () => {
    try {
      await refreshStatus();
    } catch (err) {
      console.error(err);
    }
    setTimeout(tick, 1500);
  };
  tick();
}

startPolling();
