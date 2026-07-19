export class ApiException extends Error {
  status: number;
  constructor(message: string, status = 0) {
    super(message);
    this.status = status;
    this.name = "ApiException";
  }
}

function finishFrenchSentence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed || /[.!?…]$/.test(trimmed)) return trimmed;
  return `${trimmed}.`;
}

export function mapApiError(message: string): string {
  const m = message.toLowerCase().trim();
  if (m.includes("request timeout") || m.includes("timed out") || m.includes("timeout"))
    return "Le serveur met trop de temps à répondre. Vérifie ta connexion et réessaie.";
  if (m.includes("network request failed") || m.includes("network error"))
    return "Connexion au serveur impossible. Vérifie ta connexion internet.";
  if (m.includes("invalid server response"))
    return "Réponse du serveur illisible. Réessaie dans un instant.";
  if (m.includes("non connect")) return "Non connecté.";
  if (m.includes("bluetooth desactiv")) return "Bluetooth désactivé.";
  if (m.includes("session expir")) return "Session expirée, reconnecte-toi.";
  if (m.includes("device not found"))
    return "La boîte n'est pas encore enregistrée sur le serveur. Attends une minute puis réessaie l'association.";
  if (m.includes("invalid uuid")) return "Identifiant de boîte invalide.";
  if (m.includes("invalid serial")) return "Numéro de série invalide.";
  if (m.includes("serial_number mismatch"))
    return "Le numéro de série ne correspond pas à la boîte.";
  if (m.includes("invalid device name")) return "Nom de boîte invalide.";
  if (m.includes("user already owns a device"))
    return "Tu as déjà une boîte liée à ce compte. Déconnecte-la d'abord ou utilise un autre compte.";
  if (m.includes("device already claimed")) return "Cette boîte est déjà associée à un compte.";
  if (m.includes("claim your device first"))
    return "Associe d'abord ta boîte à ton compte avant de lier un contact.";
  if (m.includes("invalid code")) return "Code invalide.";
  if (m.includes("account_not_found")) return "Aucun compte trouvé pour ce fournisseur.";
  if (m.includes("email already registered")) return "Cet e-mail est déjà utilisé.";
  if (m.includes("invalid email")) return "Adresse e-mail invalide.";
  if (m.includes("invalid credentials")) return "Identifiants incorrects.";
  if (m.includes("invalid or expired code")) return "Code invalide ou expiré.";
  if (m.includes("invalid or expired token")) return "Lien invalide ou expiré.";
  if (m.includes("no active pairing")) return "Aucun contact actif.";
  if (m.includes("pairing not found")) return "Contact introuvable.";
  if (m.includes("rate limit exceeded")) return "Trop de tentatives. Réessaie dans quelques minutes.";
  if (m.includes("first_name required")) return "Le prénom est obligatoire.";
  if (m.includes("private relay email not allowed"))
    return "Les adresses e-mail masquées Apple ne sont pas acceptées.";
  if (m.includes("contact email not verified"))
    return "Confirme d'abord ton e-mail de contact.";
  if (m.includes("password not allowed"))
    return "Mot de passe non disponible pour ce compte.";
  if (m.includes("cannot link to yourself")) return "Tu ne peux pas t'ajouter toi-même.";
  if (m.includes("cannot link to your own device"))
    return "Tu ne peux pas lier ta propre boîte comme contact.";
  if (m.includes("user not found")) return "Compte introuvable.";
  if (m.includes("not found")) return "Introuvable.";
  if (m.includes("email not provided by provider"))
    return "E-mail non fourni par le fournisseur de connexion.";
  if (m.includes("oauth token exchange failed"))
    return "Échec de la connexion OAuth. Réessaie.";
  if (m.includes("oauth provider not configured"))
    return "Connexion OAuth indisponible.";
  if (m.includes("oauth provider unknown")) return "Fournisseur OAuth inconnu.";
  if (m.includes("apple oauth not configured"))
    return "Connexion Apple indisponible.";
  if (m.includes("missing oauth code") || m.includes("missing code"))
    return "Connexion OAuth interrompue. Réessaie.";
  if (m.includes("device not claimed"))
    return "Cette boîte n'est pas encore associée à un compte.";
  if (m.includes("invalid action")) return "Action invalide.";
  if (m.includes("unauthorized")) return "Accès non autorisé.";
  if (m.includes("provider user id missing"))
    return "Identifiant du fournisseur de connexion manquant.";
  if (m.includes("oauth token missing")) return "Connexion OAuth incomplète. Réessaie.";
  if (m.includes("missing apple credentials"))
    return "Connexion Apple interrompue. Réessaie.";
  if (m.includes("unknown command")) return "Commande inconnue.";
  if (m.includes("config command needs"))
    return "Réglage invalide : nom ou région manquant.";
  if (m.includes("password too short"))
    return "Mot de passe trop court (8 caractères minimum).";
  if (
    m.includes("missing token") ||
    m.includes("invalid token") ||
    m.includes("invalid refresh token")
  )
    return "Session expirée, reconnecte-toi.";
  return finishFrenchSentence(message);
}

export function userFacingError(error: unknown, fallback = "Erreur réseau."): string {
  if (error instanceof ApiException) return mapApiError(error.message);
  if (error instanceof Error) return mapApiError(error.message);
  return fallback;
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
