import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { AUTH_UNAUTHORIZED_EVENT } from "../../lib/api.ts";
import { authClient } from "../../lib/auth-client.ts";
import { getErrorMessage } from "../../lib/errors.ts";

interface AuthGateProps {
  children: ReactNode;
}

export default function AuthGate({ children }: AuthGateProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSessionExpired, setIsSessionExpired] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const {
    data: session,
    error: sessionError,
    isPending,
    refetch,
  } = authClient.useSession();

  useEffect(() => {
    const handleUnauthorized = (): void => {
      setError("");
      setIsSessionExpired(true);
      void refetch();
    };

    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
    return () => {
      window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
    };
  }, [refetch]);

  const handleSubmit = async (): Promise<void> => {
    const trimmedUsername = username.trim();
    if (!trimmedUsername || !password) {
      setError("Enter your username and password.");
      return;
    }

    setIsSubmitting(true);
    setError("");
    try {
      const { error: signInError } = await authClient.signIn.username({
        password,
        username: trimmedUsername,
      });
      if (signInError) {
        throw new Error(signInError.message);
      }

      setPassword("");
      setIsSessionExpired(false);
      await refetch();
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Unable to sign in."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignOut = async (): Promise<void> => {
    setIsSigningOut(true);
    setError("");
    try {
      const { error: signOutError } = await authClient.signOut();
      if (signOutError) {
        throw new Error(signOutError.message);
      }

      setPassword("");
      setIsSessionExpired(false);
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Unable to sign out."));
    } finally {
      setIsSigningOut(false);
    }
  };

  if (isPending) {
    return (
      <main className="auth-page" aria-busy="true">
        <section className="auth-card" aria-labelledby="auth-loading-title">
          <span className="panel-kicker">AUTHENTICATING</span>
          <h1 id="auth-loading-title">Checking your session…</h1>
        </section>
      </main>
    );
  }

  if (session) {
    return (
      <>
        {children}
        <div className="auth-session" role="status">
          <span>Authenticated</span>
          <button
            className="auth-session__button"
            disabled={isSigningOut}
            onClick={() => void handleSignOut()}
            type="button"
          >
            {isSigningOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
        {error ? (
          <p className="field-help field-help--error auth-session__error">
            {error}
          </p>
        ) : null}
      </>
    );
  }

  const displayedError =
    error ||
    (sessionError
      ? getErrorMessage(sessionError, "Unable to verify your session.")
      : "") ||
    (isSessionExpired ? "Your session expired. Sign in again." : "");

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="auth-title">
        <div className="auth-card__brand" aria-hidden="true">
          <span className="brand-mark">
            <span />
            <span />
            <span />
          </span>
          AIS anomaly
        </div>
        <span className="panel-kicker">RESTRICTED CONSOLE</span>
        <h1 id="auth-title">Sign in to continue</h1>
        <p>
          Enter your operator credentials to access vessel data and worker
          controls.
        </p>

        <form
          className="auth-form"
          onSubmit={(event) => {
            event.preventDefault();
            void handleSubmit();
          }}
        >
          <div className="field">
            <label htmlFor="auth-username">Username</label>
            <div className="input-shell">
              <input
                autoComplete="username"
                disabled={isSubmitting}
                id="auth-username"
                onChange={(event) => setUsername(event.target.value)}
                value={username}
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="auth-password">Password</label>
            <div className="input-shell">
              <input
                autoComplete="current-password"
                disabled={isSubmitting}
                id="auth-password"
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                value={password}
              />
            </div>
          </div>

          <p className="field-help field-help--error" aria-live="polite">
            {displayedError}
          </p>
          <button
            className="button button--primary"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </section>
    </main>
  );
}
