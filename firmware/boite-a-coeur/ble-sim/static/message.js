(function () {
  "use strict";

  const P = window.BacMessagePack;
  if (!P) return;

  const STORAGE_KEY = "bac_message_draft_v2";
  const preview = document.getElementById("msgPreview");
  const logEl = document.getElementById("msgLog");
  const deviceList = document.getElementById("msgDeviceList");
  const deviceEmpty = document.getElementById("msgDeviceEmpty");
  const ipInput = document.getElementById("msgIp");
  const layerList = document.getElementById("msgLayerList");
  const inspector = document.getElementById("msgInspector");
  const emojiPanel = document.getElementById("msgEmojiPanel");
  const emojiGrid = document.getElementById("msgEmojiGrid");
  const emojiSearch = document.getElementById("msgEmojiSearch");
  const statusEl = document.getElementById("msgStatus");

  let scene = loadScene();
  let selectedId = scene.layers[0] ? scene.layers[0].id : null;
  let drag = null;
  let previewToken = 0;
  let emojiTargetLayerId = null;

  function loadScene() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        if (s && Array.isArray(s.layers)) return s;
      }
    } catch (e) {}
    return P.createDefaultScene();
  }

  function saveScene() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(scene));
    } catch (e) {}
  }

  function selectedLayer() {
    return scene.layers.find((L) => L.id === selectedId) || null;
  }

  function log(line) {
    if (!logEl) return;
    const t = new Date().toLocaleTimeString();
    logEl.textContent = `[${t}] ${line}\n` + logEl.textContent;
  }

  function setStatus(text) {
    if (statusEl) statusEl.textContent = text;
  }

  async function refreshPreview() {
    if (!preview) return;
    const token = ++previewToken;
    await P.renderScenePreview(preview, scene, { selectedId });
    if (token !== previewToken) return;
  }

  function schedulePreview() {
    refreshPreview();
    saveScene();
  }

  function moveLayer(id, dir) {
    const i = scene.layers.findIndex((L) => L.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= scene.layers.length) return;
    const tmp = scene.layers[i];
    scene.layers[i] = scene.layers[j];
    scene.layers[j] = tmp;
    renderLayers();
    schedulePreview();
  }

  function removeLayer(id) {
    scene.layers = scene.layers.filter((L) => L.id !== id);
    if (selectedId === id) selectedId = scene.layers.length ? scene.layers[scene.layers.length - 1].id : null;
    renderLayers();
    renderInspector();
    schedulePreview();
  }

  function addLayer(type) {
    let layer;
    if (type === "text") {
      layer = {
        id: P.uid(),
        type: "text",
        text: "Your text",
        x: 0,
        y: 40,
        w: P.MSG_W,
        h: 36,
        color: "#f0d0d0",
        fontSize: 20,
        fontWeight: "600",
        align: "center",
      };
    } else if (type === "photo") {
      layer = {
        id: P.uid(),
        type: "photo",
        src: null,
        x: 90,
        y: 70,
        w: 100,
        h: 100,
        fit: "cover",
      };
    } else {
      layer = {
        id: P.uid(),
        type: "icon",
        ref: "emoji:2764-fe0f",
        x: 108,
        y: 108,
        size: 64,
        anim: true,
        fps: 12,
      };
    }
    scene.layers.push(layer);
    selectedId = layer.id;
    renderLayers();
    renderInspector();
    schedulePreview();
  }

  function layerLabel(L) {
    if (L.type === "text") return "Text: " + (L.text || "").split("\n")[0].slice(0, 24);
    if (L.type === "photo") return L.src ? "Photo" : "Photo (empty)";
    if (L.type === "icon") return "Emoji " + (L.ref || "").replace("emoji:", "");
    return L.type;
  }

  function renderLayers() {
    if (!layerList) return;
    layerList.innerHTML = "";
    scene.layers.forEach((L, idx) => {
      const li = document.createElement("li");
      li.className = "msg-layer-item" + (L.id === selectedId ? " active" : "") + (L.hidden ? " hidden-layer" : "");
      li.dataset.id = L.id;

      const main = document.createElement("button");
      main.type = "button";
      main.className = "msg-layer-select";
      main.textContent = layerLabel(L);
      main.addEventListener("click", () => {
        selectedId = L.id;
        renderLayers();
        renderInspector();
        schedulePreview();
      });

      const actions = document.createElement("div");
      actions.className = "msg-layer-actions";

      const up = document.createElement("button");
      up.type = "button";
      up.className = "icon-btn";
      up.title = "Move up";
      up.textContent = "\u2191";
      up.disabled = idx === 0;
      up.addEventListener("click", (e) => {
        e.stopPropagation();
        moveLayer(L.id, -1);
      });

      const down = document.createElement("button");
      down.type = "button";
      down.className = "icon-btn";
      down.title = "Move down";
      down.textContent = "\u2193";
      down.disabled = idx === scene.layers.length - 1;
      down.addEventListener("click", (e) => {
        e.stopPropagation();
        moveLayer(L.id, 1);
      });

      const del = document.createElement("button");
      del.type = "button";
      del.className = "icon-btn danger";
      del.title = "Delete";
      del.textContent = "\u00d7";
      del.addEventListener("click", (e) => {
        e.stopPropagation();
        removeLayer(L.id);
      });

      actions.appendChild(up);
      actions.appendChild(down);
      actions.appendChild(del);
      li.appendChild(main);
      li.appendChild(actions);
      layerList.appendChild(li);
    });
  }

  function field(label, el) {
    const wrap = document.createElement("div");
    wrap.className = "field";
    const lbl = document.createElement("label");
    lbl.textContent = label;
    wrap.appendChild(lbl);
    wrap.appendChild(el);
    return wrap;
  }

  function renderInspector() {
    if (!inspector) return;
    inspector.innerHTML = "";

    const bgTitle = document.createElement("h3");
    bgTitle.textContent = "Background";
    inspector.appendChild(bgTitle);

    const bgRow = document.createElement("div");
    bgRow.className = "seg-row";
    ["color", "image"].forEach((mode) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "seg-btn" + (scene.bgType === mode ? " active" : "");
      btn.textContent = mode === "color" ? "Color" : "Photo";
      btn.addEventListener("click", () => {
        scene.bgType = mode;
        renderInspector();
        schedulePreview();
      });
      bgRow.appendChild(btn);
    });
    inspector.appendChild(bgRow);

    if (scene.bgType === "color") {
      const color = document.createElement("input");
      color.type = "color";
      color.value = scene.bgColor || "#120310";
      color.addEventListener("input", () => {
        scene.bgColor = color.value;
        schedulePreview();
      });
      inspector.appendChild(field("Color", color));
    } else {
      const file = document.createElement("input");
      file.type = "file";
      file.accept = "image/*";
      file.addEventListener("change", () => {
        const f = file.files && file.files[0];
        if (!f) return;
        const reader = new FileReader();
        reader.onload = () => {
          scene.bgImage = reader.result;
          schedulePreview();
          renderInspector();
        };
        reader.readAsDataURL(f);
      });
      inspector.appendChild(field("Upload background", file));
      if (scene.bgImage) {
        const clear = document.createElement("button");
        clear.type = "button";
        clear.className = "secondary small-btn";
        clear.textContent = "Remove background photo";
        clear.addEventListener("click", () => {
          scene.bgImage = null;
          schedulePreview();
          renderInspector();
        });
        inspector.appendChild(clear);
      }
    }

    const L = selectedLayer();
    if (!L) {
      const hint = document.createElement("p");
      hint.className = "hint";
      hint.textContent = "Add a layer or select one in the list.";
      inspector.appendChild(hint);
      return;
    }

    const layerTitle = document.createElement("h3");
    layerTitle.textContent = "Selected layer";
    inspector.appendChild(layerTitle);

    const xyRow = document.createElement("div");
    xyRow.className = "grid-2";
    ["x", "y"].forEach((key) => {
      const inp = document.createElement("input");
      inp.type = "number";
      inp.value = L[key] | 0;
      inp.addEventListener("input", () => {
        L[key] = parseInt(inp.value, 10) || 0;
        schedulePreview();
      });
      xyRow.appendChild(field(key.toUpperCase(), inp));
    });
    inspector.appendChild(xyRow);

    if (L.type === "text") {
      const text = document.createElement("textarea");
      text.rows = 3;
      text.value = L.text || "";
      text.addEventListener("input", () => {
        L.text = text.value;
        renderLayers();
        schedulePreview();
      });
      inspector.appendChild(field("Text", text));

      const color = document.createElement("input");
      color.type = "color";
      color.value = L.color || "#e09090";
      color.addEventListener("input", () => {
        L.color = color.value;
        schedulePreview();
      });
      inspector.appendChild(field("Color", color));

      const size = document.createElement("input");
      size.type = "number";
      size.min = "12";
      size.max = "36";
      size.value = L.fontSize || 22;
      size.addEventListener("input", () => {
        L.fontSize = parseInt(size.value, 10) || 22;
        schedulePreview();
      });
      inspector.appendChild(field("Font size", size));

      const align = document.createElement("select");
      ["center", "left", "right"].forEach((a) => {
        const o = document.createElement("option");
        o.value = a;
        o.textContent = a;
        if ((L.align || "center") === a) o.selected = true;
        align.appendChild(o);
      });
      align.addEventListener("change", () => {
        L.align = align.value;
        schedulePreview();
      });
      inspector.appendChild(field("Align", align));

      const h = document.createElement("input");
      h.type = "number";
      h.min = "20";
      h.max = "120";
      h.value = L.h || 36;
      h.addEventListener("input", () => {
        L.h = parseInt(h.value, 10) || 36;
        schedulePreview();
      });
      inspector.appendChild(field("Block height", h));
    }

    if (L.type === "photo") {
      const file = document.createElement("input");
      file.type = "file";
      file.accept = "image/*";
      file.addEventListener("change", () => {
        const f = file.files && file.files[0];
        if (!f) return;
        const reader = new FileReader();
        reader.onload = () => {
          L.src = reader.result;
          renderLayers();
          schedulePreview();
        };
        reader.readAsDataURL(f);
      });
      inspector.appendChild(field("Photo file", file));

      const wh = document.createElement("div");
      wh.className = "grid-2";
      ["w", "h"].forEach((key) => {
        const inp = document.createElement("input");
        inp.type = "number";
        inp.min = "16";
        inp.max = "280";
        inp.value = L[key] || 100;
        inp.addEventListener("input", () => {
          L[key] = parseInt(inp.value, 10) || 100;
          schedulePreview();
        });
        wh.appendChild(field(key.toUpperCase(), inp));
      });
      inspector.appendChild(wh);

      const fit = document.createElement("select");
      [["cover", "Fill"], ["contain", "Fit"]].forEach(([v, lbl]) => {
        const o = document.createElement("option");
        o.value = v;
        o.textContent = lbl;
        if ((L.fit || "cover") === v) o.selected = true;
        fit.appendChild(o);
      });
      fit.addEventListener("change", () => {
        L.fit = fit.value;
        schedulePreview();
      });
      inspector.appendChild(field("Fit", fit));
    }

    if (L.type === "icon") {
      const pick = document.createElement("button");
      pick.type = "button";
      pick.className = "secondary";
      pick.textContent = "Choose emoji";
      pick.addEventListener("click", () => openEmojiPicker(L.id));
      inspector.appendChild(pick);

      const ref = document.createElement("input");
      ref.type = "text";
      ref.value = L.ref || "";
      ref.placeholder = "emoji:1f48c";
      ref.addEventListener("change", () => {
        L.ref = ref.value.trim();
        renderLayers();
        schedulePreview();
      });
      inspector.appendChild(field("Reference", ref));

      const size = document.createElement("input");
      size.type = "number";
      size.min = "24";
      size.max = "128";
      size.value = L.size || 64;
      size.addEventListener("input", () => {
        L.size = parseInt(size.value, 10) || 64;
        schedulePreview();
      });
      inspector.appendChild(field("Size", size));

      const animLbl = document.createElement("label");
      animLbl.className = "check";
      const anim = document.createElement("input");
      anim.type = "checkbox";
      anim.checked = !!L.anim;
      anim.addEventListener("change", () => {
        L.anim = anim.checked;
        schedulePreview();
      });
      animLbl.appendChild(anim);
      animLbl.appendChild(document.createTextNode(" Animated"));
      inspector.appendChild(animLbl);
    }
  }

  function hitTest(px, py) {
    for (let i = scene.layers.length - 1; i >= 0; i--) {
      const L = scene.layers[i];
      if (L.hidden) continue;
      const b = P.layerBounds(L);
      if (px >= b.x && py >= b.y && px < b.x + b.w && py < b.y + b.h) return L;
    }
    return null;
  }

  function previewCoords(evt) {
    const r = preview.getBoundingClientRect();
    const px = Math.round(((evt.clientX - r.left) / r.width) * P.MSG_W);
    const py = Math.round(((evt.clientY - r.top) / r.height) * P.MSG_H);
    return { px, py };
  }

  function setupPreviewDrag() {
    if (!preview) return;
    preview.addEventListener("mousedown", (evt) => {
      const { px, py } = previewCoords(evt);
      const L = hitTest(px, py);
      if (!L) return;
      selectedId = L.id;
      renderLayers();
      renderInspector();
      drag = { id: L.id, ox: px - (L.x | 0), oy: py - (L.y | 0) };
      schedulePreview();
      evt.preventDefault();
    });
    window.addEventListener("mousemove", (evt) => {
      if (!drag) return;
      const L = scene.layers.find((x) => x.id === drag.id);
      if (!L) return;
      const { px, py } = previewCoords(evt);
      L.x = Math.max(0, Math.min(P.MSG_W - 8, px - drag.ox));
      L.y = Math.max(0, Math.min(P.MSG_H - 8, py - drag.oy));
      renderInspector();
      schedulePreview();
    });
    window.addEventListener("mouseup", () => {
      drag = null;
    });
  }

  async function openEmojiPicker(layerId) {
    emojiTargetLayerId = layerId;
    if (!emojiPanel) return;
    emojiPanel.hidden = false;
    await renderEmojiGrid(emojiSearch ? emojiSearch.value : "");
  }

  async function renderEmojiGrid(query) {
    if (!emojiGrid) return;
    const FE = window.LucarneFluentEmoji;
    if (!FE) return;
    await FE.ensureManifest();
    const icons = FE.searchIcons(query, "all", 48);
    emojiGrid.innerHTML = "";
    icons.forEach((ic) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "emoji-cell";
      btn.title = ic.label || ic.id;
      const img = document.createElement("img");
      img.src = FE.pngUrl(ic.id);
      img.alt = ic.label || ic.id;
      img.width = 32;
      img.height = 32;
      btn.appendChild(img);
      btn.addEventListener("click", () => {
        const L = scene.layers.find((x) => x.id === emojiTargetLayerId);
        if (L && L.type === "icon") {
          L.ref = FE.emojiRef(ic.id);
          L.anim = !!ic.animated;
          renderLayers();
          renderInspector();
          schedulePreview();
        }
        if (emojiPanel) emojiPanel.hidden = true;
      });
      emojiGrid.appendChild(btn);
    });
  }

  function renderDevices(devices) {
    if (!deviceList) return;
    deviceList.innerHTML = "";
    if (!devices.length) {
      if (deviceEmpty) deviceEmpty.hidden = false;
      return;
    }
    if (deviceEmpty) deviceEmpty.hidden = true;
    devices.forEach((d) => {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "device-btn";
      btn.textContent = (d.name || "Boite") + " \u2014 " + (d.ip || "?");
      btn.addEventListener("click", () => {
        if (ipInput) ipInput.value = d.ip || "";
        log("Selected " + btn.textContent);
      });
      li.appendChild(btn);
      deviceList.appendChild(li);
    });
  }

  async function discover() {
    log("Scanning LAN...");
    setStatus("Discovering...");
    const r = await fetch("/api/discover");
    const j = await r.json();
    if (!j.ok) {
      log("Discover failed");
      setStatus("Discover failed");
      return;
    }
    log("Found " + j.devices.length + " box(es) on " + j.subnet + ".x");
    setStatus(j.devices.length + " box(es) found");
    renderDevices(j.devices || []);
  }

  async function sendMessage() {
    const ip = ipInput ? ipInput.value.trim() : "";
    if (!ip) {
      log("IP required");
      setStatus("IP required");
      return;
    }
    log("Building packet...");
    setStatus("Building...");
    let packet;
    try {
      packet = await P.buildFromScene(scene);
    } catch (e) {
      log("Build failed: " + e.message);
      setStatus("Build failed");
      return;
    }
    log("Sending " + packet.byteLength + " bytes to " + ip);
    setStatus("Sending...");
    const r = await fetch("/api/send-message?ip=" + encodeURIComponent(ip), {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream" },
      body: packet,
    });
    const j = await r.json();
    if (j.ok) {
      log("Sent OK (" + j.bytes + " bytes)");
      setStatus("Sent");
    } else {
      log("Send failed: " + (j.error || "unknown"));
      setStatus("Send failed");
    }
  }

  function resetScene() {
    scene = P.createDefaultScene();
    selectedId = scene.layers[0] ? scene.layers[0].id : null;
    renderLayers();
    renderInspector();
    schedulePreview();
    log("Reset to default");
  }

  document.getElementById("msgDiscoverBtn")?.addEventListener("click", discover);
  document.getElementById("msgSendBtn")?.addEventListener("click", sendMessage);
  document.getElementById("msgAddText")?.addEventListener("click", () => addLayer("text"));
  document.getElementById("msgAddPhoto")?.addEventListener("click", () => addLayer("photo"));
  document.getElementById("msgAddIcon")?.addEventListener("click", () => addLayer("icon"));
  document.getElementById("msgResetBtn")?.addEventListener("click", resetScene);
  document.getElementById("msgEmojiClose")?.addEventListener("click", () => {
    if (emojiPanel) emojiPanel.hidden = true;
  });
  emojiSearch?.addEventListener("input", () => {
    renderEmojiGrid(emojiSearch.value);
  });

  setupPreviewDrag();

  if (preview) {
    preview.width = P.MSG_W;
    preview.height = P.MSG_H;
    renderLayers();
    renderInspector();
    refreshPreview();
  }
})();
