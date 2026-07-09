const VAULT_URL = process.env.VAULT_URL;       // e.g. https://usdm-etmf.veevavault.com
const VAULT_USER = process.env.VAULT_USER;
const VAULT_PASS = process.env.VAULT_PASS;

let sessionId = null;

async function authenticate() {
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
  return sessionId;
}

export async function vqlQuery(vql) {
  if (!sessionId) await authenticate();

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

  // Re-auth on expired session and retry once
  if (data.responseStatus === 'FAILURE' && data.responseMessage?.includes('INVALID_SESSION')) {
    await authenticate();
    return vqlQuery(vql);
  }

  if (data.responseStatus !== 'SUCCESS') {
    throw new Error(`VQL failed: ${data.responseMessage || JSON.stringify(data)}`);
  }

  return data.data || [];
}
