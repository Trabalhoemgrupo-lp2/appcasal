import { describe, expect, it, vi } from "vitest";
import { logDetailedApiError } from "./runtimePrivacy";

describe("logDetailedApiError", () => {
  it("não registra detalhes de erros de API em produção", () => {
    const logger = vi.fn();
    const error = new Error("endpoint inclui dados internos");

    logDetailedApiError("[API Query Error]", error, false, logger);

    expect(logger).not.toHaveBeenCalled();
  });

  it("preserva detalhes exclusivamente durante o desenvolvimento", () => {
    const logger = vi.fn();
    const error = new Error("falha de desenvolvimento");

    logDetailedApiError("[API Query Error]", error, true, logger);

    expect(logger).toHaveBeenCalledWith("[API Query Error]", error);
  });
});
