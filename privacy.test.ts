// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import {
  clearLocalPrivacyData,
  appendExternalMapDisclosures,
  EXTERNAL_MAP_DISCLOSURE_TEXT,
  isExternalMapUrl,
  LOCATION_CONSENT_STORAGE_PREFIX,
  MOMENT_WIDGET_STORAGE_KEY,
  proximityStorageKey,
  spotifyConnectionStorageKey,
  shouldOpenExternalMapWithConsent,
} from "./privacy";

describe("limpeza local de privacidade", () => {
  it("remove somente as preferências locais ligadas à pessoa que encerrou a sessão", () => {
    const removeItem = vi.fn();

    clearLocalPrivacyData("user-a", { removeItem });

    expect(removeItem).toHaveBeenCalledTimes(4);
    expect(removeItem).toHaveBeenCalledWith(proximityStorageKey("user-a"));
    expect(removeItem).toHaveBeenCalledWith(`${LOCATION_CONSENT_STORAGE_PREFIX}user-a`);
    expect(removeItem).toHaveBeenCalledWith(MOMENT_WIDGET_STORAGE_KEY);
    expect(removeItem).toHaveBeenCalledWith(spotifyConnectionStorageKey("user-a"));
    expect(removeItem).not.toHaveBeenCalledWith(proximityStorageKey("user-b"));
  });

  it("não remove dados quando não há uma pessoa autenticada", () => {
    const removeItem = vi.fn();

    clearLocalPrivacyData("", { removeItem });

    expect(removeItem).not.toHaveBeenCalled();
  });

  it("identifica somente destinos de mapa externo aprovados para a confirmação", () => {
    expect(isExternalMapUrl("https://www.google.com/maps/search/?api=1&query=-23.5,-46.6")).toBe(true);
    expect(isExternalMapUrl("https://maps.google.com/?q=-23.5,-46.6")).toBe(true);
    expect(isExternalMapUrl("https://example.com/?q=-23.5,-46.6")).toBe(false);
    expect(isExternalMapUrl("/mapa-local")).toBe(false);
  });

  it("bloqueia o mapa externo quando o consentimento é recusado e não pergunta em links internos", () => {
    const reject = vi.fn(() => false);
    const accept = vi.fn(() => true);

    expect(shouldOpenExternalMapWithConsent("https://www.google.com/maps/search/?q=-23.5,-46.6", reject)).toBe(false);
    expect(reject).toHaveBeenCalledTimes(1);
    expect(shouldOpenExternalMapWithConsent("https://www.google.com/maps/search/?q=-23.5,-46.6", accept)).toBe(true);
    expect(shouldOpenExternalMapWithConsent("/mapa-local", reject)).toBe(true);
    expect(reject).toHaveBeenCalledTimes(1);
  });

  it("insere um aviso textual antes da abertura de coordenadas no mapa externo", () => {
    const root = document.createElement("div");
    root.innerHTML = '<a href="https://www.google.com/maps/search/?q=-23.5,-46.6">abrir mapa</a>';

    appendExternalMapDisclosures(root);

    expect(root.querySelector("[data-appcasal-map-disclosure]")?.textContent).toBe(EXTERNAL_MAP_DISCLOSURE_TEXT);
  });
});
