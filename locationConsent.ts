export type LocationConsentAction = "request" | "start" | "skip";

const CONSENT_PREFIX = "appcasal.location-consent";

export function locationConsentStorageKey(userId: string) {
  return `${CONSENT_PREFIX}:${userId}`;
}

export function getLocationConsentAction(
  storedPreference: string | null,
  geolocationAvailable: boolean,
): LocationConsentAction {
  if (!geolocationAvailable || storedPreference === "paused") {
    return "skip";
  }

  // Uma recusa não é uma decisão permanente do app: na próxima entrada,
  // tentamos solicitar novamente. Se o navegador tiver bloqueado a origem,
  // a API retornará PERMISSION_DENIED e orientaremos a pessoa a desbloquear
  // a permissão nas configurações do navegador.
  return storedPreference === "granted" ? "start" : "request";
}
