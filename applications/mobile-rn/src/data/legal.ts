export type LegalParagraph = { title: string; body: string };

export const LEGAL_SECTIONS: Record<
  string,
  { title: string; paragraphs: LegalParagraph[] }
> = {
  terms: {
    title: "Conditions d'utilisation",
    paragraphs: [
      {
        title: "Usage",
        body: "En utilisant Boîte à cœur, tu t'engages à utiliser le service de manière respectueuse et légale.",
      },
      {
        title: "Contenu",
        body: "Tu es responsable du contenu des messages envoyés via ton compte.",
      },
      {
        title: "Association",
        body: "L'association d'une boîte à ton compte est personnelle. Ne partage pas tes codes de liaison publiquement.",
      },
      {
        title: "Service",
        body: "Le service est fourni en l'état. Nous pouvons faire évoluer les fonctionnalités ou suspendre un compte en cas d'abus manifeste.",
      },
    ],
  },
  privacy: {
    title: "Confidentialité",
    paragraphs: [
      {
        title: "Collecte",
        body: "Nous collectons les informations nécessaires à ton compte (e-mail, profil), à tes boîtes (identifiants, statut) et aux messages envoyés.",
      },
      {
        title: "Messages",
        body: "Les messages sont stockés pour être délivrés à la boîte destinataire, puis conservés dans ton historique d'envoi.",
      },
      {
        title: "Tes droits",
        body: "Tu peux demander la suppression de ton compte et dissocier tes boîtes depuis l'application.",
      },
      {
        title: "Partage",
        body: "Nous ne vendons pas tes données. Les prestataires techniques traitent des données limitées pour fournir le service.",
      },
    ],
  },
  legal: {
    title: "Mentions légales",
    paragraphs: [
      {
        title: "Éditeur",
        body: "TechAlchemy - application Boîte à cœur, service de messagerie affective entre boîtes connectées.",
      },
      { title: "Contact", body: "support@boite-a-coeur.techalchemy.fr" },
      { title: "Hébergement", body: "Infrastructure TechAlchemy, Union européenne." },
      {
        title: "Données",
        body: "Les données techniques nécessaires au fonctionnement sont traitées conformément à la politique de confidentialité.",
      },
    ],
  },
};
