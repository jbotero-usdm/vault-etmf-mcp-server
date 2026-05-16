export default async function handler(req, res) {
  const { fileId, folderId, name, type } = req.query || {};
  const params = new URLSearchParams();
  if (fileId) params.set('fileId', fileId);
  if (folderId) params.set('folderId', folderId);
  if (name) params.set('name', name);
  if (type) params.set('type', type);
  const target = `/?${params.toString()}`;
  res.redirect(302, target);
}
