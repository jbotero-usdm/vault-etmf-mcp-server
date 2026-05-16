async function boxGet(url, token) {
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`Box API ${r.status}: ${await r.text()}`);
  return r.json();
}

function inferStudy(text='') {
  const patterns = [
    /[A-Z]{2,6}-\d{3}-\d{3}/,
    /APG\d{3,}-\d+/,
    /APG-\d+/,
    /[A-Z]{2,8}\d{2,}-\d+/
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[0];
  }
  return 'Unassigned';
}

function inferCro(pathEntries=[]) {
  const names = pathEntries.map(e => e.name || '');
  const known = ['Parexel','ICON','PPD','Fortrea','Alimentiv','Kapadi'];
  for (const n of names) {
    const hit = known.find(k => n.toLowerCase().includes(k.toLowerCase()));
    if (hit) return hit;
  }
  return 'Unknown';
}

async function listFolderFiles(folderId, stage, token, maxDepth=3) {
  const files = [];
  const queue = [{ id: folderId, depth: 0 }];
  while (queue.length) {
    const { id, depth } = queue.shift();
    let offset = 0;
    while (true) {
      const data = await boxGet(`https://api.box.com/2.0/folders/${id}/items?limit=1000&offset=${offset}&fields=id,name,type,created_at,modified_at,path_collection,created_by`, token);
      const entries = data.entries || [];
      for (const item of entries) {
        if (item.type === 'file') {
          const pathEntries = item.path_collection?.entries || [];
          files.push({
            id: item.id,
            name: item.name,
            stage,
            created_at: item.created_at,
            modified_at: item.modified_at,
            study: inferStudy(`${item.name} ${pathEntries.map(x=>x.name).join(' ')}`),
            cro: inferCro(pathEntries),
            source: 'Box Intake'
          });
        } else if (item.type === 'folder' && depth < maxDepth) {
          queue.push({ id: item.id, depth: depth + 1 });
        }
      }
      if (entries.length < 1000) break;
      offset += entries.length;
    }
  }
  return files;
}

export default async function handler(req, res) {
  try {
    const token = process.env.BOX_DEVELOPER_TOKEN;
    if (!token) {
      return res.status(200).json({
        status: 'warning',
        generatedAt: new Date().toISOString(),
        intake: {
          newItems: 0,
          readyForClassification: 0,
          inQcReview: 0,
          approvedCount: 0,
          rejectedCount: 0,
          agingItems: 0,
          croCount: 0,
          studies: [],
          cros: [],
          recentFiles: [],
          note: 'BOX_DEVELOPER_TOKEN missing'
        }
      });
    }

    const folders = {
      intake: process.env.BOX_FOLDER_ID_INTAKE,
      classification: process.env.BOX_FOLDER_ID_CLASSIFICATION,
      qc: process.env.BOX_FOLDER_ID_QC,
      approved: process.env.BOX_FOLDER_ID_APPROVED,
      rejected: process.env.BOX_FOLDER_ID_REJECTED
    };

    const stageFiles = {};
    for (const [stage, id] of Object.entries(folders)) {
      stageFiles[stage] = id ? await listFolderFiles(id, stage, token) : [];
    }

    const all = Object.values(stageFiles).flat();
    const now = Date.now();
    const agingItems = all.filter(f => f.modified_at && (now - new Date(f.modified_at).getTime()) > 7*24*60*60*1000).length;

    const byStudy = new Map();
    const byCro = new Map();
    for (const f of all) {
      const s = byStudy.get(f.study) || { study: f.study, count: 0, readyForClassification: 0, inQc: 0 };
      s.count += 1;
      if (f.stage === 'classification') s.readyForClassification += 1;
      if (f.stage === 'qc') s.inQc += 1;
      byStudy.set(f.study, s);

      const c = byCro.get(f.cro) || { name: f.cro, files: 0, studiesSet: new Set(), inQc: 0 };
      c.files += 1;
      c.studiesSet.add(f.study);
      if (f.stage === 'qc') c.inQc += 1;
      byCro.set(f.cro, c);
    }

    const cros = Array.from(byCro.values()).map(c => ({ name: c.name, files: c.files, studies: c.studiesSet.size, inQc: c.inQc }));
    const recentFiles = all.sort((a,b)=>new Date(b.modified_at||b.created_at||0)-new Date(a.modified_at||a.created_at||0)).slice(0,25);

    res.status(200).json({
      status: 'ok',
      generatedAt: new Date().toISOString(),
      intake: {
        newItems: stageFiles.intake.length,
        readyForClassification: stageFiles.classification.length,
        inQcReview: stageFiles.qc.length,
        approvedCount: stageFiles.approved.length,
        rejectedCount: stageFiles.rejected.length,
        totalFiles: all.length,
        agingItems,
        croCount: cros.length,
        studies: Array.from(byStudy.values()).sort((a,b)=>b.count-a.count),
        cros: cros.sort((a,b)=>b.files-a.files),
        recentFiles
      }
    });
  } catch (err) {
    res.status(500).json({ status: 'error', generatedAt: new Date().toISOString(), error: String(err) });
  }
}
