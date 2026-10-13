import type { User } from '../auth';

const PROVIDERS: Record<string, string> = {
  okta: 'Okta',
  oidc: 'OpenID Connect',
  samlp: 'SAML',
  waad: 'Microsoft Entra ID',
  'google-oauth2': 'Google',
  auth0: 'Auth0 database',
};

// Auth0 subjects look like "okta|okta-corp|00u1abc" (strategy|connection|id) or "auth0|abc123"
export function parseSub(sub: string) {
  const parts = sub.split('|');
  const strategy = parts.length > 1 ? parts[0] : '';
  return {
    provider: PROVIDERS[strategy] ?? (strategy || 'Unknown'),
    connection: parts.length > 2 ? parts.slice(1, -1).join('|') : null,
    id: parts[parts.length - 1],
  };
}

export function displayName(user: User) {
  return user.name || user.email || 'Signed-in user';
}

export function firstName(user: User) {
  const name = displayName(user);
  // Okta often sends the email as the name
  return name.includes('@') ? name.split('@')[0] : name.split(' ')[0];
}

export function initials(user: User) {
  const words = displayName(user).split('@')[0].split(/[\s._-]+/).filter(Boolean);
  return ((words[0]?.[0] ?? '?') + (words[1]?.[0] ?? '')).toUpperCase();
}

export function greeting(now = new Date()) {
  const h = now.getHours();
  if (h < 5) return 'Up late';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}
