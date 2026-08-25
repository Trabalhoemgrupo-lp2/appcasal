import { describe, expect, it } from "vitest";
import { getLocationConsentAction, locationConsentStorageKey } from "./locationConsent";

describe("consentimento de localização", () => {
  it("cria uma preferência isolada por pessoa", () => {
    expect(locationConsentStorageKey("pessoa-a")).toBe("appcasal.location-consent:pessoa-a");
    expect(locationConsentStorageKey("pessoa-a")).not.toBe(locationConsentStorageKey("pessoa-b"));
  });

  it("solicita autorização apenas quando ainda não existe uma escolha", () => {
    expect(getLocationConsentAction(null, true)).toBe("request");
    expect(getLocationConsentAction("granted", true)).toBe("start");
  });

  it("respeita negativas, pausas e navegadores sem geolocalização", () => {
    expect(getLocationConsentAction("denied", true)).toBe("request");
    expect(getLocationConsentAction("paused", true)).toBe("skip");
    expect(getLocationConsentAction(null, false)).toBe("skip");
  });
});
