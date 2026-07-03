export class ApiException extends Error {
  status: number;
  constructor(message: string, status = 0) {
    super(message);
    this.status = status;
    this.name = "ApiException";
  }
}

export function mapApiError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("device not found"))
    return "La boîte n'est pas encore enregistrée sur le serveur. Attends une minute puis réessaie l'association.";
  if (m.includes("invalid uuid")) return "Identifiant de boîte invalide";
  if (m.includes("invalid serial")) return "Numéro de série invalide";
  if (m.includes("serial_number mismatch"))
    return "Le numéro de série ne correspond pas à la boîte";
  if (m.includes("invalid device name")) return "Nom de boîte invalide";
  if (m.includes("user already owns a device"))
    return "Tu as déjà une boîte liée à ce compte. Déconnecte-la d'abord ou utilise un autre compte.";
  if (m.includes("device already claimed")) return "Cette boîte est déjà associée à un compte";
  if (m.includes("claim your device first"))
    return "Associe d'abord ta boîte à ton compte avant de lier un contact";
  if (m.includes("invalid code")) return "Code invalide";
  if (m.includes("invalid credentials")) return "E-mail ou mot de passe incorrect";
  if (m.includes("email already registered")) return "Cet e-mail est déjà utilisé";
  if (m.includes("invalid email")) return "Adresse e-mail invalide";
  if (m.includes("password too short"))
    return "Mot de passe trop court (8 caractères minimum)";
  if (
    m.includes("missing token") ||
    m.includes("invalid token") ||
    m.includes("invalid refresh token")
  )
    return "Session expirée, reconnecte-toi";
  return message;
}

export function parseApiErrorMessage(text: string): string {
  let raw = text.trim();
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed.error === "string") raw = parsed.error;
  } catch {
    // keep raw text
  }
  return mapApiError(raw);
}
