import { ArrowLeft, ArrowRight, BookOpen, Compass, Sparkles } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { sound } from "@/game/audio";
import { useGame, type IntroStep } from "@/game/store";
import { WorldButton } from "./WorldButton";
import { HeroChooser, PetChooser, VehicleChooser } from "./CharacterPicker";
import { TitleSign } from "./TitleSign";

function StepShell({
  step,
  title,
  children,
  onBack,
  next,
}: {
  step: number;
  title: string;
  children: React.ReactNode;
  onBack: () => void;
  next: React.ReactNode;
}) {
  return (
    <div className="pointer-events-auto fixed inset-0 z-30 flex items-center justify-center bg-scrim/55 p-2.5 backdrop-blur-sm sm:p-4">
      <div
        key={title}
        className="reveal-shell animate-portal flex max-h-[calc(100dvh-1.25rem)] w-full max-w-3xl flex-col overflow-y-auto rounded-3xl p-4 sm:max-h-[calc(100dvh-2rem)] sm:p-8 short:p-3 short:max-w-4xl shadow-clay"
      >
        <div className="flex items-center gap-2 mb-1">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-mint/40 bg-mint/20 px-3 py-0.5 font-heading text-[11px] font-semibold uppercase tracking-wider text-mint">
            <Sparkles className="h-3 w-3" aria-hidden /> Step {step} of 3
          </span>
        </div>
        <h2 className="mb-3.5 mt-0.5 font-heading text-2xl font-bold leading-tight tracking-wide text-cream sm:mb-5 sm:mt-1 sm:text-4xl short:mb-1.5 short:text-xl">
          {title}
        </h2>
        {children}
        <div className="mt-4 flex items-center justify-between gap-3 sm:mt-7 short:mt-2">
          <WorldButton variant="ghost" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" aria-hidden /> Back
          </WorldButton>
          {next}
        </div>
      </div>
    </div>
  );
}

/** Opening flow: welcome → character → pet → vehicle → the world appears → start. */
export function OpeningScreen() {
  const phase = useGame((s) => s.phase);
  const ready = useGame((s) => s.sceneReady);
  const step = useGame((s) => s.introStep);
  const setStep = useGame((s) => s.setIntroStep);
  const setPhase = useGame((s) => s.setPhase);

  if (phase !== "intro" || !ready) return null;

  const go = (s: IntroStep) => {
    sound.start();
    setStep(s);
  };

  if (step === "hero")
    return (
      <StepShell
        step={1}
        title="Pick your main character"
        onBack={() => go("welcome")}
        next={
          <WorldButton variant="hero" onClick={() => go("pet")} autoFocus>
            Now, a sidekick <ArrowRight className="h-4 w-4" aria-hidden />
          </WorldButton>
        }
      >
        <HeroChooser />
      </StepShell>
    );

  if (step === "pet")
    return (
      <StepShell
        step={2}
        title="Who's riding shotgun?"
        onBack={() => go("hero")}
        next={
          <WorldButton variant="hero" onClick={() => go("vehicle")} autoFocus>
            Next: the wheels <ArrowRight className="h-4 w-4" aria-hidden />
          </WorldButton>
        }
      >
        <PetChooser />
      </StepShell>
    );

  if (step === "vehicle")
    return (
      <StepShell
        step={3}
        title="Choose your ride (make it loud)"
        onBack={() => go("pet")}
        next={
          <WorldButton variant="hero" onClick={() => go("world")} autoFocus>
            Reveal the island <ArrowRight className="h-4 w-4" aria-hidden />
          </WorldButton>
        }
      >
        <VehicleChooser />
      </StepShell>
    );

  if (step === "world")
    return (
      <div className="pointer-events-none fixed inset-0 z-30">
        <div className="scrim-bottom absolute inset-x-0 bottom-0 h-56" />
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-4 px-6 pb-[max(2rem,env(safe-area-inset-bottom))] text-center">
          <p className="text-glow animate-rise max-w-md font-heading text-base font-medium text-cream sm:text-lg">
            Hotspots everywhere. No rules, no order — follow your heart (or the arrow).
          </p>
          <div className="pointer-events-auto animate-rise flex items-center gap-3" style={{ animationDelay: "0.15s" }}>
            <WorldButton variant="ghost" onClick={() => go("vehicle")}>
              <ArrowLeft className="h-4 w-4" aria-hidden /> Back
            </WorldButton>
            <WorldButton
              variant="hero"
              size="lg"
              autoFocus
              onClick={() => {
                sound.start();
                setPhase("entering");
              }}
            >
              <Compass className="h-5 w-5" aria-hidden /> Let's explore
            </WorldButton>
          </div>
        </div>
      </div>
    );

  return (
    <div className="pointer-events-none fixed inset-0 z-30">
      <div className="absolute inset-0 bg-scrim/40" />
      <div className="relative flex h-full flex-col items-center justify-center px-6 text-center">
        <p className="text-glow animate-rise font-heading text-lg font-semibold tracking-wide text-cream/95 sm:text-2xl short:text-base">
          Welcome to
        </p>
        <h1 className="animate-rise mt-1" style={{ animationDelay: "0.1s" }}>
          <TitleSign className="title-sway mx-auto w-[min(88vw,36rem)] sm:w-[min(70vw,42rem)] short:w-[70dvh]" />
        </h1>
        <p
          className="text-glow animate-rise mt-5 max-w-xl font-heading text-lg font-medium leading-snug tracking-wide text-cream sm:text-2xl short:mt-1 short:text-base"
          style={{ animationDelay: "0.2s" }}
        >
          I build AI agents to work <span className="text-mint font-bold">with</span> me, darling — never <em>for</em> me.
        </p>
        <p
          className="text-glow animate-rise mt-2 max-w-md text-sm text-cream/80 sm:text-base short:mt-0.5 short:text-xs"
          style={{ animationDelay: "0.28s" }}
        >
          Fair warning: this universe flirts back.
        </p>
        <WorldButton
          variant="hero"
          size="lg"
          className="pointer-events-auto animate-rise mt-9 short:mt-3 short:h-11 shadow-clay"
          style={{ animationDelay: "0.35s" }}
          onClick={() => go("hero")}
          autoFocus
        >
          Enter the Wonderworld <ArrowRight className="h-5 w-5" aria-hidden />
        </WorldButton>
        <Link
          to="/portfolio"
          className="pointer-events-auto animate-rise absolute bottom-[max(1.5rem,env(safe-area-inset-bottom))] short:bottom-[max(0.5rem,env(safe-area-inset-bottom))] short:text-xs flex items-center gap-1.5 text-sm font-heading font-medium text-cream/80 underline-offset-4 hover:text-cream hover:underline"
          style={{ animationDelay: "0.5s" }}
        >
          <BookOpen className="h-4 w-4" aria-hidden /> Not a gamer? Read the classic version
        </Link>
      </div>
    </div>
  );
}
