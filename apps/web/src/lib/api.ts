import {
  createApiClient,
  type ApiRequestOptions,
} from "@ais-anomaly/api-client";

export function getApiOrigin(): string {
  const viteEnvironment = (
    import.meta as ImportMeta & {
      readonly env: { readonly VITE_API_ORIGIN?: string };
    }
  ).env;
  const configuredOrigin = viteEnvironment.VITE_API_ORIGIN?.trim();
  if (configuredOrigin) {
    return configuredOrigin;
  }

  // Vite and nginx proxy /api requests to the API by default, keeping
  // Better Auth cookies same-origin in local and containerized deployments.
  return window.location.origin;
}

function hasHttpStatus(error: unknown): error is { readonly status: number } {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof error.status === "number"
  );
}

const apiClient = createApiClient({ origin: getApiOrigin() });

export const { getApiUrl } = apiClient;
export const AUTH_UNAUTHORIZED_EVENT = "ais-auth-unauthorized";

export async function requestJson<T = unknown>(
  pathname: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const headers = new Headers(options.headers);

  try {
    return await apiClient.requestJson<T>(pathname, {
      ...options,
      credentials: options.credentials ?? "include",
      headers,
    });
  } catch (error) {
    if (
      typeof window !== "undefined" &&
      hasHttpStatus(error) &&
      error.status === 401
    ) {
      window.dispatchEvent(new Event(AUTH_UNAUTHORIZED_EVENT));
    }
    throw error;
  }
}
