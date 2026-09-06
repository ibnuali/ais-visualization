export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export type FetchImplementation = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export type ApiRequestOptions = RequestInit & {
  errorPrefix?: string;
};

export interface ApiClient {
  getApiUrl(pathname: string): string;
  requestJson<T = unknown>(
    pathname: string,
    options?: ApiRequestOptions,
  ): Promise<T>;
}

export interface CreateApiClientOptions {
  origin: string;
  fetchImpl?: FetchImplementation;
}

function normalizeOrigin(origin: unknown): string {
  if (typeof origin !== "string" || !origin.trim()) {
    throw new TypeError("An API origin is required.");
  }

  return origin.trim().replace(/\/+$/, "");
}

function hasApiError(payload: unknown): payload is { error: string } {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "error" in payload &&
    typeof payload.error === "string"
  );
}

export function createApiClient(options: CreateApiClientOptions): ApiClient;
export function createApiClient({
  origin,
  fetchImpl = globalThis.fetch,
}: Partial<CreateApiClientOptions> = {}): ApiClient {
  const apiOrigin = normalizeOrigin(origin);

  if (typeof fetchImpl !== "function") {
    throw new TypeError("A fetch implementation is required.");
  }

  function getApiUrl(pathname: string): string {
    return new URL(pathname, `${apiOrigin}/`).toString();
  }

  async function requestJson<T = unknown>(
    pathname: string,
    {
      errorPrefix = "The API returned",
      ...requestOptions
    }: ApiRequestOptions = {},
  ): Promise<T> {
    const response = await fetchImpl(getApiUrl(pathname), {
      credentials: "include",
      ...requestOptions,
    });
    let payload: unknown;

    try {
      payload = await response.json();
    } catch (parseError) {
      if (response.ok) {
        throw parseError;
      }
    }

    if (!response.ok) {
      throw new ApiError(
        (hasApiError(payload) && payload.error) ||
          `${errorPrefix} HTTP ${response.status}.`,
        response.status,
      );
    }

    return payload as T;
  }

  return { getApiUrl, requestJson };
}
