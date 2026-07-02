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
    const owned = deviceRes.device;
    const pairing = pairingRes;
    cards.appendChild(card(
      "Ma boite",
      owned ? `${owned.device_name} (id ${owned.id})` : "Aucune boite associee",
    ));
    cards.appendChild(card(
      "Partenaire",
      pairing.linked_target
        ? `${pairing.linked_target.device_name} (id ${pairing.linked_target.device_id})`
        : "Pas de partenaire",
    ));
    renderPending(pairing.pending_requests || []);
  }

  function card(title, body) {
    const div = document.createElement("div");
    div.className = "card";
    div.innerHTML = `<strong>${title}</strong>${body}`;
    return div;
  }

  function renderPending(requests) {
    const box = $("pendingRequests");
    box.innerHTML = "";
    if (!requests.length) return;
    const title = document.createElement("p");
    title.className = "muted";
    title.textContent = "Demandes en attente:";
    box.appendChild(title);
    requests.forEach((r) => {
      const row = document.createElement("div");
      row.className = "row";
      row.style.marginTop = "8px";
      const label = document.createElement("span");
      label.textContent = `${r.from_email} (#${r.pairing_id})`;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn";
      btn.textContent = "Accepter";
      btn.addEventListener("click", async () => {
        try {
          await Api.acceptRequest(r.pairing_id);
          await refreshDashboard();
        } catch (e) {
          alert(e.message);
        }
      });
      row.appendChild(label);
      row.appendChild(btn);
      box.appendChild(row);
    });
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

  async function claimWithRetry(deviceName, serialNumber) {
    const delays = [2000, 3000, 3000, 3000, 3000, 3000];
    for (let i = 0; i < delays.length; i++) {
      logBle(`Claim attempt ${i + 1} (${deviceName})...`);
      try {
        await Api.claimDevice(deviceName, serialNumber);
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
        logBle(`Identity: ${info.identity.deviceName}${info.identity.serialNumber ? " / " + info.identity.serialNumber : ""}`);
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
      if (!id?.deviceName) throw new Error("Box identity missing, reflash firmware");
      await claimWithRetry(id.deviceName, id.serialNumber);
      await refreshDashboard();
      logBle("Setup complete");
    } catch (e) {
      logBle(`Error: ${e.message}`);
    }
  });

  $("inviteBtn").addEventListener("click", async () => {
    try {
      const data = await Api.createInvite();
      const el = $("inviteUrl");
      el.textContent = data.url || data.deep_link || JSON.stringify(data);
      el.classList.remove("hidden");
    } catch (e) {
      alert(e.message);
    }
  });

  $("acceptInviteBtn").addEventListener("click", async () => {
    const raw = $("inviteToken").value.trim();
    const token = raw.includes("/") ? raw.split("/").pop() : raw;
    try {
      await Api.acceptInvite(token);
      await refreshDashboard();
      alert("Invitation acceptee");
    } catch (e) {
      alert(e.message);
    }
  });

  $("sendMsgBtn").addEventListener("click", async () => {
    const text = $("messageText").value.trim();
    if (!text) return;
    try {
      const pairing = await Api.getPairingState();
      const targetId = pairing.linked_target?.device_id;
      if (!targetId) throw new Error("No partner linked");
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
