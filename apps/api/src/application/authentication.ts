import { betterAuth, type BetterAuthOptions } from "better-auth";
import { getMigrations } from "better-auth/db/migration";
import { bearer, username } from "better-auth/plugins";
import { Pool } from "pg";

const DEFAULT_SESSION_TTL_SECONDS = 8 * 60 * 60;
const MIN_SECRET_LENGTH = 32;
const AUTH_BASE_PATH = "/api/auth";
const SIGN_UP_PATH = `${AUTH_BASE_PATH}/sign-up/email`;

export interface Authentication {
  handler(request: Request): Response | Promise<Response>;
  getSession(headers: Headers): Promise<unknown | null>;
  initialize(): Promise<void>;
  close(): Promise<void>;
}

export interface CreateAuthenticationOptions {
  baseURL: string;
  corsOrigins: ReadonlySet<string>;
  database?: BetterAuthOptions["database"];
  databaseUrl?: string;
  secret: string;
  tokenTtlSeconds?: number;
}

function hasValidTokenTtl(tokenTtlSeconds: number): boolean {
  return (
    Number.isInteger(tokenTtlSeconds) &&
    tokenTtlSeconds >= 60 &&
    tokenTtlSeconds <= 24 * 60 * 60
  );
}

function hasValidSecret(secret: string): boolean {
  return secret.trim().length >= MIN_SECRET_LENGTH;
}

function isSignUpRequest(request: Request): boolean {
  try {
    const pathname = new URL(request.url).pathname.replace(/\/+$/, "");
    return pathname === SIGN_UP_PATH;
  } catch {
    return false;
  }
}

interface BetterAuthInstanceOptions {
  baseURL: string;
  corsOrigins: ReadonlySet<string>;
  database: BetterAuthOptions["database"];
  disableSignUp?: boolean;
  secret: string;
  tokenTtlSeconds: number;
}

export function createBetterAuth({
  baseURL,
  corsOrigins,
  database,
  disableSignUp = true,
  secret,
  tokenTtlSeconds,
}: BetterAuthInstanceOptions) {
  return betterAuth({
    appName: "AIS anomaly",
    basePath: AUTH_BASE_PATH,
    baseURL,
    database,
    disabledPaths: ["/is-username-available", "/sign-up/email"],
    emailAndPassword: {
      autoSignIn: false,
      disableSignUp,
      enabled: true,
    },
    plugins: [
      username({
        displayUsername: false,
        immutableUsername: true,
      }),
      bearer(),
    ],
    secret,
    session: {
      disableSessionRefresh: true,
      expiresIn: tokenTtlSeconds,
      updateAge: tokenTtlSeconds,
    },
    trustedOrigins: [...corsOrigins],
    advanced: {
      database: {
        // Initialization below runs Better Auth's migrations explicitly. The
        // built-in check would race that migration on a fresh database.
        validateSchema: false,
      },
    },
  });
}

export function createAuthentication({
  baseURL,
  corsOrigins,
  database,
  databaseUrl,
  secret,
  tokenTtlSeconds = DEFAULT_SESSION_TTL_SECONDS,
}: CreateAuthenticationOptions): Authentication {
  if (!hasValidSecret(secret)) {
    throw new Error("BETTER_AUTH_SECRET must contain at least 32 characters");
  }

  if (!hasValidTokenTtl(tokenTtlSeconds)) {
    throw new Error("AUTH_SESSION_TTL_SECONDS must be between 60 and 86400");
  }

  const ownsDatabase = !database;
  const databasePool = database ?? new Pool({ connectionString: databaseUrl });
  const auth = createBetterAuth({
    baseURL,
    corsOrigins,
    database: databasePool,
    secret,
    tokenTtlSeconds,
  });

  const initialize = async (): Promise<void> => {
    await auth.$context;

    if (ownsDatabase && databasePool instanceof Pool) {
      const { runMigrations } = await getMigrations(auth.options);
      await runMigrations();
    }
  };

  return {
    close: async (): Promise<void> => {
      if (ownsDatabase && databasePool instanceof Pool) {
        await databasePool.end();
      }
    },
    getSession: (headers) => auth.api.getSession({ headers }),
    handler: (request) => {
      if (isSignUpRequest(request)) {
        return Response.json({ error: "Sign up is disabled" }, { status: 404 });
      }

      return auth.handler(request);
    },
    initialize,
  };
}
