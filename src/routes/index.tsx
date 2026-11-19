import { lazy, Suspense } from "react";
import { createFileRoute } from "@tanstack/react-router";

const RELOAD_KEY = "mw-world-reload";

/**
 * Load the 3D world on demand. A chunk can fail to fetch right after an update
 * (stale file version); retry once, then do a single fresh page reload.
 */
const GameExperience = lazy(async () => {
  try {
    const mod = await import("@/components/game/GameExperience");
    sessionStorage.removeItem(RELOAD_KEY);
    return mod;
  } catch (first) {
    await new Promise((r) => setTimeout(r, 600));
    try {
      return await import("@/components/game/GameExperience");
    } catch {
      // reload at most once every 15 s so a stale version can never loop
      const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
      if (Date.now() - last > 15000) {
        sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
        window.location.reload();
        return new Promise<never>(() => {});
      }
      throw first;
    }
  }
});

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Mayur's Wonderworld — An Explorable 3D Miniature Universe by Mayur Shetty" },
      {
        name: "description",
        content:
          "Walk through a living miniature adventure universe to discover Mayur Shetty's journey — Full Stack Developer | Agentic AI | Generative AI.",
      },
      { property: "og:title", content: "Mayur's Wonderworld — An Explorable 3D Miniature Universe" },
      {
        property: "og:description",
        content: "An adorable miniature diorama world where every road leads to a chapter of Mayur Shetty's professional journey.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <Suspense fallback={<div className="bg-sky-gradient fixed inset-0" />}>
      <GameExperience />
    </Suspense>
  );
}
