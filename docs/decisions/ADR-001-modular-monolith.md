# ADR-001 — Modular Django monolith

**Context.** The TRD mentions "Node.js/Python microservices". The brief asks for a modular monolith and no unnecessary microservices. The team is small, the domain is one bounded context (parking guidance), and the rules engine, search and accounts must stay transactionally consistent.

**Decision.** One Django project with one app per domain module: accounts, cities, parking, regulations, availability, plus Part 2 shells. Each app has models, selectors, services, serializers, views and tasks. Background work uses Celery and Redis inside the same codebase.

**Consequences.** One deploy and one schema. Each module can be extracted later along its app boundary. The `/spots/nearby` TRD endpoint is kept as an adapter, not as a separate service.
