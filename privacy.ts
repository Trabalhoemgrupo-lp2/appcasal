export const PROXIMITY_STORAGE_PREFIX = "appcasal:proximity:";
export const LOCATION_CONSENT_STORAGE_PREFIX = "appcasal.location-consent:";
export const MOMENT_WIDGET_STORAGE_KEY = "appcasal:moment-widget";
export const SPOTIFY_CONNECTION_STORAGE_PREFIX = "appcasal:spotify-connected:";

export function proximityStorageKey(userId: string) {
  return `${PROXIMITY_STORAGE_PREFIX}${userId}`;
}

export function spotifyConnectionStorageKey(userId: string) {
  return `${SPOTIFY_CONNECTION_STORAGE_PREFIX}${userId}`;
}

/** Remove apenas preferências de proximidade deste dispositivo e desta pessoa. */
export function clearLocalPrivacyData(userId: string, storage?: Pick<Storage, "removeItem">) {
  if (!userId || !storage) return;
  storage.removeItem(proximityStorageKey(userId));
  storage.removeItem(`${LOCATION_CONSENT_STORAGE_PREFIX}${userId}`);
  storage.removeItem(MOMENT_WIDGET_STORAGE_KEY);
  storage.removeItem(spotifyConnectionStorageKey(userId));
}

export function isExternalMapUrl(href: string) {
  try {
    const url = new URL(href);
    return url.protocol === "https:" && (url.hostname === "www.google.com" || url.hostname === "maps.google.com");
  } catch {
    return false;
  }
}

export function shouldOpenExternalMapWithConsent(href: string, requestConsent: () => boolean) {
  return !isExternalMapUrl(href) || requestConsent();
}

export const EXTERNAL_MAP_DISCLOSURE_TEXT =
  "Ao abrir o Google Maps, as coordenadas compartilhadas serão enviadas ao Google.";

export function appendExternalMapDisclosures(root: ParentNode = document) {
  root.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((link) => {
    if (!isExternalMapUrl(link.href) || link.nextElementSibling?.matches("[data-appcasal-map-disclosure]")) return;

    const disclosure = document.createElement("p");
    disclosure.dataset.appcasalMapDisclosure = "true";
    disclosure.className = "mt-2 text-xs leading-5 text-ink/52";
    disclosure.textContent = EXTERNAL_MAP_DISCLOSURE_TEXT;
    link.insertAdjacentElement("afterend", disclosure);
  });
}

let externalMapDisclosureInstalled = false;

/**
 * Solicita confirmação antes de entregar coordenadas ao provedor externo escolhido.
 * O listener é registrado uma única vez no documento e não coleta dados adicionais.
 */
export function installExternalMapDisclosureGuard() {
  if (typeof document === "undefined" || externalMapDisclosureInstalled) return;
  externalMapDisclosureInstalled = true;

  appendExternalMapDisclosures();
  if (typeof MutationObserver !== "undefined" && document.body) {
    const observer = new MutationObserver(() => {
      if (typeof document !== "undefined") appendExternalMapDisclosures();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  document.addEventListener("click", (event) => {
    if (event.defaultPrevented) return;
    if ("button" in event && typeof event.button === "number" && event.button !== 0) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const link = target.closest<HTMLAnchorElement>("a[href]");
    if (!link || !isExternalMapUrl(link.href)) return;

    const allowed = shouldOpenExternalMapWithConsent(link.href, () => window.confirm(
      `${EXTERNAL_MAP_DISCLOSURE_TEXT} Deseja continuar?`
    ));
    if (!allowed) event.preventDefault();
  });
}
