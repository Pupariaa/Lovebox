export type LegalParagraph = { title: string; body: string };

export const PRIVACY_POLICY_URL = "https://boite-a-coeur.fr/privacy";
export const TERMS_URL = "https://boite-a-coeur.fr/terms";
export const LEGAL_NOTICE_URL = "https://boite-a-coeur.fr/legal";
export const COOKIES_POLICY_URL = "https://boite-a-coeur.fr/cookies";
export const DELETE_ACCOUNT_URL = "https://boite-a-coeur.fr/delete-me";

export const LEGAL_SECTIONS: Record<
  string,
  { title: string; paragraphs: LegalParagraph[] }
> = {
  terms: {
    title: "Conditions d'utilisation",
    paragraphs: [
      {
        title: "Acceptation",
        body: "En utilisant Boîte à Cœur (application, boîte connectée ou site), tu acceptes les conditions d'utilisation et la politique de confidentialité.",
      },
      {
        title: "Service",
        body: "Envoi de messages personnalisés vers des boîtes connectées autorisées. Fonctionnement soumis à une connexion Internet.",
      },
      {
        title: "Compte",
        body: "Tu es responsable de tes identifiants. Suppression de compte et dissociation des boîtes possibles depuis l'application.",
      },
      {
        title: "Contenu",
        body: "Tu es responsable des messages envoyés. Contenus illégaux, diffamatoires, haineux ou abusifs interdits.",
      },
      {
        title: "Association",
        body: "L'association d'une boîte est personnelle. Ne partage pas publiquement tes codes ou liens d'invitation.",
      },
      {
        title: "Responsabilité",
        body: "Service fourni en l'état. Techalchemy ne peut être tenue responsable des dommages indirects liés à une coupure réseau ou une mauvaise configuration.",
      },
      {
        title: "Médiation",
        body: "Droit français. Médiation CNPM ou plateforme européenne ODR en cas de litige.",
      },
      {
        title: "Version complète",
        body: TERMS_URL,
      },
    ],
  },
  privacy: {
    title: "Confidentialité",
    paragraphs: [
      {
        title: "Responsable",
        body: "Techalchemy (EI) — ZORLONI Maxime, directeur de publication. 31 Avenue du clos banderet, 74200 Thonon-les-Bains. SIRET 97746385000015.",
      },
      {
        title: "Contact données",
        body: "support@boite-a-coeur.fr",
      },
      {
        title: "Données traitées",
        body: "Compte (e-mail, prénom, mot de passe haché, OAuth), messages BACM et métadonnées, boîtes associées, télémétrie technique des boîtes, jeton de session local, journaux de sécurité.",
      },
      {
        title: "Non collecté",
        body: "Pas de GPS stocké, pas d'audio, pas de vente de données. Galerie : uniquement les médias que tu sélectionnes.",
      },
      {
        title: "Hébergement",
        body: "Données hébergées en France (PulseHeberg SAS, Toulon).",
      },
      {
        title: "Durée",
        body: "Compte tant qu'il est actif. Messages selon leur cycle de vie (éphémères supprimés après ouverture). Journaux techniques : durée limitée.",
      },
      {
        title: "Tes droits",
        body: "Accès, rectification, effacement, limitation, portabilité, opposition, retrait du consentement. Réclamation possible auprès de la CNIL.",
      },
      {
        title: "Mes données",
        body: "Téléchargement, suppression des données ou suppression du compte : " + DELETE_ACCOUNT_URL,
      },
      {
        title: "Version complète",
        body: PRIVACY_POLICY_URL,
      },
    ],
  },
  legal: {
    title: "Mentions légales",
    paragraphs: [
      {
        title: "Éditeur",
        body: "Techalchemy — Entrepreneur individuel. 31 Avenue du clos banderet, 74200 Thonon-les-Bains, France. SIRET 97746385000015. RCS 977 463 850 R.C.S. Tarascon. TVA FR82977463850.",
      },
      {
        title: "Directeur de publication",
        body: "ZORLONI Maxime",
      },
      {
        title: "Hébergeur",
        body: "PulseHeberg SAS — 9 Boulevard de Strasbourg, 83000 Toulon. SIRET 824 070 619 00039.",
      },
      {
        title: "Contact",
        body: "support@boite-a-coeur.fr — boite-a-coeur.fr",
      },
      {
        title: "Version complète",
        body: LEGAL_NOTICE_URL,
      },
    ],
  },
};
