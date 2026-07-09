import { vqlQuery } from '../lib/vault.js';

const STUDY_CRO = {
  'XmAb13676-06': 'Parexel',
  'XmAb14045-08': 'Parexel',
  'XmAb18087-16': 'Fortrea',
  'XmAb819-01':   'ICON',
  'XmAb942-01':   'Alimentiv',
  'XmAb808-02':   'Syneos Health',
};

export default async function handler(req, res) {
  try {
    const studyVql = `
      SELECT study__vr.name__v AS study_name, COUNT(id) AS doc_count
      FROM documents
      WHERE status__v != 'obsolete__v'
      GROUP BY study__vr.name__v
    `;
    const statusVql = `
      SELECT status__v, COUNT(id) AS doc_count
      FROM documents
      GROUP BY status__v
    `;
    const recentVql = `
      SELECT id, document_number__v, name__v, status__v,
             study__vr.name__v AS study_name,
             site__vr.name__v AS site_name,
             artifact_type__v, last_modified_date__v
      FROM documents
      WHERE last_modified_date__v >= DATEADD(day, -30, NOW())
      ORDER BY last_modified_date__v DESC
      LIMIT 50
    `;
    const siteVql = `
      SELECT name__v, status__v, study__vr.name__v AS study_name
      FROM site__v
      WHERE status__v = 'active__v'
    `;

    const [studies, statuses, recentDocs, sites] = await Promise.all([
      vqlQuery(studyVql),
      vqlQuery(statusVql),
      vqlQuery(recentVql),
      vqlQuery(siteVql).catch(() => []),
    ]);

    const studySummary = studies.map(s => ({
      study: s.study_name || 'Unassigned',
      cro: STUDY_CRO[s.study_name] || 'Unknown',
      documentsFiled: s.doc_count || 0,
    }));

    const statusBreakdown = {};
    for (const s of statuses) {
      statusBreakdown[s.status__v || 'unknown'] = s.doc_count || 0;
    }

    const totalFiled = statuses.reduce((sum, s) => sum + (s.doc_count || 0), 0);
    const unclassified = statusBreakdown['unclassified__v'] || 0;
    const activeSites = sites.length;
    const cros = [...new Set(studySummary.map(s => s.cro).filter(c => c !== 'Unknown'))];

    // Health: green if no stale unclassified, amber if some, red if many
    const health = unclassified === 0 ? 'green' : unclassified <= 10 ? 'amber' : 'red';

    res.status(200).json({
      status: 'ok',
      generatedAt: new Date().toISOString(),
      overview: {
        source: 'Vault eTMF',
        health,
        activeStudies: studySummary.length,
        croPartners: cros.length,
        documentsFiled: totalFiled,
        sitesActive: activeSites,
        unclassifiedInbox: unclassified,
        studies: studySummary.sort((a, b) => b.documentsFiled - a.documentsFiled),
        statusBreakdown,
        recentActivity: recentDocs.map(d => ({
          id: d.id,
          document_number: d.document_number__v,
          name: d.name__v,
          status: d.status__v,
          study: d.study_name || 'Unassigned',
          site: d.site_name || null,
          artifact_type: d.artifact_type__v || null,
          modified_at: d.last_modified_date__v,
        })),
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
