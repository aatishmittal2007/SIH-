import os
import re
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from datetime import datetime

app = FastAPI(
    title="TRACE-X AI & Analytics Service",
    description="Intelligence extraction, entity resolution, and explainable correlation engine for TRACE-X",
    version="1.0.0-phase5"
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class HealthResponse(BaseModel):
    service: str
    status: str
    timestamp: str
    version: str

class ExtractionRequest(BaseModel):
    text: str = Field(..., description="Raw text content to extract entities from")
    case_id: Optional[str] = Field(None, description="Optional associated case ID")
    evidence_id: Optional[str] = Field(None, description="Optional associated evidence ID")

class ExtractedEntity(BaseModel):
    text: str
    type: str  # PERSON, ORGANIZATION, LOCATION, CONTACT, ACCOUNT, VEHICLE, DATE_TIME, DOCUMENT, OTHER
    confidence: float
    start_offset: int
    end_offset: int
    context: str
    extraction_method: str = "NER"
    metadata: Dict[str, Any] = Field(default_factory=dict)

class DocumentSummary(BaseModel):
    word_count: int
    character_count: int
    entity_count: int

class ExtractionResponse(BaseModel):
    success: bool
    entities: List[ExtractedEntity]
    summary: DocumentSummary

# Regular expressions for deterministic entity pattern extraction
PATTERNS = {
    "CONTACT_EMAIL": (r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b', "CONTACT", 0.95),
    "CONTACT_PHONE": (r'\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b', "CONTACT", 0.90),
    "CONTACT_IP": (r'\b(?:\d{1,3}\.){3}\d{1,3}\b', "CONTACT", 0.98),
    "ACCOUNT_CRYPTO": (r'\b(?:0x[a-fA-F0-9]{40}|[13][a-km-zA-HJ-NP-Z1-9]{25,34}|bc1[qA-Za-z0-9]{38,59})\b', "ACCOUNT", 0.95),
    "ACCOUNT_CARD": (r'\b(?:\d[ -]*?){13,16}\b', "ACCOUNT", 0.85),
    "VEHICLE_PLATE": (r'\b[A-Z]{2}[-\s]?\d{2}[-\s]?[A-Z]{1,2}[-\s]?\d{4}\b', "VEHICLE", 0.92),
    "DOCUMENT_PASSPORT": (r'\b[A-Z][0-9]{7,8}\b', "DOCUMENT", 0.85),
    "DATE_TIME": (r'\b\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?)?\b', "DATE_TIME", 0.95),
}

# Heuristic patterns for Named Entity Recognition (Person, Org, Location)
NAME_PATTERN = r'\b(?:Mr\.|Mrs\.|Ms\.|Dr\.|Prof\.|Agent|Officer|Inspector|Suspect)?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})\b'
ORG_SUFFIXES = r'\b([A-Z][A-Za-z0-9&\s]+(?:Corp|Corporation|Inc|Limited|Ltd|Group|Holdings|Bank|Agency|Pvt|LLC|GmbH))\b'
LOCATION_TERMS = r'\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\s+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|City|Airport|Port|District|State|Country))\b'

def extract_context(text: str, start: int, end: int, window: int = 40) -> str:
    ctx_start = max(0, start - window)
    ctx_end = min(len(text), end + window)
    snippet = text[ctx_start:ctx_end].replace('\n', ' ')
    if ctx_start > 0:
        snippet = "..." + snippet
    if ctx_end < len(text):
        snippet = snippet + "..."
    return snippet

@app.get("/", tags=["Info"])
def read_root():
    return {
        "message": "TRACE-X AI Service Operating",
        "documentation": "/docs",
        "health": "/health"
    }

@app.get("/health", response_model=HealthResponse, tags=["Health"])
def health_check():
    return HealthResponse(
        service="TRACE-X Python FastAPI AI Service",
        status="online",
        timestamp=datetime.utcnow().isoformat() + "Z",
        version="1.0.0-phase5"
    )

@app.post("/extract-entities", response_model=ExtractionResponse, tags=["NLP"])
def extract_entities(req: ExtractionRequest):
    text = req.text
    if not text or not text.strip():
        return ExtractionResponse(
            success=True,
            entities=[],
            summary=DocumentSummary(word_count=0, character_count=0, entity_count=0)
        )

    entities: List[ExtractedEntity] = []
    seen_spans = set()

    # 1. Deterministic regex pattern extraction
    for key, (pattern, entity_type, confidence) in PATTERNS.items():
        for match in re.finditer(pattern, text):
            start, end = match.span()
            matched_str = match.group().strip()
            span_key = (start, end)

            if span_key not in seen_spans and len(matched_str) > 2:
                seen_spans.add(span_key)
                entities.append(ExtractedEntity(
                    text=matched_str,
                    type=entity_type,
                    confidence=confidence,
                    start_offset=start,
                    end_offset=end,
                    context=extract_context(text, start, end),
                    extraction_method="RULE",
                    metadata={"pattern_key": key}
                ))

    # 2. Heuristic Organization extraction
    for match in re.finditer(ORG_SUFFIXES, text):
        start, end = match.span()
        matched_str = match.group(1).strip()
        span_key = (start, end)
        if span_key not in seen_spans and len(matched_str) > 3:
            seen_spans.add(span_key)
            entities.append(ExtractedEntity(
                text=matched_str,
                type="ORGANIZATION",
                confidence=0.88,
                start_offset=start,
                end_offset=end,
                context=extract_context(text, start, end),
                extraction_method="NER",
                metadata={"sub_type": "ORGANIZATION"}
            ))

    # 3. Heuristic Location extraction
    for match in re.finditer(LOCATION_TERMS, text):
        start, end = match.span()
        matched_str = match.group(1).strip()
        span_key = (start, end)
        if span_key not in seen_spans and len(matched_str) > 3:
            seen_spans.add(span_key)
            entities.append(ExtractedEntity(
                text=matched_str,
                type="LOCATION",
                confidence=0.85,
                start_offset=start,
                end_offset=end,
                context=extract_context(text, start, end),
                extraction_method="NER",
                metadata={"sub_type": "LOCATION"}
            ))

    # 4. Heuristic Person Name extraction
    for match in re.finditer(NAME_PATTERN, text):
        start, end = match.span()
        matched_str = match.group(1).strip()
        span_key = (start, end)
        # Exclude common false positives
        if span_key not in seen_spans and len(matched_str.split()) >= 2 and matched_str not in {"Street St", "Road Rd"}:
            seen_spans.add(span_key)
            entities.append(ExtractedEntity(
                text=matched_str,
                type="PERSON",
                confidence=0.82,
                start_offset=start,
                end_offset=end,
                context=extract_context(text, start, end),
                extraction_method="NER",
                metadata={"sub_type": "PERSON"}
            ))

    # Sort entities by start_offset
    entities.sort(key=lambda e: e.start_offset)

    words = text.split()
    summary = DocumentSummary(
        word_count=len(words),
        character_count=len(text),
        entity_count=len(entities)
    )

    return ExtractionResponse(
        success=True,
        entities=entities,
        summary=summary
    )

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
