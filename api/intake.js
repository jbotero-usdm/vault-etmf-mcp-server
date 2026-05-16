async function boxFetch(path, token) {
  const response = await fetch(`https://api.box.com/2.0${path}`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Box API ${response.status}: ${text}`);
  }
  return response.json();
}

async function getFolderItems(folderId, token) {
  return boxFetch(`/folders/${folderId}/items?limit=1000&fields=id,name,type,modified_at,path_collection`, token);
}

function inferStudy(name) {
  const patterns = [
    /APG\d+(?:-\d+)?/i,
    /XEN-\d+(?:-[A-Za-z0-9]+)?/i,
    /XmAb\d+(?:-\d+)?/i
  ];
  for (const p of patterns) {
    const m = name.match(p);
    if (m) return m[0];
  }
  return 'Unassigned';
}

export default async function handler(req, res) {
  const token = process.env.BOX_DEVELOPER_TOKEN || process.env.BOX_ACCESS_TOKEN;
  const rootFolder = process.env.BOX_FOLDER_ID_ROOT || '379575763081';
  const intakeFolder = process.env.BOX_FOLDER_ID_INTAKE;
  const classificationFolder = process.env.BOX_FOLDER_ID_CLASSIFICATION;
  const qcFolder = process.env.BOX_FOLDER_ID_QC;
  const approvedFolder = process.env.BOX_FOLDER_ID_APPROVED;
  const rejectedFolder = process.env.BOX_FOLDER_ID_REJECTED;

  try {
    if (!token) {
      return res.status(200).json({
        status: 'warning',
        generatedAt: new Date().toISOString(),
        intake: {
          source: 'Box',
          folder: rootFolder,
          folderName: 'SmartTMF root (token missing)',
          newItems: 0,
          needsQc: 0,
          approved: 0,
          readyForClassification: 0,
          agingItems: 0,
          stageCounts: { intake: 0, classification: 0, qc_review: 0, approved: 0, rejected: 0 },
          stageFolders: {},
          studies: [],
          recentFiles: [],
          note: 'Add BOX_DEVELOPER_TOKEN or BOX_ACCESS_TOKEN in Vercel env vars'
        }
      });
    }

    const [rootInfo, intakeItems, classificationItems, qcItems, approvedItems, rejectedItems] = await Promise.all([
      boxFetch(`/folders/${rootFolder}?fields=id,name`, token).catch(() => ({ id: rootFolder, name: 'SmartTMF Root' })),
      intakeFolder ? getFolderItems(intakeFolder, token).catch(() => ({ entries: [] })) : Promise.resolve({ entries: [] }),
      classificationFolder ? getFolderItems(classificationFolder, token).catch(() => ({ entries: [] })) : Promise.resolve({ entries: [] }),
      qcFolder ? getFolderItems(qcFolder, token).catch(() => ({ entries: [] })) : Promise.resolve({ entries: [] }),
      approvedFolder ? getFolderItems(approvedFolder, token).catch(() => ({ entries: [] })) : Promise.resolve({ entries: [] }),
      rejectedFolder ? getFolderItems(rejectedFolder, token).catch(() => ({ entries: [] })) : Promise.resolve({ entries: [] })
    ]);

    const now = Date.now();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

    const intakeEntries = intakeItems.entries || [];
    const intakeFiles = intakeEntries.filter(x => x.type === 'file');
    const intakeStudyFolders = intakeEntries.filter(x => x.type === 'folder');

    const studiesMap = new Map();
    const recentFiles = [];

    for (const studyFolder of intakeStudyFolders) {
      try {
        const studyItems = await getFolderItems(studyFolder.id, token);
        const files = (studyItems.entries || []).filter(x => x.type === 'file');
        const latestModifiedAt = files.map(f => f.modified_at).filter(Boolean).sort().reverse()[0] || null;
        studiesMap.set(studyFolder.name, {
          study: studyFolder.name,
          count: files.length,
          latestModifiedAt
        });
        files.forEach(f => recentFiles.push({
          id: f.id,
          name: f.name,
          study: studyFolder.name,
          stage: 'Intake',
          modified_at: f.modified_at
        }));
      } catch (_) {}
    }

    // Also include loose intake files not inside study subfolders
    intakeFiles.forEach(f => {
      recentFiles.push({
        id: f.id,
        name: f.name,
        study: inferStudy(f.name),
        stage: 'Intake',
        modified_at: f.modified_at
      });
    });

    const allRecent = recentFiles.sort((a, b) => new Date(b.modified_at || 0) - new Date(a.modified_at || 0)).slice(0, 25);
    const agingItems = allRecent.filter(f => f.modified_at && (now - new Date(f.modified_at).getTime() > sevenDaysMs)).length;

    return res.status(200).json({
      status: 'ok',
      generatedAt: new Date().toISOString(),
      intake: {
        source: 'Box',
        folder: rootInfo.id,
        folderName: rootInfo.name,
        newItems: intakeEntries.length,
        needsQc: (qcItems.entries || []).length,
        approved: (approvedItems.entries || []).length,
        readyForClassification: (classificationItems.entries || []).length,
        agingItems,
        totalFiles: allRecent.length,
        stageCounts: {
          intake: intakeEntries.length,
          classification: (classificationItems.entries || []).length,
          qc_review: (qcItems.entries || []).length,
          approved: (approvedItems.entries || []).length,
          rejected: (rejectedItems.entries || []).length
        },
        stageFolders: {
          intake: intakeFolder || 'not_configured',
          classification: classificationFolder || 'not_configured',
          qc_review: qcFolder || 'not_configured',
          approved: approvedFolder || 'not_configured',
          rejected: rejectedFolder || 'not_configured'
        },
        studies: Array.from(studiesMap.values()).sort((a, b) => b.count - a.count),
        recentFiles: allRecent,
        note: 'Live Box intake metrics'
      }
    });
  } catch (err) {
    return res.status(500).json({
      status: 'error',
      generatedAt: new Date().toISOString(),
      error: String(err)
    });
  }
}
