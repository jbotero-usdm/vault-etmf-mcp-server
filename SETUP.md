# SmartTMF live final bundle

Deploy these files into `vault-etmf-mcp-server`:

- `index.html`
- `api/health.js`
- `api/intake.js`
- `api/vault-summary.js`
- `api/overview.js`

## Required Vercel env vars

### Box
- `BOX_DEVELOPER_TOKEN`
- `BOX_FOLDER_ID_INTAKE`
- `BOX_FOLDER_ID_CLASSIFICATION`
- `BOX_FOLDER_ID_QC`
- `BOX_FOLDER_ID_APPROVED`
- `BOX_FOLDER_ID_REJECTED`

### Vault
- `VAULT_URL`
- `VAULT_USERNAME`
- `VAULT_PASSWORD`

### Glean / datasource labels
- `GLEAN_API_URL`
- `DATASOURCE_DOCUMENTS=vaultetmfv2documents`
- `DATASOURCE_OBJECTS=vaultetmfv2objects`
- `DATASOURCE_SECURITY=vaultetmfv2security`

## Copy commands

```bash
cd /Users/jennellbotero/Desktop/GleanLS/vault-etmf-mcp-server
cp ~/Downloads/index.html ./index.html
cp ~/Downloads/health.js ./api/health.js
cp ~/Downloads/intake.js ./api/intake.js
cp ~/Downloads/vault-summary.js ./api/vault-summary.js
cp ~/Downloads/overview.js ./api/overview.js

git add index.html api/health.js api/intake.js api/vault-summary.js api/overview.js
git commit -m "Patch SmartTMF shell for live Box intake and Vault summary"
git push origin main
```
