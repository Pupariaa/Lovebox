const ESPRESSIF_VID = 0x303a;
const SERIAL_BAUD = 921600;
const SERIAL_BAUD_FALLBACK = 115200;
const DEFAULT_CHUNK_BYTES = 119;
const MAX_CHUNK_BYTES = 768;
const BAC_MAX_LINE_DEFAULT = 1100;
const TOKEN_REFRESH_MS = 240000;
const LINE_TIMEOUT_MS = 8000;
const API = '/api/v1';
const SERIAL_RE = /^BACXS32[A-Z0-9]+R[12]$/i;

const UX = {
  connectPause: 900,
  identifyPause: 1100,
  stepTransition: 800,
  releasesMin: 1400,
  analyzeWarmup: 1200,
  analyzePerCheck: 380,
  analyzeFinish: 1000,
  flashPrepare: 800,
};

const CHECK_LABELS = {
  serial: 'Numéro de série',
  uuid: 'Identifiant interne',
  wifi_config: 'Wi-Fi configuré',
  wifi_link: 'Connexion Wi-Fi',
  configured: 'Configuration',
  claimed: 'Compte associé',
  cloud_secret: 'Liaison serveur',
  heap: 'Mémoire disponible',
  psram: 'Mémoire étendue',
  ffat: 'Stockage interne',
  mode_idle: 'État de la boîte',
  ota_busy: 'Mise à jour',
  ota_verify: 'Vérification firmware',
  assets: 'Assets graphiques',
};

const ANALYZE_STATUS = {
  serial: 'Lecture de l\'identité…',
  uuid: 'Vérification interne…',
  wifi_config: 'Analyse du Wi-Fi…',
  wifi_link: 'Test de connexion…',
  configured: 'Lecture de la configuration…',
  claimed: 'Vérification du compte…',
  cloud_secret: 'Contrôle serveur…',
  heap: 'Mesure de la mémoire…',
  psram: 'Contrôle mémoire étendue…',
  ffat: 'Lecture du stockage…',
  mode_idle: 'État de fonctionnement…',
  ota_busy: 'Vérification mise à jour…',
  ota_verify: 'Validation firmware…',
  assets: 'Contrôle des assets…',
};

const $ = (id) => document.getElementById(id);

const logEl = $('log');
const connState = $('connState');
const statusRing = $('statusRing');
const activityLine = $('activityLine');
const deviceCard = $('deviceCard');
const metaDevice = $('metaDevice');
const metaSerial = $('metaSerial');
const metaFw = $('metaFw');
const analyzeLoader = $('analyzeLoader');
const analyzeLoaderText = $('analyzeLoaderText');
const analyzeHero = $('analyzeHero');
const analyzeHeroIcon = $('analyzeHeroIcon');
const analyzeHeroTitle = $('analyzeHeroTitle');
const analyzeHeroText = $('analyzeHeroText');
const analyzeChecks = $('analyzeChecks');
const fwMeta = $('fwMeta');
const flashState = $('flashState');
const progressWrap = $('progressWrap');
const progressBar = $('progressBar');
const progressPct = $('progressPct');
const progressMetrics = $('progressMetrics');
const releaseSelect = $('releaseSelect');
const panelLive = $('panelLive');
const liveTitle = $('liveTitle');
const livePhase = $('livePhase');
const liveFeed = $('liveFeed');
const livePct = $('livePct');
const liveBytes = $('liveBytes');
const liveSpeed = $('liveSpeed');
const liveEta = $('liveEta');

const btnConnect = $('btnConnect');
const btnDisconnect = $('btnDisconnect');
const btnAnalyze = $('btnAnalyze');
const btnFlash = $('btnFlash');
const btnAbort = $('btnAbort');
const btnReanalyze = $('btnReanalyze');

const panels = [...document.querySelectorAll('.panel')];
const stepLine1 = $('stepLine1');
const stepLine2 = $('stepLine2');
const stepEls = [...document.querySelectorAll('.step')];

let port = null;
let reader = null;
let writer = null;
let readLoopActive = false;
let lineQueue = [];
let lineWaiters = [];
let flashing = false;
let abortFlash = false;
let releases = [];
let deviceSerial = null;
let downloadToken = null;
let tokenIssuedAt = 0;
let deviceChunkMax = DEFAULT_CHUNK_BYTES;
let deviceLineMax = BAC_MAX_LINE_DEFAULT;
let activeSerialBaud = SERIAL_BAUD_FALLBACK;
let deviceFwVersion = null;
let deviceAnalyze = { otaBusy: false, modeIdle: true };
let quietChunkLog = false;
let serialExpectDisconnect = false;
let lastProgressUiAt = 0;
let currentStep = 1;
let displayProgress = 0;
const FLASH_BEGIN_TIMEOUT_MS = 120000;

function formatBytes(n) {
  if (n == null || Number.isNaN(n)) return '—';
  if (n >= 1048576) return `${(n / 1048576).toFixed(2)} Mo`;
  if (n >= 1024) return `${Math.round(n / 1024)} Ko`;
  return `${n} o`;
}

function formatSpeed(bps) {
  if (!bps || !Number.isFinite(bps) || bps <= 0) return '—';
  if (bps >= 1048576) return `${(bps / 1048576).toFixed(2)} Mo/s`;
  if (bps >= 1024) return `${Math.round(bps / 1024)} Ko/s`;
  return `${Math.round(bps)} o/s`;
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  if (seconds < 60) return `${Math.max(1, Math.round(seconds))} s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m} min ${String(s).padStart(2, '0')} s`;
}

function liveTime() {
  return new Date().toISOString().slice(11, 19);
}

function pushLiveEvent(text, kind = 'info') {
  const li = document.createElement('li');
  li.className = kind === 'ok' ? 'is-ok' : kind === 'warn' ? 'is-warn' : kind === 'err' ? 'is-err' : kind === 'work' ? 'is-work' : '';
  li.innerHTML = `<time>${liveTime()}</time>${text}`;
  liveFeed.prepend(li);
  while (liveFeed.children.length > 40) liveFeed.lastChild.remove();
}

function setLivePhase(text) {
  livePhase.textContent = text;
}

function setLivePanelVisible(on) {
  panelLive.classList.toggle('hidden', !on);
  panelLive.classList.toggle('is-visible', on);
}

function deviceLineMaxFromPing(fields) {
  const n = parseInt(fields.line_max, 10);
  if (!Number.isFinite(n) || n < 512) return BAC_MAX_LINE_DEFAULT;
  return n;
}

function chunkSizeForBacCommand(cmdPrefix, requested) {
  const overhead = `@BAC ${cmdPrefix} `.length;
  const maxBytes = Math.floor((deviceLineMax - overhead) / 2);
  return Math.max(1, Math.min(requested, maxBytes, MAX_CHUNK_BYTES));
}

function deviceChunkMaxFromPing(fields) {
  const n = parseInt(fields.chunk_max, 10);
  if (!Number.isFinite(n) || n < DEFAULT_CHUNK_BYTES) return DEFAULT_CHUNK_BYTES;
  return Math.min(MAX_CHUNK_BYTES, n);
}

