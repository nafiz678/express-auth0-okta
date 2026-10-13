import { useState, type ReactNode } from 'react';
import { NavLink } from 'react-router';
import type { User } from '../auth';
import { apiUrl, type ApiResult } from '../lib/api';
import { displayName, initials } from '../lib/identity';

export function Brand() {
  return (
    <span className="brand">
      <svg className="brand-mark" viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="8" fill="currentColor" />
        <path d="M9 24V15a7 7 0 0 1 14 0v9" fill="none" stroke="var(--paper)" strokeWidth="2.4" strokeLinecap="round" />
        <circle cx="16" cy="19" r="2.2" fill="var(--paper)" />
      </svg>
      <span className="brand-name">Gatehouse</span>
    </span>
  );
}

// The header of every signed-in page
export function TopBar({ user }: { user: User }) {
  return (
    <header className="topbar">
      <div className="topbar-left">
        <Brand />
        <nav className="topbar-nav" aria-label="Pages">
          <NavLink to="/dashboard">Dashboard</NavLink>
          <NavLink to="/private">Private test</NavLink>
        </nav>
      </div>
      <div className="topbar-user">
        <Avatar user={user} size={32} />
        <span className="topbar-name">{displayName(user)}</span>
        <a className="btn btn-ghost" href={apiUrl('/logout')}>
          <LogoutIcon /> Log out
        </a>
      </div>
    </header>
  );
}

// Shown once an API call comes back 401 on a page that needs a session
export function SessionEnded({ returnTo }: { returnTo: string }) {
  return (
    <div className="notice notice-warn" role="alert">
      <div>
        <strong>Your session has ended.</strong>
        <span>The server no longer recognises your cookie. Sign in again to carry on.</span>
      </div>
      <a className="btn btn-primary" href={apiUrl(`/login?returnTo=${encodeURIComponent(returnTo)}`)}>
        Sign in again
      </a>
    </div>
  );
}

const JSON_TOKEN = /("(?:\\.|[^"\\])*")(\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d+)?/g;

// A response body, pretty-printed and coloured when it is JSON
export function Json({ value }: { value: unknown }) {
  if (typeof value === 'string') return <pre>{value}</pre>;
  const json = JSON.stringify(value, null, 2);
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of json.matchAll(JSON_TOKEN)) {
    out.push(json.slice(last, m.index));
    const kind = m[2] ? 'key' : m[1] ? 'str' : 'lit';
    out.push(
      <span key={m.index} className={`tok-${kind}`}>
        {m[1] ?? m[0]}
      </span>,
      m[2] ?? '',
    );
    last = m.index + m[0].length;
  }
  out.push(json.slice(last));
  return <pre>{out}</pre>;
}

export function Avatar({ user, size = 40 }: { user: User; size?: number }) {
  const [broken, setBroken] = useState(false);
  const style = { width: size, height: size, fontSize: size * 0.38 };
  return user.picture && !broken ? (
    <img
      className="avatar"
      style={style}
      src={user.picture}
      alt={displayName(user)}
      referrerPolicy="no-referrer"
      onError={() => setBroken(true)}
    />
  ) : (
    <span className="avatar avatar-initials" style={style} aria-hidden="true">
      {initials(user)}
    </span>
  );
}

export function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // clipboard blocked: the value is still selectable on the page
    }
  };
  return (
    <button type="button" className="icon-btn" onClick={copy} aria-label={copied ? 'Copied' : label} title={label}>
      {copied ? <CheckIcon /> : <CopyIcon />}
    </button>
  );
}

export function StatusPill({ status }: { status: number }) {
  const tone = status >= 200 && status < 300 ? 'ok' : status === 401 ? 'warn' : 'bad';
  return (
    <span className={`pill pill-${tone}`}>
      <span className="pill-dot" />
      {status === 0 ? 'no response' : status}
    </span>
  );
}

// Everything known about a failed API call: what failed, why, how to fix it, and the raw facts
export function ErrorPanel({ result, onRetry, busy }: { result: ApiResult; onRetry?: () => void; busy?: boolean }) {
  const { error } = result;
  if (!error) return null;
  return (
    <div className={`fault${error.kind === 'unauthorized' ? ' fault-warn' : ''}`} role="alert">
      <div className="fault-head">
        <strong>{error.title}</strong>
        {onRetry && error.retryable && (
          <button type="button" className="btn btn-ghost" onClick={onRetry} disabled={busy}>
            <RefreshIcon /> {busy ? 'Retrying…' : 'Retry'}
          </button>
        )}
      </div>

      <dl className="fault-rows">
        <div>
          <dt>Why it failed</dt>
          <dd>{error.why}</dd>
        </div>
        {error.serverMessage && (
          <div>
            <dt>The server said</dt>
            <dd>
              <code>{error.serverMessage}</code>
            </dd>
          </div>
        )}
        <div>
          <dt>How to fix it</dt>
          <dd>{error.fix}</dd>
        </div>
      </dl>

      <dl className="fault-tech">
        <dt>Request</dt>
        <dd>
          {result.method} {result.url}
        </dd>
        <dt>Status</dt>
        <dd>{result.status === 0 ? 'none (no response received)' : `${result.status} ${result.statusText}`}</dd>
        <dt>Error type</dt>
        <dd>{error.kind}</dd>
        {error.cause && (
          <>
            <dt>Cause</dt>
            <dd>{error.cause}</dd>
          </>
        )}
        {result.contentType && (
          <>
            <dt>Content type</dt>
            <dd>{result.contentType}</dd>
          </>
        )}
        <dt>Failed after</dt>
        <dd>
          {result.ms} ms, at {result.at.toLocaleTimeString()}
        </dd>
      </dl>
    </div>
  );
}

const icon = {
  width: 16,
  height: 16,
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const;

export const ArrowIcon = () => (
  <svg {...icon}>
    <path d="M3 8h10M9 4l4 4-4 4" />
  </svg>
);
export const CopyIcon = () => (
  <svg {...icon}>
    <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
    <path d="M10.5 5.5v-2a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2" />
  </svg>
);
export const CheckIcon = () => (
  <svg {...icon}>
    <path d="M3 8.5l3.2 3.2L13 4.8" />
  </svg>
);
export const RefreshIcon = () => (
  <svg {...icon}>
    <path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9M13.5 2.5v3h-3" />
  </svg>
);
export const LogoutIcon = () => (
  <svg {...icon}>
    <path d="M6 2.5H3.5a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1H6M10.5 11l3-3-3-3M13.5 8H6" />
  </svg>
);
export const LockIcon = () => (
  <svg {...icon}>
    <rect x="3" y="7" width="10" height="6.5" rx="1.5" />
    <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
  </svg>
);
export const PlayIcon = () => (
  <svg {...icon}>
    <path d="M5 3.5v9l7-4.5z" />
  </svg>
);
