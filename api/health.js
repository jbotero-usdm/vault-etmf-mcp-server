export default function handler(req, res) {
  const now = new Date().toISOString();
  res.status(200).json({
    status: process.env.OVERALL_STATUS || 'yellow',
    app: process.env.APP_NAME || 'ABC BioPharma Vault eTMF MCP',
    datasources: {
      documents: process.env.DATASOURCE_DOCUMENTS || 'vaultetmfv2documents',
      objects: process.env.DATASOURCE_OBJECTS || 'vaultetmfv2objects',
      security: process.env.DATASOURCE_SECURITY || 'vaultetmfv2security'
    },
    metrics: {
      documentsIndexed: Number(process.env.METRIC_DOCUMENTS_INDEXED || 59),
      objectsIndexed: Number(process.env.METRIC_OBJECTS_INDEXED || 22),
      usersSynced: Number(process.env.METRIC_USERS_SYNCED || 20),
      membershipsMapped: Number(process.env.METRIC_MEMBERSHIPS_MAPPED || 135),
      securityState: process.env.METRIC_SECURITY_STATE || 'Ready',
      incrementalState: process.env.METRIC_INCREMENTAL_STATE || 'Enabled'
    },
    boxIntakeLabel: process.env.BOX_INTAKE_LABEL || 'ABC BioPharma intake folder',
    smokeTestStatus: process.env.SMOKE_TEST_STATUS || 'Available',
    knownGap: process.env.KNOWN_GAP || 'Security datasource is tracked operationally, not surfaced as searchable content',
    lastSuccessfulCheck: process.env.LAST_SUCCESSFUL_CHECK || now,
    message: 'Dashboard live. Admin actions can be wired next.'
  });
}