function setTransferProgress(sent, total, startedAt, { force = false } = {}) {
  const now = Date.now();
  if (!force && sent < total && now - lastProgressUiAt < 250) return;
  lastProgressUiAt = now;
  const pct = total > 0 ? Math.max(0, Math.min(100, Math.round((sent / total) * 100))) : 0;
  setProgressVisual(pct);
  const elapsed = Math.max(0.001, (Date.now() - startedAt) / 1000);
  const speed = sent / elapsed;
  const remaining = speed > 0 ? (total - sent) / speed : 0;
  const metrics = `${formatBytes(sent)} / ${formatBytes(total)} · ${formatSpeed(speed)} · ${formatDuration(remaining)} restantes`;
  flashState.textContent = `Installation en cours (${pct} %)`;
  if (progressMetrics) progressMetrics.textContent = metrics;
  livePct.textContent = `${pct} %`;
  liveBytes.textContent = `${formatBytes(sent)} / ${formatBytes(total)}`;
  liveSpeed.textContent = formatSpeed(speed);
  liveEta.textContent = formatDuration(remaining);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isChunkNoise(msg) {
  return msg.includes('FLASH_CHUNK') || msg.includes('chunk written=');
}

function log(msg, { force = false } = {}) {
  if (!force && quietChunkLog && isChunkNoise(msg)) return;
  const ts = new Date().toISOString().slice(11, 19);
  logEl.textContent += `[${ts}] ${msg}\n`;
  if (logEl.textContent.length > 20000) {
    logEl.textContent = logEl.textContent.slice(-12000);
  }
  logEl.scrollTop = logEl.scrollHeight;
}

async function setActivity(text, { pause = 0 } = {}) {
  activityLine.classList.add('is-fading');
  await wait(180);
  activityLine.textContent = text;
  activityLine.classList.remove('is-fading');
  if (pause > 0) await wait(pause);
}

function setRingState(state) {
  statusRing.dataset.state = state;
}

function setStep(step) {
  currentStep = step;
  stepEls.forEach((el) => {
    const n = Number(el.dataset.step);
    el.classList.toggle('is-active', n === step);
    el.classList.toggle('is-done', n < step);
  });
  stepLine1.classList.toggle('is-filled', step > 1);
  stepLine2.classList.toggle('is-filled', step > 2);
}

function setPanel(step) {
  panels.forEach((panel) => {
    const n = Number(panel.dataset.panel);
    const wasVisible = panel.classList.contains('is-visible');
    let visible = false;
    if (step === 1) visible = n === 1;
    else if (step === 2) visible = n <= 2;
    else visible = n >= 2 && n <= 3;

    panel.classList.toggle('is-visible', visible);
    panel.classList.toggle('is-current', n === step);
    panel.classList.toggle('is-past', visible && n < step);

    if (visible && !wasVisible) {
      panel.classList.add('is-entering');
      window.setTimeout(() => panel.classList.remove('is-entering'), 600);
    }
  });
}

async function goToStep(step, activityText) {
  setStep(step);
  setPanel(step);
  if (activityText) await setActivity(activityText, { pause: UX.stepTransition });
  if (step === 3) {
    const updatePanel = $('panelUpdate');
    updatePanel?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

function parsePing(line) {
  const raw = line.replace('@BAC OK ', '');
  const fields = {};
  for (const part of raw.split(/\s+/)) {
    const eq = part.indexOf('=');
    if (eq > 0) fields[part.slice(0, eq)] = part.slice(eq + 1);
  }
  return fields;
}

function parseSerialFromPing(line) {
  const fields = parsePing(line);
  const serial = fields.serial;
  if (!serial || serial === '-') return null;
  return SERIAL_RE.test(serial) ? serial : null;
}

function compareSemver(a, b) {
  if (!a || !b) return -1;
  const pa = a.split(/[.-]/).map((x) => parseInt(x, 10) || 0);
  const pb = b.split(/[.-]/).map((x) => parseInt(x, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const da = pa[i] || 0;
    const db = pb[i] || 0;
    if (da < db) return -1;
    if (da > db) return 1;
  }
  return 0;
}

function pingSupportsAssetsUsb(fields) {
  return fields && fields.assets_usb === '1';
}

function selectedRelease() {
  const id = Number(releaseSelect.value);
  if (!id) return null;
  return releases.find((r) => r.id === id) || null;
}

function updateFlashButton() {
  btnFlash.disabled = !port || !deviceSerial || !selectedRelease() || flashing;
}

function setConnectedUI(on) {
  btnConnect.disabled = on;
  btnDisconnect.classList.toggle('hidden', !on);
  btnDisconnect.disabled = !on;
  btnAnalyze.disabled = !on || flashing;
  releaseSelect.disabled = !on || !deviceSerial || releases.length === 0;
  connState.textContent = on ? 'Connectée' : 'En attente';
  setRingState(on ? 'connected' : 'idle');
  updateFlashButton();
}

function pushLine(line) {
  if (lineWaiters.length > 0) {
    const resolve = lineWaiters.shift();
    resolve(line);
    return;
  }
  lineQueue.push(line);
}

function waitLine(timeoutMs = LINE_TIMEOUT_MS) {
  if (lineQueue.length > 0) {
    return Promise.resolve(lineQueue.shift());
  }
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      const idx = lineWaiters.indexOf(waiter);
      if (idx >= 0) lineWaiters.splice(idx, 1);
      resolve('');
    }, Math.max(1, timeoutMs));
    const waiter = (line) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const idx = lineWaiters.indexOf(waiter);
      if (idx >= 0) lineWaiters.splice(idx, 1);
      resolve(line);
    };
    lineWaiters.push(waiter);
  });
}

async function startReadLoop() {
  if (!port?.readable || readLoopActive) return;
  readLoopActive = true;
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (port.readable && readLoopActive) {
      reader = port.readable.getReader();
      try {
        while (readLoopActive) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let nl;
          while ((nl = buffer.indexOf('\n')) >= 0) {
            const line = buffer.slice(0, nl).replace(/\r$/, '').trim();
            buffer = buffer.slice(nl + 1);
            if (line.length) {
              log(`< ${line}`);
              pushLine(line);
            }
          }
        }
      } finally {
        reader.releaseLock();
        reader = null;
      }
    }
  } catch (err) {
    if (readLoopActive && !(flashing && serialExpectDisconnect)) {
      log(`Erreur de lecture : ${err.message}`);
    }
  } finally {
    readLoopActive = false;
  }
}

async function sendLine(line) {
  if (!writer) throw new Error('Non connecté');
  log(`> ${line}`);
  const data = new TextEncoder().encode(`${line}\n`);
  await writer.write(data);
}

async function sendBac(cmd) {
  await sendLine(`@BAC ${cmd}`);
}

function lineHasPrefix(line, prefix) {
  if (!prefix) return true;
  return line.toLowerCase().includes(String(prefix).toLowerCase());
}

function mapFlashError(message) {
  const msg = String(message || '').toLowerCase();
  if (msg.includes('flash blocked')) {
    return 'La boîte est occupée (mise à jour cloud ou session précédente). Débranchez le Wi-Fi ou attendez 1 min, puis réessayez.';
  }
  if (msg.includes('update begin failed')) {
    return 'Impossible d\'ouvrir l\'écriture flash. Débranchez/rebranchez la boîte puis relancez.';
  }
  if (msg.includes('invalid sha256')) {
    return 'Empreinte firmware invalide côté serveur.';
  }
  if (msg.includes('délai dépassé')) {
    return 'La boîte ne répond pas (effacement flash long ou câble instable). Attendez 2 min ou rebranchez la boîte.';
  }
  if (msg.includes('assets blocked') || msg.includes('psram alloc failed')) {
    return 'Installation assets impossible (boîte occupée ou mémoire insuffisante).';
  }
  if (msg.includes('assets install failed')) {
    return 'Échec écriture assets sur la boîte. Rebranchez et réessayez.';
  }
  return message;
}

