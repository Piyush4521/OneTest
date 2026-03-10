import { useState, type FormEvent } from "react";

interface AuthPageProps {
  onSubmit: (email: string, password: string) => Promise<void>;
  isSubmitting: boolean;
  errorMessage: string | null;
}

export function AuthPage({ onSubmit, isSubmitting, errorMessage }: AuthPageProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit(email.trim(), password);
  }

  return (
    <div className="auth-layout">
      <div className="auth-grid">
        <section className="auth-card auth-card-primary">
          <p className="panel-label">Firebase Sign-In</p>
          <h1>Enter the portal with your college credentials.</h1>
          <p className="surface-copy">
            Email/password auth is enabled for OneTest. Faculty and student access are determined
            by your Firebase user profile and custom role claims.
          </p>
          <form className="auth-form" onSubmit={(event) => void handleSubmit(event)}>
            <label className="field">
              <span>Email</span>
              <input
                autoComplete="username"
                required
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            <label className="field">
              <span>Password</span>
              <input
                autoComplete="current-password"
                required
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            <button className="button button-primary auth-submit" disabled={isSubmitting} type="submit">
              {isSubmitting ? "Signing in..." : "Sign in"}
            </button>
          </form>
          {errorMessage ? <p className="auth-error">{errorMessage}</p> : null}
        </section>

        <aside className="auth-card auth-card-secondary">
          <p className="panel-label">Provisioning note</p>
          <h2>What must already exist</h2>
          <ul className="signal-list">
            <li>Firebase Email/Password Auth account</li>
            <li>`users/uid` profile document</li>
            <li>Custom role claim for faculty or student access</li>
          </ul>
        </aside>
      </div>
    </div>
  );
}
