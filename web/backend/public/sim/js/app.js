(() => {
  const $ = (id) => document.getElementById(id);
  let registerMode = false;

  function logBle(msg) {
    const el = $("bleLog");
    const line = `[${new Date().toLocaleTimeString()}] ${msg}`;
    el.textContent = (el.textContent ? el.textContent + "\n" : "") + line;
    el.scrollTop = el.scrollHeight;
    console.log(line);
  }

  function showError(id, msg) {
    const el = $(id);
    if (!msg) {
      el.classList.add("hidden");
      el.textContent = "";
      return;
    }
    el.textContent = msg;
    el.classList.remove("hidden");
  }

  function defaultApiBase() {
    const origin = window.location.origin;
    if (origin.startsWith("http")) return origin;
    return "https://boite-a-coeur.techalchemy.fr";
  }

  async function refreshDashboard() {
    const [deviceRes, pairingRes] = await Promise.all([
      Api.getMyDevice(),
      Api.getPairingState(),
    ]);
    const cards = $("statusCards");
    cards.innerHTML = "";
    const devices = deviceRes.devices || (deviceRes.device ? [deviceRes.device] : []);
    const pairing = pairingRes;
    const owned = devices[0];
    cards.appendChild(card(
      "Ma boite",
      owned ? `${owned.display_name || owned.device_name} (id ${owned.id})` : "Aucune boite associee",
    ));
    const targets = pairing.linked_targets || (pairing.linked_target ? [pairing.linked_target] : []);
    cards.appendChild(card(
      "Contacts",
      targets.length
        ? targets.map((t) => `${t.display_name || t.device_name} (id ${t.device_id})`).join(", ")
        : "Aucun contact lie",
    ));
    if (owned) {
      const label = owned.online
        ? "En ligne"
        : (owned.last_seen_seconds_ago != null
          ? `Vu il y a ${Math.max(1, Math.round(owned.last_seen_seconds_ago / 60))} min`
          : "Hors ligne");
      cards.appendChild(card("Statut boite", label));
    }
  }

  function card(title, body) {
    const div = document.createElement("div");
    div.className = "card";
    div.innerHTML = `<strong>${title}</strong>${body}`;
    return div;
  }

  function showMain(email) {
    $("authPanel").classList.add("hidden");
    $("mainPanel").classList.remove("hidden");
    $("sessionEmail").textContent = email;
  }

  function showAuth() {
    $("mainPanel").classList.add("hidden");
    $("authPanel").classList.remove("hidden");
  }

  async function claimWithRetry(uuid, serialNumber) {
    const delays = [2000, 3000, 3000, 3000, 3000, 3000];
    for (let i = 0; i < delays.length; i++) {
      logBle(`Claim attempt ${i + 1}...`);
      try {
        await Api.claimDevice(uuid, serialNumber);
        logBle("Claim OK");
        return;
      } catch (e) {
        const retry = e.message.includes("not found") || e.message.includes("enregistr");
        if (!retry || i === delays.length - 1) throw e;
        logBle(`Claim wait: ${e.message}`);
        await sleep(delays[i]);
      }
    }
  }

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  $("tabLogin").addEventListener("click", () => {
    registerMode = false;
    $("tabLogin").classList.add("active");
    $("tabRegister").classList.remove("active");
  });

  $("tabRegister").addEventListener("click", () => {
    registerMode = true;
    $("tabRegister").classList.add("active");
    $("tabLogin").classList.remove("active");
  });

  $("authSubmit").addEventListener("click", async () => {
    showError("authError", null);
    const email = $("authEmail").value.trim();
    const password = $("authPassword").value;
    Api.setBase($("apiBase").value.trim() || defaultApiBase());
    try {
      if (registerMode) await Api.register(email, password);
      else await Api.login(email, password);
      localStorage.setItem("bac_sim_email", email);
      await refreshDashboard();
      showMain(email);
    } catch (e) {
      showError("authError", e.message);
    }
  });

  $("logoutBtn").addEventListener("click", async () => {
    await Api.logout();
    await Ble.disconnect();
    showAuth();
  });

  $("bleConnectBtn").addEventListener("click", async () => {
    showError("authError", null);
    try {
      if (navigator.bluetooth?.getAvailability) {
        const avail = await navigator.bluetooth.getAvailability();
        if (!avail) {
          logBle("Bluetooth adapter unavailable");
          return;
        }
      }
      const info = await Ble.connect();
      $("bleState").textContent = `Connecte: ${info.name}`;
      $("bleDisconnectBtn").disabled = false;
      $("wifiProvisionBtn").disabled = false;
      if (info.identity) {
        logBle(`Identity: ${info.identity.deviceName} / ${info.identity.serialNumber || "?"}`);
      } else {
        logBle("Warning: box identity not read");
      }
    } catch (e) {
      logBle(`Connect error: ${e.message}`);
    }
  });

  $("bleDisconnectBtn").addEventListener("click", async () => {
    await Ble.disconnect();
    $("bleState").textContent = "Non connecte";
    $("bleDisconnectBtn").disabled = true;
    $("wifiProvisionBtn").disabled = true;
    logBle("Disconnected");
  });

  $("wifiProvisionBtn").addEventListener("click", async () => {
    const ssid = $("wifiSsid").value.trim();
    const pass = $("wifiPass").value.trim();
    if (!ssid) return alert("SSID required");
    localStorage.setItem("bac_sim_wifi_ssid", ssid);
    localStorage.setItem("bac_sim_wifi_pass", pass);
    try {
      const wifiOk = await Ble.provisionWifi(ssid, pass, (s) => logBle(s));
      if (!wifiOk) {
        logBle("WiFi failed on box");
        return;
      }
      logBle("WiFi OK on box");
      const id = Ble.getIdentity();
      if (!id?.uuid || !id?.serialNumber) throw new Error("Box identity incomplete, reflash firmware");
      await claimWithRetry(id.uuid, id.serialNumber);
      await refreshDashboard();
      logBle("Setup complete");
    } catch (e) {
      logBle(`Error: ${e.message}`);
    }
  });

  $("generateCodeBtn").addEventListener("click", async () => {
    try {
      const data = await Api.generatePairingCode();
      $("pairingCode").textContent = data.code;
      $("pairingCode").classList.remove("hidden");
      logBle(`Code generated: ${data.code}`);
    } catch (e) {
      alert(e.message);
    }
  });

  $("copyCodeBtn").addEventListener("click", async () => {
    const code = $("pairingCode").textContent.trim();
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      logBle("Code copied");
    } catch (e) {
      alert(code);
    }
  });

  $("acceptCodeBtn").addEventListener("click", async () => {
    const code = $("acceptCodeInput").value.trim();
    if (!code) return;
    try {
      await Api.acceptPairingCode(code);
      await refreshDashboard();
      alert("Contact lie");
    } catch (e) {
      alert(e.message);
    }
  });

  $("sendMsgBtn").addEventListener("click", async () => {
    const text = $("messageText").value.trim();
    if (!text) return;
    try {
      const pairing = await Api.getPairingState();
      const targets = pairing.linked_targets || (pairing.linked_target ? [pairing.linked_target] : []);
      const targetId = targets[0]?.device_id;
      if (!targetId) throw new Error("No contact linked");
      const bacm = Bacm.packSimpleText(text);
      await Api.sendMessage(targetId, bacm);
      $("msgResult").textContent = "Message envoye";
      $("msgResult").className = "ok";
    } catch (e) {
      $("msgResult").textContent = e.message;
      $("msgResult").className = "error";
    }
  });

  $("apiBase").value = Api.loadBase(defaultApiBase());
  $("wifiSsid").value = localStorage.getItem("bac_sim_wifi_ssid") || "freebox_MAISON";
  $("wifiPass").value = localStorage.getItem("bac_sim_wifi_pass") || "";

  if (!Ble.supported()) {
    showError("authError", "Web Bluetooth requis (Chrome ou Edge, HTTPS ou localhost)");
  }

  const savedEmail = localStorage.getItem("bac_sim_email");
  if (savedEmail) $("authEmail").value = savedEmail;

  if (Api.loadTokens()) {
    refreshDashboard()
      .then(() => showMain(savedEmail || "session"))
      .catch(() => Api.clearSession());
  }
})();
