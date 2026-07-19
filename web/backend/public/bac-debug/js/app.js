const ESPRESSIF_VID = 0x303a;
const CHUNK_BYTES = 384;
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
  flashPrepare: 1600,
  flashChunkPause: 120,
  progressTick: 55,
  progressMinStep: 1,
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
const releaseSelect = $('releaseSelect');

const btnConnect = $('btnConnect');
const btnDisconnect = $('btnDisconnect');
const btnAnalyze = $('btnAnalyze');
const btnFlash = $('btnFlash');
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
let currentStep = 1;
let displayProgress = 0;
let progressAnim = null;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function log(msg) {
  const ts = new Date().toISOString().slice(11, 19);
  logEl.textContent += `[${ts}] ${msg}\n`;
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
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const idx = lineWaiters.indexOf(resolve);
      if (idx >= 0) lineWaiters.splice(idx, 1);
      reject(new Error('Délai dépassé, la boîte ne répond pas.'));
    }, timeoutMs);
    lineWaiters.push((line) => {
      clearTimeout(timer);
      resolve(line);
    });
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
    if (readLoopActive) log(`Erreur de lecture : ${err.message}`);
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

async function expectOk(prefix, timeoutMs) {
  const line = await waitLine(timeoutMs);
  if (!line.startsWith('@BAC OK')) {
    if (line.startsWith('@BAC ERR')) throw new Error(line.slice(9));
    throw new Error('Réponse inattendue de la boîte.');
  }
  if (prefix && !line.includes(prefix)) throw new Error('Réponse inattendue de la boîte.');
  return line;
}

function showDeviceCard(fields) {
  metaDevice.textContent = fields.device && fields.device !== '-' ? fields.device : 'Boîte à Cœur';
  metaSerial.textContent = fields.serial && fields.serial !== '-' ? fields.serial : '—';
  metaFw.textContent = fields.fw || '—';
  deviceCard.classList.remove('hidden');
}

function formatReleaseLabel(r) {
  const mb = (r.firmware_size / (1024 * 1024)).toFixed(2);
  return `Version ${r.version} (${mb} Mo)`;
}

