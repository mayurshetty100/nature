import { createFileRoute, Link } from "@tanstack/react-router";
import { Award, BadgeCheck, Briefcase, Compass, Download, Github, GraduationCap, Lightbulb, Linkedin, Mail, Cog } from "lucide-react";
import { achievements, certifications, education, experience, profile, projects, skills } from "@/data/portfolio";
import { worldButton } from "@/components/game/WorldButton";

export const Route = createFileRoute("/portfolio")({
  head: () => ({
    meta: [
      { title: "Mayur Shetty — Classic Portfolio" },
      {
        name: "description",
        content:
          "Mayur Shetty's education, internships at Samsung Research, HPE and Aptos, projects, skills and achievements — in a simple readable page.",
      },
      { property: "og:title", content: "Mayur Shetty — Classic Portfolio" },
      { property: "og:description", content: "Full Stack Developer | Agentic AI | Generative AI. Experience, projects, skills and achievements." },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PortfolioPage,
});

function Section({ id, icon: Icon, title, children }: { id: string; icon: typeof Award; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="mb-5 flex items-center gap-3 font-heading text-2xl font-semibold text-cream">
        <span className="bg-amber-gradient flex h-10 w-10 items-center justify-center rounded-xl text-primary-foreground">
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Chips({ items }: { items: string[] }) {
  return (
    <ul className="mt-3 flex flex-wrap gap-1.5">
      {items.map((t) => (
        <li key={t} className="rounded-full bg-secondary px-2.5 py-1 text-xs text-cream/90">
          {t}
        </li>
      ))}
    </ul>
  );
}

function PortfolioPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="bg-sky-gradient relative overflow-hidden">
        <div className="scrim-bottom absolute inset-0" />
        <div className="relative mx-auto max-w-4xl px-6 pb-14 pt-10">
          <div className="flex items-center justify-end">
            <Link to="/" className={worldButton({ variant: "glass", size: "md" })}>
              <Compass className="h-4 w-4" aria-hidden /> Explore the 3D world
            </Link>
          </div>
          <h1 className="text-glow mt-12 font-heading text-5xl font-bold text-cream sm:text-6xl">{profile.name}</h1>
          <p className="text-glow mt-3 font-heading text-lg text-cream">{profile.headline}</p>
          <p className="text-glow mt-4 max-w-2xl text-cream/95">{profile.intro}</p>
          <div className="mt-7 flex flex-wrap gap-2.5">
            <a href={profile.resumeUrl} download="Mayur_Shetty_Resume.pdf" className={worldButton({ variant: "hero", size: "md" })}>
              <Download className="h-4 w-4" aria-hidden /> Download resume
            </a>
            <a href={profile.emailUrl} target="_blank" rel="noreferrer" className={worldButton({ variant: "glass", size: "md" })}>
              <Mail className="h-4 w-4" aria-hidden /> Email
            </a>
            <a href={profile.links.github} target="_blank" rel="noreferrer" className={worldButton({ variant: "glass", size: "md" })}>
              <Github className="h-4 w-4" aria-hidden /> GitHub
            </a>
            <a href={profile.links.linkedin} target="_blank" rel="noreferrer" className={worldButton({ variant: "glass", size: "md" })}>
              <Linkedin className="h-4 w-4" aria-hidden /> LinkedIn
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-4xl flex-col gap-14 px-6 py-14">
        <Section id="education" icon={GraduationCap} title="Education">
          <div className="glass-panel rounded-2xl p-5">
            <p className="font-heading text-lg font-semibold text-cream">{education.institution}</p>
            <p className="text-cream/90">{education.degree}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {education.period} · CGPA {education.cgpa}
            </p>
          </div>
        </Section>

        <Section id="experience" icon={Briefcase} title="Experience">
          <div className="flex flex-col gap-4">
            {experience.map((e) => (
              <article key={e.company} className="glass-panel rounded-2xl p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-heading text-lg font-semibold text-cream">{e.company}</h3>
                  <span className="text-sm text-amber">{e.period}</span>
                </div>
                <p className="text-cream/90">{e.role}</p>
                <p className="text-sm text-muted-foreground">{e.focus}</p>
                <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-cream/90">
                  {e.points.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
                <Chips items={e.tech} />
              </article>
            ))}
          </div>
        </Section>

        <Section id="projects" icon={Lightbulb} title="Projects">
          <div className="grid gap-4 sm:grid-cols-2">
            {projects.map((p) => (
              <article key={p.name} className="glass-panel rounded-2xl p-5">
                <h3 className="font-heading text-lg font-semibold text-cream">{p.name}</h3>
                <p className="text-xs text-amber">{p.tags}</p>
                <p className="mt-2 text-sm text-cream/90">{p.summary}</p>
                {p.note && <p className="mt-2 text-sm font-semibold text-meadow">{p.note}</p>}
                <Chips items={p.tech} />
              </article>
            ))}
          </div>
        </Section>

        <Section id="skills" icon={Cog} title="Skills">
          <div className="grid gap-4 sm:grid-cols-2">
            {skills.map((g) => (
              <div key={g.group} className="glass-panel rounded-2xl p-5">
                <h3 className="font-heading font-semibold text-cream">{g.group}</h3>
                <Chips items={g.items} />
              </div>
            ))}
          </div>
        </Section>

        <Section id="achievements" icon={Award} title="Achievements & Recognition">
          <ul className="grid gap-3 sm:grid-cols-2">
            {achievements.map((a) => (
              <li key={a.title} className="glass-panel rounded-2xl p-4">
                <p className="font-heading font-semibold text-cream">{a.title}</p>
                <p className="text-sm text-cream/85">{a.detail}</p>
              </li>
            ))}
          </ul>
        </Section>

        <Section id="certifications" icon={BadgeCheck} title="Certifications">
          <ul className="glass-panel flex flex-col gap-2 rounded-2xl p-5 text-sm text-cream/90">
            {certifications.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </Section>
      </main>
      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        {profile.name} · {profile.location} ·{" "}
        <Link to="/" className="text-amber hover:underline">
          Return to the world
        </Link>
      </footer>
    </div>
  );
}
