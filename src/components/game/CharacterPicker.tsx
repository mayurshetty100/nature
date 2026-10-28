import { lazy, Suspense, useEffect, useRef, useState } from "react";
import {
  Bike,
  Bot,
  Car,
  Cat,
  Check,
  Dog,
  Mountain,
  Gauge,
  Flame,
  Footprints,
  Leaf,
  PawPrint,
  Rabbit,
  ScanFace,
  Snowflake,
  Sparkles,
  Wind,
  X,
  Zap,
  MoveUp,
} from "lucide-react";
import { EMOTES, HEROES, PETS, POWERS, type PetId, type PowerId } from "@/game/characters";
import { useGame } from "@/game/store";
import { VEHICLES, type VehicleId } from "@/game/vehicles";
import { cn } from "@/lib/utils";
import { WorldButton } from "./WorldButton";

const HeroPreview = lazy(() => import("./HeroPreview"));
const PetPreview = lazy(() => import("./PetPreview"));
const VehiclePreview = lazy(() => import("./VehiclePreview"));

const PET_ICON: Record<PetId, typeof Dog> = {
  byte: Bot,
  panda: Leaf,
  penguin: Snowflake,
  bunny: Rabbit,
  dragon: Flame,
  cat: Cat,
  puppy: Dog,
  fox: PawPrint,
  none: Footprints,
};
const POWER_ICON: Record<PowerId, typeof Dog> = { fly: Wind, speed: Gauge, teleport: Zap, invisible: Sparkles, leap: MoveUp };

const tile = (on: boolean) =>
  cn(
    // phones: compact tiles (icon + name) so the whole picker fits without scrolling
    "relative flex min-w-0 flex-col justify-center gap-0.5 rounded-xl border px-2 py-1.5 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-20 sm:gap-1 sm:rounded-2xl sm:px-3.5 sm:py-3 short:min-h-0 short:py-1.5",
    on
      ? "border-amber/70 bg-amber/15 shadow-glow"
      : "border-panel-border bg-secondary/40 hover:bg-secondary/70",
  );

/** 3D stage on top, name and details in their own strip underneath — text never sits on the model. */
function PreviewCard({
  stage,
  overlay,
  children,
}: {
  stage: React.ReactNode;
  overlay?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-row overflow-hidden rounded-2xl border border-panel-border bg-secondary/40 sm:flex-col">
      <div className="relative h-36 w-[44%] shrink-0 sm:h-56 sm:w-auto short:h-28">
        {stage}
        {overlay}
      </div>
      <div className="min-w-0 flex-1 space-y-1 border-l border-panel-border/70 bg-scrim/25 px-2.5 py-2 sm:border-l-0 sm:border-t sm:px-3.5 sm:py-3">
        {children}
      </div>
    </div>
  );
}

