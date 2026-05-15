function parseAdminUsers() {
  return (process.env.MCP_ADMIN_USERS || "")
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
}

function getRequestUser(req) {
  return String(req.headers["x-user-email"] || req.headers["x-vercel-proxied-for"] || "").toLowerCase();
}

async function dispatchWorkflow(workflowId, inputs = {}) {
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  const ref = process.env.GITHUB_BRANCH || "main";
  const token = process.env.GITHUB_TOKEN;

  if (!owner || !repo || !token) {
    throw new Error("Missing GitHub workflow dispatch configuration");
  }

  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflowId}/dispatches`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ref, inputs }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub dispatch failed: ${res.status} ${text}`);
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const admins = parseAdminUsers();
  const user = getRequestUser(req);

  if (admins.length && !admins.includes(user)) {
    return res.status(403).json({ error: "Admin access required" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const acknowledgement = body.acknowledgement || "";
    const reason = body.reason || "";

    if (!acknowledgement) {
      return res.status(400).json({ error: "Acknowledgement is required" });
    }

    await dispatchWorkflow("reindex.yml", {
      triggered_by: user || "unknown",
      acknowledgement,
      reason,
      datasource_documents: process.env.DATASOURCE_DOCUMENTS || "vaultetmfv2documents",
      datasource_objects: process.env.DATASOURCE_OBJECTS || "vaultetmfv2objects",
      datasource_security: process.env.DATASOURCE_SECURITY || "vaultetmfv2security",
    });

    return res.status(200).json({
      status: "accepted",
      action: "reindex",
      triggeredBy: user || "unknown",
      message: "Reindex workflow dispatched",
    });
  } catch (err) {
    return res.status(500).json({ error: String(err.message || err) });
  }
}
