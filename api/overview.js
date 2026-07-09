import { vqlQuery } from '../lib/vault.js';

export default async function handler(req, res) {
  try {
    const studiesVql = `
      SELECT name__v, status__v
      FROM study__v
      ORDER BY name__v
    `;

    const sitesVql = `
      SELECT name__v, status__v
      FROM site__v
      LIMIT 200
    `;

    const docsVql = `
      SELECT id, name__v, status__v, last_modified_date__v
      FROM documents
      ORDER BY last_modified_date__v DESC
      LIMIT 200
    `;

    const [studies, sites, docs] = await Promise.all([
      vqlQuery(studiesVql).catch(() => []),
      vqlQuery(sitesVql).catch(() => []),
      vqlQuery(docsVql),
    ]);

    const statusBreakdown = {};
    for (const d of docs) {
      const k = d.status__v || 'Unknown';
      statusBreakdown[k] = (statusBreakdown[k] || 0) + 1;
    }

    const unclassifiedInbox = statusBreakdown['unclassified__v'] || 0;

    const croPartners = [...new Set(
      docs.map(d => (d.name__v || '').split('_')[0]).filter(Boolean)
    )].length;

    const recentActivity = docs.slice(0, 15).map(d => ({
      id: d.id,
      name: d.name__v || 'Untitled',
      status: d.status__v || 'Unknown',
      modified_at: d.last_modified_date__v || null,
    }));

    const health =
      docs.length > 0 ? 'green' :
      studies.length > 0 || sites.length > 0 ? 'amber' :
      'red';

    res.status(200).json({
      status: 'ok',
      generatedAt: new Date().toISOString(),
      overview: {
        source: 'Vault eTMF',
        health,
        activeStudies: studies.length,
        croPartners,
        documentsFiled: docs.length,
        sitesActive: sites.length,
        unclassifiedInbox,
        studies: studies.map(s => ({ name: s.name__v, status: s.status__v })),
        statusBreakdown,
        recentActivity,
      },
    });
  } catch (e) {
    res.status(200).json({
      status: 'warning',
      generatedAt: new Date().toISOString(),
      overview: {
        source: 'Vault eTMF',
        health: 'red',
        activeStudies: 0,
        croPartners: 0,
        documentsFiled: 0,
        sitesActive: 0,
        unclassifiedInbox: 0,
        studies: [],
        statusBreakdown: {},
        recentActivity: [],
        note: String(e.message || e),
      },
    });
  }
}