async function cleanupFlashSessions() {
  drainLineQueue();
  try {
    await sendBac('ASSETS_ABORT');
    await waitLine(1500);
  } catch (_) {}
  try {
    await sendBac('FLASH_ABORT');
    await waitLine(1500);
  } catch (_) {}
  drainLineQueue();
}

async function expectOk(prefix, timeoutMs = LINE_TIMEOUT_MS, onProgress = null) {
  const deadline = Date.now() + timeoutMs;
  let eraseSeen = false;
  while (Date.now() < deadline) {
    const remaining = Math.max(100, deadline - Date.now());
    if (onProgress) onProgress(Math.ceil(remaining / 1000), eraseSeen);
    const slice = onProgress ? Math.min(1000, remaining) : remaining;
    const line = await waitLine(slice);
    if (!line || !line.startsWith('@BAC')) continue;
    if (line.startsWith('@BAC ERR')) throw new Error(mapFlashError(line.slice(9).trim()));
    if (line.startsWith('@BAC INFO flash_erase')) {
      eraseSeen = true;
      continue;
    }
    if (line.startsWith('@BAC OK')) {
      if (prefix && !lineHasPrefix(line, prefix)) throw new Error('Réponse inattendue de la boîte.');
      return line;
    }
  }
  throw new Error(mapFlashError('Délai dépassé, la boîte ne répond pas.'));
}

function drainLineQueue() {
  lineQueue.length = 0;
}

function setFlashStatus(text) {
  flashState.textContent = text;
  setLivePhase(text);
}

async function stopReadLoop() {
  readLoopActive = false;
  try {
    if (reader) await reader.cancel();
  } catch (_) {}
}

async function reconfigureSerial(baud) {
  await stopReadLoop();
  try {
    if (writer) {
      writer.releaseLock();
      writer = null;
    }
  } catch (_) {}
  try {
    await port.close();
  } catch (_) {}
  await wait(250);
  await port.open({ baudRate: baud });
  activeSerialBaud = baud;
  writer = port.writable.getWriter();
  lineQueue = [];
  lineWaiters = [];
  startReadLoop();
  await wait(300);
  pushLiveEvent(`Port USB ${baud} baud`, 'work');
}

async function openSerialPort(baud = activeSerialBaud) {
  await port.open({ baudRate: baud });
  activeSerialBaud = baud;
  pushLiveEvent(`Port USB ${baud} baud`, 'work');
}

async function tryPing(timeoutMs = 3000) {
  try {
    drainLineQueue();
    await sendBac('PING');
    const pong = await expectOk('PONG', timeoutMs);
    return parsePing(pong);
  } catch (_) {
    return null;
  }
}

async function applyPingFields(fields) {
  deviceChunkMax = deviceChunkMaxFromPing(fields);
  deviceLineMax = deviceLineMaxFromPing(fields);
  deviceFwVersion = fields.fw || deviceFwVersion;
  const wantHigh = Number(fields.chunk_max) >= 512;
  if (wantHigh && activeSerialBaud !== SERIAL_BAUD) {
    await reconfigureSerial(SERIAL_BAUD);
  } else if (!wantHigh && activeSerialBaud !== SERIAL_BAUD_FALLBACK) {
    await reconfigureSerial(SERIAL_BAUD_FALLBACK);
  }
}

async function ensureSerialReady() {
  const live = await tryPing(2500);
  if (live) {
    await applyPingFields(live);
    return live;
  }

  await stopReadLoop();
  try {
    if (writer) {
      writer.releaseLock();
      writer = null;
    }
  } catch (_) {}
  try {
    await port.close();
  } catch (_) {}

  pushLiveEvent('Reconnexion USB…', 'work');
  setFlashStatus('Reconnexion à la boîte…');

  for (let attempt = 0; attempt < 40; attempt++) {
    setFlashStatus(`Reconnexion à la boîte… (${attempt + 1}/40)`);
    await wait(attempt === 0 ? 3000 : 2000);
    for (const baud of [activeSerialBaud, SERIAL_BAUD, SERIAL_BAUD_FALLBACK]) {
      try {
        await port.open({ baudRate: baud });
        activeSerialBaud = baud;
        writer = port.writable.getWriter();
        lineQueue = [];
        lineWaiters = [];
        readLoopActive = false;
        startReadLoop();
        await wait(500);
        drainLineQueue();
        await sendBac('PING');
        const pong = await expectOk('PONG', 8000);
        const fields = parsePing(pong);
        await applyPingFields(fields);
        pushLiveEvent('USB reconnecté', 'ok');
        return fields;
      } catch (_) {
        try {
          await stopReadLoop();
        } catch (_) {}
        try {
          if (writer) {
            writer.releaseLock();
            writer = null;
          }
        } catch (_) {}
        try {
          await port.close();
        } catch (_) {}
      }
    }
  }
  throw new Error('Impossible de reconnecter la boîte en USB.');
}

async function reopenPortAfterReboot() {
  return ensureSerialReady();
}

async function prepareFlashSession(size, sha) {
  drainLineQueue();
  setFlashStatus('Nettoyage de la session précédente…');
  setProgressVisual(1);
  pushLiveEvent('FLASH_ABORT…', 'work');
  try {
    await sendBac('FLASH_ABORT');
    await expectOk('flash_aborted', 5000);
  } catch (_) {}
  drainLineQueue();

  setFlashStatus('Test de communication USB…');
  setProgressVisual(2);
  await sendBac('PING');
  const pong = await expectOk('PONG', 8000);
  const pingFields = parsePing(pong);
  deviceChunkMax = deviceChunkMaxFromPing(pingFields);
  deviceLineMax = deviceLineMaxFromPing(pingFields);
  deviceFwVersion = pingFields.fw || deviceFwVersion;
  drainLineQueue();

  const prepSeconds = Math.round(FLASH_BEGIN_TIMEOUT_MS / 1000);
  setFlashStatus(`Effacement partition OTA sur la boîte (0-${prepSeconds} s, ne débranchez pas)…`);
  setProgressVisual(3);
  pushLiveEvent(`FLASH_BEGIN ${formatBytes(size)} · firmware ${deviceFwVersion || '?'}`, 'work');
  await sendBac(`FLASH_BEGIN size=${size} sha256=${String(sha).toLowerCase()}`);

  let eraseSeen = false;
  const line = await expectOk('flash_ready', FLASH_BEGIN_TIMEOUT_MS, (secondsLeft, eraseStarted) => {
    if (eraseStarted) eraseSeen = true;
    const phase = eraseSeen
      ? `Effacement flash en cours… ${secondsLeft} s restantes`
      : `Attente boîte… ${secondsLeft} s restantes`;
    setFlashStatus(phase);
    if (progressMetrics) {
      progressMetrics.textContent = eraseSeen
        ? 'La boîte efface la partition OTA. Premier passage : normal, patientez.'
        : 'Si rien ne change après 30 s, vérifiez le câble USB.';
    }
  });

  setProgressVisual(5);
  pushLiveEvent(`Écriture prête (${line.includes('target=') ? line.split('target=')[1].trim() : 'OK'})`, 'ok');
  drainLineQueue();
}

