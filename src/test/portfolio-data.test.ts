import { describe, expect, it } from "vitest";
import * as data from "@/data/portfolio";
import { STOPS } from "@/game/stops";

const all = JSON.stringify(data);

describe("portfolio content follows the resume", () => {
  it("never exposes the phone number", () => {
    expect(all).not.toMatch(/97434|65909/);
  });

  it("keeps the CGPA exactly as on the resume", () => {
    expect(data.education.cgpa).toBe("9.60 / 10");
  });

  it("states the SKPG award for three consecutive years, not two", () => {
    const skpg = data.achievements.find((a) => a.title.includes("SKPG"));
    expect(skpg?.detail).toContain("three consecutive");
  });

  it("does not include the unverified 'Top 1% CodeChef' claim from the reference art", () => {
    expect(all).not.toMatch(/Top 1%/i);
  });

  it("links to Mayur's real LinkedIn profile", () => {
    expect(data.profile.links.linkedin).toBe("https://www.linkedin.com/in/mayur-shetty-4bab0932a");
  });

  it("has no separate website link (the site itself is the portfolio)", () => {
    expect(Object.keys(data.profile.links)).not.toContain("portfolio");
  });
});

describe("skills Mayur added", () => {
  const group = (name: string) => data.skills.find((g) => g.group === name)?.items ?? [];
  it("lists agentic guardrails, vector embeddings and the named vector databases under Agentic AI", () => {
    const ai = group("Agentic AI & Generative AI");
    expect(ai).toContain("Agentic Guardrails");
    expect(ai).toContain("Vector Embeddings");
    expect(ai).toContain("Vector Databases (FAISS, Pinecone, ChromaDB)");
  });
  it("lists computer networking under Computer Science", () => {
    expect(group("Computer Science")).toContain("Computer Networking");
  });
});

describe("content Mayur added on 27 Oct", () => {
  it("lists the HP and Anaconda certificates right after the Google one", () => {
    const i = data.certifications.findIndex((c) => c.startsWith("Google"));
    expect(data.certifications.slice(i + 1, i + 3)).toEqual(["HP — AI in Everyday Life", "Anaconda — Machine Learning"]);
  });
  it("shows the CodeChef 5-star achievement", () => {
    expect(data.achievements.some((a) => a.title.includes("5★") && a.title.includes("CodeChef"))).toBe(true);
  });
  it("includes the Manifest and DarkState projects", () => {
    const names = data.projects.map((p) => p.name);
    expect(names).toContain("Manifest");
    expect(names).toContain("DarkState");
  });
  it("opens Gmail compose addressed to Mayur for Email", () => {
    expect(data.profile.emailUrl).toBe("https://mail.google.com/mail/?view=cm&fs=1&to=mayurshetty9743%40gmail.com");
  });
});

describe("journey", () => {
  it("has seven stops in order from the gate to the lighthouse", () => {
    expect(STOPS.map((s) => s.id)).toEqual(["gate", "academy", "forest", "skills", "city", "peak", "cove"]);
  });
});
