import { achievements, certifications, education, experience, profile, projects, skills } from "@/data/portfolio";
import { STOP_BY_ID, type StopId } from "./stops";

/** A chapter told as short typed lines — every word comes from the resume data. */
export type Story = {
  title: string;
  lines: string[];
  links?: { label: string; href: string; download?: boolean }[];
};

const list = (items: string[], max: number) => items.slice(0, max).join(", ") + (items.length > max ? " …" : "");

/**
 * Each hotspot tells one chapter as a little narrative — dark-romance, rizz and
 * suspense in the narrator's voice, ending on a cliffhanger that points to
 * another hotspot. Narration is mood only; every fact line comes from the resume.
 */
export function storyFor(id: StopId): Story {
  switch (id) {
    case "gate":
      return {
        title: `Every love story starts with a stranger. Hi — I'm ${profile.name}.`,
        lines: [
          "They say never trust a guy who talks to machines. Funny thing is… the machines talk back.",
          profile.intro,
          `Last seen in ${profile.location}. Never without a plan.`,
          "The rest of his secrets are scattered across this island. Dare to find them?",
        ],
      };
    case "academy":
      return {
        title: `Before the agents, there was a boy with a ${education.cgpa.split(" ")[0]}.`,
        lines: [
          "Every legend has an origin story. His began in a classroom.",
          `${education.degree} · ${education.institution} · ${education.period}`,
          `CGPA ${education.cgpa}. Yes, really.`,
          ...achievements.filter((a) => /SKPG|State Rank|Scholarship/i.test(a.title)).map((a) => `${a.title} — ${a.detail}`),
          `But grades were never his obsession. Something else was calling… follow it to ${STOP_BY_ID.forest.name}.`,
        ],
      };
    case "forest":
      return {
        title: "He doesn't just fall for ideas. He builds them.",
        lines: [
          "Some ideas you flirt with. These ones he refused to let go.",
          ...projects.map((p) => `${p.name} — ${p.tags}${p.note ? ` · ${p.note}` : ""}`),
          `Building them was the easy part. Who let him loose in the real world? ${STOP_BY_ID.city.name} holds the answer.`,
        ],
      };
    case "skills":
      return {
        title: "Every heartbreaker needs an arsenal.",
        lines: [
          "He collects skills the way others collect secrets.",
          ...skills.map((g) => `${g.group}: ${list(g.items, 6)}`),
          `Weapons mean nothing without a battlefield. The towers downtown remember how he used them.`,
        ],
      };
    case "city":
      return {
        title: "Three companies. Three intense flings. Zero regrets.",
        lines: [
          "Internships are like summer romances — short, intense, impossible to forget.",
          ...experience.map((e) => `${e.role} · ${e.company} (${e.period}) — ${e.focus}`),
          `Every fling left him sharper. The receipts are waiting on ${STOP_BY_ID.peak.name}.`,
        ],
      };
    case "peak":
      return {
        title: "Receipts, not rumours.",
        lines: [
          "Talk is cheap. Trophies aren't.",
          ...achievements.map((a) => a.title),
          `Certified: ${list(certifications, 3)}`,
          "One door on this island is still closed… the lighthouse has been waiting for you.",
        ],
      };
    case "cove":
      return {
        title: "You found me. Most people never make it this far.",
        lines: [
          "Every story needs an ending. This one needs a sequel — and you might be in it.",
          "Got an idea that needs a builder with rizz? Slide in. I'll be waiting.",
          `Email: ${profile.links.email}`,
        ],
        links: [
          { label: "Resume", href: profile.resumeUrl, download: true },
          { label: "LinkedIn", href: profile.links.linkedin },
          { label: "GitHub", href: profile.links.github },
          { label: "Email", href: profile.emailUrl },
        ],
      };
  }
}

/** Typing speed (characters per second) and how long a finished chapter stays on screen. */
export const TYPE_CPS = 55;
export function holdSeconds(story: Story) {
  const chars = story.lines.reduce((n, l) => n + l.length, story.title.length);
  return Math.min(26, 7 + chars / 45) + (story.links ? 10 : 0);
}