function showDeviceCard(fields) {
  metaDevice.textContent = fields.device && fields.device !== '-' ? fields.device : 'Boîte à Cœur';
  metaSerial.textContent = fields.serial && fields.serial !== '-' ? fields.serial : '—';
  metaFw.textContent = fields.fw || '—';
  deviceCard.classList.remove('hidden');
}

function formatReleaseLabel(r) {
  const fwMb = (r.firmware_size / (1024 * 1024)).toFixed(2);
  const assetsPart = (r.assets_size || 0) > 0 ? ` + assets ${formatBytes(r.assets_size)}` : '';
  return `Version ${r.version} (${fwMb} Mo${assetsPart})`;
}

async function loadReleases() {
  if (!deviceSerial) {
    throw new Error('Numéro de série introuvable.');
  }
  await setActivity('Recherche des mises à jour…');
  const started = Date.now();
  const res = await fetch(`${API}/usb-debug/releases`, {
    headers: { 'X-Bac-Serial': deviceSerial },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Impossible de charger les versions.');
  }
  const data = await res.json();
  const elapsed = Date.now() - started;
  if (elapsed < UX.releasesMin) await wait(UX.releasesMin - elapsed);

  downloadToken = data.download_token || null;
  tokenIssuedAt = Date.now();
  releases = data.releases || [];
  releaseSelect.innerHTML = '';
  if (releases.length === 0) {
    releaseSelect.innerHTML = '<option value="">Aucune version disponible</option>';
    fwMeta.textContent = 'Aucune mise à jour publiée pour le moment.';
    updateFlashButton();
    return;
  }
  for (const r of releases) {
    const opt = document.createElement('option');
    opt.value = String(r.id);
    opt.textContent = formatReleaseLabel(r);
    releaseSelect.appendChild(opt);
  }
  releaseSelect.disabled = false;
  onReleaseChange();
  log(`${releases.length} version(s) disponible(s).`);
}

async function fetchServerChunk(releaseId, offset, length, kind = 'firmware') {
  await ensureDownloadToken();
  const chunkPaths = {
    firmware: `${API}/usb-debug/releases/${releaseId}/chunk`,
    assets: `${API}/usb-debug/releases/${releaseId}/assets/chunk`,
    manifest: `${API}/usb-debug/releases/${releaseId}/manifest/chunk`,
  };
  const url = `${chunkPaths[kind]}?offset=${offset}&length=${length}`;
  let res = await fetch(url, {
    headers: { 'X-Bac-Serial': deviceSerial, 'X-Bac-Download-Token': downloadToken || '' },
  });
  if (res.status === 401) {
    await refreshDownloadToken();
    res = await fetch(url, {
      headers: { 'X-Bac-Serial': deviceSerial, 'X-Bac-Download-Token': downloadToken || '' },
    });
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Erreur lors du transfert.');
  }
  return new Uint8Array(await res.arrayBuffer());
}

async function downloadReleaseBlob(releaseId, size, kind, onProgress) {
  await ensureDownloadToken();
  const fullPaths = {
    firmware: `${API}/usb-debug/releases/${releaseId}/firmware`,
    assets: `${API}/usb-debug/releases/${releaseId}/assets`,
    manifest: `${API}/usb-debug/releases/${releaseId}/manifest`,
  };
  const url = fullPaths[kind];
  let res = await fetch(url, {
    headers: { 'X-Bac-Serial': deviceSerial, 'X-Bac-Download-Token': downloadToken || '' },
  });
  if (res.status === 401) {
    await refreshDownloadToken();
    res = await fetch(url, {
      headers: { 'X-Bac-Serial': deviceSerial, 'X-Bac-Download-Token': downloadToken || '' },
    });
  }
  if (res.ok) {
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.length !== size) {
      throw new Error(`Taille ${kind} incorrecte.`);
    }
    if (onProgress) onProgress(size, size);
    return buf;
  }

  const blob = new Uint8Array(size);
  const step = 768;
  const batch = 16;
  let done = 0;
  for (let offset = 0; offset < size; offset += step * batch) {
    const tasks = [];
    for (let i = 0; i < batch; i++) {
      const off = offset + i * step;
      if (off >= size) break;
      const len = Math.min(step, size - off);
      tasks.push(fetchServerChunk(releaseId, off, len, kind).then((chunk) => ({ off, chunk })));
    }
    const parts = await Promise.all(tasks);
    for (const { off, chunk } of parts) {
      blob.set(chunk, off);
      done += chunk.length;
    }
    if (onProgress) onProgress(done, size);
  }
  return blob;
}

async function downloadFirmwareImage(releaseId, size, onProgress) {
  return downloadReleaseBlob(releaseId, size, 'firmware', onProgress);
}

async function writeFlashChunkHex(hex) {
  if (!writer) throw new Error('Non connecté');
  await writer.write(new TextEncoder().encode(`@BAC FLASH_CHUNK ${hex}\n`));
}

async function waitChunkOk(timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const remaining = Math.max(1, deadline - Date.now());
    const line = await waitLine(Math.min(250, remaining));
    if (!line) continue;
    if (!line.startsWith('@BAC')) continue;
    if (line.startsWith('@BAC ERR')) throw new Error(mapFlashError(line.slice(9).trim()));
    if (line.startsWith('@BAC OK chunk')) return;
  }
  throw new Error(mapFlashError('Délai dépassé, la boîte ne répond pas.'));
}

function legacyFlashEtaMinutes(size, chunkSize) {
  const chunks = Math.ceil(size / chunkSize);
  const seconds = chunks * 0.125;
  return Math.max(1, Math.round(seconds / 60));
}

function modernFlashEtaMinutes(size, chunkSize) {
  const bytesPerSec = chunkSize >= 512 ? 28000 : 950;
  return Math.max(1, Math.round(size / bytesPerSec / 60));
}

function isLegacyUsbFlash(chunkSize) {
  return chunkSize <= DEFAULT_CHUNK_BYTES;
}

function flashEtaMinutes(size, chunkSize) {
  return isLegacyUsbFlash(chunkSize)
    ? legacyFlashEtaMinutes(size, chunkSize)
    : modernFlashEtaMinutes(size, chunkSize);
}

function onReleaseChange() {
  const rel = selectedRelease();
  if (!rel) {
    fwMeta.textContent = releases.length ? '' : 'Aucune mise à jour publiée pour le moment.';
    updateFlashButton();
    return;
  }
  const needFw = compareSemver(deviceFwVersion, rel.version) < 0;
  fwMeta.textContent = isLegacyUsbFlash(deviceChunkMax)
    ? `Firmware ${deviceFwVersion || '1.0.28'} : ~${legacyFlashEtaMinutes(rel.firmware_size, deviceChunkMax)} min (blocs ${deviceChunkMax} o). Une seule fois.`
    : needFw
      ? 'La boîte redémarre après l\'installation.'
      : '';
  updateFlashButton();
}

