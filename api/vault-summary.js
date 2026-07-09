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
      SELECT id, name__v, document_number__v, status__v, version_modified_date__v
      FROM documents
      WHERE status__v != 'obsolete__v'
      ORDER BY version_modified_date__v DESC
      LIMIT 200
    `;

    const [studies, sites, docs] = await Promise.all([
      vqlQuery(studiesVql).catch(() => []),
      vqlQuery(sitesVql).catch(() => []),
      vqlQuery(docsVql),
    ]);

    const documentsByStudy = docs.length
      ? [{ study: 'Unassigned', count: docs.length }]
      : [];

    const recentDocuments = docs.map(d => ({
      id: d.id,
      name__v: d.name__v || 'Untitled',
      document_number: d.document_number__v || null,
      status: d.status__v || null,
      study__v: 'Unassigned',
      artifact_type: null,
      version_modified_date__v: d.version_modified_date__v || null,
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
        study: 'Unassigned',
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