/** Character grid + live 3D preview. */
export function HeroChooser() {
  const heroId = useGame((s) => s.heroId);
  const setHero = useGame((s) => s.setHero);
  const [close, setClose] = useState(false);
  const hero = HEROES.find((h) => h.id === heroId) ?? HEROES[0];
  const PowerIcon = POWER_ICON[hero.power];
  return (
    <div className="grid gap-2.5 sm:grid-cols-[minmax(0,16rem)_1fr] sm:gap-5">
      <PreviewCard
        stage={
          <Suspense fallback={null}>
            <HeroPreview heroId={hero.id} close={close} />
          </Suspense>
        }
        overlay={
          <button
            onClick={() => setClose(!close)}
            aria-pressed={close}
            className="glass-panel absolute right-1.5 top-1.5 flex h-8 items-center gap-1 rounded-xl px-2 text-[11px] font-semibold text-cream sm:right-2.5 sm:top-2.5 sm:h-9 sm:gap-1.5 sm:px-2.5 sm:text-xs hover:bg-secondary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ScanFace className="h-4 w-4 text-amber" aria-hidden />
            {close ? "Full body" : "Close-up"}
          </button>
        }
      >
        <p className="font-heading text-base font-semibold leading-tight text-cream sm:text-lg">
          {hero.name} <span className="block text-xs font-medium text-amber sm:inline sm:text-sm">· {hero.title}</span>
        </p>
        <p className="flex items-center gap-1 text-xs font-semibold text-amber">
          <Flame className="h-3.5 w-3.5 shrink-0" aria-hidden /> Signature: {EMOTES[hero.id].name}
        </p>
        <p className="flex items-start gap-1 text-xs font-semibold text-arcane">
          <PowerIcon className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden /> {POWERS[hero.power].name}{" "}
          — {POWERS[hero.power].how}
        </p>
      </PreviewCard>
      <div className="grid content-start grid-cols-3 gap-1.5 sm:gap-2.5">
        {HEROES.map((h) => {
          const Icon = POWER_ICON[h.power];
          return (
            <button
              key={h.id}
              onClick={() => setHero(h.id)}
              aria-pressed={heroId === h.id}
              className={tile(heroId === h.id)}
            >
              <Icon className="h-4 w-4 text-arcane sm:hidden short:block" aria-hidden />
              <span className="line-clamp-2 pr-3 font-heading text-xs font-semibold leading-tight text-cream sm:pr-0 sm:text-sm">{h.name}</span>
              <span className="hidden text-[11px] leading-tight text-muted-foreground sm:block short:hidden">{h.title}</span>
              <span className="hidden items-center gap-1 text-[11px] font-semibold text-arcane sm:flex short:hidden">
                <Icon className="h-3 w-3" aria-hidden /> {POWERS[h.power].name}
              </span>
              {heroId === h.id && (
                <Check className="absolute right-1.5 top-1.5 h-3.5 w-3.5 text-amber sm:right-2.5 sm:top-2.5 sm:h-4 sm:w-4" aria-hidden />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Pet grid + live 3D preview so every companion is visible before choosing. */
export function PetChooser() {
  const petId = useGame((s) => s.petId);
  const setPet = useGame((s) => s.setPet);
  const pet = PETS.find((p) => p.id === petId) ?? PETS[0];
  return (
    <div className="grid gap-2.5 sm:grid-cols-[minmax(0,16rem)_1fr] sm:gap-5">
      <PreviewCard
        stage={
          pet.id === "none" ? (
            <div className="flex h-full items-center justify-center p-6 text-center">
              <Footprints className="h-12 w-12 text-muted-foreground" aria-hidden />
            </div>
          ) : (
            <Suspense fallback={null}>
              <PetPreview petId={pet.id} />
            </Suspense>
          )
        }
      >
        <p className="font-heading text-base font-semibold leading-tight text-cream sm:text-lg">{pet.name}</p>
        <p className="text-xs text-muted-foreground">{pet.blurb}</p>
        {pet.move && (
          <p className="flex items-center gap-1 text-xs font-semibold text-amber">
            <Flame className="h-3.5 w-3.5 shrink-0" aria-hidden /> Signature: {pet.move.name}
          </p>
        )}
        <p className="flex items-start gap-1 text-xs font-semibold text-arcane">
          <Sparkles className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />{" "}
          {pet.magic ? `Ability: ${pet.magic.name} — ${pet.magic.how}` : pet.trait}
        </p>
      </PreviewCard>
      <div className="grid content-start grid-cols-3 gap-1.5 sm:gap-2.5">
        {PETS.map((p) => {
          const Icon = PET_ICON[p.id];
          return (
            <button
              key={p.id}
              onClick={() => setPet(p.id)}
              aria-pressed={petId === p.id}
              className={tile(petId === p.id)}
            >
              <Icon className="h-4 w-4 text-arcane sm:h-5 sm:w-5" aria-hidden />
              <span className="line-clamp-2 pr-3 font-heading text-xs font-semibold leading-tight text-cream sm:pr-0 sm:text-sm">{p.name}</span>
              <span className="hidden text-[11px] leading-tight text-muted-foreground sm:block short:hidden">{p.blurb}</span>
              {petId === p.id && (
                <Check className="absolute right-1.5 top-1.5 h-3.5 w-3.5 text-amber sm:right-2.5 sm:top-2.5 sm:h-4 sm:w-4" aria-hidden />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value, Icon }: { label: string; value: number; Icon: typeof Dog }) {
  return (
    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
      <Icon className="h-3.5 w-3.5 text-arcane" aria-hidden />
      <span className="w-14">{label}</span>
      <span className="flex gap-0.5" aria-label={`${value} of 5`}>
        {Array.from({ length: 5 }, (_, i) => (
          <span
            key={i}
            className={cn("h-1.5 w-4 rounded-full", i < value ? "bg-amber" : "bg-secondary")}
          />
        ))}
      </span>
    </div>
  );
}

const VEHICLE_ICON: Record<VehicleId, typeof Dog> = {
  superbike: Bike,
  scrambler: Bike,
  supercar: Car,
  coupe: Car,
  luxury: Car,
  suv: Car,
  jeep: Car,
};

/** Vehicle grid + live 3D preview with speed / off-road / handling ratings. */
export function VehicleChooser() {
  const vehicleId = useGame((s) => s.vehicleId);
  const setVehicle = useGame((s) => s.setVehicle);
  const v = VEHICLES.find((x) => x.id === vehicleId) ?? VEHICLES[0];
  return (
    <div className="grid gap-2.5 sm:grid-cols-[minmax(0,16rem)_1fr] sm:gap-5">
      <PreviewCard
        stage={
          <Suspense fallback={null}>
            <VehiclePreview vehicleId={v.id as VehicleId} />
          </Suspense>
        }
      >
        <p className="font-heading text-base font-semibold leading-tight text-cream sm:text-lg">
          {v.name} <span className="block text-xs font-medium text-amber sm:inline sm:text-sm">· {v.type}</span>
        </p>
        <p className="line-clamp-2 text-xs text-muted-foreground sm:line-clamp-none short:hidden">{v.blurb}</p>
        {v.skin && <p className="hidden text-[11px] font-semibold text-amber sm:block short:hidden">Skin: {v.skin.name}</p>}
        <Stat label="Speed" value={v.stats.speed} Icon={Gauge} />
        <Stat label="Off-road" value={v.stats.offroad} Icon={Mountain} />
        <Stat label="Handling" value={v.stats.handling} Icon={Wind} />
      </PreviewCard>
      <div className="grid content-start grid-cols-3 gap-1.5 sm:gap-2.5">
        {VEHICLES.map((x) => {
          const Icon = VEHICLE_ICON[x.id as VehicleId];
          return (
            <button
              key={x.id}
              onClick={() => setVehicle(x.id as VehicleId)}
              aria-pressed={vehicleId === x.id}
              className={tile(vehicleId === x.id)}
            >
              <Icon className="h-4 w-4 text-arcane sm:h-5 sm:w-5" aria-hidden />
              <span className="line-clamp-2 pr-3 font-heading text-xs font-semibold leading-tight text-cream sm:pr-0 sm:text-sm">{x.name}</span>
              <span className="hidden text-[11px] leading-tight text-muted-foreground sm:block short:hidden">{x.type}</span>
              {vehicleId === x.id && (
                <Check className="absolute right-1.5 top-1.5 h-3.5 w-3.5 text-amber sm:right-2.5 sm:top-2.5 sm:h-4 sm:w-4" aria-hidden />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** In-game "change character & pet" window (opened from the menu). */
export function CharacterPicker() {
  const open = useGame((s) => s.pickerOpen);
  const setOpen = useGame((s) => s.setPickerOpen);
  const ref = useRef<HTMLButtonElement>(null);
  const [tab, setTab] = useState<"hero" | "pet" | "ride">("hero");
  useEffect(() => {
    if (open) ref.current?.focus();
  }, [open]);
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-scrim/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Change character, pet and vehicle"
    >
      <div className="reveal-shell animate-portal flex max-h-[calc(100dvh-2rem)] w-full max-w-3xl flex-col overflow-y-auto rounded-3xl p-5 sm:p-7">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div className="glass-panel flex rounded-xl p-1" role="tablist">
            {(["hero", "pet", "ride"] as const).map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={cn(
                  "rounded-lg px-4 py-1.5 font-heading text-sm font-semibold transition-colors",
                  tab === t
                    ? "bg-amber-gradient text-primary-foreground"
                    : "text-cream hover:bg-secondary/70",
                )}
              >
                {t === "hero" ? "Character" : t === "pet" ? "Pet" : "Vehicle"}
              </button>
            ))}
          </div>
          <WorldButton
            ref={ref}
            variant="icon"
            size="icon"
            onClick={() => setOpen(false)}
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </WorldButton>
        </div>
        {tab === "hero" ? <HeroChooser /> : tab === "pet" ? <PetChooser /> : <VehicleChooser />}
        <div className="mt-6 flex justify-end">
          <WorldButton variant="hero" onClick={() => setOpen(false)}>
            Done
          </WorldButton>
        </div>
      </div>
    </div>
  );
}
