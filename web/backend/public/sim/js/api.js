const Api = (() => {
  let baseUrl = "";
  let accessToken = null;
  let refreshToken = null;

  function setBase(url) {
    baseUrl = url.replace(/\/$/, "");
    localStorage.setItem("bac_sim_api", baseUrl);
  }

  function loadBase(defaultUrl) {
    baseUrl = localStorage.getItem("bac_sim_api") || defaultUrl;
    return baseUrl;
  }

  function saveTokens(access, refresh) {
    accessToken = access;
    refreshToken = refresh;
    if (access) localStorage.setItem("bac_sim_access", access);
    else localStorage.removeItem("bac_sim_access");
    if (refresh) localStorage.setItem("bac_sim_refresh", refresh);
    else localStorage.removeItem("bac_sim_refresh");
  }

  function loadTokens() {
    accessToken = localStorage.getItem("bac_sim_access");
    refreshToken = localStorage.getItem("bac_sim_refresh");
    return !!accessToken;
  }

  function clearSession() {
    saveTokens(null, null);
  }

  async function request(path, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (accessToken && !headers.Authorization) {
      headers.Authorization = `Bearer ${accessToken}`;
    }
    if (options.body && !(options.body instanceof ArrayBuffer) && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }
    const res = await fetch(`${baseUrl}${path}`, { ...options, headers });
    if (res.status === 401 && refreshToken && !options._retried) {
      await refresh();
      return request(path, { ...options, _retried: true });
    }
    if (options.raw) return res;
    const text = await res.text();
    let data = {};
    if (text) {
      try { data = JSON.parse(text); } catch (_) { data = { error: text }; }
    }
    if (!res.ok) {
      throw new Error(data.error || res.statusText || "request failed");
    }
    return data;
  }

  async function register(email, password) {
    const data = await request("/api/v1/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    saveTokens(data.access_token, data.refresh_token);
    return data;
  }

  async function login(email, password) {
    const data = await request("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    saveTokens(data.access_token, data.refresh_token);
    return data;
  }

  async function refresh() {
    const data = await request("/api/v1/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    saveTokens(data.access_token, data.refresh_token);
    return data;
  }

  async function logout() {
    if (refreshToken) {
      await request("/api/v1/auth/logout", {
        method: "POST",
        body: JSON.stringify({ refresh_token: refreshToken }),
      }).catch(() => {});
    }
    clearSession();
  }

  async function getMyDevice() {
    return request("/api/v1/devices/me");
  }

  async function claimDevice(uuid, serialNumber) {
    return request("/api/v1/devices/claim", {
      method: "POST",
      body: JSON.stringify({ uuid, serial_number: serialNumber }),
    });
  }

  async function getPairingState() {
    return request("/api/v1/pairings/me");
  }

  async function generatePairingCode() {
    return request("/api/v1/pairings/code/generate", { method: "POST", body: "{}" });
  }

  async function acceptPairingCode(code) {
    return request("/api/v1/pairings/code/accept", {
      method: "POST",
      body: JSON.stringify({ code }),
    });
  }

  async function sendMessage(targetDeviceId, bacmBuffer) {
    return request(`/api/v1/messages?target_device_id=${targetDeviceId}`, {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream" },
      body: bacmBuffer,
    });
  }

  return {
    setBase,
    loadBase,
    loadTokens,
    clearSession,
    register,
    login,
    logout,
    getMyDevice,
    claimDevice,
    getPairingState,
    generatePairingCode,
    acceptPairingCode,
    sendMessage,
  };
})();
