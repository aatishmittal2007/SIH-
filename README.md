# TRACE-X: AI-Powered Criminal Network & Investigation Intelligence System

TRACE-X is an evidence-backed investigator decision-support platform designed to correlate entities, evidence, and events across multiple criminal investigation cases.

---

## Executive Summary & Problem Statement

Modern criminal investigations generate vast amounts of unstructured evidence—CDR logs, chat transcripts, financial statements, and surveillance reports—spread across isolated cases. Law enforcement agencies face significant challenges in discovering cross-case entity links, identifying hidden network bridges, and resolving conflicting evidence manually.

**TRACE-X** solves this by providing a unified, multi-modal intelligence platform that ingests unstructured evidence, extracts entities and temporal events via NLP/NER, maintains strict evidence-to-entity provenance, builds a dual-layer graph in Neo4j, detects contradictions and anomalies, and offers explainable hypothesis paths for investigators.

---

## Core Capabilities (1-14)

1. **Evidence Ingestion**: Supports multi-format evidence ingestion (text, documents, metadata) linked to cases with full audit trails.
2. **NLP & Named Entity Recognition (NER)**: Automatically extracts entities (Person, Org, Phone, Email, Username, IP, Location, Device, Account) with offset-level confidence scores.
3. **Deterministic Entity Resolution**: Candidate matching based on normalized identifiers, exact phone/email hashes, fuzzy string similarity, and reviewer approval workflows.
4. **Strict Provenance Model**: Every entity, relationship, and claim preserves `evidenceId`, `sourceId`, extraction confidence, character offsets, and creation timestamps.
5. **Relationship Graph (Neo4j)**: Evidence-backed graph mapping entity associations without unverified or speculative connections.
6. **Cross-Case Correlation**: Multi-signal scoring engine detecting shared identifiers, co-occurrences, and cross-case entity overlaps.
7. **Temporal Intelligence**: Chronological event timelines with multi-filter temporal mapping, overlap discovery, and sequence analysis.
8. **Network Analysis**: Centrality metrics (Degree, Betweenness, Closeness, Eigenvector), bridge node detection, and community clustering.
9. **Anomaly Detection**: Flags unexpected behavioral bursts, unusual communication spikes, and outlier transactions.
10. **Contradiction Detection**: Identifies conflicting claims across multiple evidence sources (e.g., alibi/location discrepancies).
11. **Explainable Intelligence**: Decomposes AI intelligence findings into transparent sub-signal weights and evidence chains.
12. **Investigation Path Finding**: Multi-depth graph traversal discovering shortest paths and bridge entities between targets.
13. **Investigator Alerts**: Signal-driven alert notifications (contradictions, anomalies, high-confidence entity matches).
14. **Structured Reports**: Deterministic investigation report generation with export capabilities and full audit tracking.

---

## Architecture & Technology Stack

```
                               ┌─────────────────────────┐
                               │ Investigator / Analyst  │
                               └────────────┬────────────┘
                                            │
                                            ▼
                               ┌─────────────────────────┐
                               │  React + TS Frontend    │
                               │  (Vite + Tailwind CSS)  │
                               └────────────┬────────────┘
                                            │ REST API (Rate Limited)
                                            ▼
                               ┌─────────────────────────┐
                               │  Node.js Express API    │
                               │   (TypeScript Backend)  │
                               └──────┬──────┬──────┬────┘
                                      │      │      │
                        ┌─────────────┘      │      └─────────────┐
                        ▼                    ▼                    ▼
               ┌────────────────┐   ┌────────────────┐   ┌────────────────┐
               │   PostgreSQL   │   │ Neo4j Graph DB │   │ Python FastAPI │
               │ Structured Data│   │ Relationships  │   │  AI Service    │
               └────────────────┘   └────────────────┘   └────────────────┘
```

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, Lucide Icons
- **Backend**: Node.js, Express, TypeScript, Prisma ORM, Express Rate Limit, JWT Auth
- **Primary Database (PostgreSQL)**: Stores cases, users, evidence documents, entities, entity matches, events, contradictions, alerts, reports, and audit logs.
- **Graph Database (Neo4j)**: Stores entity nodes and evidence-backed relationships (`USES`, `ASSOCIATED_WITH`, `WORKS_WITH`, `LOCATED_AT`, `INVOLVES`, `HAS_EVENT`, `MENTIONS`) with provenance properties.
- **AI Service**: Python, FastAPI, SpaCy / Transformer NER models, Scikit-Learn signal models.

---

## Data Flow & Provenance Model

```
Raw Evidence Document / Log
       │
       ▼
[ NLP / NER Extraction ] ──► Stores EntityMentions & Character Offsets
       │
       ▼
[ Entity Resolution ]   ──► Generates EntityMatch Candidates (Pending/Approved)
       │
       ▼
[ Graph Builder ]       ──► Syncs Trusted Nodes & Edges to Neo4j with Provenance
       │
       ▼
[ Correlation Engine ]  ──► Calculates Multi-Signal Confidence Scores
       │
       ▼
[ Path & Intelligence ] ──► Delivers Investigator Dashboard, Alerts, & Reports
```

Every claim, node, or edge in TRACE-X retains explicit provenance metadata:
- `sourceId` / `evidenceId`
- `confidence` (0.00 – 1.00)
- `extractedAt` / `createdAt`
- Exact character start/end offsets in raw evidence

---

## Security, RBAC & Intelligence Safety

### Role-Based Access Control (RBAC)
- **ADMIN**: Full system administration, user management, and system-wide audit log access.
- **INVESTIGATOR**: Access restricted strictly to assigned cases and associated evidence/entities.
- **ANALYST**: Read-only intelligence exploration for authorized cases.

### Intelligence Safety & Neutrality
- **No Guilt Claims**: TRACE-X does NOT claim connection equals guilt, anomaly equals criminality, or centrality equals a mastermind.
- **Human-in-the-Loop**: All automated entity matches remain `PENDING` until explicit analyst confirmation.
- **Neutral Terminology**: Findings present probabilistic scores, uncertainty markers, and evidence citations.

---

## Setup & Demonstration Guide

### Prerequisites
- Node.js (v18+)
- Python (v3.10+)
- Docker & Docker Compose

### 1. Start Database Containers (PostgreSQL & Neo4j)
```bash
docker-compose up -d
```

### 2. Configure Environment & Database Seed
```bash
cd backend
npm install
npx prisma db push
npm run db:seed
```

### 3. Start Backend API Server
```bash
cd backend
npm run dev
# Server running at http://localhost:5000
```

### 4. Start AI Service (Optional / Integrated)
```bash
cd ai-service
pip install -r requirements.txt
python main.py
# AI Service running at http://localhost:8000
```

### 5. Start Frontend UI
```bash
cd frontend
npm install
npm run dev
# Frontend running at http://localhost:3000
```

---

## Test & Validation Suite

To run all backend regression and integration tests across all 20 implementation phases:

```bash
cd backend
npm test
```

To run TypeScript type checks:
```bash
cd backend && npx tsc --noEmit
cd ../frontend && npm run build
```

---

## Synthetic Data & Demo Disclaimer

*This project was developed for the Smart India Hackathon (SIH) prototype demonstration. All person names, phone numbers, email addresses, organizations, and case narratives used in seed datasets are entirely synthetic and generated for testing and validation purposes.*

