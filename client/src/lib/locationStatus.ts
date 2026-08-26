export type LocationFreshness = "live" | "recent" | "stale";

export type LocationStatus = {
  freshness: LocationFreshness;
  label: string;
  detail: string;
};

const LIVE_WINDOW_MS = 2 * 60_000;
const RECENT_WINDOW_MS = 5 * 60_000;

export function getLocationStatus(
  updatedAt: string,
  now = Date.now(),
): LocationStatus {
  const timestamp = Date.parse(updatedAt);
  if (!Number.isFinite(timestamp)) {
    return {
      freshness: "stale",
      label: "sem atualização",
      detail: "não foi possível confirmar o horário",
    };
  }

  const ageMs = Math.max(0, now - timestamp);
  if (ageMs < LIVE_WINDOW_MS) {
    return {
      freshness: "live",
      label: "ao vivo",
      detail: "atualizado agora",
    };
  }

  const minutes = Math.max(1, Math.floor(ageMs / 60_000));
  if (ageMs < RECENT_WINDOW_MS) {
    return {
      freshness: "recent",
      label: "recente",
      detail: `atualizado há ${minutes} min`,
    };
  }

  if (minutes < 60) {
    return {
      freshness: "stale",
      label: "desatualizado",
      detail: `atualizado há ${minutes} min`,
    };
  }

  const hours = Math.floor(minutes / 60);
  return {
    freshness: "stale",
    label: "desatualizado",
    detail: `atualizado há ${hours} h`,
  };
}

export function formatLocationDistance(distanceMeters: number | null) {
  if (
    distanceMeters === null ||
    !Number.isFinite(distanceMeters) ||
    distanceMeters < 0
  ) {
    return null;
  }
  if (distanceMeters < 1_000) {
    return `${Math.max(1, Math.round(distanceMeters))} m de distância`;
  }
  return `${(distanceMeters / 1_000).toFixed(1).replace(".", ",")} km de distância`;
}

export function formatLocationAccuracy(accuracyMeters: number | null) {
  if (
    accuracyMeters === null ||
    !Number.isFinite(accuracyMeters) ||
    accuracyMeters < 0
  ) {
    return null;
  }
  if (accuracyMeters < 1_000) {
    return `±${Math.max(1, Math.round(accuracyMeters))} m`;
  }
  return `±${(accuracyMeters / 1_000).toFixed(1).replace(".", ",")} km`;
}
