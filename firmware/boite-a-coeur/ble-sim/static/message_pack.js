(function () {
  "use strict";

  const MSG_W = 280;
  const MSG_H = 240;
  const LAYER_STATIC = 0;
  const LAYER_ANIM = 1;

  function rgb888To565(r, g, b) {
    return (((r & 0xf8) << 8) | ((g & 0xfc) << 3) | (b >> 3)) & 0xffff;
  }

  function hexTo565(hex) {
    const h = hex.replace("#", "");
    const r = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);
    return rgb888To565(r, g, b);
  }

  function canvasTo565(canvas) {
    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;
    const img = ctx.getImageData(0, 0, w, h);
    const out = new Uint16Array(w * h);
    for (let i = 0; i < w * h; i++) {
      const p = i * 4;
      out[i] = rgb888To565(img.data[p], img.data[p + 1], img.data[p + 2]);
    }
    return { w, h, pixels: out };
  }

  function writeU16(view, off, v) {
    view.setUint16(off, v, true);
  }

  function writeU32(view, off, v) {
    view.setUint32(off, v, true);
  }

  function packLayerMeta(view, off, layer) {
    view.setUint8(off, layer.type);
    view.setUint8(off + 1, layer.fps || 0);
    writeU16(view, off + 2, layer.x);
    writeU16(view, off + 4, layer.y);
    writeU16(view, off + 6, layer.w);
    writeU16(view, off + 8, layer.h);
    writeU16(view, off + 10, layer.frameCount);
    writeU32(view, off + 12, layer.dataSize);
  }

  function packMessage(bg565, layers) {
    let total = 12 + bg565.pixels.length * 2;
    layers.forEach((L) => {
      total += 16 + L.data.byteLength;
    });
    const buf = new ArrayBuffer(total);
    const view = new DataView(buf);
    const bytes = new Uint8Array(buf);
    bytes[0] = 0x42;
    bytes[1] = 0x41;
    bytes[2] = 0x43;
    bytes[3] = 0x4d;
    writeU16(view, 4, 1);
    writeU16(view, 6, MSG_W);
    writeU16(view, 8, MSG_H);
    view.setUint8(10, layers.length);
    view.setUint8(11, 0);
    let off = 12;
    const bgCopy = new Uint16Array(bg565.pixels);
    bytes.set(new Uint8Array(bgCopy.buffer), off);
    off += bgCopy.byteLength;
    layers.forEach((L) => {
      packLayerMeta(view, off, L);
      off += 16;
      bytes.set(new Uint8Array(L.data.buffer, L.data.byteOffset, L.data.byteLength), off);
      off += L.data.byteLength;
    });
    return buf;
  }

  function blendPixel(bg565, x, y, fg565, alpha) {
    if (x < 0 || y < 0 || x >= MSG_W || y >= MSG_H) return;
    const bi = y * MSG_W + x;
    const R = window.LucarneRender;
    bg565.pixels[bi] = alpha >= 250 ? fg565 : R ? R.blend565(bg565.pixels[bi], fg565, alpha) : fg565;
  }

  function compositeImageDataOntoBg(bg565, img, ox, oy) {
    const w = img.width;
    const h = img.height;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const j = (y * w + x) * 4;
        const a = img.data[j + 3];
        if (a < 8) continue;
        const fg = rgb888To565(img.data[j], img.data[j + 1], img.data[j + 2]);
        blendPixel(bg565, ox + x, oy + y, fg, a);
      }
    }
  }

  function textFont(item) {
    const weight = item.fontWeight || "600";
    const size = item.fontSize || 22;
    const family = item.fontFamily || "Segoe UI, system-ui, sans-serif";
    return `${weight} ${size}px ${family}`;
  }

  function renderTextCanvas(item) {
    const w = item.w || MSG_W;
    const h = item.h || 36;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = item.color || "#e09090";
    ctx.font = textFont(item);
    ctx.textAlign = item.align || "center";
    ctx.textBaseline = "middle";
    const tx = item.align === "left" ? 8 : item.align === "right" ? w - 8 : w / 2;
    const lines = String(item.text || "").split("\n");
    const lh = item.fontSize || 22;
    const startY = h / 2 - ((lines.length - 1) * lh) / 2;
    lines.forEach((line, i) => {
      ctx.fillText(line, tx, startY + i * lh);
    });
    return canvas;
  }

  function bakeTextIntoBg(item, bg565) {
    const canvas = renderTextCanvas(item);
    compositeImageDataOntoBg(bg565, canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height), item.x | 0, item.y | 0);
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  function renderPhotoCanvas(item) {
    const w = item.w || 100;
    const h = item.h || 100;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    return { canvas, w, h };
  }

  async function drawPhotoOnCanvas(canvas, item) {
    if (!item.src) return;
    const img = await loadImage(item.src);
    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    const fit = item.fit || "cover";
    if (fit === "contain") {
      const scale = Math.min(w / img.width, h / img.height);
      const dw = img.width * scale;
      const dh = img.height * scale;
      ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
    } else {
      const scale = Math.max(w / img.width, h / img.height);
      const dw = img.width * scale;
      const dh = img.height * scale;
      ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
    }
  }

  async function bakePhotoIntoBg(item, bg565) {
    const { canvas } = renderPhotoCanvas(item);
    await drawPhotoOnCanvas(canvas, item);
    compositeImageDataOntoBg(bg565, canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height), item.x | 0, item.y | 0);
  }

  async function buildBackground565(scene) {
    const bgCanvas = document.createElement("canvas");
    bgCanvas.width = MSG_W;
    bgCanvas.height = MSG_H;
    const bgCtx = bgCanvas.getContext("2d");
    if (scene.bgType === "image" && scene.bgImage) {
      const img = await loadImage(scene.bgImage);
      const scale = Math.max(MSG_W / img.width, MSG_H / img.height);
      const dw = img.width * scale;
      const dh = img.height * scale;
      bgCtx.drawImage(img, (MSG_W - dw) / 2, (MSG_H - dh) / 2, dw, dh);
    } else {
      bgCtx.fillStyle = scene.bgColor || "#120310";
      bgCtx.fillRect(0, 0, MSG_W, MSG_H);
    }
    return canvasTo565(bgCanvas);
  }

  async function loadEmojiFrames(ref, size) {
    const FE = window.LucarneFluentEmoji;
    if (!FE || !FE.bakeForFlash) throw new Error("LucarneFluentEmoji not loaded");
    const pack = await FE.bakeForFlash(ref, size);
    if (!pack || !pack.frames || !pack.frames.length) throw new Error("emoji load failed");
    return pack;
  }

  function compositeAnimOnBg(bgPixels, bgW, bgH, frame, dx, dy, dw, dh) {
    const fw = frame.w;
    const fh = frame.h;
    for (let py = 0; py < dh; py++) {
      for (let px = 0; px < dw; px++) {
        const sx = Math.floor((px * fw) / dw);
        const sy = Math.floor((py * fh) / dh);
        const fi = sy * fw + sx;
        const a = frame.alpha ? frame.alpha[fi] : 255;
        if (a < 8) continue;
        const tx = dx + px;
        const ty = dy + py;
        if (tx < 0 || ty < 0 || tx >= bgW || ty >= bgH) continue;
        const fg = frame.pixels[fi];
        const bi = ty * bgW + tx;
        if (a >= 250) bgPixels[bi] = fg;
        else {
          const R = window.LucarneRender;
          bgPixels[bi] = R ? R.blend565(bgPixels[bi], fg, a) : fg;
        }
      }
    }
  }

  async function bakeStaticIconIntoBg(item, bg565) {
    const side = item.size || 64;
    const x = item.x | 0;
    const y = item.y | 0;
    const pack = await loadEmojiFrames(item.ref || item.icon, side);
    const bgCopy = new Uint16Array(bg565.pixels);
    compositeAnimOnBg(bgCopy, MSG_W, MSG_H, pack.frames[0], x, y, side, side);
    bg565.pixels = bgCopy;
  }

  async function buildAnimLayer(ref, bg565, rect, fps) {
    const pack = await loadEmojiFrames(ref, Math.max(rect.dw, rect.dh));
    const frames = [];
    for (let i = 0; i < pack.frames.length; i++) {
      const bgCopy = new Uint16Array(bg565.pixels);
      compositeAnimOnBg(bgCopy, bg565.w, bg565.h, pack.frames[i], rect.dx, rect.dy, rect.dw, rect.dh);
      const crop = document.createElement("canvas");
      crop.width = rect.w;
      crop.height = rect.h;
      const ctx = crop.getContext("2d");
      const img = ctx.createImageData(rect.w, rect.h);
      for (let y = 0; y < rect.h; y++) {
        for (let x = 0; x < rect.w; x++) {
          const c = bgCopy[(rect.y + y) * bg565.w + (rect.x + x)];
          const r = ((c >> 11) & 0x1f) << 3;
          const g = ((c >> 5) & 0x3f) << 2;
          const b = (c & 0x1f) << 3;
          const j = (y * rect.w + x) * 4;
          img.data[j] = r;
          img.data[j + 1] = g;
          img.data[j + 2] = b;
          img.data[j + 3] = 255;
        }
      }
      ctx.putImageData(img, 0, 0);
      const px = canvasTo565(crop);
      frames.push(px.pixels);
    }
    const frameBytes = frames[0].byteLength;
    const blob = new Uint16Array(frameBytes / 2 * frames.length);
    let off = 0;
    frames.forEach((f) => {
      blob.set(f, off / 2);
      off += frameBytes;
    });
    return {
      type: LAYER_ANIM,
      x: rect.x,
      y: rect.y,
      w: rect.w,
      h: rect.h,
      fps: fps || 12,
      frameCount: frames.length,
      data: blob,
      dataSize: blob.byteLength,
    };
  }

  async function buildFromScene(scene) {
    const bg565 = await buildBackground565(scene);
    const layers = [];
    for (const item of scene.layers || []) {
      if (item.hidden) continue;
      if (item.type === "text") {
        bakeTextIntoBg(item, bg565);
      } else if (item.type === "photo") {
        if (!item.src) continue;
        await bakePhotoIntoBg(item, bg565);
      } else if (item.type === "icon") {
        const side = item.size || 64;
        const x = item.x | 0;
        const y = item.y | 0;
        const rect = { x, y, w: side, h: side, dx: x, dy: y, dw: side, dh: side };
        if (item.anim) {
          layers.push(await buildAnimLayer(item.ref || item.icon, bg565, rect, item.fps || 12));
        } else {
          await bakeStaticIconIntoBg(item, bg565);
        }
      }
    }
    return packMessage(bg565, layers);
  }

  function layerBounds(item) {
    if (item.type === "text") {
      return { x: item.x | 0, y: item.y | 0, w: item.w || MSG_W, h: item.h || 36 };
    }
    if (item.type === "photo") {
      return { x: item.x | 0, y: item.y | 0, w: item.w || 100, h: item.h || 100 };
    }
    if (item.type === "icon") {
      const s = item.size || 64;
      return { x: item.x | 0, y: item.y | 0, w: s, h: s };
    }
    return { x: 0, y: 0, w: 0, h: 0 };
  }

  async function renderScenePreview(canvas, scene, opts) {
    opts = opts || {};
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, MSG_W, MSG_H);
    if (scene.bgType === "image" && scene.bgImage) {
      try {
        const img = await loadImage(scene.bgImage);
        const scale = Math.max(MSG_W / img.width, MSG_H / img.height);
        const dw = img.width * scale;
        const dh = img.height * scale;
        ctx.drawImage(img, (MSG_W - dw) / 2, (MSG_H - dh) / 2, dw, dh);
      } catch (e) {
        ctx.fillStyle = scene.bgColor || "#120310";
        ctx.fillRect(0, 0, MSG_W, MSG_H);
      }
    } else {
      ctx.fillStyle = scene.bgColor || "#120310";
      ctx.fillRect(0, 0, MSG_W, MSG_H);
    }
    const FE = window.LucarneFluentEmoji;
    for (const item of scene.layers || []) {
      if (item.hidden) continue;
      if (item.type === "text") {
        const tc = renderTextCanvas(item);
        ctx.drawImage(tc, item.x | 0, item.y | 0);
      } else if (item.type === "photo" && item.src) {
        const { canvas: pc } = renderPhotoCanvas(item);
        await drawPhotoOnCanvas(pc, item);
        ctx.drawImage(pc, item.x | 0, item.y | 0);
      } else if (item.type === "icon" && FE) {
        const s = item.size || 64;
        try {
          await FE.ensureManifest();
          const id = FE.parseEmojiRef(item.ref || item.icon);
          if (id) {
            const ic = await FE.ensureIcon(id);
            const url = ic && ic.player ? null : FE.pngUrl(FE.normalizeLegacyId(id));
            if (url) {
              const img = await loadImage(url);
              ctx.drawImage(img, item.x | 0, item.y | 0, s, s);
            }
          }
        } catch (e) {}
      }
    }
    if (opts.selectedId) {
      const sel = (scene.layers || []).find((L) => L.id === opts.selectedId);
      if (sel && !sel.hidden) {
        const b = layerBounds(sel);
        ctx.strokeStyle = "rgba(232, 93, 117, 0.9)";
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 3]);
        ctx.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
        ctx.setLineDash([]);
      }
    }
  }

  function createDefaultScene() {
    return {
      bgType: "color",
      bgColor: "#120310",
      bgImage: null,
      layers: [
        {
          id: "t1",
          type: "text",
          text: "Nouveau message",
          x: 0,
          y: 58,
          w: MSG_W,
          h: 40,
          color: "#e09090",
          fontSize: 22,
          fontWeight: "600",
          align: "center",
        },
        {
          id: "i1",
          type: "icon",
          ref: "emoji:1f48c",
          x: 108,
          y: 108,
          size: 64,
          anim: true,
          fps: 12,
        },
      ],
    };
  }

  function uid() {
    return "l" + Math.random().toString(36).slice(2, 9);
  }

  window.BacMessagePack = {
    MSG_W,
    MSG_H,
    LAYER_STATIC,
    LAYER_ANIM,
    packMessage,
    buildFromScene,
    renderScenePreview,
    createDefaultScene,
    layerBounds,
    uid,
    canvasTo565,
    hexTo565,
  };
})();
