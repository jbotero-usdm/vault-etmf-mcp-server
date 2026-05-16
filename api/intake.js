import { discoverStageFolders, listFiles } from '../lib/box.js';

export default async function handler(req, res) {
  try {
    const folders = await discoverStageFolders();
    const [intakeFiles, classificationFiles, qcFiles, approvedFiles, rejectedFiles] = await Promise.all([
      listFiles(folders.intake),
      listFiles(folders.classification),
      listFiles(folders.qc),
      listFiles(folders.approved),
      listFiles(folders.rejected),
    ]);

    const recentFiles = [...intakeFiles, ...classificationFiles, ...qcFiles, ...approvedFiles, ...rejectedFiles]
      .map(f => ({
        ...f,
        stage: intakeFiles.find(x => x.id === f.id) ? 'Intake' :
               classificationFiles.find(x => x.id === f.id) ? 'Needs Classification' :
               qcFiles.find(x => x.id === f.id) ? 'QC Review' :
               approvedFiles.find(x => x.id === f.id) ? 'Approved' : 'Rejected',
      }))
      .sort((a, b) => new Date(b.modified_at || b.created_at) - new Date(a.modified_at || a.created_at))
      .slice(0, 25);

    const byStudy = {};
    for (const f of recentFiles) {
      const k = f.study || 'Unassigned';
      byStudy[k] ||= { study: k, count: 0, readyForClassification: 0, inQc: 0 };
      byStudy[k].count += 1;
      if (f.stage === 'Needs Classification') byStudy[k].readyForClassification += 1;
      if (f.stage === 'QC Review') byStudy[k].inQc += 1;
    }

    const cros = [...new Set(recentFiles.map(f => {
      const parts = (f.name || '').split('_');
      return parts.length > 1 ? parts[0] : null;
    }).filter(Boolean))];

    res.status(200).json({
      status: 'ok',
      generatedAt: new Date().toISOString(),
      intake: {
        source: 'Box intake',
        folders,
        totalFiles: recentFiles.length,
        newItems: intakeFiles.length,
        readyForClassification: classificationFiles.length,
        inQcReview: qcFiles.length,
        approvedCount: approvedFiles.length,
        rejectedCount: rejectedFiles.length,
        agingItems: intakeFiles.filter(f => Date.now() - new Date(f.modified_at || f.created_at).getTime() > 7 * 24 * 60 * 60 * 1000).length,
        cros,
        recentFiles,
        studies: Object.values(byStudy).sort((a, b) => b.count - a.count),
      },
    });
  } catch (e) {
    res.status(200).json({
      status: 'warning',
      generatedAt: new Date().toISOString(),
      intake: {
        source: 'Box intake',
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
