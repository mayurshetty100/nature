/**
 * Portfolio content — sourced ONLY from Mayur Shetty's resume.
 * Do not add projects, metrics, or links that are not on the resume or supplied by Mayur himself.
 * Phone number is intentionally omitted.
 */
import resumeAsset from "@/assets/resume.pdf.asset.json";

export const profile = {
  name: "Mayur Shetty",
  headline: "Full Stack Developer | Agentic AI | Generative AI",
  location: "Bangalore, India",
  tagline: "Every great adventure begins with a single step. Ready to explore my world?",
  intro:
    "I build AI agents that work with me, darling — never for me. I blend restless curiosity with a little creative chaos, then turn it into tech you can't stop thinking about. Fair warning: my code flirts back.",
  links: {
    email: "mayurshetty9743@gmail.com",
    github: "https://github.com/mayurshetty100",
    linkedin: "https://www.linkedin.com/in/mayur-shetty-4bab0932a",
  },
  /** "Email" opens a Gmail compose window addressed to Mayur */
  emailUrl: "https://mail.google.com/mail/?view=cm&fs=1&to=mayurshetty9743%40gmail.com",
  resumeUrl: resumeAsset.url,
};

export const education = {
  institution: "M S Ramaiah Institute of Technology, Bangalore",
  degree: "B.E. Computer Science and Engineering",
  period: "2023 – 2027",
  cgpa: "9.60 / 10",
};

export type Experience = {
  company: string;
  role: string;
  period: string;
  focus: string;
  points: string[];
  tech: string[];
};

export const experience: Experience[] = [
  {
    company: "Aptos India Pvt. Ltd.",
    role: "QA Automation Intern (QEAI)",
    period: "Jul 2026 – Sep 2026",
    focus: "Enterprise Retail · Test Automation · QA Agents",
    points: [
      "Designed and maintained automation scripts for enterprise retail mobile applications, running regression suites across Android and iOS in single-device, feature-parallel and device-parallel configurations.",
      "Built an AI-powered Failure Analyzer Agent that parses post-execution logs, diagnoses feature-file failures and injects root-cause inferences directly into Allure reports for instant fix guidance.",
      "Extended it with Healenium, a self-healing locator sub-agent, and a LangDock-based agent for automation failure analysis.",
    ],
    tech: ["TypeScript", "Appium", "Cucumber (BDD)", "Gherkin", "Allure", "Healenium", "LangDock", "Jira", "Bitbucket", "Confluence"],
  },
  {
    company: "Hewlett Packard Enterprise (HPE)",
    role: "Research Intern",
    period: "Jan 2026 – Jun 2026",
    focus: "PUMA-Boot — PUF-Anchored Mutual Attestation · HPC Secure Boot",
    points: [
      "Architected PUMA-Boot, a hardware-rooted secure boot framework for HPC clusters that eliminates Trust-On-First-Use vulnerabilities by anchoring node identity in PUF-derived keys.",
      "Enforced TPM-based integrity measurement and bidirectional node-server attestation via PUF challenge-response protocols.",
      "Designed an encrypted boot-artifact delivery pipeline spanning server attestation, node attestation and OS provisioning, with post-quantum primitives (ML-DSA, ML-KEM, SHA-3).",
    ],
    tech: ["PUF", "TPM", "ML-DSA", "ML-KEM", "SHA-3", "HPC", "Secure Boot"],
  },
  {
    company: "Samsung Research India Bangalore (SRIB)",
    role: "Project Intern",
    period: "May 2025 – Nov 2025",
    focus: "On-Device Vector Search · Android AI/ML Inference",
    points: [
      "Designed and shipped a production-grade on-device Android vector similarity search library implementing HNSW, IVFPQ, LSH, Flat and Hybrid IVF+HNSW indexing.",
      "Achieved a 33× query speedup (3.11 ms vs 105 ms) and 126× compression via Product Quantization.",
      "Engineered loop-unrolled distance kernels, max-heap top-k retrieval and K-means++ initialisation; benchmarked on Fashion-MNIST (784-dim, 60K vectors) across recall@10, latency and throughput.",
    ],
    tech: ["Kotlin", "Android", "HNSW", "IVFPQ", "LSH", "Product Quantization"],
  },
];

export type Project = {
  name: string;
  tags: string;
  summary: string;
  tech: string[];
  note?: string;
};

