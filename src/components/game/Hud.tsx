import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowUpDown, BedDouble, Sunrise, Armchair, Bike, BookOpen, Car, DoorOpen, Heart, Keyboard, LogOut, Ship, Smile, Map as MapIcon, Menu, Navigation, PartyPopper, Sparkles, UserRound, Volume2, VolumeX, Wind, X, Zap, Gauge, MoveUp, CupSoda, Trophy, Handshake } from "lucide-react";
import { toggleRide } from "@/game/ride";
import { doEmote, goOutside, interact } from "@/game/interact";
import { getBuilding } from "@/game/buildings";
import { RIDES } from "@/game/vehicles";
import { activatePower, heroPower } from "@/game/powers";
import { EMOTES, HEROES, PETS, POWERS, type PowerId } from "@/game/characters";
import { powerTiming } from "@/game/abilities";
import { cn } from "@/lib/utils";
import { player, useGame } from "@/game/store";
import { STOPS, STOP_BY_ID } from "@/game/stops";
import { cameraView, guide } from "@/components/world/cameraState";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { WorldButton } from "./WorldButton";

function steps(d: number) {
  return Math.max(1, Math.round(d / 0.75));
}

/** Predefined, context-aware lines for Byte the guide. */
function GuideBrain() {
  const phase = useGame((s) => s.phase);
  const target = useGame((s) => s.targetStop);
  const dist = useGame((s) => s.distToTarget);
  const arrival = useGame((s) => s.arrival);
  const isTouch = useGame((s) => s.isTouch);
  const say = useGame((s) => s.say);

  useEffect(() => {
    if (phase !== "playing") return;
    const t0 = setTimeout(
      () =>
        say(
          "welcome",
          isTouch
            ? "Yo, I'm Byte — your ridiculously handsome guide. Joystick to walk, swipe to look all around, round button to jump. Go anywhere, any order."
            : "Yo, I'm Byte — your ridiculously handsome guide. W A S D to strut, scroll or drag to look all around, Space to jump. Go anywhere, any order.",
          { once: true },
        ),
      2500,
    );
    const t1 = setTimeout(() => {
      const def = POWERS[heroPower()];
      say("power", `Psst — you've got ${def.name}: ${def.how.toLowerCase()}. ${isTouch ? "Smash the glowing button" : "Hit Q"} and show off${heroPower() === "fly" ? (isTouch ? " — tap jump to climb higher." : " — hold Space to climb, C to dive.") : "."}`, { once: true });
    }, 14000);
    const t2 = setTimeout(() => {
      const pet = PETS.find((p) => p.id === useGame.getState().petId);
      if (pet?.magic) say("pet-ability", `${pet.name} has your back — ${pet.magic.name}: ${pet.magic.how}. No button needed, it just works.`, { once: true });
    }, 30000);
    const idle = setInterval(() => {
      const now = performance.now() / 1000;
      if (player.lastMoveAt === 0 && now > 30) {
        say("idle", isTouch ? "Standing still? Bold. Push the joystick and let's make some memories — swipe to look around." : "Standing still? Bold. Press W and let's make some memories — scroll to look around.", { once: true });
      }
    }, 4000);
    return () => {
      clearTimeout(t0);
      clearTimeout(t1);
      clearTimeout(t2);
      clearInterval(idle);
    };
  }, [phase, isTouch, say]);

  useEffect(() => {
    if (phase !== "playing" || !target || target === "gate") return;
    if (dist > 0 && dist < 30) say(`near-${target}`, `Heart racing? ${STOP_BY_ID[target].name} is right around the corner.`, { once: true });
  }, [dist, target, phase, say]);

  useEffect(() => {
    if (!arrival || arrival.id === "gate") return;
    const st = useGame.getState();
    const next = st.targetStop && !st.visited.includes(st.targetStop) ? STOP_BY_ID[st.targetStop] : STOPS.find((x) => !st.visited.includes(x.id));
    const t = setTimeout(
      () =>
        say(
          `arrive-${arrival.id}`,
          next ? `Smooth. ${next.name} is calling your name — or wander off, I won't tell.` : "Every hotspot claimed. Legend status unlocked — the island is all yours.",
        ),
      9000,
    );
    return () => clearTimeout(t);
  }, [arrival, say]);

  const nearVehicle = useGame((s) => s.nearVehicle);
  useEffect(() => {
    if (nearVehicle && phase === "playing")
      say(`ride-${nearVehicle}`, nearVehicle === "yacht" ? `The yacht is giving main-character energy. ${isTouch ? "Tap Board" : "Press F"} and sail like you own the ocean.` : `Your ${RIDES[nearVehicle].name} just pulled up looking expensive. ${isTouch ? "Tap the ride button" : "Press F"} to hop on.`, { once: true });
  }, [nearVehicle, phase, isTouch, say]);

  return null;
}

