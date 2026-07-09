import { vqlQuery } from '../lib/vault.js';

const STAGE_MAP = {
  Unclassified: 'Intake',
  'In Progress': 'In Progress',
  Approved: 'Approved',
  Effective: 'Approved',
  Rejected: 'Rejected',
  Obsolete: 'Rejected',
};

export default async function handler(req, res) {
  try {
    const vql = `
      SELECT id, document_number__v, name__v, status__v, created_date__v, last_modified_date__v
      FROM documents
      ORDER BY last_modified_date__v DESC
      LIMIT 100
    `;

    const docs = await vqlQuery(vql);

    const recentFiles = docs.map(d => ({
      id: d.id,
      document_number: d.document_number__v || null,
      name: d.name__v || 'Untitled',
      status: d.status__v || 'Unknown',
      stage: STAGE_MAP[d.status__v] || d.status__v || 'Unknown',
      study: 'Unassigned',
      site: null,
      country: null,
      artifactType: null,
      classification: null,
      created_at: d.created_date__v || null,
      modified_at: d.last_modified_date__v || null,
    }));

    const intake = recentFiles.filter(f => f.stage === 'Intake');
    const approved = recentFiles.filter(f => f.stage === 'Approved');
    const rejected = recentFiles.filter(f => f.stage === 'Rejected');
    const inProgress = recentFiles.filter(f => f.stage === 'In Progress');

    const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
    const agingItems = intake.filter(f =>
      f.modified_at && (Date.now() - new Date(f.modified_at).getTime() > SEVEN_DAYS)
    );

    const cros = [...new Set(recentFiles.map(f => {
      const parts = (f.name || '').split('_');
      return parts.length > 1 ? parts[0] : null;
    }).filter(Boolean))];

    res.status(200).json({
      status: 'ok',
      generatedAt: new Date().toISOString(),
      intake: {
        source: 'Vault eTMF Inbox',
        totalFiles: recentFiles.length,
        newItems: intake.length,
        readyForClassification: intake.length,
        inQcReview: inProgress.length,
        approvedCount: approved.length,
        rejectedCount: rejected.length,
        agingItems: agingItems.length,
        cros,
        recentFiles: recentFiles.slice(0, 25),
        studies: [{
          study: 'Unassigned',
          count: recentFiles.length,
          readyForClassification: intake.length,
          inQc: inProgress.length,
          aging: agingItems.length,
        }],
      },
    });
  } catch (e) {
    res.status(200).json({
      status: 'warning',
      generatedAt: new Date().toISOString(),
      intake: {
        source: 'Vault eTMF Inbox',
        totalFiles: 0,
        newItems: 0,
        readyForClassification: 0,
        inQcReview: 0,
        approvedCount: 0,
        rejectedCount: 0,
        agingItems: 0,
        cros: [],
        recentFiles: [],
        studies: [],
        note: String(e.message || e),
      },
    });
  }
}
