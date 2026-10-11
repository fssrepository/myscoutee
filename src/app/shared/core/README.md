# Frontend core domains

The existing adapter layers are retained. Within each layer, domain folders use
the names of the canonical backend owners in `server/projects/profile/.../domain`.
For example, identity models belong to `accounts`; personal and support
conversations belong to `chat`. Microservice deployment groups such as
`identity` and `communication` are compositions of domains, not new model owners.

| Layer | Location | Responsibility |
| --- | --- | --- |
| Contracts | `contracts/<domain>/` | Existing DTOs and service contracts |
| Base | `base/services/<domain>/` | Existing route selection and orchestration |
| Base helpers | `base/{repositories,builders,mappers}/<domain>/` | Domain-owned local state, construction and conversion |
| HTTP | `http/{services,interceptors}/<domain>/` | Existing HTTP and request handling |
| Local | `local/source/{services,repositories,builders,mappers,entity,planners}/<domain>/` | Existing local adapters and persistence |
| Seed | `local/seed/{services,repositories,builders,entity}/<domain>/` | Existing domain fixtures and bootstrap steps |

Only folders needed by this application are present. The template adds its own
`showcase` domain and does not import omitted MyScoutee product domains.
Cross-domain compositions, including the existing Activities contract, use
`common` within their original layer. Shared infrastructure, configuration,
schema composition and seed data keep their existing central locations.

This organization changes file paths and imports. It does not change API routes,
JSON fields, database collections, queries, permissions, adapter selection or
lazy-loading boundaries. Existing `index.ts` entry points retain their exports
and order. Tests stay beside their owners. Source generators and external QA
imports must use the same domain paths when generating or consuming these files.