function renderCheckItem(code, ok, detail, index) {
  const li = document.createElement('li');
  li.className = ok ? 'ok' : 'fail';
  li.style.animationDelay = `${index * 60}ms`;
  const label = CHECK_LABELS[code] || code;
  li.innerHTML = `
    <span class="check-badge" aria-hidden="true"></span>
    <div class="check-body">
      <strong>${label}</strong>
      <span>${detail}</span>
    </div>
  `;
  return li;
}

function setProgressVisual(pct) {
  const clamped = Math.max(0, Math.min(100, Math.round(pct)));
  displayProgress = clamped;
  progressBar.style.width = `${clamped}%`;
  progressPct.textContent = `${clamped} %`;
}

async function refreshDownloadToken() {
  if (!deviceSerial) return;
  const res = await fetch(`${API}/usb-debug/releases`, {
    headers: { 'X-Bac-Serial': deviceSerial },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Impossible de renouveler la session.');
  }
  const data = await res.json();
  downloadToken = data.download_token || null;
  tokenIssuedAt = Date.now();
}

async function ensureDownloadToken() {
  if (!downloadToken || Date.now() - tokenIssuedAt > TOKEN_REFRESH_MS) {
    await refreshDownloadToken();
    pushLiveEvent('Session de téléchargement renouvelée', 'work');
  }
}

async function connect() {
  if (!('serial' in navigator)) {
    alert('Utilisez Chrome ou Edge sur ordinateur.');
    return;
  }
  try {
    liveFeed.innerHTML = '';
    setLivePanelVisible(true);
    setLivePhase('Ouverture du port USB…');
    liveTitle.textContent = 'Connexion en cours';
    pushLiveEvent('Ouverture du port USB…', 'work');
    setRingState('connecting');
    connState.textContent = 'Connexion…';
    btnConnect.disabled = true;
    await setActivity('Ouverture du port USB…');

    port = await navigator.serial.requestPort({
      filters: [{ usbVendorId: ESPRESSIF_VID }],
    });
    await openSerialPort(SERIAL_BAUD_FALLBACK);
    writer = port.writable.getWriter();
    lineQueue = [];
    lineWaiters = [];
    deviceSerial = null;
    deviceChunkMax = DEFAULT_CHUNK_BYTES;
    deviceCard.classList.add('hidden');
    startReadLoop();

    await wait(UX.connectPause);
    await setActivity('Échange avec la boîte…');
    setRingState('working');
    connState.textContent = 'Identification…';
    setLivePhase('Identification de la boîte…');

    log('Connexion établie.');
    pushLiveEvent('Connexion USB établie', 'ok');
    const pong = await ping();
    const pingFields = parsePing(pong);
    deviceSerial = parseSerialFromPing(pong);
    if (!deviceSerial) {
      throw new Error('Numéro de série invalide ou manquant.');
    }
    deviceFwVersion = pingFields.fw || null;
    deviceChunkMax = deviceChunkMaxFromPing(pingFields);
    deviceLineMax = deviceLineMaxFromPing(pingFields);
    if (deviceChunkMax >= 512) {
      await reconfigureSerial(SERIAL_BAUD);
    } else {
      pushLiveEvent(`Firmware ${pingFields.fw || '?'} · blocs ${deviceChunkMax} o`, 'warn');
    }
    pushLiveEvent(`Boîte identifiée · blocs max ${deviceChunkMax} o`, 'ok');

    await wait(UX.identifyPause);
    showDeviceCard(pingFields);
    liveTitle.textContent = pingFields.device && pingFields.device !== '-' ? pingFields.device : 'Boîte à Cœur';
    setConnectedUI(true);
    await setActivity('Boîte identifiée, préparation…');
    setLivePhase('Chargement des versions disponibles…');

    await goToStep(2, 'Lancement du diagnostic…');
    await loadReleases();
    pushLiveEvent(`${releases.length} version(s) disponible(s)`, 'ok');
    setLivePhase('Diagnostic interne…');
    await runAnalyze({ auto: true });
    await goToStep(3, 'Diagnostic terminé');
    setLivePhase('Prêt pour la mise à jour');
    await setActivity('Prêt. Vous pouvez mettre à jour si besoin.');
    pushLiveEvent('Session prête', 'ok');
  } catch (err) {
    log(`Échec : ${err.message}`);
    pushLiveEvent(`Échec : ${err.message}`, 'err');
    setRingState('error');
    connState.textContent = 'Échec';
    setLivePhase(`Échec : ${err.message}`);
    await setActivity('Échec de connexion');
    await disconnect();
  }
}

async function disconnect() {
  readLoopActive = false;
  abortFlash = true;
  flashing = false;
  deviceSerial = null;
  downloadToken = null;
  tokenIssuedAt = 0;
  deviceChunkMax = DEFAULT_CHUNK_BYTES;
  deviceLineMax = BAC_MAX_LINE_DEFAULT;
  activeSerialBaud = SERIAL_BAUD_FALLBACK;
  deviceFwVersion = null;
  deviceAnalyze = { otaBusy: false, modeIdle: true };
  displayProgress = 0;
  lineWaiters.forEach((resolve) => resolve(''));
  lineWaiters = [];
  try {
    if (reader) await reader.cancel();
  } catch (_) {}
  try {
    if (writer) {
      writer.releaseLock();
      writer = null;
    }
  } catch (_) {}
  try {
    if (port) await port.close();
  } catch (_) {}
  port = null;
  releases = [];
  releaseSelect.innerHTML = '<option value="">Connectez la boîte pour voir les versions</option>';
  releaseSelect.disabled = true;
  deviceCard.classList.add('hidden');
  analyzeLoader.classList.add('hidden');
  analyzeHero.classList.add('hidden');
  analyzeHeroTitle.textContent = '';
  analyzeHeroText.textContent = '';
  analyzeChecks.innerHTML = '';
  progressWrap.classList.add('hidden');
  if (progressMetrics) progressMetrics.textContent = '';
  btnAbort.classList.add('hidden');
  fwMeta.textContent = '';
  liveFeed.innerHTML = '';
  livePct.textContent = '—';
  liveBytes.textContent = '—';
  liveSpeed.textContent = '—';
  liveEta.textContent = '—';
  setLivePanelVisible(false);
  setLivePhase('En attente de connexion');
  btnReanalyze.classList.add('hidden');
  btnAnalyze.classList.remove('hidden');
  btnAnalyze.textContent = 'Lancer le diagnostic';
  setConnectedUI(false);
  setStep(1);
  setPanel(1);
  await setActivity('En attente de connexion');
  log('Déconnecté.');
}

async function ping() {
  await sendBac('PING');
  return expectOk('PONG');
}

function setAnalyzeRunning(running) {
  analyzeLoader.classList.toggle('hidden', !running);
  btnAnalyze.classList.toggle('hidden', running);
}

async function runAnalyze({ auto = false, returnStep = null } = {}) {
  analyzeChecks.innerHTML = '';
  analyzeHero.classList.add('hidden');
  setAnalyzeRunning(true);
  btnReanalyze.classList.add('hidden');
  analyzeLoaderText.textContent = 'Préparation de l\'analyse…';
  btnAnalyze.disabled = true;
  if (!auto) btnAnalyze.textContent = 'Analyse en cours…';

  try {
    await wait(UX.analyzeWarmup);
    await sendBac('ANALYZE');

    const buffered = [];
    let issues = null;

    while (true) {
      const line = await waitLine(15000);
      if (line === '@BAC ANALYZE_BEGIN') continue;
      if (line.startsWith('@BAC CHECK ')) {
        const rest = line.slice(11);
        const sp = rest.indexOf(' ');
        const code = sp >= 0 ? rest.slice(0, sp) : rest;
        const tail = sp >= 0 ? rest.slice(sp + 1) : '';
        const ok = tail.startsWith('ok ');
        const detail = ok ? tail.slice(3) : tail.startsWith('fail ') ? tail.slice(5) : tail;
        buffered.push({ code, ok, detail });
        continue;
      }
      if (line.startsWith('@BAC INFO ')) continue;
      if (line.startsWith('@BAC ANALYZE_END')) {
        const m = line.match(/issues=(\d+)/);
        issues = m ? Number(m[1]) : 0;
        break;
      }
      if (line.startsWith('@BAC ERR')) throw new Error(line.slice(9));
    }

    for (let i = 0; i < buffered.length; i++) {
      const item = buffered[i];
      if (item.code === 'ota_busy') deviceAnalyze.otaBusy = !item.ok;
      if (item.code === 'mode_idle') deviceAnalyze.modeIdle = item.ok;
      analyzeLoaderText.textContent = ANALYZE_STATUS[item.code] || 'Analyse en cours…';
      setLivePhase(ANALYZE_STATUS[item.code] || 'Analyse en cours…');
      await wait(UX.analyzePerCheck);
      analyzeChecks.appendChild(renderCheckItem(item.code, item.ok, item.detail, i));
      pushLiveEvent(`${CHECK_LABELS[item.code] || item.code} : ${item.ok ? 'OK' : 'À vérifier'}`, item.ok ? 'ok' : 'warn');
      if (i === 0) setAnalyzeRunning(false);
    }

    if (buffered.length === 0) setAnalyzeRunning(false);

    await wait(UX.analyzeFinish);

    analyzeHero.classList.remove('hidden');
    if (issues === 0) {
      analyzeHero.className = 'result-banner is-ok';
      analyzeHeroIcon.className = 'result-banner-icon is-ok';
      analyzeHeroTitle.textContent = 'Tout est en ordre';
      analyzeHeroText.textContent = 'Votre boîte est prête à l\'emploi.';
      await setActivity('Diagnostic terminé — tout est en ordre');
    } else {
      analyzeHero.className = 'result-banner is-fail';
      analyzeHeroIcon.className = 'result-banner-icon is-fail';
      analyzeHeroTitle.textContent = `${issues} point${issues > 1 ? 's' : ''} à vérifier`;
      analyzeHeroText.textContent = 'Contactez le support si vous avez besoin d\'aide.';
      await setActivity(`Diagnostic terminé — ${issues} point(s) à vérifier`);
    }

    btnAnalyze.textContent = 'Relancer le diagnostic';
    btnReanalyze.classList.remove('hidden');
    if (returnStep) await goToStep(returnStep);
  } finally {
    analyzeLoader.classList.add('hidden');
    btnAnalyze.classList.remove('hidden');
    btnAnalyze.disabled = !port || flashing;
  }
}

const HEX_LUT = '0123456789abcdef';

function bytesToHex(bytes) {
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    hex += HEX_LUT[b >> 4] + HEX_LUT[b & 15];
  }
  return hex;
}

