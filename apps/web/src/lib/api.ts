import { createApiClient } from "@ais-anomaly/api-client";

function getApiOrigin(): string {
  const viteEnvironment = (
    import.meta as ImportMeta & {
      readonly env: { readonly VITE_API_ORIGIN?: string };
    }
  ).env;
  const configuredOrigin = viteEnvironment.VITE_API_ORIGIN?.trim();
  if (configuredOrigin) {
    return configuredOrigin;
  }

  return `${window.location.protocol}//${window.location.hostname}:3000`;
}

const apiClient = createApiClient({ origin: getApiOrigin() });

export const { getApiUrl, requestJson } = apiClient;
