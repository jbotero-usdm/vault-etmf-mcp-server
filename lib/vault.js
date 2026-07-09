const RAW_VAULT_URL = process.env.VAULT_ETMF_DNS;
const VAULT_URL = RAW_VAULT_URL && RAW_VAULT_URL.startsWith('http')
  ? RAW_VAULT_URL
  : `https://${RAW_VAULT_URL || ''}`;

const VAULT_USER = process.env.VAULT_ETMF_USERNAME;
const VAULT_PASS = process.env.VAULT_ETMF_PASSWORD;

let sessionId = null;
let authPromise = null;
let sessionExpiresAt = 0;

function requireEnv() {
  if (!VAULT_URL || !VAULT_USER || !VAULT_PASS) {
    throw new Error('Missing Vault env vars');
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function doAuthenticate() {
  requireEnv();

  const resp = await fetch(`${VAULT_URL}/api/v25.2/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `username=${encodeURIComponent(VAULT_USER)}&password=${encodeURIComponent(VAULT_PASS)}`,
  });

  const data = await resp.json();

  if (data.responseStatus !== 'SUCCESS') {
    throw new Error(`Vault auth failed: ${data.responseMessage || JSON.stringify(data)}`);
  }

  sessionId = data.sessionId;
  sessionExpiresAt = Date.now() + 25 * 60 * 1000;
  return sessionId;
}

async function authenticate(force = false) {
  if (!force && sessionId && Date.now() < sessionExpiresAt) return sessionId;
  if (!force && authPromise) return authPromise;

  authPromise = (async () => {
    try {
      return await doAuthenticate();
    } finally {
      authPromise = null;
    }
  })();

  return authPromise;
}

async function safeAuthenticate(force = false) {
  try {
    return await authenticate(force);
  } catch (e) {
    const msg = String(e.message || e);

    if (msg.includes('API_LIMIT_EXCEEDED')) {
      await sleep(65000);
      return authenticate(true);
    }

    throw e;
  }
}

export async function vqlQuery(vql) {
  await safeAuthenticate();

  const resp = await fetch(`${VAULT_URL}/api/v25.2/query`, {
    method: 'POST',
    headers: {
      'Authorization': sessionId,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    },
    body: `q=${encodeURIComponent(vql)}`,
  });

  const data = await resp.json();
  const msg = data.responseMessage || JSON.stringify(data);

  if (data.responseStatus === 'FAILURE' && msg.includes('INVALID_SESSION')) {
    sessionId = null;
    sessionExpiresAt = 0;
    await safeAuthenticate(true);
    return vqlQuery(vql);
  }

  if (data.responseStatus !== 'SUCCESS') {
    throw new Error(`VQL failed: ${msg}`);
  }

  return data.data || [];
}
