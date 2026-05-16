export default async function handler(req, res) {
  const { code, error, error_description } = req.query || {};
  if (error) {
    return res.status(400).send(`Box OAuth error: ${error} ${error_description || ''}`);
  }
  return res.status(200).send(`
    <html><body style="font-family:Arial,sans-serif;padding:24px;">
      <h2>Box OAuth callback received</h2>
      <p>Authorization code captured successfully.</p>
      <p style="word-break:break-all"><strong>code:</strong> ${code || 'missing'}</p>
      <p>You can now exchange this code in your backend if you move beyond developer-token mode.</p>
    </body></html>
  `);
}