function GuideBubble() {
  const hint = useGame((s) => s.hint);
  const dismiss = useGame((s) => s.dismissHint);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!hint) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => dismiss(), 9000);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [hint, dismiss]);
  if (!hint) return null;
  return (
    <div key={hint.key} className="glass-panel animate-rise pointer-events-auto flex max-w-md items-start gap-3 rounded-2xl p-3 pr-2" role="status" aria-live="polite">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cream" aria-hidden>
        <div className="flex h-5 w-7 items-center justify-center gap-1.5 rounded-full bg-scrim">
          <span className="h-2 w-1.5 rounded-full bg-leaf" />
          <span className="h-2 w-1.5 rounded-full bg-leaf" />
        </div>
      </div>
      <p className="min-w-0 flex-1 pt-1 font-heading text-sm font-medium leading-snug text-cream">{hint.text}</p>
      <button onClick={dismiss} className="-my-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-cream" aria-label="Dismiss guide message">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

/** "Next place" chip with a live compass arrow that turns with the camera. */
function NextChip() {
  const target = useGame((s) => s.targetStop);
  const dist = useGame((s) => s.distToTarget);
  const visited = useGame((s) => s.visited);
  const arrow = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    let id = 0;
    const tick = () => {
      if (arrow.current) {
        const rel = guide.yaw - cameraView.yaw;
        arrow.current.style.transform = `rotate(${(-rel * 180) / Math.PI}deg)`;
        arrow.current.style.opacity = guide.active ? "1" : "0.4";
      }
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, []);
  const next = target ? STOP_BY_ID[target] : null;
  return (
    <div className="glass-panel pointer-events-auto flex min-w-0 items-center gap-3 rounded-2xl py-2 pl-2 pr-4">
      <span className="bg-wood-plank flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-cream">
        {next ? (
          <span ref={arrow} className="flex transition-opacity">
            <Navigation className="h-5 w-5 -rotate-45 fill-current" aria-hidden />
          </span>
        ) : (
          <PartyPopper className="h-5 w-5" aria-hidden />
        )}
      </span>
      <div className="min-w-0">
        <p className="truncate font-swag text-[15px] leading-tight tracking-wide text-cream">{next ? next.name : "Island conquered"}</p>
        <p className="truncate text-xs leading-tight text-muted-foreground">
          {next ? `${steps(dist)} steps away · ${visited.length} of ${STOPS.length} claimed` : "Roam free, legend"}
        </p>
      </div>
    </div>
  );
}

/** One contextual prompt at the bottom: enter a building, board the yacht, or where you are inside. */
const ACTION_ICON = { sit: Armchair, lie: BedDouble, lift: ArrowUpDown, stand: LogOut, pet: Heart, roof: Sunrise, chill: CupSoda, trophy: Trophy, dap: Handshake } as const;

/** Sit / lie down / take the lift / pet — appears only when something is in reach. */
function NearActionButton({ variant = "hero" }: { variant?: "hero" | "ghost" }) {
  const a = useGame((s) => s.nearAction);
  const isTouch = useGame((s) => s.isTouch);
  if (!a) return null;
  const Icon = ACTION_ICON[a.kind];
  return (
    <WorldButton variant={variant} size="md" onClick={interact} className={cn("animate-rise pointer-events-auto min-w-0 max-w-full", isTouch && variant === "hero" && "h-12 px-5 text-base", variant === "ghost" && "h-9 px-3")}>
      <Icon className={cn("h-4 w-4", variant === "ghost" && "text-amber")} aria-hidden />
      {!isTouch && <kbd className="rounded-md bg-primary-foreground/15 px-1.5 text-xs">E</kbd>}
      <span className="min-w-0 truncate">{a.label}</span>
    </WorldButton>
  );
}

function ActionPrompt() {
  const nearDoor = useGame((s) => s.nearDoor);
  const nearAction = useGame((s) => s.nearAction);
  const nearVehicle = useGame((s) => s.nearVehicle);
  const inside = useGame((s) => s.inside);
  const riding = useGame((s) => s.riding);
  const isTouch = useGame((s) => s.isTouch);
  if (inside) {
    const b = getBuilding(inside);
    return (
      <div className="glass-panel animate-rise pointer-events-auto flex max-w-[calc(100vw-1.5rem)] items-center gap-2 rounded-2xl py-2 pl-4 pr-2 sm:gap-3">
        <DoorOpen className="h-4 w-4 shrink-0 text-amber" aria-hidden />
        <span className="min-w-0 truncate font-heading text-sm font-semibold text-cream">{b?.name ?? "Inside"}</span>
        {nearAction ? (
          <NearActionButton variant="ghost" />
        ) : (
          <WorldButton variant="ghost" size="md" className="h-9 shrink-0 px-3" onClick={goOutside}>
            {!isTouch && <kbd className="rounded-md bg-secondary px-1.5 text-xs text-muted-foreground">E</kbd>}
            Leave
          </WorldButton>
        )}
      </div>
    );
  }
  if (nearDoor && !riding) {
    const b = getBuilding(nearDoor);
    return (
      <WorldButton variant="hero" size="md" onClick={interact} className="animate-rise pointer-events-auto">
        <DoorOpen className="h-4 w-4" aria-hidden />
        {!isTouch && <kbd className="rounded-md bg-primary-foreground/15 px-1.5 text-xs">E</kbd>}
        Step inside {b?.name ?? ""}
      </WorldButton>
    );
  }
  if (nearVehicle === "yacht" && !riding) {
    return (
      <WorldButton variant="hero" size="md" onClick={toggleRide} className="animate-rise pointer-events-auto">
        <Ship className="h-4 w-4" aria-hidden />
        {!isTouch && <kbd className="rounded-md bg-primary-foreground/15 px-1.5 text-xs">F</kbd>}
        Board the yacht
      </WorldButton>
    );
  }
  if (nearAction && !riding) return <NearActionButton />;
  return null;
}

/** Small round action button used in the bottom-right cluster. */
function RoundAction({ label, keyHint, onPress, children, active }: { label: string; keyHint: string; onPress: () => void; children: ReactNode; active?: boolean }) {
  const isTouch = useGame((s) => s.isTouch);
  return (
    <button
      onPointerDown={(e) => {
        e.stopPropagation();
        onPress();
      }}
      aria-label={`${label}${isTouch ? "" : ` (${keyHint})`}`}
      title={`${label}${isTouch ? "" : ` (${keyHint})`}`}
      className={cn(
        "glass-panel pointer-events-auto relative flex items-center justify-center rounded-full text-cream transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        isTouch ? "h-12 w-12" : "h-11 w-11",
        active && "ring-2 ring-amber",
      )}
    >
      {children}
      {!isTouch && <kbd className="absolute -bottom-1 -right-1 rounded-md bg-secondary px-1 text-[10px] leading-4 text-muted-foreground">{keyHint}</kbd>}
    </button>
  );
}

/** The explorer's named signature move (G) — a labelled pill so it's easy to find. */
function SignatureButton() {
  const heroId = useGame((s) => s.heroId);
  const isTouch = useGame((s) => s.isTouch);
  const name = EMOTES[heroId].name;
  return (
    <button
      onPointerDown={(e) => {
        e.stopPropagation();
        doEmote();
      }}
      aria-label={`Signature move: ${name}${isTouch ? "" : " (G)"}`}
      title={`Signature move: ${name}${isTouch ? "" : " (G)"}`}
      className={cn(
        "glass-panel pointer-events-auto relative flex shrink-0 items-center justify-center gap-1.5 rounded-full text-cream transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        // phones: a round icon button so it never spills into the middle of the screen
        isTouch ? "h-12 w-12" : "h-11 pl-3 pr-3.5",
      )}
    >
      <Smile className="h-5 w-5 shrink-0 text-amber" aria-hidden />
      {!isTouch && <span className="font-swag max-w-[7.5rem] truncate text-sm leading-none">{name}</span>}
      {!isTouch && <kbd className="absolute -bottom-1 -right-1 rounded-md bg-secondary px-1 text-[10px] leading-4 text-muted-foreground">G</kbd>}
    </button>
  );
}

/** Vehicle (call / hop on / get off) and the signature emote. */
function QuickActions() {
  const riding = useGame((s) => s.riding);
  const inside = useGame((s) => s.inside);
  const vehicleId = useGame((s) => s.vehicleId);
  const def = RIDES[riding ?? vehicleId];
  const VIcon = riding === "yacht" ? Ship : def.kind === "bike" ? Bike : Car;
  const isTouch = useGame((s) => s.isTouch);
  if (inside) return null;
  return (
    <div className={cn("flex items-center", isTouch ? "flex-col gap-3" : "gap-2")}>
      {!riding && <SignatureButton />}
      <RoundAction label={riding ? "Get off" : `Ride the ${def.name}`} keyHint="F" onPress={toggleRide} active={!!riding}>
        {riding ? <LogOut className="h-5 w-5 text-amber" aria-hidden /> : <VIcon className="h-5 w-5 text-amber" aria-hidden />}
      </RoundAction>
    </div>
  );
}

const POWER_ICON: Record<PowerId, typeof Wind> = { fly: Wind, speed: Gauge, teleport: Zap, invisible: Sparkles, leap: MoveUp };

/** The explorer's super power: tap / Q to use, with a fill showing time left or recharge. */
function PowerButton() {
  // the button itself lives in its own component, so hiding it never changes the hooks a render calls
  const riding = useGame((s) => s.riding);
  const inside = useGame((s) => s.inside);
  if (riding || inside) return null;
  return <PowerButtonBody />;
}

function PowerButtonBody() {
  const heroId = useGame((s) => s.heroId);
  const isTouch = useGame((s) => s.isTouch);
  const until = useGame((s) => s.powerUntil);
  const readyAt = useGame((s) => s.powerReadyAt);
  const [now, setNow] = useState(() => performance.now());
  useEffect(() => {
    const id = setInterval(() => setNow(performance.now()), 150);
    return () => clearInterval(id);
  }, []);
  const petId = useGame((s) => s.petId);
  const kind = (HEROES.find((h) => h.id === heroId) ?? HEROES[0]).power;
  const def = { ...POWERS[kind], ...powerTiming(POWERS[kind], PETS.find((p) => p.id === petId)?.magic?.perk) };
  const Icon = POWER_ICON[kind];
  const active = now < until;
  const charging = !active && now < readyAt;
  const fill = active ? (until - now) / (def.seconds * 1000) : charging ? 1 - (readyAt - now) / (def.cooldown * 1000) : 1;
  const label = active ? (kind === "fly" ? "Land" : "End") : def.name;
  return (
    <button
      onPointerDown={(e) => {
        e.stopPropagation();
        activatePower();
      }}
      disabled={charging}
      aria-label={`${def.name} — ${def.how}${isTouch ? "" : " (Q)"}`}
      className={cn(
        "glass-panel pointer-events-auto relative flex items-center gap-2 overflow-hidden rounded-2xl font-heading text-sm font-semibold text-cream transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60",
        isTouch ? "h-16 w-16 justify-center rounded-full" : "h-12 px-4",
        active && "ring-2 ring-arcane",
      )}
    >
      <span className="absolute inset-y-0 left-0 bg-arcane/25 transition-[width] duration-150" style={{ width: `${Math.max(0, Math.min(1, fill)) * 100}%` }} aria-hidden />
      <Icon className={cn("relative text-arcane", isTouch ? "h-7 w-7" : "h-4 w-4")} aria-hidden />
      {!isTouch && (
        <>
          <span className="relative">{label}</span>
          <kbd className="relative rounded-md bg-secondary px-1.5 text-xs text-muted-foreground">Q</kbd>
        </>
      )}
    </button>
  );
}

function GameMenu() {
  const isTouch = useGame((s) => s.isTouch);
  const muted = useGame((s) => s.muted);
  const toggleMuted = useGame((s) => s.toggleMuted);
  const setPickerOpen = useGame((s) => s.setPickerOpen);
  const setControlsOpen = useGame((s) => s.setControlsOpen);
  const item = "gap-2.5 rounded-lg px-3 py-2.5 text-sm text-cream focus:bg-secondary/80 focus:text-cream";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <WorldButton variant="icon" size="icon" aria-label="Menu" title="Menu">
          <Menu className="h-5 w-5" />
        </WorldButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="glass-strong w-60 rounded-2xl border-panel-border p-1.5 text-cream">
        <DropdownMenuItem className={item} onSelect={toggleMuted}>
          {muted ? <VolumeX className="text-muted-foreground" /> : <Volume2 className="text-amber" />}
          {muted ? "Turn sound on" : "Turn sound off"}
        </DropdownMenuItem>
        <DropdownMenuItem className={item} onSelect={() => setPickerOpen(true)}>
          <UserRound className="text-amber" /> Swap your squad & ride
        </DropdownMenuItem>
        {!isTouch && (
          <DropdownMenuItem className={item} onSelect={() => setControlsOpen(true)}>
            <Keyboard className="text-amber" /> Controls
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator className="bg-panel-border" />
        <DropdownMenuItem className={item} asChild>
          <Link to="/portfolio">
            <BookOpen className="text-amber" /> Classic portfolio
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Hud() {
  const phase = useGame((s) => s.phase);
  const isTouch = useGame((s) => s.isTouch);
  const setMapOpen = useGame((s) => s.setMapOpen);
  if (phase !== "playing") return <GuideBrain />;
  return (
    <div className="pointer-events-none fixed inset-0 z-20">
      <GuideBrain />
      <div className="flex items-start justify-between gap-3 p-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:p-5">
        <NextChip />
        <div className="pointer-events-auto flex shrink-0 gap-2">
          <WorldButton variant="icon" size="icon" onClick={() => setMapOpen(true)} aria-label="World map (M)" title="World map (M)">
            <MapIcon className="h-5 w-5" />
          </WorldButton>
          <GameMenu />
        </div>
      </div>
      {/* desktop: keep clear of the action buttons on the right until the screen is wide enough */}
      {/* phones: sit above the joystick and left of the right-hand button column, so nothing overlaps */}
      {/* phones: the prompt gets its own row ABOVE the right-hand button column (portrait), or the free strip
          between the joystick and the buttons (landscape) — so pet / sit / enter is never hidden behind the power button */}
      <div
        className={cn(
          "absolute flex flex-col items-center gap-3 [&>*]:max-w-full",
          isTouch
            ? "inset-x-3 bottom-[max(20.5rem,calc(env(safe-area-inset-bottom)+19.5rem))] short:bottom-[max(1rem,env(safe-area-inset-bottom))] short:left-[11.5rem] short:right-[7.5rem]"
            : "inset-x-0 bottom-6 pl-4 pr-[25rem] 2xl:px-4",
        )}
      >
        {!isTouch && <GuideBubble />}
        <ActionPrompt />
      </div>
      {/* phones: tips float above the thumb buttons instead of covering them */}
      {isTouch && (
        <div className="pointer-events-none absolute bottom-[max(24.5rem,calc(env(safe-area-inset-bottom)+23.5rem))] left-3 right-3 flex justify-center short:bottom-auto short:left-[11.5rem] short:right-[7.5rem] short:top-20">
          <GuideBubble />
        </div>
      )}
      <div className={cn("absolute flex flex-col items-end gap-3", isTouch ? "bottom-[max(7.5rem,calc(env(safe-area-inset-bottom)+6.5rem))] right-5" : "bottom-6 right-6 flex-row items-center")}>
        <QuickActions />
        <PowerButton />
      </div>
    </div>
  );
}
