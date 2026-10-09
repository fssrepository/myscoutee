# MyScoutee ⚡

MyScoutee is an AI-assisted Angular application for group-based Dating, Work
and Community experiences. Mutual priorities support meeting people; the
current development also covers work campaigns, company team building, local
services, community cases and decisions.

The MSC-115 through MSC-119 development is consolidated on **master**.
It includes domain-specific ratings, document attachments, contextual EN/HU
guides and API/MCP permission controls. The Java client and MCP development
version is **1.6.0**; full execution QA for these extensions is pending.

### Source snapshot — 7 October 2026

| Scope | Physical source lines |
|---|---:|
| Angular `src/app` (`.ts`, `.html`, `.scss`, including tests) | 363,570 |
| Backend profile Java sources | 157,658 |
| Administrator affinity-graph JavaScript | 4,876 |
| Core total | **526,104** |

Counted from tracked files in frontend `e7e800bb3` and backend `3a743d6d0`;
includes blank lines and comments, excludes generated bundles, dependencies,
manuals and 69,872 lines of frontend seed JSON. The backend and graph are included
only in the core total, not in the Angular figure.

---

## 🌐 Live Demo

👉 [UI Prototype](https://fssrepository.github.io/myscoutee/)

The committed GitHub Pages bundle is **1.3.3**, rebuilt for MSC-121 with the
MSC-120 frontend-local timing and landing-page corrections. Its exact build
identity is recorded in `docs/app-version.json`. The hosted site changes only
after this bundle is published through the existing GitHub Pages workflow.

> **Demo images:** The GitHub Pages prototype uses placeholders from
> [Lorem Picsum](https://picsum.photos/) and [Random User](https://randomuser.me/documentation).
> Local and server demos use generated WebP images served from MinIO.

---

## 📥 Downloads

### Installer

The **1.3.0 installer release** contains the Debian installer, client tools,
container references, checksums and release metadata:
[download v1.3.0](https://github.com/fssrepository/myscoutee/releases/tag/v1.3.0).
Application updates **1.3.1–1.3.3** do not imply a newer full installer; consult
the [versioned release notes](https://github.com/fssrepository/myscoutee-backend/tree/master/guides/releases)
for their installation scope.

### Official manuals

| Manual | Document version | Applies to | Download |
|---|---:|---:|---|
| Operations Manual | 1.0.0 | MyScoutee 1.0.0 | [PDF](https://raw.githubusercontent.com/fssrepository/myscoutee/master/guides/manuals/MyScoutee_Operations_Manual_v1.0.0_EN.pdf) |
| Administrator Manual | 1.0.0 | MyScoutee 1.0.0 | [PDF](https://raw.githubusercontent.com/fssrepository/myscoutee/master/guides/manuals/MyScoutee_Administrator_Manual_v1.0.0_EN.pdf) |
| User Manual | 1.0.0 | MyScoutee 1.0.0 | [PDF](https://raw.githubusercontent.com/fssrepository/myscoutee/master/guides/manuals/MyScoutee_User_Manual_v1.0.0_EN.pdf) |
| Integration API Guide | 1.0.1 | 1.0.1 + MSC-119 source extensions | [PDF](https://raw.githubusercontent.com/fssrepository/myscoutee/master/guides/manuals/MyScoutee_Integration_API_Guide_v1.0.1_EN.pdf) |
| MCP User Guide | 1.0.0 | MCP / client 1.6.0 · MSC-119 | [PDF](https://raw.githubusercontent.com/fssrepository/myscoutee/master/guides/manuals/MyScoutee_MCP_User_Guide_v1.0.0_EN.pdf) |
| Microservices Guide | 0.1.0 | MSC-121 implementation preview | [PDF](https://raw.githubusercontent.com/fssrepository/myscoutee/master/guides/manuals/MyScoutee_Microservices_Guide_v0.1.0_EN.pdf) |

Document versions are independent of software versions. The MCP guide covers
MSC-119 source behavior and identifies its pending live-host QA.

### Presentations

| Presentation | Version | PDF | PowerPoint |
|---|---:|---|---|
| MyScoutee Network | 1.0.0 | [PDF](https://raw.githubusercontent.com/fssrepository/myscoutee/master/guides/pitches/MyScoutee_Network_Pitch_v1.0.0_EN.pdf) | [PPTX](https://raw.githubusercontent.com/fssrepository/myscoutee/master/guides/pitches/MyScoutee_Network_Pitch_v1.0.0_EN.pptx) |
| MyScoutee Product | 1.0.0 | [PDF](https://raw.githubusercontent.com/fssrepository/myscoutee/master/guides/pitches/MyScoutee_Product_Pitch_v1.0.0_EN.pdf) | [PPTX](https://raw.githubusercontent.com/fssrepository/myscoutee/master/guides/pitches/MyScoutee_Product_Pitch_v1.0.0_EN.pptx) |

---

## 🛠 Contributing

- Check the **Issues**  
- Submit a PR  
