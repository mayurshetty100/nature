# Mayur's World — Phase 0: Analysis and Plan

## A. Professional identity

**Mayur Shetty** — Full-Stack Engineer | Agentic AI Systems | Generative AI.
Positioning: a CS undergraduate (MSRIT, CGPA 9.60) with three industry internships (Samsung Research, HPE, Aptos) who ships real systems across on-device AI, secure infrastructure and agentic QA tooling, plus a patented healthcare project.

## B. Resume inventory (source of truth)

**Education** — M S Ramaiah Institute of Technology, Bangalore · B.E. Computer Science and Engineering · 2023–2027 · CGPA 9.60/10.

**Experience**
- **Aptos India** · QA Automation Intern (QEAI) · Jul–Sep 2026 — TypeScript/Appium/Cucumber/Gherkin automation for retail mobile apps (Android + iOS, parallel run modes); built an AI **Failure Analyzer Agent** that writes root-cause inferences into Allure reports; extended with Healenium self-healing locators and a LangDock agent.
- **HPE** · Research Intern · Jan–Jun 2026 — Architected **PUMA-Boot**, PUF-anchored mutual-attestation secure boot for HPC clusters (removes Trust-On-First-Use, TPM integrity); encrypted boot-artifact pipeline with post-quantum crypto (ML-DSA, ML-KEM, SHA-3).
- **Samsung Research India** · Project Intern · May–Nov 2025 — On-device Android vector search library in Kotlin (HNSW, IVFPQ, LSH, Flat, Hybrid); **33x query speedup** (3.11 ms vs 105 ms), **126x compression**; benchmarked on Fashion-MNIST (784-dim, 60K vectors).

**Projects** — HealSync (patient-owned health wallet, agentic OCR + LangChain summaries, patented) · BRO (voice-controlled local desktop agent with parallel task delegation) · Homely (multimodal health assistant, English/Hindi/Kannada) · AI Secure Code Guardian (VS Code extension, multi-agent LangGraph + CodeBERT/LSTM/CNN + Qdrant RAG) · WindGuard (3D wind-farm digital twin with live telemetry).

**Skills** — Languages · CS fundamentals · Agentic & Generative AI · Frontend & Backend · DevOps & QA · Soft skills (grouped exactly as on the resume).

**Achievements** — 2nd Prize HACK-MCE 24h National Hackathon · Patent inventor (HealSync) · State Rank 9, Karnataka 2nd PUC 2023 · 4th Place ACPC AlgoHour 2024 (500+) · SKPG Award, 3 consecutive years · 4 National Merit Scholarships (Cadence, FFE, HDFC ECSS, Mirae Asset).

**Certifications** — IBM Agentic AI · Microsoft Generative AI · Google Prompt Engineering · NPTEL (IIT Kharagpur): Software Engineering, Cloud Computing (Elite Topper, Top 2%), MultiCore Architecture.

**Links** — email, github.com/mayurshetty100, linkedin.com/in/mayur-shetty, portfolio.mayurshetty.me. Phone number will NOT be shown.

**Flagged for your review**
1. Reference image says "Top 1% on CodeChef" and "SKPG – 2 years"; the resume says neither (it says 3 years, no CodeChef). I will follow the resume.
2. Aptos internship ended Sep 2026 but is written in present tense — I will use past tense.
3. No GitHub or demo links exist per project — project cards will show no links until you give them.
4. Company names appear only as text labels on neutral buildings — no logos.

## C. World map (one floating island, matching your reference)

```text
                     [6 Achievement Peak]  (trophy summit)
   [3 City of Giants]          |
        |                [4 Inventor's Forest]
[2 Academy] ---- river ---- bridges          |
        \                                 [7 Lighthouse Cove]
   [1 Forgotten Gate]   [5 Skills Grove]     (final treasure)
     (start, signposts)   (holo crystal)
```
Order of the main road: Gate -> Academy -> City -> Forest -> Skills Grove -> Achievement Peak -> Lighthouse Cove. Rivers, waterfalls off island edges, wooden bridges and clouds below, as in the reference.

## D. Visitor journey

Loading screen (painted sky + progress) -> Opening view: camera glides over the island, character + robot companion at the gate, title, tagline, two buttons -> "Begin the Adventure": camera drops behind the character, companion greets -> walk the road; each landmark shows a signboard, approach prompt ("Press E"), info panel, a "discovered" stamp and a pointer to the next stop -> Final treasure: resume download + links. "Explore the World Map" opens the map at any time with direct travel to any stop. A plain "Read as page" version is always one click away.