async function waitChunkOkWithPrefix(prefix, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const remaining = Math.max(1, deadline - Date.now());
    const line = await waitLine(Math.min(250, remaining));
    if (!line) continue;
    if (!line.startsWith('@BAC')) continue;
    if (line.startsWith('@BAC ERR')) throw new Error(mapFlashError(line.slice(9).trim()));
    if (line.startsWith(`@BAC OK ${prefix}`)) return;
  }
  throw new Error(mapFlashError('Délai dépassé, la boîte ne répond pas.'));
}

async function transferHexChunks(blob, size, cmdPrefix, waitPrefix, chunkSize, onSent) {
  let sent = 0;
  let nextHexPromise = null;
  while (sent < size) {
    if (abortFlash) throw new Error('abort');
    const chunkLen = Math.min(chunkSize, size - sent);
    const hex = nextHexPromise ? await nextHexPromise : bytesToHex(blob.subarray(sent, sent + chunkLen));
    const nextOffset = sent + chunkLen;
    if (nextOffset < size) {
      const nextLen = Math.min(chunkSize, size - nextOffset);
      nextHexPromise = Promise.resolve().then(() => bytesToHex(blob.subarray(nextOffset, nextOffset + nextLen)));
    } else {
      nextHexPromise = null;
    }
    await sendBac(`${cmdPrefix} ${hex}`);
    await waitChunkOkWithPrefix(waitPrefix);
    sent = nextOffset;
    if (onSent) onSent(sent, size);
  }
}

async function prepareAssetsSession(release, packSize, packSha) {
  drainLineQueue();
  setFlashStatus('Préparation installation assets…');
  try {
    await sendBac('ASSETS_ABORT');
    await expectOk('assets_aborted', 5000);
  } catch (_) {}
  drainLineQueue();

  await sendBac('PING');
  const pong = await expectOk('PONG', 8000);
  const pingFields = parsePing(pong);
  if (!pingSupportsAssetsUsb(pingFields)) {
    throw new Error('Firmware trop ancien pour l\'installation USB des assets.');
  }
  deviceChunkMax = deviceChunkMaxFromPing(pingFields);
  deviceLineMax = deviceLineMaxFromPing(pingFields);
  drainLineQueue();

  const manifestSize = release.assets_manifest_size || 0;
  if (manifestSize > 0) {
    setFlashStatus('Téléchargement manifest assets…');
    const manifest = await downloadReleaseBlob(release.id, manifestSize, 'manifest');
    pushLiveEvent(`Manifest en mémoire (${formatBytes(manifestSize)})`, 'ok');
    await sendBac(`ASSETS_MANIFEST_BEGIN size=${manifestSize}`);
    await expectOk('assets_manifest_ready');
    const manifestChunk = chunkSizeForBacCommand('ASSETS_MANIFEST_CHUNK', deviceChunkMax);
    await transferHexChunks(manifest, manifestSize, 'ASSETS_MANIFEST_CHUNK', 'manifest_chunk', manifestChunk);
    await sendBac('ASSETS_MANIFEST_END');
    await expectOk('assets_manifest_complete');
  }

  await sendBac(`ASSETS_BEGIN size=${packSize} sha256=${String(packSha).toLowerCase()} version=${release.version}`);
  await expectOk('assets_ready');
}

async function waitForAnalyzeAssetsOk(timeoutMs = 20000) {
  drainLineQueue();
  await sendBac('ANALYZE');
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const line = await waitLine(Math.max(100, deadline - Date.now()));
    if (!line) continue;
    if (line.startsWith('@BAC CHECK assets ok')) return true;
    if (line.startsWith('@BAC CHECK assets fail')) return false;
    if (line.startsWith('@BAC ANALYZE_END')) return false;
    if (line.startsWith('@BAC ERR')) return false;
  }
  return false;
}

