# PassGP — Frontend (Landing Page)

Marketing landing page for **PassGP**, an AI-powered voice oral examiner for
medical exam preparation (RACGP, ACRRM, AMC, PESCI).

Built with **React 18 + Vite**. No backend or auth here yet — this is the
public-facing landing page only. It is structured to scale into the full
application (login, dashboard, the AI examiner itself) without rework.

## Getting started

```bash
cd frontend
npm install
npm run dev      # start dev server at http://localhost:5173
npm run build    # production build into /dist
npm run preview  # preview the production build
```

## Project structure

```
frontend/
├── index.html
├── vite.config.js
├── public/
│   └── favicon.svg
└── src/
    ├── main.jsx                 # app entry
    ├── App.jsx                  # preloader + landing page
    ├── index.css                # global design system (tokens, reset, helpers)
    ├── pages/
    │   └── LandingPage/         # assembles all sections
    ├── components/
    │   ├── common/              # Button, Reveal, SectionHeading, Preloader, BackToTop
    │   ├── layout/              # Header, Footer
    │   └── sections/            # Hero, Features, Pricing, FAQ, ... (one folder each)
    ├── hooks/                   # useCountUp, useScrollPosition
    └── data/                    # content (features, faqs, pricing, ...) — edit text here
```

## Design system

All colours, gradients, typography, spacing, radii and shadows are defined as
CSS custom properties in [`src/index.css`](src/index.css). Change the brand
there and the whole site updates.

## Editing content

Section copy lives in [`src/data/`](src/data) — update those files to change
text without touching components.

## Notes

- Images are loaded from Unsplash / randomuser.me CDNs for the demo. Swap them
  for hosted assets before production.
- Sections are modular and self-contained (JSX + CSS per folder), so new
  sections or pages can be added cleanly.
