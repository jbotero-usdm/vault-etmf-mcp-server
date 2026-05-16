export default async function handler(req, res) {
  const now = new Date().toISOString();

  const payload = {
    status: 'ok',
    generatedAt: now,
    environment: {
      company: 'ABC BioPharma',
      name: 'SmartTMF Box Intake + Vault Filing Support',
      systemOfRecord: 'Vault',
      intakeSystem: 'Box',
      intelligenceLayer: 'Glean'
    },
    datasources: {
      documents: {
        name: process.env.DATASOURCE_DOCUMENTS || 'vaultetmfv2documents',
        indexed: 59,
        status: 'active',
        description: 'TMF documents and metadata'
      },
      objects: {
        name: process.env.DATASOURCE_OBJECTS || 'vaultetmfv2objects',
        indexed: 22,
        status: 'active',
        description: 'Study, country, and site context'
      },
      security: {
        name: process.env.DATASOURCE_SECURITY || 'vaultetmfv2security',
        usersDiscovered: 20,
        groupsDiscovered: 45,
        membershipsMapped: 135,
        status: 'snapshot',
        description: 'Security snapshot and readiness context'
      }
    },
    health: {
      dashboard: 'live',
      agent: 'available',
      filingMode: 'gather_only',
      adminOps: 'enabled'
    },
    runs: {
      lastFullCrawl: 'Ready to wire from workflow history',
      lastReindex: 'Ready to wire from workflow history',
      lastIncrementalSync: 'Ready to wire from workflow history'
    }
  };

  res.status(200).json(payload);
}