async function loadReleases() {
  if (!deviceSerial) {
    throw new Error('Numéro de série introuvable.');
  }
  await setActivity('Recherche des mises à jour…');
  const started = Date.now();
  const res = await fetch(`${API}/usb-debug/releases`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Impossible de charger les versions.');
  }
  const data = await res.json();
  const elapsed = Date.now() - started;
  if (elapsed < UX.releasesMin) await wait(UX.releasesMin - elapsed);

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

async function fetchServerChunk(releaseId, offset, length) {
  const url = `${API}/usb-debug/releases/${releaseId}/chunk?offset=${offset}&length=${length}`;
  const res = await fetch(url, {
    headers: { 'X-Bac-Serial': deviceSerial },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Erreur lors du transfert.');
  }
  return new Uint8Array(await res.arrayBuffer());
}

function onReleaseChange() {
  const rel = selectedRelease();
  if (!rel) {
    fwMeta.textContent = releases.length ? '' : 'Aucune mise à jour publiée pour le moment.';
    updateFlashButton();
    return;
  }
  fwMeta.textContent = 'La boîte redémarrera après l\'installation.';
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

async function animateProgressTo(target) {
  if (progressAnim) {
    await progressAnim;
  }
  progressAnim = (async () => {
    while (displayProgress < target) {
      const step = Math.max(UX.progressMinStep, Math.ceil((target - displayProgress) * 0.18));
      setProgressVisual(Math.min(target, displayProgress + step));
      await wait(UX.progressTick);
    }
    setProgressVisual(target);
  })();
  await progressAnim;
  progressAnim = null;
}

async function connect() {
  if (!('serial' in navigator)) {
    alert('Utilisez Chrome ou Edge sur ordinateur.');
    return;
  }
  try {
    setRingState('connecting');
    connState.textContent = 'Connexion…';
    btnConnect.disabled = true;
    await setActivity('Ouverture du port USB…');

    port = await navigator.serial.requestPort({
      filters: [{ usbVendorId: ESPRESSIF_VID }],
    });
    await port.open({ baudRate: 115200 });
    writer = port.writable.getWriter();
    lineQueue = [];
    lineWaiters = [];
    deviceSerial = null;
    deviceCard.classList.add('hidden');
    startReadLoop();

    await wait(UX.connectPause);
    await setActivity('Échange avec la boîte…');
    setRingState('working');
    connState.textContent = 'Identification…';

    log('Connexion établie.');
    const pong = await ping();
    deviceSerial = parseSerialFromPing(pong);
    if (!deviceSerial) {
      throw new Error('Numéro de série invalide ou manquant.');
    }

    await wait(UX.identifyPause);
    showDeviceCard(parsePing(pong));
    setConnectedUI(true);
    await setActivity('Boîte identifiée, préparation…');

    await goToStep(2, 'Lancement du diagnostic…');
    await loadReleases();
    await runAnalyze({ auto: true });
    await goToStep(3, 'Diagnostic terminé');
    await setActivity('Prêt. Vous pouvez mettre à jour si besoin.');
  } catch (err) {
    log(`Échec : ${err.message}`);
    setRingState('error');
    connState.textContent = 'Échec';
    await setActivity('Échec de connexion');
    await disconnect();
  }
}

async function disconnect() {
  readLoopActive = false;
  abortFlash = true;
  flashing = false;
  deviceSerial = null;
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
  btnAbort.classList.add('hidden');
  fwMeta.textContent = '';
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
      analyzeLoaderText.textContent = ANALYZE_STATUS[item.code] || 'Analyse en cours…';
      await wait(UX.analyzePerCheck);
      analyzeChecks.appendChild(renderCheckItem(item.code, item.ok, item.detail, i));
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

function bytesToHex(bytes) {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function flashFromServer(release) {
  const size = release.firmware_size;
  const sha = release.firmware_sha256;

  progressWrap.classList.remove('hidden');
  setProgressVisual(0);
  flashing = true;
  abortFlash = false;
  btnAbort.classList.remove('hidden');
  btnAbort.disabled = false;
  btnFlash.disabled = true;
  btnAnalyze.disabled = true;
  setRingState('working');

  flashState.textContent = `Préparation de la version ${release.version}…`;
  await setActivity(`Préparation de la version ${release.version}…`);
  await wait(UX.flashPrepare);
  await animateProgressTo(4);

  try {
    await sendBac(`FLASH_BEGIN size=${size} sha256=${sha}`);
    await expectOk('flash_ready', 10000);
    await animateProgressTo(8);
    flashState.textContent = 'Téléchargement et installation…';
    await setActivity('Installation en cours…');

    let sent = 0;
    while (sent < size) {
      if (abortFlash) {
        await sendBac('FLASH_ABORT');
        await expectOk('flash_aborted');
        flashState.textContent = 'Mise à jour annulée.';
        await setActivity('Mise à jour annulée');
        return;
      }
      const chunkLen = Math.min(CHUNK_BYTES, size - sent);
      const chunk = await fetchServerChunk(release.id, sent, chunkLen);
      if (chunk.length !== chunkLen) {
        throw new Error('Transfert incomplet.');
      }
      const hex = bytesToHex(chunk);
      await sendBac(`FLASH_CHUNK ${hex}`);
      await expectOk('chunk', 12000);
      sent += chunkLen;
      const realPct = Math.round((sent / size) * 100);
      const visualTarget = Math.max(8, Math.min(99, realPct));
      flashState.textContent = `Installation en cours…`;
      await animateProgressTo(visualTarget);
      await wait(UX.flashChunkPause);
    }

    await sendBac('FLASH_END');
    await expectOk('flash_complete', 15000);
    await animateProgressTo(100);
    flashState.textContent = 'Terminé. La boîte redémarre…';
    await setActivity('Mise à jour terminée');
    setRingState('connected');
    setTimeout(() => disconnect(), 2200);
  } catch (err) {
    flashState.textContent = `Erreur : ${err.message}`;
    await setActivity(`Erreur : ${err.message}`);
    setRingState('error');
    try {
      await sendBac('FLASH_ABORT');
      await waitLine(3000);
    } catch (_) {}
  } finally {
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
  if (!confirm(`Installer la version ${rel.version} ?\n\nLa boîte va redémarrer.`)) return;
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
