const VERIFIER_KEY = 'pkce_verifier';
const REDIRECT_PATH = '/dev/auth';

interface OidcDiscovery {
  authorization_endpoint: string;
  token_endpoint: string;
}

async function fetchDiscovery(): Promise<OidcDiscovery> {
  const issuer = import.meta.env.VITE_OIDC_ISSUER as string;
  const resp = await fetch(`${issuer}/.well-known/openid-configuration`);
  if (!resp.ok) throw new Error(`OIDC discovery failed: ${resp.status}`);
  return resp.json() as Promise<OidcDiscovery>;
}

function base64urlEncode(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function generateVerifier(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(48));
  return base64urlEncode(bytes.buffer);
}

async function generateChallenge(verifier: string): Promise<string> {
  const encoded = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return base64urlEncode(digest);
}

export async function startLogin(): Promise<void> {
  const discovery = await fetchDiscovery();
  const verifier = generateVerifier();
  const challenge = await generateChallenge(verifier);

  sessionStorage.setItem(VERIFIER_KEY, verifier);

  const redirectUri = window.location.origin + REDIRECT_PATH;
  const authUrl = new URL(discovery.authorization_endpoint);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', import.meta.env.VITE_OIDC_CLIENT_ID as string);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('scope', 'openid profile email offline_access');
  authUrl.searchParams.set('code_challenge', challenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');
  authUrl.searchParams.set('nonce', base64urlEncode(crypto.getRandomValues(new Uint8Array(16)).buffer));
  authUrl.searchParams.set('state', base64urlEncode(crypto.getRandomValues(new Uint8Array(16)).buffer));

  const audience = import.meta.env.VITE_OIDC_AUDIENCE as string | undefined;
  if (audience) authUrl.searchParams.set('audience', audience);

  console.log('Redirecting to OIDC provider with URL:', authUrl.toString());
  window.location.href = authUrl.toString();
}

export async function exchangeCode(code: string): Promise<Record<string, unknown>> {
  const verifier = sessionStorage.getItem(VERIFIER_KEY);
  if (!verifier) throw new Error('PKCE verifier missing from sessionStorage');
  sessionStorage.removeItem(VERIFIER_KEY);

  const discovery = await fetchDiscovery();
  const redirectUri = window.location.origin + REDIRECT_PATH;

  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: import.meta.env.VITE_OIDC_CLIENT_ID as string,
    code_verifier: verifier,
  });

  const clientSecret = import.meta.env.VITE_OIDC_CLIENT_SECRET as string | undefined;
  if (clientSecret) params.set('client_secret', clientSecret);

  const resp = await fetch(discovery.token_endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  const data = (await resp.json()) as Record<string, unknown>;
  if (!resp.ok) throw new Error(`Token exchange failed: ${JSON.stringify(data)}`);
  return data;
}
