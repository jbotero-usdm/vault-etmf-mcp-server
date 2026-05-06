"""
Veeva Vault eTMF Intelligence MCP Server
Glean-hosted MCP server for TMF document classification and intelligence
"""

import os
import json
from typing import Optional, Dict, Any
import httpx
from mcp.server.fastmcp import FastMCP

# Initialize FastMCP server
mcp = FastMCP("Veeva Vault eTMF Intelligence")

# Vault configuration from environment
VAULT_DNS = os.getenv("VAULT_ETMF_DNS", "partnersi-usdm-etmf.veevavault.com")
VAULT_USERNAME = os.getenv("VAULT_ETMF_USERNAME")
VAULT_PASSWORD = os.getenv("VAULT_ETMF_PASSWORD")

# Session cache
_vault_session = None


def get_vault_session() -> str:
    """Get or create Vault session token"""
    global _vault_session
    
    if _vault_session:
        return _vault_session
    
    # Authenticate to Vault
    auth_url = f"https://{VAULT_DNS}/api/v23.3/auth"
    
    response = httpx.post(
        auth_url,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        data={
            "username": VAULT_USERNAME,
            "password": VAULT_PASSWORD
        },
        timeout=30
    )
    
    if response.status_code != 200:
        raise Exception(f"Vault authentication failed: {response.text}")
    
    auth_data = response.json()
    _vault_session = auth_data["sessionId"]
    return _vault_session


def vault_request(method: str, endpoint: str, **kwargs) -> httpx.Response:
    """Make authenticated request to Vault API"""
    session_id = get_vault_session()
    
    url = f"https://{VAULT_DNS}/api/v23.3{endpoint}"
    
    headers = kwargs.pop("headers", {})
    headers["Authorization"] = session_id
    
    response = httpx.request(
        method=method,
        url=url,
        headers=headers,
        timeout=30,
        **kwargs
    )
    
    # Handle session expiration
    if response.status_code == 401:
        global _vault_session
        _vault_session = None
        # Retry once with new session
        session_id = get_vault_session()
        headers["Authorization"] = session_id
        response = httpx.request(
            method=method,
            url=url,
            headers=headers,
            timeout=30,
            **kwargs
        )
    
    return response


# Load TMF Classifier
from etmf_classifier import TMFClassifier

# Initialize classifier at module level
_classifier = TMFClassifier('tmf_reference_model.json')


@mcp.tool()
def search_vault_documents(query: str, study_number: Optional[str] = None) -> str:
    """
    Search for documents in the Vault eTMF by title or content.
    
    Args:
        query: Search terms (document title, keywords)
        study_number: Optional study number to filter results (e.g., "APG101-301")
    
    Returns:
        JSON string with matching documents: id, title, type, study, status
    """
    # Build VQL query
    vql = f"SELECT id, name__v, type__v, study_number__v, lifecycle__v FROM documents WHERE name__v CONTAINS '{query}'"
    
    if study_number:
        vql += f" AND study_number__v = '{study_number}'"
    
    vql += " LIMIT 20"
    
    try:
        response = vault_request(
            method="POST",
            endpoint="/query",
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            data={"q": vql}
        )
        
        if response.status_code != 200:
            return json.dumps({
                "error": f"Search failed: {response.text}",
                "documents": []
            })
        
        data = response.json()
        documents = data.get("data", [])
        
        return json.dumps({
            "count": len(documents),
            "documents": [
                {
                    "id": doc.get("id"),
                    "title": doc.get("name__v"),
                    "type": doc.get("type__v"),
                    "study": doc.get("study_number__v"),
                    "status": doc.get("lifecycle__v")
                }
                for doc in documents
            ]
        }, indent=2)
        
    except Exception as e:
        return json.dumps({"error": str(e), "documents": []})


