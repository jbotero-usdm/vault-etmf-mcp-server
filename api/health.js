import overviewHandler from './overview.js';
import vaultHandler from './vault-summary.js';

function run(handler) {
  return new Promise((resolve) => {
    const req = {};
    const res = {
      status(code) { this.code = code; return this; },
      json(data) { resolve(data); }
    };
    handler(req, res);
  });
}

export default async function handler(req, res) {
  const [overview, vault] = await Promise.all([run(overviewHandler), run(vaultHandler)]);

  const status = overview.overview?.health === 'green' ?
    'ok' : overview.overview?.health === 'amber' ?
    'warning' : 'error';

  res.status(200).json({
    status,
    generatedAt: new Date().toISOString(),
    environment: {
      company: 'USDM Life Sciences',
      name: 'SmartTMF — Vault eTMF via Glean',
      mode: 'live'
    },
    datasources: {
      documents: {
        name: process.env.DATASOURCE_DOCUMENTS || 'vaultetmfv2documents',
        indexed: vault.documentsFiled || 0,
        status: vault.status || 'warning',
        description: 'Vault eTMF documents exposed through Glean'
      },
      objects: {
        name: process.env.DATASOURCE_OBJECTS || 'vaultetmfv2objects',
        indexed: (vault.studiesCount || 0) + (vault.sitesCount || 0),
        status: vault.status || 'warning',
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
