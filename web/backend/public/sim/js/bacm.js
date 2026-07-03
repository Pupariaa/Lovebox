const Bacm = (() => {
  const MSG_W = 280;
  const MSG_H = 240;

  function rgb888To565(r, g, b) {
    return (((r & 0xf8) << 8) | ((g & 0xfc) << 3) | (b >> 3)) & 0xffff;
  }

  function canvasTo565(canvas) {
    const ctx = canvas.getContext("2d");
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const out = new Uint16Array(canvas.width * canvas.height);
    for (let i = 0; i < out.length; i++) {
      const p = i * 4;
      out[i] = rgb888To565(img.data[p], img.data[p + 1], img.data[p + 2]);
    }
    return out;
  }

  function packMessage(bg565) {
    const total = 12 + bg565.length * 2;
    const buf = new ArrayBuffer(total);
    const view = new DataView(buf);
    const bytes = new Uint8Array(buf);
    bytes[0] = 0x42;
    bytes[1] = 0x41;
    bytes[2] = 0x43;
    bytes[3] = 0x4d;
    view.setUint16(4, 1, true);
    view.setUint16(6, MSG_W, true);
    view.setUint16(8, MSG_H, true);
    view.setUint8(10, 0);
    view.setUint8(11, 0);
    bytes.set(new Uint8Array(bg565.buffer), 12);
    return buf;
  }

  function packSimpleText(text, opts = {}) {
    const bgColor = opts.bgColor || "#2a1520";
    const textColor = opts.textColor || "#e8a0b0";
    const canvas = document.createElement("canvas");
    canvas.width = MSG_W;
    canvas.height = MSG_H;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, MSG_W, MSG_H);
    ctx.fillStyle = textColor;
    ctx.font = "600 22px Segoe UI, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const lines = String(text || "").split("\n").slice(0, 6);
    const lh = 26;
    const startY = MSG_H / 2 - ((lines.length - 1) * lh) / 2;
    lines.forEach((line, i) => {
      ctx.fillText(line, MSG_W / 2, startY + i * lh);
    });
    return packMessage(canvasTo565(canvas));
  }

  return { packSimpleText, MSG_W, MSG_H };
})();
