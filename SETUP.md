# SmartTMF Box → Vault → Glean Bundle

## Files included
- `index.html` — Box-first SmartTMF dashboard
- `api/health.js` — environment health endpoint
- `api/intake.js` — live Box intake endpoint
- `api/box/webhook.js` — Box webhook receiver
- `api/box/launch.js` — Box web integration launch callback
- `api/box/oauth/callback.js` — Box OAuth redirect handler

## Recommended Vercel environment variables

### Box
- `BOX_DEVELOPER_TOKEN`
- `BOX_FOLDER_ID_ROOT=379575763081`
- `BOX_FOLDER_ID_INTAKE`
- `BOX_FOLDER_ID_CLASSIFICATION`
- `BOX_FOLDER_ID_QC`
- `BOX_FOLDER_ID_APPROVED`
- `BOX_FOLDER_ID_REJECTED`

### Glean / environment
- `GLEAN_API_URL=https://usdm-be.glean.com`
- `DATASOURCE_DOCUMENTS=vaultetmfv2documents`
- `DATASOURCE_OBJECTS=vaultetmfv2objects`
- `DATASOURCE_SECURITY=vaultetmfv2security`

## Box setup values

### Web Integration
- **Name:** SmartTMF
- **Description:** Open SmartTMF to classify, review, and monitor TMF intake workflows.
- **Callback URL:** `https://vault-etmf-mcp-server.vercel.app/api/box/launch`
- **Prompt:** Open SmartTMF for TMF intake review, AI classification, QC oversight, and filing support.
- **Permissions:** Download permissions
- **Item types:** File and Folder

### OAuth Redirect URI
- `https://vault-etmf-mcp-server.vercel.app/api/box/oauth/callback`

### Webhook URL
- `https://vault-etmf-mcp-server.vercel.app/api/box/webhook`
- **Payload format:** REST

### Suggested webhook events
- Uploaded
- Created
- Moved
- Deleted

## Copy into repo
From your Mac:

```bash
cd /Users/jennellbotero/Desktop/GleanLS/vault-etmf-mcp-server
mkdir -p api/box
cp ~/Downloads/index.html ./index.html
cp ~/Downloads/health.js ./api/health.js
cp ~/Downloads/intake.js ./api/intake.js
cp ~/Downloads/webhook.js ./api/box/webhook.js
cp ~/Downloads/launch.js ./api/box/launch.js
cp ~/Downloads/oauth-callback.js ./api/box/oauth/callback.js
```

## Commit and push
```bash
git add index.html api/
git commit -m "Add Box intake, webhook, and launch handlers"
git push origin main
```
