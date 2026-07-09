import { vqlQuery } from '../lib/vault.js';

export default async function handler(req, res) {
  try {
    const studiesVql = `
      SELECT name__v, status__v FROM study__v ORDER BY name__v
    `;
    const sitesVql = `
      SELECT name__v, status__v, study__vr.name__v AS study_name FROM site__v
    `;
    const docsVql = `
      SELECT id, name__v, document_number__v, status__v,
             study__vr.name__v AS study_name,
             artifact_type__v, version_modified_date__v
      FROM documents
      WHERE status__v != 'obsolete__v'
      ORDER BY version_modified_date__v DESC
      LIMIT 50
    `;
    const docsByStudyVql = `
      SELECT study__vr.name__v AS study_name, COUNT(id) AS doc_count
      FROM documents
      WHERE status__v != 'obsolete__v'
      GROUP BY study__vr.name__v
    `;

    const [studies, sites, docs, docsByStudy] = await Promise.all([
      vqlQuery(studiesVql).catch(() => []),
      vqlQuery(sitesVql).catch(() => []),
      vqlQuery(docsVql),
      vqlQuery(docsByStudyVql),
    ]);

    const documentsByStudy = docsByStudy.map(r => ({
      study: r.study_name || 'Unassigned',
      count: r.doc_count || 0,
    }));

    const recentDocuments = docs.map(d => ({
      id: d.id,
      name__v: d.name__v,
      document_number: d.document_number__v,
      status: d.status__v,
      study__v: d.study_name || 'Unassigned',
      artifact_type: d.artifact_type__v || null,
      version_modified_date__v: d.version_modified_date__v,
    }));

    res.status(200).json({
      status: 'ok',
      generatedAt: new Date().toISOString(),
      studiesCount: studies.length,
      sitesCount: sites.length,
      documentsFiled: docs.length,
      documentsByStudy,
      recentDocuments,
      studies: studies.map(s => ({ name: s.name__v, status: s.status__v })),
      sites: sites.map(s => ({
        name: s.name__v,
        status: s.status__v,
        study: s.study_name || 'Unassigned',
      })),
    });
  } catch (e) {
    res.status(200).json({
      status: 'warning',
      generatedAt: new Date().toISOString(),
      studiesCount: 0,
      sitesCount: 0,
      documentsFiled: 0,
      documentsByStudy: [],
      recentDocuments: [],
      studies: [],
      sites: [],
      note: String(e.message || e),
    });
  }
}
