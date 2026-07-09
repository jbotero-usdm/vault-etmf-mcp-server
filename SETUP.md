# SmartTMF live final bundle

Deploy these files into `vault-etmf-mcp-server`:

- `index.html`
- `api/health.js`
- `api/intake.js`
- `api/vault-summary.js`
- `api/overview.js`
- `lib/vault.js`

## Required Vercel env vars

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
mkdir -p lib
cp ~/Downloads/vault.js ./lib/vault.js
cp ~/Downloads/overview.js ./api/overview.js
cp ~/Downloads/intake.js ./api/intake.js
cp ~/Downloads/vault-summary.js ./api/vault-summary.js
cp ~/Downloads/health.js ./api/health.js
cp ~/Downloads/index.html ./index.html
rm -f lib/box.js
git add -A
git commit -m "Migrate SmartTMF from Box to Vault eTMF"
git push origin main
