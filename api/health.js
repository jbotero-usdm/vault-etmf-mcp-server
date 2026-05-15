export default function handler(req, res) {
  res.status(200).json({
    status: "ok",
    app: {
      name: "ABC BioPharma Vault eTMF v2",
      mode: "in_progress",
      summary: "Core environment is active. Datasources, filing support, and dashboard views are available. Admin automation and deeper operational controls are being added in phases."
    },
    datasources: {
      documents: {
        name: "vaultetmfv2documents",
        role: "Indexed TMF document content and metadata",
        metrics: {
          indexed: 59,
          lastSync: "recent",
          syncMode: "incremental_supported"
        }
      },
      objects: {
        name: "vaultetmfv2objects",
        role: "Study, study country, and site context",
        metrics: {
          indexed: 22,
          studies: 10,
          countries: 4,
          sites: 8,
          lastSync: "recent"
        }
      },
      security: {
        name: "vaultetmfv2security",
        role: "Security snapshot and environment readiness support",
        metrics: {
          usersDiscovered: 20,
          groupsDiscovered: 45,
          membershipsMapped: 135,
          indexedAsSearchableCorpus: false,
          lastSnapshotRefresh: "recent"
        }
      }
    },
    agent: {
      name: "ABC BioPharma TMF Filer Agent",
      mode: "gather_only",
      capabilities: [
        "identify_box_file",
        "resolve_vault_classification",
        "resolve_study_country_site_ids",
        "prepare_filing_inputs"
      ],
      boundary: "Does not perform the final autonomous filing step."
    },
    trust: {
      access: "authenticated",
      permissions: "role_based",
      audit: "traceable",
      writeback: "human_acknowledgement_required",
      gxpModel: "human_governed",
      statement: "AI acts as a delegate to the user, not as an autonomous final decision-maker."
    },
    adminOps: {
      adminOnly: true,
      actions: [
        "full_crawl",
        "reindex",
        "smoke_test",
        "detailed_troubleshooting",
        "run_history_and_diagnostics"
      ],
      metrics: {
        lastFullCrawl: "available_via_admin_run_history",
        lastReindex: "available_via_admin_run_history",
        lastIncrementalSync: "available_via_admin_run_history",
        datasourceHealth: "tracked"
      }
    },
    endpoints: {
      health: "/api/health",
      fullCrawl: "/api/admin-full-crawl",
      reindex: "/api/admin-reindex"
    },
    generatedAt: new Date().toISOString()
  });
}
