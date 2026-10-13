import { useEffect, useState } from 'react';
import { useAuth } from '../auth';
import { apiUrl, callApi, statusLabel, type ApiResult } from '../lib/api';
import { ErrorPanel, Json, LockIcon, LogoutIcon, PlayIcon, SessionEnded, TopBar } from '../components/ui';

type Check = {
  title: string;
  path: string;
  // the status that means the check passed; 0 means the UI must give up waiting
  expect: number;
  // send the request without the session cookie
  anonymous?: boolean;
};

const CHECKS: Check[] = [
  { title: 'The session cookie is accepted', path: '/api/me', expect: 200 },
  { title: 'A private endpoint answers', path: '/api/private/hello', expect: 200 },
  { title: 'The session claims are readable', path: '/api/private/session', expect: 200 },
  { title: 'The same endpoint refuses a request with no cookie', path: '/api/private/hello', expect: 401, anonymous: true },
  { title: 'An unknown API route answers JSON, not a page', path: '/api/private/missing', expect: 404 },
];

type Run = ApiResult | 'running';

function passed(check: Check, r: ApiResult) {
  if (check.expect === 0) return r.error?.kind === 'timeout';
  return r.status === check.expect && r.body !== null && typeof r.body === 'object';
}

export default function Private() {
  const { user } = useAuth();
  const [session, setSession] = useState<ApiResult | null>(null);
  const [runs, setRuns] = useState<Record<number, Run>>({});
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    let live = true;
    callApi('/api/private/session').then((r) => {
      if (!live) return;
      setSession(r);
      if (r.status === 401) setExpired(true);
    });
    return () => {
      live = false;
    };
  }, []);

  const run = async (i: number) => {
    const check = CHECKS[i];
    setRuns((prev) => ({ ...prev, [i]: 'running' }));
    const r = await callApi(check.path, check.anonymous ? { credentials: 'omit' } : undefined);
    setRuns((prev) => ({ ...prev, [i]: r }));
    if (r.status === 401 && check.expect !== 401) setExpired(true);
  };

  if (!user) return null;

  const done = CHECKS.filter((_, i) => runs[i] && runs[i] !== 'running');
  const passes = CHECKS.filter((c, i) => runs[i] && runs[i] !== 'running' && passed(c, runs[i]));
  const anyRunning = CHECKS.some((_, i) => runs[i] === 'running');

  return (
    <div className="page">
      <TopBar user={user} />

      {expired && <SessionEnded returnTo="/private" />}

      <main className="dash">
        <section className="dash-head">
          <p className="eyebrow">
            <LockIcon /> Private page
          </p>
          <h1>Test bench</h1>
          <p className="lede">
            You can only see this page while signed in. Use it to check the session, the route guard and how every
            kind of API answer is handled.
          </p>
        </section>

        <div className="dash-grid">
          <section className="card">
            <div className="card-head">
              <h2>Your session</h2>
            </div>
            <SessionBody result={session} />
          </section>

          <section className="card session">
            <div className="card-head">
              <h2>Route guard</h2>
            </div>
            <p>
              <code>/private</code> sits behind the same guard as the dashboard. To test it, log out and open{' '}
              <code>/private</code> again: you should be sent to the entrance, and signing in should bring you
              straight back here.
            </p>
            <a className="btn btn-outline" href={apiUrl('/logout')}>
              <LogoutIcon /> Log out
            </a>
          </section>
        </div>

        <section className="card checks" aria-label="API checks">
          <div className="card-head">
            <div>
              <h2>API checks</h2>
              <p className="checks-sum" aria-live="polite">
                {done.length === 0
                  ? `${CHECKS.length} checks, none run yet.`
                  : `${passes.length} of ${done.length} run checks passed.`}
              </p>
              <p className="checks-sum">
                The last two make the API fail on purpose, so they show as errors in the browser's network tab. They
                pass when the failure is the expected one.
              </p>
            </div>
            <button
              type="button"
              className="btn btn-accent"
              onClick={() => CHECKS.forEach((_, i) => run(i))}
              disabled={anyRunning}
            >
              <PlayIcon /> {anyRunning ? 'Running…' : 'Run all checks'}
            </button>
          </div>

          <ol>
            {CHECKS.map((check, i) => (
              <CheckRow key={i} check={check} run={runs[i]} onRun={() => run(i)} />
            ))}
          </ol>
        </section>
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

function CheckRow({ check, run, onRun }: { check: Check; run: Run | undefined; onRun: () => void }) {
  const result = run && run !== 'running' ? run : null;
  const wanted = check.expect === 0 ? 'a timeout' : statusLabel(check.expect);

  return (
    <li className="check">
      <div className="check-row">
        <div>
          <p className="check-title">{check.title}</p>
          <p className="check-req">
            GET {check.path}
            {check.anonymous && ' (no cookie)'} · {check.expect === 200 ? 'should answer' : 'should fail with'} {wanted}
          </p>
        </div>
        <Verdict check={check} run={run} />
        <button
          type="button"
          className="icon-btn"
          onClick={onRun}
          disabled={run === 'running'}
          aria-label={`Run check: ${check.title}`}
          title="Run this check"
        >
          <PlayIcon />
        </button>
      </div>

      {result && (
        <details>
          <summary>
            Got {statusLabel(result.status)} in {result.ms} ms
          </summary>
          <div className="console-out">
            {result.error && <ErrorPanel result={result} />}
            {result.body !== null && result.body !== '' && (
              <>
                {result.error && <p className="console-label">Response body</p>}
                <Json value={result.body} />
              </>
            )}
          </div>
        </details>
      )}
    </li>
  );
}

function Verdict({ check, run }: { check: Check; run: Run | undefined }) {
  if (!run) return <span className="check-idle">not run</span>;
  if (run === 'running') {
    return (
      <span className="pill pill-warn">
        <span className="pill-dot" /> running
      </span>
    );
  }
  const ok = passed(check, run);
  return (
    <span className={`pill pill-${ok ? 'ok' : 'bad'}`}>
      <span className="pill-dot" /> {!ok ? 'fail' : check.expect === 200 ? 'pass' : 'pass: API failed as expected'}
    </span>
  );
}

function SessionBody({ result }: { result: ApiResult | null }) {
  if (!result) return <div className="skeleton" aria-label="Loading" />;
  if (result.error) return <ErrorPanel result={result} />;
  const claims = (result.body as { claims?: Record<string, unknown> } | null)?.claims ?? {};
  return (
    <>
      <dl className="pass-fields">
        <ClaimField label="Issuer" value={claims.iss} />
        <ClaimField label="Session ID" value={claims.sid} />
        <ClaimField label="ID token issued" value={when(claims.iat)} />
        <ClaimField label="ID token expires" value={when(claims.exp)} />
      </dl>
      <details className="claims">
        <summary>All ID token claims</summary>
        <div className="console-out">
          <Json value={claims} />
        </div>
      </details>
    </>
  );
}

function ClaimField({ label, value }: { label: string; value: unknown }) {
  return (
    <div>
      <dt className="pass-label">{label}</dt>
      <dd>{typeof value === 'string' && value ? value : 'n/a'}</dd>
    </div>
  );
}

// JWT times are seconds since the epoch
function when(seconds: unknown) {
  return typeof seconds === 'number' ? new Date(seconds * 1000).toLocaleString() : undefined;
}
