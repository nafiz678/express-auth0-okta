import { useLocation } from 'react-router';
import { useAuth } from '../auth';
import { ArrowIcon, Brand, ErrorPanel, LockIcon } from '../components/ui';
import { apiUrl } from '../lib/api';

const HOPS = [
  { who: 'Browser', what: 'GET /login', why: 'A plain link, so the request reaches Express instead of the React router.' },
  { who: 'Express', what: '302 → Auth0 /authorize', why: 'Starts the authorization code flow with scope openid profile email.' },
  { who: 'Auth0', what: 'connection=okta-corp', why: 'Skips the Auth0 login page and hands you straight to Okta.' },
  { who: 'Okta', what: 'verifies you', why: 'Password, MFA, whatever your company policy requires.' },
  { who: 'Express', what: 'GET /callback', why: 'Exchanges the code and sets an encrypted, httpOnly session cookie.' },
  { who: 'React', what: '/dashboard', why: 'The app asks /api/me who you are and renders your workspace.' },
];

const FACTS = [
  { title: 'No tokens in the browser', text: 'The code exchange happens on the server. This page never sees an access or ID token.' },
  { title: 'Encrypted httpOnly cookie', text: 'Your session travels in a cookie that scripts on the page cannot read.' },
  { title: 'APIs answer 401, not redirects', text: 'Every /api route checks the session and fails cleanly when it is missing.' },
];

export default function Home() {
  const { failure, retry } = useAuth();
  // set by the route guard when a private page was opened while signed out
  const from = (useLocation().state as { from?: string } | null)?.from;
  const loginHref = apiUrl(from ? `/login?returnTo=${encodeURIComponent(from)}` : '/login');

  return (
    <div className="page">
      <header className="topbar">
        <Brand />
        <span className="topbar-meta">
          <LockIcon /> Okta SSO via Auth0
        </span>
      </header>

      {from && (
        <div className="notice notice-warn" role="status">
          <div>
            <strong>That page is private.</strong>
            <span>
              Sign in and you'll be taken back to <code>{from}</code>.
            </span>
          </div>
        </div>
      )}

      {failure && (
        <div className="fault-slot">
          <ErrorPanel result={failure} onRetry={retry} />
        </div>
      )}

      <main className="hero">
        <section className="hero-copy">
          <p className="eyebrow">Company single sign-on</p>
          <h1>
            One door in.
            <br />
            <em>Okta</em> holds the key.
          </h1>
          <p className="lede">
            Sign in with your company Okta account. Your session is kept on the server side of the door, in an
            encrypted cookie this page can't read.
          </p>
          <div className="cta-row">
            <a className="btn btn-primary btn-lg" href={loginHref}>
              Sign in with Okta <ArrowIcon />
            </a>
            <span className="cta-note">You'll verify with Okta, then land on your dashboard.</span>
          </div>
        </section>

        <aside className="trace" aria-label="What happens when you sign in">
          <div className="trace-head">
            <span>sign-in trace</span>
            <span>{HOPS.length} hops</span>
          </div>
          <ol className="trace-list">
            {HOPS.map((hop, i) => (
              <li key={hop.what}>
                <span className="trace-n">{String(i + 1).padStart(2, '0')}</span>
                <div>
                  <p className="trace-line">
                    <span className="trace-who">{hop.who}</span>
                    <span className="trace-what">{hop.what}</span>
                  </p>
                  <p className="trace-why">{hop.why}</p>
                </div>
              </li>
            ))}
          </ol>
        </aside>
      </main>

      <section className="facts" aria-label="How your session is protected">
        {FACTS.map((fact, i) => (
          <article key={fact.title}>
            <span className="facts-n">{String(i + 1).padStart(2, '0')}</span>
            <h2>{fact.title}</h2>
            <p>{fact.text}</p>
          </article>
        ))}
      </section>

      <footer className="footer">
        <span>Express · Auth0 · Okta</span>
        <span>Authorization code flow</span>
      </footer>
    </div>
  );
}
