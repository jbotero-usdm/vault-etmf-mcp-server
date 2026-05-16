export default async function handler(req, res) {
  const ok = (v) => !!(v && String(v).trim());
  const payload = {
    status: ok(process.env.VAULT_URL) && ok(process.env.GLEAN_API_URL) ? 'ok' : 'warning',
    generatedAt: new Date().toISOString(),
    datasources: {
      documents: { name: process.env.DATASOURCE_DOCUMENTS || 'vaultetmfv2documents', status: 'active' },
      objects: { name: process.env.DATASOURCE_OBJECTS || 'vaultetmfv2objects', status: 'active' },
      security: { name: process.env.DATASOURCE_SECURITY || 'vaultetmfv2security', status: 'snapshot' }
    },
    connections: {
      box: ok(process.env.BOX_DEVELOPER_TOKEN) || ok(process.env.BOX_CLIENT_ID),
      vault: ok(process.env.VAULT_URL) && ok(process.env.VAULT_USERNAME) && ok(process.env.VAULT_PASSWORD),
      glean: ok(process.env.GLEAN_API_URL)
    }
  };
  res.status(200).json(payload);
}