async function waitForAssetsInstallDone(release, startedAt) {
  serialExpectDisconnect = true;
  const size = release.assets_size || 0;
  const estimatedMs = Math.max(120000, Math.round(size / 12000) * 1000);
  const deadline = Date.now() + Math.max(estimatedMs + 180000, 900000);
  const installStartedAt = Date.now();
  let lostAt = 0;
  let lastReconnectAt = 0;

  setFlashStatus('Installation en cours sur la boîte…');
  pushLiveEvent('Écriture FFat en cours…', 'work');

  while (Date.now() < deadline) {
    const line = await waitLine(400);
    if (line) {
      if (line.startsWith('@BAC OK assets_complete')) {
        serialExpectDisconnect = false;
        return;
      }
      if (line.startsWith('@BAC ERR')) {
        serialExpectDisconnect = false;
        throw new Error(mapFlashError(line.slice(9).trim()));
      }
      if (line.startsWith('@BAC INFO assets_progress')) {
        const m = line.match(/pct=(\d+)/);
        if (m) setTransferProgress(Number(m[1]), 100, startedAt, { force: true });
        lostAt = 0;
        continue;
      }
      if (line.startsWith('@BAC INFO assets_install')) continue;
    } else if (!lostAt && Date.now() - installStartedAt > 8000) {
      lostAt = Date.now();
      pushLiveEvent('USB interrompu, attente fin installation…', 'warn');
    }

    const elapsed = Date.now() - installStartedAt;
    const pct = Math.min(99, Math.round((elapsed / estimatedMs) * 100));
    setTransferProgress(Math.round((size * pct) / 100), size, startedAt, { force: true });
    setFlashStatus(`Installation en cours sur la boîte… ${pct} %`);

    if (elapsed >= 10000 && Date.now() - lastReconnectAt >= 5000) {
      lastReconnectAt = Date.now();
      try {
        await ensureSerialReady();
        if (await waitForAnalyzeAssetsOk(12000)) {
          serialExpectDisconnect = false;
          return;
        }
      } catch (_) {}
    }
  }

  serialExpectDisconnect = false;
  throw new Error('Délai dépassé pendant l\'installation des assets.');
}

async function expectAssetsComplete(timeoutMs = 900000, startedAt) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const remaining = Math.max(100, deadline - Date.now());
    const line = await waitLine(Math.min(1000, remaining));
    if (!line || !line.startsWith('@BAC')) continue;
    if (line.startsWith('@BAC ERR')) throw new Error(mapFlashError(line.slice(9).trim()));
    if (line.startsWith('@BAC INFO assets_progress')) {
      const m = line.match(/pct=(\d+)/);
      if (m) setTransferProgress(Number(m[1]), 100, startedAt, { force: true });
      continue;
    }
    if (line.startsWith('@BAC INFO assets_install')) continue;
    if (line.startsWith('@BAC OK assets_complete')) return line;
  }
  throw new Error('Délai dépassé pendant l\'installation des assets.');
}

async function flashFirmwareToDevice(release) {
  const size = release.firmware_size;
  const sha = release.firmware_sha256;
  let chunkSize = deviceChunkMax;

  if (progressMetrics) {
    progressMetrics.textContent = isLegacyUsbFlash(deviceChunkMax)
      ? `Blocs ${deviceChunkMax} o · ~950 o/s · comptez ~${legacyFlashEtaMinutes(size, deviceChunkMax)} min. Ne fermez pas l'onglet.`
      : `Blocs ${deviceChunkMax} o · ~2 min · l'écran de la boîte affiche la progression.`;
  }
  await prepareFlashSession(size, sha);
  chunkSize = chunkSizeForBacCommand('FLASH_CHUNK', deviceChunkMax);

  setFlashStatus('Téléchargement du firmware en local…');
  pushLiveEvent('Téléchargement serveur…', 'work');
  const firmware = await downloadFirmwareImage(release.id, size, (done, total) => {
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    setFlashStatus(`Téléchargement serveur ${pct} %…`);
    setProgressVisual(Math.min(3, Math.round(pct * 0.03)));
  });
  pushLiveEvent(`Firmware en mémoire (${formatBytes(size)})`, 'ok');
  drainLineQueue();

  quietChunkLog = true;
  lastProgressUiAt = 0;
  const etaMin = flashEtaMinutes(size, chunkSize);
  setFlashStatus(`Écriture USB (~${etaMin} min, ne fermez pas)…`);
  pushLiveEvent(`Transfert USB · blocs ${chunkSize} o · ~${etaMin} min`, 'work');

  let sent = 0;
  const startedAt = Date.now();
  let nextHexPromise = null;

  while (sent < size) {
    if (abortFlash) {
      await sendBac('FLASH_ABORT');
      await expectOk('flash_aborted');
      throw new Error('abort');
    }

    const chunkLen = Math.min(chunkSize, size - sent);
    const hex = nextHexPromise ? await nextHexPromise : bytesToHex(firmware.subarray(sent, sent + chunkLen));
    const nextOffset = sent + chunkLen;
    if (nextOffset < size) {
      const nextLen = Math.min(chunkSize, size - nextOffset);
      nextHexPromise = Promise.resolve().then(() => bytesToHex(firmware.subarray(nextOffset, nextOffset + nextLen)));
    } else {
      nextHexPromise = null;
    }

    await writeFlashChunkHex(hex);
    try {
      await waitChunkOk();
    } catch (err) {
      if (chunkSize > DEFAULT_CHUNK_BYTES && String(err.message).includes('hex decode')) {
        await sendBac('FLASH_ABORT');
        await expectOk('flash_aborted', 5000).catch(() => {});
        await prepareFlashSession(size, sha);
        chunkSize = DEFAULT_CHUNK_BYTES;
        deviceChunkMax = DEFAULT_CHUNK_BYTES;
        sent = 0;
        nextHexPromise = null;
        pushLiveEvent(`Blocs réduits à ${chunkSize} o (firmware ancien)`, 'warn');
        setLivePhase('Reprise avec blocs plus petits…');
        continue;
      }
      throw err;
    }

    sent = nextOffset;
    setTransferProgress(sent, size, startedAt);

    if (sent % (chunkSize * 64) === 0 || sent === size) {
      pushLiveEvent(`Écriture flash ${Math.round((sent / size) * 100)} %`, 'work');
    }
  }

  await sendBac('FLASH_END');
  await expectOk('flash_complete', 15000);
  setTransferProgress(size, size, startedAt, { force: true });
}

async function flashAssetsToDevice(release) {
  const size = release.assets_size;
  const sha = release.assets_sha256;
  if (!size || !sha) return;

  setFlashStatus('Téléchargement des assets en local…');
  pushLiveEvent('Téléchargement assets serveur…', 'work');
  const assets = await downloadReleaseBlob(release.id, size, 'assets', (done, total) => {
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    setFlashStatus(`Téléchargement assets ${pct} %…`);
    setProgressVisual(Math.min(8, Math.round(pct * 0.08)));
  });
  pushLiveEvent(`Assets en mémoire (${formatBytes(size)})`, 'ok');
  drainLineQueue();

  await prepareAssetsSession(release, size, sha);

  quietChunkLog = true;
  lastProgressUiAt = 0;
  const chunkSize = chunkSizeForBacCommand('ASSETS_CHUNK', deviceChunkMax);
  const etaMin = Math.max(2, Math.round(size / 28000 / 60));
  setFlashStatus(`Transfert assets USB (~${etaMin} min)…`);
  pushLiveEvent(`Transfert assets · blocs ${chunkSize} o`, 'work');

  const startedAt = Date.now();
  await transferHexChunks(assets, size, 'ASSETS_CHUNK', 'assets_chunk', chunkSize, (sent, total) => {
    setTransferProgress(sent, total, startedAt);
    if (sent % (chunkSize * 64) === 0 || sent === total) {
      pushLiveEvent(`Transfert assets ${Math.round((sent / total) * 100)} %`, 'work');
    }
  });

  setFlashStatus('Installation assets sur la boîte…');
  pushLiveEvent('Écriture FFat et vérification…', 'work');
  await sendBac('ASSETS_END');
  await waitForAssetsInstallDone(release, startedAt);
  setTransferProgress(size, size, startedAt, { force: true });
  quietChunkLog = false;
}

