"""
Enhanced eTMF Document Classification using DIA TMF Reference Model v3.3.1

Uses the official 11-zone, 250-artifact TMF Reference Model for accurate classification.
"""

import json
import re
from typing import Dict, List, Tuple, Optional
from pathlib import Path


class TMFClassifier:
    """Classifies eTMF documents using DIA TMF Reference Model v3.3.1"""
    
    def __init__(self, model_path: str = "tmf_reference_model.json"):
        """Load the TMF Reference Model"""
        with open(model_path, 'r') as f:
            self.model = json.load(f)
        
        # Build search index for fast matching
        self.artifact_index = self._build_artifact_index()
        
    def _build_artifact_index(self) -> List[Dict]:
        """Build searchable index of all artifacts with keywords"""
        index = []
        
        for zone_num, zone in self.model['zones'].items():
            for section_num, section in zone['sections'].items():
                for artifact in section['artifacts']:
                    # Extract keywords from artifact name and definition
                    keywords = self._extract_keywords(
                        artifact['name'], 
                        artifact.get('definition', '')
                    )
                    
                    index.append({
                        'zone_number': zone['number'],
                        'zone_name': zone['name'],
                        'section_number': section['number'],
                        'section_name': section['name'],
                        'artifact_number': artifact['number'],
                        'artifact_name': artifact['name'],
                        'core_or_recommended': artifact.get('core_or_recommended', ''),
                        'keywords': keywords,
                        'definition': artifact.get('definition', '')
                    })
        
        return index
    
    def _extract_keywords(self, name: str, definition: str) -> List[str]:
        """Extract searchable keywords from artifact name and definition"""
        # Combine name and definition
        text = f"{name} {definition}".lower()
        
        # Remove common words
        stop_words = {'the', 'and', 'or', 'for', 'to', 'of', 'in', 'a', 'an', 'is', 'are'}
        
        # Extract words (alphanumeric sequences)
        words = re.findall(r'\b[a-z]{3,}\b', text)
        
        # Filter and deduplicate
        keywords = list(set([w for w in words if w not in stop_words]))
        
        return keywords
    
    def classify(self, document_title: str, document_type: str = None) -> Dict:
        """
        Classify a document based on its title and optional type
        
        Args:
            document_title: The document title/name
            document_type: Optional Veeva document type/subtype
            
        Returns:
            Classification result with zone, section, artifact, confidence
        """
        # Extract keywords from document title
        doc_keywords = self._extract_keywords(document_title, document_type or '')
        
        # Score each artifact
        matches = []
        for artifact in self.artifact_index:
            score = self._calculate_match_score(doc_keywords, artifact)
            if score > 0:
                matches.append({
                    'artifact': artifact,
                    'score': score
                })
        
        # Sort by score
        matches.sort(key=lambda x: x['score'], reverse=True)
        
        if not matches:
            return self._no_match_result(document_title)
        
        # Get top match
        top_match = matches[0]
        confidence = self._calculate_confidence(top_match['score'], matches)
        
        return {
            'document_title': document_title,
            'classification': {
                'zone': {
                    'number': top_match['artifact']['zone_number'],
                    'name': top_match['artifact']['zone_name']
                },
                'section': {
                    'number': top_match['artifact']['section_number'],
                    'name': top_match['artifact']['section_name']
                },
                'artifact': {
                    'number': top_match['artifact']['artifact_number'],
                    'name': top_match['artifact']['artifact_name'],
                    'core_or_recommended': top_match['artifact']['core_or_recommended']
                }
            },
            'confidence_score': confidence,
            'confidence_level': self._get_confidence_level(confidence),
            'routing_decision': self._get_routing_decision(confidence),
            'alternative_matches': [
                {
                    'zone': m['artifact']['zone_name'],
                    'section': m['artifact']['section_name'],
                    'artifact': m['artifact']['artifact_name'],
                    'confidence': self._calculate_confidence(m['score'], matches)
                }
                for m in matches[1:4]  # Top 3 alternatives
            ] if len(matches) > 1 else []
        }
    
    def _calculate_match_score(self, doc_keywords: List[str], artifact: Dict) -> float:
        """Calculate match score between document and artifact"""
        artifact_keywords = set(artifact['keywords'])
        doc_keyword_set = set(doc_keywords)
        
        if not artifact_keywords or not doc_keyword_set:
            return 0.0
        
        # Calculate overlap
        overlap = len(artifact_keywords & doc_keyword_set)
        
        # Bonus for exact phrase matches in artifact name
        artifact_name_lower = artifact['artifact_name'].lower()
        doc_title_lower = ' '.join(doc_keywords)
        
        # Check for partial name matches
        name_words = artifact_name_lower.split()
        name_match_bonus = sum(1 for word in name_words if word in doc_title_lower)
        
        # Calculate base score
        base_score = overlap * 10
        
        # Add bonuses
        score = base_score + (name_match_bonus * 15)
        
        # Exact match bonus
        if artifact_name_lower in doc_title_lower or doc_title_lower in artifact_name_lower:
            score += 50
        
        return score
    
    def _calculate_confidence(self, top_score: float, all_matches: List[Dict]) -> int:
        """Calculate confidence percentage (0-100)"""
        if not all_matches:
            return 0
        
        # Normalize to 0-100 scale
        max_score = 100  # Theoretical max
        confidence = min(100, int((top_score / max_score) * 100))
        
        # Reduce confidence if there are close competing matches
        if len(all_matches) > 1:
            second_score = all_matches[1]['score']
            if second_score > (top_score * 0.8):  # Within 20%
                confidence = int(confidence * 0.9)  # Reduce by 10%
        
        return confidence
    
    def _get_confidence_level(self, confidence: int) -> str:
        """Convert confidence score to level"""
        if confidence >= 90:
            return "HIGH"
        elif confidence >= 75:
            return "MEDIUM"
        elif confidence >= 50:
            return "LOW"
        else:
            return "VERY_LOW"
    
    def _get_routing_decision(self, confidence: int) -> str:
        """Determine routing decision based on confidence"""
        if confidence >= 90:
            return "Auto-approve - High confidence classification"
        elif confidence >= 75:
            return "Route to QC review - Medium confidence"
        elif confidence >= 50:
            return "Manual classification required - Low confidence"
        else:
            return "Manual classification required - Unable to classify with confidence"
    
    def _no_match_result(self, document_title: str) -> Dict:
        """Return result when no match found"""
        return {
            'document_title': document_title,
            'classification': None,
            'confidence_score': 0,
            'confidence_level': "NO_MATCH",
            'routing_decision': "Manual classification required - No matching artifacts found",
            'alternative_matches': []
        }
    
    def get_zone_summary(self) -> List[Dict]:
        """Get summary of all zones in the model"""
        summary = []
        for zone_num in sorted([int(k) for k in self.model['zones'].keys()]):
            zone = self.model['zones'][str(zone_num)]
            artifact_count = sum(len(s['artifacts']) for s in zone['sections'].values())
            summary.append({
                'zone_number': zone_num,
                'zone_name': zone['name'],
                'section_count': len(zone['sections']),
                'artifact_count': artifact_count
            })
        return summary
    
    def get_section_details(self, zone_number: int) -> List[Dict]:
        """Get detailed section information for a zone"""
        zone = self.model['zones'].get(str(zone_number))
        if not zone:
            return []
        
        sections = []
        for section_num in sorted(zone['sections'].keys()):
            section = zone['sections'][section_num]
            sections.append({
                'section_number': section['number'],
                'section_name': section['name'],
                'artifact_count': len(section['artifacts']),
                'artifacts': [
                    {
                        'number': a['number'],
                        'name': a['name'],
                        'core_or_recommended': a.get('core_or_recommended', '')
                    }
                    for a in section['artifacts']
                ]
            })
        return sections


