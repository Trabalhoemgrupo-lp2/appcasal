export type RuntimeErrorLogger = (scope: string, error: unknown) => void;

/** Mantém detalhes de falhas fora do console do navegador em produção. */
export function logDetailedApiError(
  scope: string,
  error: unknown,
  isDevelopment: boolean,
  logger: RuntimeErrorLogger
) {
  if (isDevelopment) logger(scope, error);
}
