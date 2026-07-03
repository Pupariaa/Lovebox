import type { DeviceDto, LinkedTargetDto } from "@/data/api/models";

export function deviceLabel(device: DeviceDto | null | undefined): string {
  if (!device) return "Non configurée";
  return device.display_name?.trim() ? device.display_name : device.device_name;
}

export function targetLabel(target: LinkedTargetDto): string {
  return target.display_name?.trim() ? target.display_name : target.device_name;
}

export function formatLastSeen(online: boolean, secondsAgo?: number | null): string {
  if (online) return "En ligne";
  if (secondsAgo == null) return "Jamais vue";
  if (secondsAgo < 60) return `Vue il y a ${secondsAgo}s`;
  if (secondsAgo < 3600) return `Vue il y a ${Math.floor(secondsAgo / 60)} min`;
  if (secondsAgo < 86_400) return `Vue il y a ${Math.floor(secondsAgo / 3600)} h`;
  return `Vue il y a ${Math.floor(secondsAgo / 86_400)} j`;
}
 
export function formatDateTime(value?: string | null): string {
  if (!value) return "";
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const COMMON_REGIONS: { code: string; label: string }[] = [
  { code: "", label: "Automatique" },
  { code: "FR", label: "France" },
  { code: "BE", label: "Belgique" },
  { code: "CH", label: "Suisse" },
  { code: "CA", label: "Canada" },
  { code: "US", label: "États-Unis" },
  { code: "GB", label: "Royaume-Uni" },
  { code: "DE", label: "Allemagne" },
  { code: "ES", label: "Espagne" },
  { code: "IT", label: "Italie" },
  { code: "PT", label: "Portugal" },
  { code: "NL", label: "Pays-Bas" },
  { code: "LU", label: "Luxembourg" },
  { code: "MA", label: "Maroc" },
  { code: "TN", label: "Tunisie" },
  { code: "DZ", label: "Algérie" },
  { code: "RE", label: "La Réunion" },
  { code: "GP", label: "Guadeloupe" },
  { code: "MQ", label: "Martinique" },
];