## E. Visual design system

- **Mood**: golden-hour storybook — warm sunset sky, soft clouds, lush greens. Natural and refreshing, not neon. Tech regions add soft cyan holograms only.
- **Palette**: meadow green, moss, warm sandstone path, terracotta roofs, river teal, sky peach-to-blue, accent amber glow; cyan only for AI/skills.
- **Lighting**: warm low sun, soft sky fill, light fog for depth, gentle bloom on lanterns.
- **Materials**: flat-shaded low-poly with soft color variation (toon-friendly), hand-painted feel textures on path and rock.
- **Character**: chibi explorer with backpack (CC0 rigged model with idle/walk/run) plus a small white-and-blue robot cat companion built for this project.
- **Typography**: a hand-lettered display font for the title ("Mayur's World") and a clean rounded sans for UI.
- **UI**: dark-glass navy cards with warm amber accents and icon chips, as in the reference; wooden signposts in-world.

## F. Technical architecture

- React Three Fiber + drei on the existing TanStack Start app, game route rendered client-only.
- `portfolio data` file holding all resume content (separate from game state).
- Small game-state store: current phase (intro/playing), discovered stops, nearest interaction, open panel.
- Scene parts: Environment (island, terrain, water, clouds, trees), Landmarks, Player + Controller, Follow camera, Companion, Interaction zones, Collision (simple circles/boxes + island boundary — no heavy physics).
- UI layer: Opening screen, Loading screen, HUD, World map, Info panel, Control guide, Mobile joystick, Plain-text fallback page.
- Performance: instanced trees/rocks, capped pixel ratio, one shadow light, lower quality preset on phones.

## G. Living world and guidance (your latest notes)

- **Live nature**: flocks of birds circling the island, butterflies near flowers, trees and grass swaying in wind, flowing river and waterfalls, drifting clouds, fireflies at lanterns. Kept subtle so it feels refreshing, not busy.
- **Move in every direction**: WASD/arrows on laptops, a joystick on phones and tablets, smooth acceleration and turning, walk/run animation.
- **Scroll to walk**: scrolling (mouse wheel or swiping up on phones) walks the character forward along the road; scrolling back walks back. Free movement and scroll-walking work together.
- **Direction guidance**: a glowing trail on the road, a floating arrow pointing to the next stop, signposts, and short companion hints like "The Academy is just ahead — keep walking!".

## H. Phased plan (approval after each)

- **Phase 1 — Opening + living first area (next step)**: design system, loading screen, the full island (water, clouds, river, road, waterfalls), detailed Forgotten Gate area, distant silhouettes of later stops, character + robot cat companion, live nature (birds, butterflies, swaying trees, flowing water), title screen with both buttons, **basic walking in all directions + scroll-to-walk + direction arrow/trail**, world-map overlay, control guide, plain-text fallback page.
- **Phase 2 — Movement polish**: mouse/drag camera, collisions with buildings and island edges, mobile joystick tuning, run animation, camera reveals.
- **Phase 3 — First milestone + interaction system**: Academy Kingdom with approach prompt, info panel, discovery stamp, guide dialogue.
- **Phase 4 — City of Giants + Skills Grove**.
- **Phase 5 — Inventor's Forest project labs + detail views**.
- **Phase 6 — Achievement Peak, optional discoveries, progress tracker**.
- **Phase 7 — Lighthouse Cove final treasure + contact**.
- **Phase 8 — Mobile polish, performance, accessibility, reduced motion, QA**.

## H. Risks and mitigations

- **Black or slow 3D on weak devices** -> loading screen, quality presets, WebGL check with automatic fallback page.
- **Character model availability** -> source a free CC0 animated model; if one cannot be fetched, a clearly labelled placeholder is used and noted.
- **Looking like "boxes"** -> low-poly but crafted shapes, color variation, fog, lighting and textures; models from free CC0 packs for trees/rocks where possible.
- **Controls feeling broken** -> delta-time movement, input reset on window blur, browser-based testing each phase.
- **Content drift from resume** -> all text comes from one data file built only from the resume.

## Technical details

Packages: three, @react-three/fiber 9, @react-three/drei 10 (React 19 already present). Optional later: @react-three/postprocessing for subtle bloom. No backend needed. Resume PDF hosted as a project asset for the final download.
