import { getMigrations } from "better-auth/db/migration";
import { Pool } from "pg";
import { createBetterAuth } from "../application/authentication.ts";
import { loadRuntimeConfig } from "../main/runtime-config.ts";

function requireEnvironment(name: string): string {
    const value = process.env[name]?.trim();
    if (!value) {
        throw new Error(`${name} is required to create a Better Auth user`);
    }
    return value;
}

const config = loadRuntimeConfig();
if (!config.betterAuthSecret) {
    throw new Error(
        "BETTER_AUTH_SECRET is required to create a Better Auth user",
    );
}
if (!config.databaseUrl) {
    throw new Error("DATABASE_URL is required to create a Better Auth user");
}

const username = requireEnvironment("AUTH_NEW_USERNAME");
const email = requireEnvironment("AUTH_NEW_EMAIL");
const password = process.env.AUTH_NEW_PASSWORD;
if (!password) {
    throw new Error(
        "AUTH_NEW_PASSWORD is required to create a Better Auth user",
    );
}
const name = process.env.AUTH_NEW_NAME?.trim() || username;
const databasePool = new Pool({ connectionString: config.databaseUrl });
const auth = createBetterAuth({
    baseURL: config.betterAuthUrl,
    corsOrigins: config.corsOrigins,
    database: databasePool,
    disableSignUp: false,
    secret: config.betterAuthSecret,
    tokenTtlSeconds: config.authSessionTtlSeconds,
});

try {
    await auth.$context;
    const { runMigrations } = await getMigrations(auth.options);
    await runMigrations();
    const result = await auth.api.signUpEmail({
        body: {
            email,
            name,
            password,
            username,
        },
    });

    process.stdout.write(`Created Better Auth user ${result.user.email}\n`);
} finally {
    await databasePool.end();
}
