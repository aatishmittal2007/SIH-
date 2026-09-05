# TRACE-X Documentation & Architecture Overview

This directory contains system architecture documentation, data dictionary specifications, and SIH presentation materials for TRACE-X.

---

## Key Modules & Specifications

1. **[System Architecture](../README.md#architecture--technology-stack)**: Monorepo layout, PostgreSQL + Neo4j dual persistence, and FastAPI AI service integration.
2. **[Capabilities Guide](../README.md#core-capabilities-1-14)**: Detailed breakdown of all 14 core investigative capabilities (Evidence Ingestion, NLP, Resolution, Provenance, Graph, Temporal, Anomalies, Contradictions, Path Finding, Alerts, Reports).
3. **[Security & RBAC Model](../README.md#security-rbac--intelligence-safety)**: Role definitions, case-level access isolation, and non-accusatory intelligence guardrails.
4. **[Synthetic Dataset Reference](../data/synthetic/README.md)**: Specifications for the SIH multi-case synthetic demonstration dataset.

---

## Database Schemas

- **PostgreSQL Schema**: Defined in `backend/prisma/schema.prisma`.
- **Neo4j Graph Model**: Node Labels (`Person`, `Organization`, `Phone`, `Email`, `Username`, `IP`, `Domain`, `URL`, `Device`, `Location`, `Account`, `Transaction`, `Event`, `Evidence`, `Case`) and Relationships with explicit provenance properties (`evidenceId`, `sourceId`, `confidence`, `createdAt`).