@mcp.tool()
def get_document_info(document_id: str) -> str:
    """
    Get detailed metadata for a specific Vault document.
    Use this to verify a document exists before classifying it.
    
    Args:
        document_id: The Vault document ID (e.g., "115", "704")
    
    Returns:
        JSON string with document metadata: title, type, status, study, version
    """
    try:
        response = vault_request(
            method="GET",
            endpoint=f"/objects/documents/{document_id}"
        )
        
        if response.status_code != 200:
            return json.dumps({
                "error": f"Document {document_id} not found",
                "exists": False
            })
        
        data = response.json()
        doc = data.get("data", data.get("document", data))
        
        return json.dumps({
            "exists": True,
            "document_id": document_id,
            "title": doc.get("name__v", "Unknown"),
            "type": doc.get("type__v", ""),
            "subtype": doc.get("subtype__v", ""),
            "status": doc.get("lifecycle__v", "Unknown"),
            "study": doc.get("study_number__v", ""),
            "version": doc.get("version__v", ""),
            "url": f"https://{VAULT_DNS}/ui/#doc_info/{document_id}/0/1"
        }, indent=2)
        
    except Exception as e:
        return json.dumps({"error": str(e), "exists": False})


@mcp.tool()
def classify_tmf_document(document_id: str) -> str:
    """
    Classify an eTMF document using the DIA TMF Reference Model v3.3.1.
    Returns the recommended Zone, Section, and Artifact classification with confidence score.
    
    Args:
        document_id: The Vault document ID to classify
    
    Returns:
        JSON string with classification:
        - zone: {number, name}
        - section: {number, name}
        - artifact: {number, name, core_or_recommended}
        - confidence_score: 0-100
        - routing_decision: What to do with this classification
    """
    try:
        # Get document metadata
        response = vault_request(
            method="GET",
            endpoint=f"/objects/documents/{document_id}"
        )
        
        if response.status_code != 200:
            return json.dumps({
                "error": f"Document {document_id} not found",
                "classification": None
            })
        
        data = response.json()
        doc = data.get("data", data.get("document", data))
        
        # Extract metadata
        doc_title = doc.get("name__v", "Unknown")
        doc_type = doc.get("type__v", "")
        doc_subtype = doc.get("subtype__v", "")
        
        # Only pass type if meaningful (not "Undefined")
        type_text = f"{doc_type} {doc_subtype}".strip()
        if type_text.lower() in ["undefined", "unclassified", ""]:
            type_text = None
        
        # Classify using TMF Reference Model
        result = _classifier.classify(
            document_title=doc_title,
            document_type=type_text
        )
        
        # Add document context
        result["document_id"] = document_id
        result["document_url"] = f"https://{VAULT_DNS}/ui/#doc_info/{document_id}/0/1"
        
        return json.dumps(result, indent=2)
        
    except Exception as e:
        return json.dumps({
            "error": str(e),
            "classification": None
        })


@mcp.tool()
def list_study_documents(study_number: str) -> str:
    """
    List all documents in a specific clinical study.
    
    Args:
        study_number: The study number (e.g., "APG101-301", "MRD-101-301")
    
    Returns:
        JSON string with all documents in the study
    """
    vql = f"SELECT id, name__v, type__v, lifecycle__v FROM documents WHERE study_number__v = '{study_number}'"
    
    try:
        response = vault_request(
            method="POST",
            endpoint="/query",
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            data={"q": vql}
        )
        
        if response.status_code != 200:
            return json.dumps({
                "error": f"Query failed: {response.text}",
                "documents": []
            })
        
        data = response.json()
        documents = data.get("data", [])
        
        return json.dumps({
            "study_number": study_number,
            "document_count": len(documents),
            "documents": [
                {
                    "id": doc.get("id"),
                    "title": doc.get("name__v"),
                    "type": doc.get("type__v"),
                    "status": doc.get("lifecycle__v")
                }
                for doc in documents
            ]
        }, indent=2)
        
    except Exception as e:
        return json.dumps({"error": str(e), "documents": []})


@mcp.tool()
def get_tmf_model_zones() -> str:
    """
    Get the complete DIA TMF Reference Model v3.3.1 zone structure.
    Use this to understand what zones, sections, and artifacts exist.
    
    Returns:
        JSON string with all 11 TMF zones and their artifact counts
    """
    zones = _classifier.get_zone_summary()
    
    return json.dumps({
        "model_version": _classifier.model["version"],
        "model_date": _classifier.model["date"],
        "total_zones": len(zones),
        "total_artifacts": len(_classifier.artifact_index),
        "zones": zones
    }, indent=2)

if __name__ == "__main__":
    import os
    port = int(os.getenv("PORT", 8000))
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=port)
