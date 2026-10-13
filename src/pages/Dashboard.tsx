import { useEffect, useState, type ReactNode } from 'react';
import { useAuth, type User } from '../auth';
import { apiUrl, callApi, statusLabel, type ApiResult } from '../lib/api';
import { displayName, firstName, greeting, parseSub } from '../lib/identity';
import {
  Avatar,
  CopyButton,
  ErrorPanel,
  Json,
  LockIcon,
  LogoutIcon,
  PlayIcon,
  RefreshIcon,
  SessionEnded,
  StatusPill,
  TopBar,
} from '../components/ui';

const ENDPOINTS = [
  { path: '/api/me', note: 'The profile behind your session cookie.' },
  { path: '/api/private/hello', note: 'An example private endpoint.' },
];

export default function Dashboard() {
  const { user } = useAuth();
  const [hello, setHello] = useState<ApiResult | null>(null);
  const [busy, setBusy] = useState(true);
  const [expired, setExpired] = useState(false);

  const receive = (result: ApiResult) => {
    setHello(result);
    setBusy(false);
    if (result.status === 401) setExpired(true);
  };

  useEffect(() => {
    let live = true;
    callApi('/api/private/hello').then((r) => live && receive(r));
    return () => {
      live = false;
    };
  }, []);

  const reload = () => {
    setBusy(true);
    callApi('/api/private/hello').then(receive);
  };

  if (!user) return null;

  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div className="page">
      <TopBar user={user} />

      {expired && <SessionEnded returnTo="/dashboard" />}

      <main className="dash">
        <section className="dash-head">
          <p className="eyebrow">{today}</p>
          <h1>
            {greeting()}, <em>{firstName(user)}</em>.
          </h1>
        </section>

        <div className="dash-grid">
          <PassCard user={user} />

          <div className="dash-col">
            <section className="card hello">
              <div className="card-head">
                <h2>From the server</h2>
                <div className="card-tools">
                  {hello && <StatusPill status={hello.status} />}
                  <button
                    type="button"
                    className={`icon-btn${busy ? ' is-spinning' : ''}`}
                    onClick={reload}
                    disabled={busy}
                    aria-label="Ask the server again"
                    title="Ask the server again"
                  >
                    <RefreshIcon />
                  </button>
                </div>
              </div>
              <HelloBody result={hello} onRetry={reload} busy={busy} />
              <p className="card-foot">
                <code>GET /api/private/hello</code>
                {hello && (
                  <span>
                    {hello.ms} ms · {hello.at.toLocaleTimeString()}
                  </span>
                )}
              </p>
            </section>

            <section className="card session">
              <div className="card-head">
                <h2>Signing out</h2>
              </div>
              <p>
                Logging out ends your session here, at Auth0 and at Okta. You'll verify with Okta again the next
                time you sign in.
              </p>
              <a className="btn btn-outline" href={apiUrl('/logout')}>
                <LogoutIcon /> Log out
              </a>
            </section>
          </div>
        </div>

        <ApiConsole onUnauthorized={() => setExpired(true)} />
      </main>

      <footer className="footer">
        <span>Express · Auth0 · Okta</span>
        <span>
          <LockIcon /> Session held in an encrypted httpOnly cookie
        </span>
      </footer>
    </div>
  );
}

function HelloBody({ result, onRetry, busy }: { result: ApiResult | null; onRetry: () => void; busy: boolean }) {
  if (!result) return <div className="skeleton" aria-label="Loading" />;
  if (result.error) return <ErrorPanel result={result} onRetry={onRetry} busy={busy} />;
  const message = (result.body as { message?: unknown } | null)?.message;
  if (typeof message === 'string') return <p className="hello-msg">{message}</p>;
  return (
    <p className="hello-msg hello-msg-bad">
      The server answered {statusLabel(result.status)}, but the response has no <code>message</code> field.
    </p>
  );
}

function PassCard({ user }: { user: User }) {
  const { provider, connection } = parseSub(user.sub);
  return (
    <section className="pass" aria-label="Your identity">
      <div className="pass-top">
        <span>Access pass</span>
        <span className="pass-live">
          <span className="pill-dot" /> Signed in
        </span>
      </div>

      <div className="pass-who">
        <Avatar user={user} size={72} />
        <div>
          <p className="pass-name">{displayName(user)}</p>
          {user.email && <p className="pass-email">{user.email}</p>}
        </div>
      </div>

      <dl className="pass-fields">
        <Field label="Verified by">{provider}</Field>
        <Field label="Connection">{connection ?? 'n/a'}</Field>
        <Field label="Session">Server-side cookie</Field>
        <Field label="Scopes">openid profile email</Field>
      </dl>

      <div className="pass-sub">
        <div>
          <span className="pass-label">Subject</span>
          <code title={user.sub}>{user.sub}</code>
        </div>
        <CopyButton value={user.sub} label="Copy subject ID" />
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="pass-label">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function ApiConsole({ onUnauthorized }: { onUnauthorized: () => void }) {
  const [selected, setSelected] = useState(ENDPOINTS[0].path);
  const [results, setResults] = useState<Record<string, ApiResult>>({});
  const [running, setRunning] = useState<string | null>(null);
  const result = results[selected];
  const endpoint = ENDPOINTS.find((e) => e.path === selected)!;

  const run = async () => {
    setRunning(selected);
    const r = await callApi(selected);
    setResults((prev) => ({ ...prev, [selected]: r }));
    setRunning(null);
    if (r.status === 401) onUnauthorized();
  };

  return (
    <section className="console" aria-label="API console">
      <div className="console-side">
        <h2>API console</h2>
        <p>Call the protected endpoints with your session cookie and see exactly what comes back.</p>
        <div className="console-tabs" role="tablist" aria-label="Endpoint">
          {ENDPOINTS.map((e) => (
            <button
              key={e.path}
              type="button"
              role="tab"
              aria-selected={e.path === selected}
              className="console-tab"
              onClick={() => setSelected(e.path)}
            >
              <span className="verb">GET</span>
              {e.path}
            </button>
          ))}
        </div>
      </div>

      <div className="console-main">
        <div className="console-bar">
          <span className="console-note">{endpoint.note}</span>
          <button type="button" className="btn btn-accent" onClick={run} disabled={running !== null}>
            <PlayIcon /> {running === selected ? 'Sending…' : 'Send request'}
          </button>
        </div>
        <div className="console-out" role="tabpanel" aria-live="polite">
          {result ? (
            <>
              <div className="console-meta">
                <StatusPill status={result.status} />
                <span>{result.ms} ms</span>
                <span>{result.at.toLocaleTimeString()}</span>
              </div>
              {result.error && <ErrorPanel result={result} onRetry={run} busy={running !== null} />}
              {result.body !== null && result.body !== '' && (
                <>
                  {result.error && <p className="console-label">Response body</p>}
                  <Json value={result.body} />
                </>
              )}
            </>
          ) : (
            <p className="console-empty">
              Press <b>Send request</b> to call <code>{selected}</code>.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
