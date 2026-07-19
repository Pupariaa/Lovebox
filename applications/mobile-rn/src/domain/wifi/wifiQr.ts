export type WifiQrPayload = {
  ssid: string;
  password: string;
  security?: string;
};

function unescapeWifiValue(value: string): string {
  return value.replace(/\\(.)/g, "$1");
}

export function parseWifiQr(raw: string): WifiQrPayload | null {
  const text = raw.trim();
  if (!/^WIFI:/i.test(text)) return null;

  const body = text.replace(/^WIFI:/i, "");
  const fields: Record<string, string> = {};
  const fieldRegex = /([A-Za-z]):((?:\\.|[^;])*);/g;
  let match: RegExpExecArray | null;

  while ((match = fieldRegex.exec(body)) !== null) {
    fields[match[1].toUpperCase()] = unescapeWifiValue(match[2]);
  }

  const ssid = fields.S;
  if (!ssid) return null;

  return {
    ssid,
    password: fields.P ?? "",
    security: fields.T,
  };
}
