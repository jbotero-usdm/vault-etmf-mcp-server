import { vqlQuery } from '../lib/vault.js';

const STAGE_MAP = {
  'unclassified__v':      'Intake',
  'needs_classification': 'Needs Classification',
  'in_qc_review__v':      'QC Review',
  'approved__v':          'Approved',
  'effective__v':         'Approved',
  'rejected__v':          'Rejected',
  'obsolete__v':          'Rejected',
};

export default async function handler(req, res) {
  try {
    const vql = `
      SELECT id, document_number__v, name__v, status__v,
             study__vr.name__v AS study_name,
             site__vr.name__v AS site_name,
             artifact_type__v, classification__vs,
             created_date__v, last_modified_date__v, country__v
      FROM documents
      WHERE status__v IN (
        'unclassified__v', 'needs_classification',
        'in_qc_review__v', 'approved__v',
        'effective__v', 'rejected__v'
      )
      ORDER BY last_modified_date__v DESC
      LIMIT 100
    `;

    const docs = await vqlQuery(vql);

    const recentFiles = docs.map(d => ({
      id:             d.id,
      document_number: d.document_number__v,
      name:           d.name__v,
      status:         d.status__v,
      stage:          STAGE_MAP[d.status__v] || d.status__v || 'Unknown',
      study:          d.study_name || 'Unassigned',
      site:           d.site_name || null,
      country:        d.country__v || null,
      artifactType:   d.artifact_type__v || null,
      classification: d.classification__vs || null,
      created_at:     d.created_date__v,
      modified_at:    d.last_modified_date__v,
    }));

    const intake       = recentFiles.filter(f => f.stage === 'Intake');
    const classification = recentFiles.filter(f => f.stage === 'Needs Classification');
    const qc           = recentFiles.filter(f => f.stage === 'QC Review');
    const approved     = recentFiles.filter(f => f.stage === 'Approved');
    const rejected     = recentFiles.filter(f => f.stage === 'Rejected');

    const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
    const agingItems = intake.filter(f =>
      Date.now() - new Date(f.modified_at || f.created_at).getTime() > SEVEN_DAYS
    );

    const byStudy = {};
    for (const f of recentFiles) {
      const k = f.study;
      byStudy[k] ||= { study: k, count: 0, readyForClassification: 0, inQc: 0, aging: 0 };
      byStudy[k].count += 1;
      if (f.stage === 'Needs Classification') byStudy[k].readyForClassification += 1;
      if (f.stage === 'QC Review') byStudy[k].inQc += 1;
    }
    for (const f of agingItems) {
      if (byStudy[f.study]) byStudy[f.study].aging += 1;
    }

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
        readyForClassification: classification.length,
        inQcReview: qc.length,
        approvedCount: approved.length,
        rejectedCount: rejected.length,
        agingItems: agingItems.length,
        cros,
        recentFiles: recentFiles.slice(0, 25),
        studies: Object.values(byStudy).sort((a, b) => b.count - a.count),
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
