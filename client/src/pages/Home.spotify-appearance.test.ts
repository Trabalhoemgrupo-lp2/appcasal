import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const homeSource = readFileSync(
  resolve(process.cwd(), "client/src/pages/Home.tsx"),
  "utf8"
);
const stylesSource = readFileSync(
  resolve(process.cwd(), "client/src/index.css"),
  "utf8"
);

describe("aparência da Sala Spotify", () => {
  it("usa superfícies temáticas em vez de fundos claros rígidos", () => {
    expect(homeSource).toContain("music-hero");
    expect(homeSource).toContain("spotify-account");
    expect(homeSource).not.toContain(
      'bg-[linear-gradient(118deg,#ffffff,#f3fbf6)]'
    );
  });

  it("define superfícies e textos legíveis para o modo noturno", () => {
    expect(stylesSource).toContain(".dark .music-hero");
    expect(stylesSource).toContain(".dark .spotify-account");
    expect(stylesSource).toContain(".dark .spotify-account-title");
    expect(stylesSource).toContain(".dark .spotify-account-copy");
  });

  it("escurece cartões translúcidos e a navegação inferior no celular", () => {
    expect(homeSource).toContain('className="mobile-tab-bar fixed');
    expect(stylesSource).toContain(".dark .bg-white\\/65");
    expect(stylesSource).toContain(".dark .bg-white\\/92");
    expect(stylesSource).toContain(".dark .mobile-tab-bar");
  });
});
