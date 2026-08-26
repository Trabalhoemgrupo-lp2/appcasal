import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const home = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");

describe("compartilhamentos privados do casal", () => {
  it("oferece envio manual de bateria quando o navegador não expõe a leitura automática", () => {
    expect(home).toContain("onShareBatteryManually");
    expect(home).toContain("Percentual de bateria para compartilhar");
    expect(home).toContain("Use o envio manual abaixo para compartilhar.");
    expect(home).toContain("function handleShareBatteryManually()");
    expect(home).toContain("couple_widget_battery_snapshots");
  });

  it("distingue a localização ativa, pausada e ainda não autorizada do parceiro", () => {
    expect(home).toContain("const partnerLocation = locations.find(");
    expect(home).toContain("const partner = partnerLocation?.sharing_enabled");
    expect(home).toContain("Localização de {partnerName}");
    expect(home).toContain("pausou o compartilhamento e a posição foi apagada");
    expect(home).toContain("abrir localização compartilhada");
  });

  it("mantém o filtro em tempo real por casal para as duas sincronizações", () => {
    expect(home).toContain('table: "couple_locations"');
    expect(home).toContain('table: "couple_widget_battery_snapshots"');
    expect(home).toContain('filter: `couple_id=eq.${coupleId}`');
  });

  it("mantém início e pausa voluntários da própria localização", () => {
    expect(home).toContain("navigator.geolocation.watchPosition");
    expect(home).toContain('sharing_enabled: true');
    expect(home).toContain('sharing_enabled: false');
    expect(home).toContain('from("couple_locations")');
  });
});
