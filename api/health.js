export default async function handler(req, res) {
  const envReady = Boolean(
    process.env.VAULT_ETMF_DNS &&
    process.env.VAULT_ETMF_USERNAME &&
    process.env.VAULT_ETMF_PASSWORD
  );

  res.status(200).json({
    status: envReady ? 'ok' : 'warning',
    generatedAt: new Date().toISOString(),
    environment: {
      company: 'USDM Life Sciences',
      name: 'SmartTMF — Vault eTMF via Glean',
      mode: 'live'
    },
    datasources: {
      documents: {
        name: process.env.DATASOURCE_DOCUMENTS || 'vaultetmfv2documents',
        indexed: 0,
        status: 'unknown',
        description: 'Vault eTMF documents exposed through Glean'
      },
      objects: {
        name: process.env.DATASOURCE_OBJECTS || 'vaultetmfv2objects',
        indexed: 0,
        status: 'unknown',
        description: 'Study and site context exposed through Glean'
      },
      security: {
        name: process.env.DATASOURCE_SECURITY || 'vaultetmfv2security',
        usersDiscovered: 0,
        groupsDiscovered: 0,
        membershipsMapped: 0,
        status: 'not_shown',
        description: 'Operational detail hidden from main dashboard'
      }
    },
    health: {
      dashboard: 'live',
      agent: 'available',
      filingMode: 'assisted',
      adminOps: 'enabled'
    }
  });
}
