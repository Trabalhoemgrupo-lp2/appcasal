export type ReverseGeocodedPlace = {
  name: string;
  address: string;
};

type BigDataCloudResponse = {
  locality?: string;
  city?: string;
  principalSubdivision?: string;
  countryName?: string;
  postcode?: string;
  localityInfo?: {
    administrative?: Array<{ name?: string }>;
  };
};

function uniqueParts(parts: Array<string | undefined>) {
  return Array.from(
    new Set(
      parts
        .map(part => part?.trim())
        .filter((part): part is string => Boolean(part))
    )
  );
}

export function parseReverseGeocodeResponse(
  response: BigDataCloudResponse
): ReverseGeocodedPlace {
  const name =
    response.locality ??
    response.city ??
    response.principalSubdivision ??
    "Localização atual";
  const administrative = response.localityInfo?.administrative?.map(
    item => item.name
  );
  const address = uniqueParts([
    response.locality,
    response.city,
    response.principalSubdivision,
    response.postcode,
    response.countryName,
    ...(administrative ?? []),
  ]).join(", ");
  return {
    name,
    address: address || "Endereço não identificado",
  };
}

export async function forwardGeocode(
  query: string,
  signal?: AbortSignal
): Promise<{ latitude: number; longitude: number } | null> {
  const normalized = query.trim();
  if (!normalized) return null;

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&accept-language=pt&q=${encodeURIComponent(normalized)}`,
      { signal, headers: { Accept: "application/json" } }
    );
    if (!response.ok) return null;
    const results = (await response.json()) as Array<{ lat?: string; lon?: string }>;
    const latitude = Number(results[0]?.lat);
    const longitude = Number(results[0]?.lon);
    return Number.isFinite(latitude) && Number.isFinite(longitude)
      ? { latitude, longitude }
      : null;
  } catch {
    return null;
  }
}

export async function reverseGeocode(
  latitude: number,
  longitude: number,
  signal?: AbortSignal
): Promise<ReverseGeocodedPlace | null> {
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return null;
  }

  try {
    const response = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=pt`,
      { signal }
    );
    if (!response.ok) return null;
    return parseReverseGeocodeResponse(
      (await response.json()) as BigDataCloudResponse
    );
  } catch {
    return null;
  }
}
