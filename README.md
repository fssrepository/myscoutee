# MyScoutee Frontend ⚡

MyScoutee Frontend is the AI-assisted Angular application for group-based Dating, Work
and Community experiences. Mutual priorities support meeting people; the
current development also covers work campaigns, company team building, local
services, community cases and decisions.

---

## 🌐 Live Demo

👉 [UI Prototype](https://fssrepository.github.io/myscoutee-frontend/)

The browser demo runs locally in your browser. Use an installed backend for
server accounts, provider connections and shared persistent data.

> **Demo images:** The GitHub Pages prototype uses placeholders from
> [Lorem Picsum](https://picsum.photos/) and [Random User](https://randomuser.me/documentation).
> Local and server demos use generated WebP images served from MinIO.

The automatic frontend CI build runs `npm run build:github`. Its optional manual
`deploy:github` job commits the generated `docs/` files to the permanent
`gh-pages` branch. GitHub Pages publishes that branch's `/docs` folder.
Generated files, including local font binaries from
`@fssrepository/myscoutee-components@1.5.0`, are ignored on `master`.
The site uses `/myscoutee-frontend/`, including deep-link redirects.

---

## 📥 Downloads

### Installer

The current frontend and installer release is **1.5.0**. It includes the Debian
installer, client tools, container references, checksums and signed release
metadata: [download v1.5.0](https://github.com/fssrepository/myscoutee-frontend/releases/tag/v1.5.0).
See the [installation guide](https://github.com/fssrepository/myscoutee-backend/blob/master/guides/development/reference/packaging.md)
and [1.5.0 release record](https://github.com/fssrepository/myscoutee-backend/blob/master/guides/development/releases/v1.5.0.md).

### Official manuals

| Manual | Document version | Applies to | Download |
|---|---:|---:|---|
| Operations Manual | 1.4.1 | MyScoutee 1.4.1 | [PDF](https://raw.githubusercontent.com/fssrepository/myscoutee-frontend/master/guides/manuals/MyScoutee_Operations_Manual_EN.pdf) |
| Administrator Manual | 1.4.1 | MyScoutee 1.4.1 | [PDF](https://raw.githubusercontent.com/fssrepository/myscoutee-frontend/master/guides/manuals/MyScoutee_Administrator_Manual_EN.pdf) |
| User Manual | 1.4.1 | MyScoutee 1.4.1 | [PDF](https://raw.githubusercontent.com/fssrepository/myscoutee-frontend/master/guides/manuals/MyScoutee_User_Manual_EN.pdf) |
| Integration API Guide | 1.4.1 | MyScoutee 1.4.1 / client 1.6.0 | [PDF](https://raw.githubusercontent.com/fssrepository/myscoutee-frontend/master/guides/manuals/MyScoutee_Integration_API_Guide_EN.pdf) |
| MCP User Guide | 1.4.1 | MyScoutee 1.4.1 / client 1.6.0 | [PDF](https://raw.githubusercontent.com/fssrepository/myscoutee-frontend/master/guides/manuals/MyScoutee_MCP_User_Guide_EN.pdf) |
| Microservices Guide | 1.4.1 | KVM laboratory / eight-service assemblies | [PDF](https://raw.githubusercontent.com/fssrepository/myscoutee-frontend/master/guides/manuals/MyScoutee_Microservices_Guide_EN.pdf) |

These PDFs are document version 1.4.1 and cover MyScoutee 1.4.1; they have not
been republished for the 1.5.0 installer. The API/MCP guides distinguish verified
development behavior from external-host qualification.

### Presentations

| Presentation | Version | PDF | PowerPoint |
|---|---:|---|---|
| MyScoutee Network | 1.0.0 | [PDF](https://raw.githubusercontent.com/fssrepository/myscoutee-frontend/master/guides/pitches/MyScoutee_Network_Pitch_v1.0.0_EN.pdf) | [PPTX](https://raw.githubusercontent.com/fssrepository/myscoutee-frontend/master/guides/pitches/MyScoutee_Network_Pitch_v1.0.0_EN.pptx) |
| MyScoutee Product | 1.0.0 | [PDF](https://raw.githubusercontent.com/fssrepository/myscoutee-frontend/master/guides/pitches/MyScoutee_Product_Pitch_v1.0.0_EN.pdf) | [PPTX](https://raw.githubusercontent.com/fssrepository/myscoutee-frontend/master/guides/pitches/MyScoutee_Product_Pitch_v1.0.0_EN.pptx) |

---

## 🛠 Contributing

- Check the **Issues**  
- Submit a PR  