# Example usage
if __name__ == "__main__":
    # Initialize classifier
    classifier = TMFClassifier('tmf_reference_model.json')
    
    # Test classifications
    test_docs = [
        "Protocol Amendment 03 APG-101-301",
        "Monitoring Visit Report Site 1001",
        "Informed Consent Form Version 2.0",
        "Investigational Product Label",
        "Statistical Analysis Plan Final",
        "IRB Approval Letter",
        "Subject Screening Log",
        "Data Management Plan v1.2"
    ]
    
    print("🔍 TMF Document Classification Test\n")
    print(f"Using DIA TMF Reference Model v{classifier.model['version']}")
    print(f"Total artifacts: {len(classifier.artifact_index)}\n")
    print("=" * 100)
    
    for doc_title in test_docs:
        result = classifier.classify(doc_title)
        print(f"\n📄 Document: {doc_title}")
        
        if result['classification']:
            cls = result['classification']
            print(f"   Zone {cls['zone']['number']}: {cls['zone']['name']}")
            print(f"   Section {cls['section']['number']}: {cls['section']['name']}")
            print(f"   Artifact: {cls['artifact']['number']} - {cls['artifact']['name']}")
            print(f"   Type: {cls['artifact']['core_or_recommended']}")
            print(f"   Confidence: {result['confidence_score']}% ({result['confidence_level']})")
            print(f"   Decision: {result['routing_decision']}")
        else:
            print(f"   ❌ No match found")
            print(f"   Decision: {result['routing_decision']}")