async function flashFromServer(release) {
  const needFw = compareSemver(deviceFwVersion, release.version) < 0;
  const needAssets = (release.assets_size || 0) > 0 && release.assets_sha256;

  if (!needFw && !needAssets) {
    alert('Cette version est déjà installée sur la boîte.');
    return;
  }

  if (deviceAnalyze.otaBusy) {
    alert('La boîte signale une mise à jour cloud en cours.\nCoupez le Wi-Fi (ou attendez la fin) avant l\'installation USB.');
    return;
  }

  progressWrap.classList.remove('hidden');
  setProgressVisual(0);
  flashing = true;
  abortFlash = false;
  btnAbort.classList.remove('hidden');
  btnAbort.disabled = false;
  btnFlash.disabled = true;
  btnAnalyze.disabled = true;
  setRingState('working');
  setLivePhase(`Préparation version ${release.version}…`);
  pushLiveEvent(`Démarrage mise à jour ${release.version} (depuis ${deviceFwVersion || '?'})`, 'work');
  setFlashStatus(`Préparation de la version ${release.version}…`);

  try {
    await sendBac('PING');
    const pong = await expectOk('PONG', 8000);
    const pingFields = parsePing(pong);
    deviceChunkMax = deviceChunkMaxFromPing(pingFields);
    deviceLineMax = deviceLineMaxFromPing(pingFields);
    deviceFwVersion = pingFields.fw || deviceFwVersion;
    drainLineQueue();

    const canAssetsUsb = pingSupportsAssetsUsb(pingFields);
    if (needAssets && !canAssetsUsb && needFw) {
      pushLiveEvent('Firmware requis avant les assets USB (bootstrap)', 'warn');
      await flashFirmwareToDevice(release);
      const afterFw = await reopenPortAfterReboot();
      deviceFwVersion = afterFw.fw || deviceFwVersion;
      deviceChunkMax = deviceChunkMaxFromPing(afterFw);
      deviceLineMax = deviceLineMaxFromPing(afterFw);
      await flashAssetsToDevice(release);
      flashState.textContent = 'Terminé. La boîte redémarre…';
      setLivePhase('Redémarrage de la boîte…');
      pushLiveEvent('Mise à jour terminée, redémarrage…', 'ok');
      await setActivity('Mise à jour terminée');
      setRingState('connected');
      setTimeout(() => disconnect(), 2200);
      return;
    }

    if (needAssets) {
      if (!canAssetsUsb) {
        throw new Error('Firmware trop ancien pour l\'installation USB des assets.');
      }
      await flashAssetsToDevice(release);
      log('Assets installés.', { force: true });
      pushLiveEvent('Assets installés', 'ok');
      if (needFw) {
        setProgressVisual(0);
        if (progressMetrics) progressMetrics.textContent = '';
        setFlashStatus('Préparation du firmware…');
        pushLiveEvent('Préparation firmware…', 'work');
        await ensureSerialReady();
      }
    }

    if (needFw) {
      await flashFirmwareToDevice(release);
      quietChunkLog = false;
      log('Firmware transféré, redémarrage…', { force: true });
      flashState.textContent = 'Terminé. La boîte redémarre…';
      setLivePhase('Redémarrage de la boîte…');
      pushLiveEvent('Mise à jour terminée, redémarrage…', 'ok');
      await setActivity('Mise à jour terminée');
      setRingState('connected');
      setTimeout(() => disconnect(), 2200);
      return;
    }

    flashState.textContent = 'Terminé.';
    setLivePhase('Mise à jour terminée');
    await setActivity('Mise à jour terminée');
    setRingState('connected');
  } catch (err) {
    quietChunkLog = false;
    if (err.message === 'abort') {
      flashState.textContent = 'Mise à jour annulée.';
      setLivePhase('Mise à jour annulée');
      pushLiveEvent('Mise à jour annulée', 'warn');
      await setActivity('Mise à jour annulée');
      setRingState('connected');
      try {
        await cleanupFlashSessions();
      } catch (_) {}
      return;
    }
    log(`Erreur flash : ${err.message}`, { force: true });
    flashState.textContent = `Erreur : ${err.message}`;
    if (progressMetrics) progressMetrics.textContent = '';
    setLivePhase(`Erreur : ${err.message}`);
    pushLiveEvent(`Erreur : ${err.message}`, 'err');
    await setActivity(`Erreur : ${err.message}`);
    setRingState('error');
    try {
      await cleanupFlashSessions();
    } catch (_) {}
  } finally {
    quietChunkLog = false;
    flashing = false;
    btnAbort.disabled = true;
    btnAbort.classList.add('hidden');
    btnAnalyze.disabled = !port;
    updateFlashButton();
    if (!abortFlash) setRingState(port ? 'connected' : 'idle');
  }
}

btnConnect.addEventListener('click', connect);
btnDisconnect.addEventListener('click', disconnect);
btnAnalyze.addEventListener('click', () => {
  runAnalyze().catch((e) => log(e.message));
});
btnReanalyze.addEventListener('click', () => {
  runAnalyze().catch((e) => log(e.message));
});
releaseSelect.addEventListener('change', onReleaseChange);

btnFlash.addEventListener('click', () => {
  const rel = selectedRelease();
  if (!rel || !port || !deviceSerial) return;
  const needFw = compareSemver(deviceFwVersion, rel.version) < 0;
  const needAssets = (rel.assets_size || 0) > 0 && rel.assets_sha256;
  if (!needFw && !needAssets) {
    alert('Cette version est déjà installée sur la boîte.');
    return;
  }
  const assetsEta = needAssets ? Math.max(2, Math.round((rel.assets_size || 0) / 28000 / 60)) : 0;
  const fwEta = needFw ? flashEtaMinutes(rel.firmware_size, deviceChunkMax) : 0;
  const etaMin = assetsEta + fwEta;
  const eta = etaMin > 0 ? `\n\nComptez ~${etaMin} min.` : '';
  if (!confirm(`Installer la version ${rel.version} ?${eta}\n\nCoupez le Wi-Fi si une mise à jour cloud est en cours.\n${needFw ? 'La boîte redémarre à la fin.' : ''}`)) return;
  flashFromServer(rel).catch((e) => log(e.message));
});

btnAbort.addEventListener('click', () => {
  abortFlash = true;
});

window.addEventListener('beforeunload', () => {
  if (port) disconnect();
});

setStep(1);
setPanel(1);