export const projects: Project[] = [
  {
    name: "HealSync",
    tags: "Healthcare Interoperability · Tokenised Record Sharing · Agentic AI",
    summary:
      "A patient-owned digital health wallet for secure, tokenised, time-bound health-record sharing across hospitals, doctors and pharmacies, with an agentic AI pipeline for OCR-to-JSON prescription parsing, clinical summarisation, health-trend analysis and smart reminders.",
    tech: ["Agentic AI", "LangChain", "OCR", "AES-256", "OAuth 2.0", "OTP"],
    note: "Named inventor on a patent for HealSync.",
  },
  {
    name: "BRO",
    tags: "Voice Interface · Local AI Agent · Task Orchestration",
    summary:
      "A voice-controlled local AI agent that interprets natural-language commands and autonomously executes desktop tasks such as launching applications and opening files or project folders, with parallel task delegation so agents keep working in the background.",
    tech: ["Voice Interface", "Local AI Agent", "Parallel Task Delegation"],
  },
  {
    name: "Homely",
    tags: "Multimodal AI · Voice & Image Analysis · Multilingual",
    summary:
      "A multimodal AI health assistant that processes symptoms, voice input and images through LLM pipelines to generate personalised remedy recommendations, in English, Hindi and Kannada.",
    tech: ["LangChain", "LLMs", "JWT", "OAuth", "OTP", "Cloud Deployment"],
  },
  {
    name: "AI Secure Code Guardian",
    tags: "AI Code Security · Multi-Agent Analysis · RAG",
    summary:
      "A VS Code security extension for real-time vulnerability detection in AI-generated code, backed by a multi-agent backend combining LSTM, 1D-CNN and CodeBERT classifiers for OWASP/CWE detection with RAG-powered retrieval.",
    tech: ["VS Code Extension", "LangGraph", "LangChain", "CodeBERT", "LSTM", "1D-CNN", "Qdrant", "RAG"],
  },
  {
    name: "WindGuard",
    tags: "3D Digital Twin · Real-Time Telemetry · Physics Simulation",
    summary:
      "A real-time 3D wind-farm digital twin simulating turbine RPM, power output, wake effects and thermal/vibration behaviour, with live telemetry, alert feeds, inspector tooling and rolling energy/capacity analytics.",
    tech: ["3D Simulation", "Real-Time Telemetry", "Analytics"],
  },
  {
    name: "Manifest",
    tags: "Agentic AI · Opportunity Intelligence · Personalised Ranking",
    summary:
      "An Agentic AI-powered Opportunity Intelligence Platform that automates the discovery of jobs, internships, scholarships, hackathons and research opportunities across multiple sources. LLM-powered workflows, semantic search, vector retrieval and personalised ranking match opportunities against user resumes, skills and career preferences, delivering tailored recommendations and automated Telegram notifications through a modular MERN + FastAPI microservice architecture.",
    tech: ["React.js", "Node.js", "Express.js", "MongoDB", "Python", "FastAPI", "LangGraph", "LangChain", "Qdrant", "Groq API", "Docker", "GitHub Actions", "CI/CD"],
  },
  {
    name: "DarkState",
    tags: "AI-Powered Cloud Attack Path Analysis · Graph Security · AWS IAM",
    summary:
      "A graph-based cloud security analysis platform that identifies multi-step IAM privilege-escalation paths and risky cloud configurations by modelling users, roles, policies and resources as interconnected security graphs. BFS, DFS, reachability analysis and risk scoring uncover attack paths, prioritise security risks and visualise privilege relationships across simulated AWS environments using LocalStack, Neo4j and Cytoscape.js.",
    tech: ["Python", "FastAPI", "React.js", "NetworkX", "Neo4j", "AWS IAM", "Boto3", "LocalStack", "Docker", "Graph Algorithms", "Cloud Security"],
  },
];

export const skills: { group: string; items: string[] }[] = [
  { group: "Languages", items: ["Java", "JavaScript", "TypeScript", "Python", "SQL", "Gherkin"] },
  {
    group: "Agentic AI & Generative AI",
    items: ["RAG Pipelines", "MCPs", "LLMs", "Agentic Guardrails", "Vector Embeddings", "Vector Databases (FAISS, Pinecone, ChromaDB)", "Prompt Engineering", "Fine-Tuning", "LangChain", "LangGraph", "FastAPI", "Multi-Agent Systems"],
  },
  {
    group: "Frontend & Backend",
    items: ["React.js", "HTML5", "CSS3", "Tailwind CSS", "Node.js", "Express.js", "RESTful APIs", "MongoDB", "MySQL", "JWT", "OAuth 2.0"],
  },
  {
    group: "DevOps & QA",
    items: ["Git", "GitHub", "GitHub Actions", "CI/CD", "Docker", "Podman", "Kubernetes", "Postman", "Vercel", "Render", "AWS", "Jira", "Bitbucket", "Appium", "WebDriverIO", "BDD Cucumber"],
  },
  {
    group: "Computer Science",
    items: ["System Design", "Data Structures & Algorithms", "Operating Systems", "Database Systems", "OOPs", "Computer Networking", "Distributed Systems", "Microservices", "Software Engineering"],
  },
  {
    group: "Soft Skills",
    items: ["Public Speaking", "Communication (English, Hindi, Kannada)", "Presentation", "Leadership"],
  },
];

export const achievements: { title: string; detail: string }[] = [
  { title: "2nd Prize — HACK-MCE", detail: "24-Hour National Hackathon; designed and shipped an AI-powered solution under competitive constraints." },
  { title: "Patent", detail: "Named inventor on a patent for HealSync, a tokenised healthcare interoperability platform." },
  { title: "State Rank 9", detail: "Karnataka 2nd PUC Examination (2023) among hundreds of thousands of candidates." },
  { title: "5★ Coder — CodeChef", detail: "Five-star rated competitive programmer on CodeChef." },
  { title: "4th Place — ACPC AlgoHour 2024", detail: "Competitive programming contest among 500+ participants." },
  { title: "SKPG Award for Academic Excellence", detail: "Conferred for three consecutive academic years." },
  { title: "4 National Merit Scholarships", detail: "Cadence, Foundation for Excellence, HDFC ECSS and Mirae Asset." },
];

export const certifications: string[] = [
  "IBM — Agentic AI",
  "Microsoft — Generative AI",
  "Google — Essentials of Prompt Engineering",
  "HP — AI in Everyday Life",
  "Anaconda — Machine Learning",
  "NPTEL (IIT Kharagpur) — Software Engineering",
  "NPTEL (IIT Kharagpur) — Cloud Computing (Elite Topper · Top 2% nationally)",
  "NPTEL (IIT Kharagpur) — MultiCore Architecture",
];
