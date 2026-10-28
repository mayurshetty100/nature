<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- The 3D world lives in `src/components/world/` (R3F scene parts) and `src/components/game/` (DOM overlays); pure world math/state lives in `src/game/` — keeps rendering, UI and game logic separable.
- Portfolio text comes only from `src/data/portfolio.ts` (resume-sourced) — single source of truth so content never drifts or gets invented.
- Per-frame state (player position, input) is mutable module objects (`src/game/store.ts` `player`, `src/game/input.ts`); zustand holds only low-frequency UI state — avoids React re-renders every frame.
- The game route `/` is `ssr: false` and lazy-loads `GameExperience`; `/portfolio` is the SSR-friendly fallback — WebGL never runs on the server and visitors without 3D still get all content.
- World geometry (height field, road, river) is built lazily via `getWorld()`; never compute at module scope (Workers forbid heavy global-scope work).
- 3D models are CC0 (Kenney) GLBs in `public/models/`; signage font is a local TTF in `public/fonts/` — no runtime CDN fetches for 3D assets.
- tsconfig keeps `strict` but disables `noUncheckedIndexedAccess`, `noPropertyAccessFromIndexSignature` and `exactOptionalPropertyTypes` — typed-array-heavy 3D math made them pure noise.
- `.tsx` component files export only components; shared constants/helpers live in `.ts` files (e.g. `components/world/constants.ts`, `game/math.ts`) — mixed exports break live updates.
- Chapter text shown in the world is built in `src/game/story.ts` from `src/data/portfolio.ts` and shown by a non-blocking `StoryCard`; hotspot rules live in `src/game/stops.ts` (`nextStop` suggests the nearest unvisited, `isUnlocked` is always open, `allVisited`) — story must never pause play, and free-roam logic stays testable.
- Every library imported only by lazily loaded game code is listed in `vite.config.ts` `optimizeDeps.include` — otherwise the dev optimizer re-bundles React mid-session and the open preview crashes with a duplicate-React hooks error.
- Super powers live in `src/game/powers.ts` (activation + cooldown timing in the zustand store, flight/blink motion in `PlayerController`); movement multipliers from the running power and the pet's ability (`magic.perk`) come from the pure `footBoost`/`powerTiming` in `src/game/abilities.ts`; explorer/pet definitions live in `src/game/characters.ts` — one data table drives picker, previews and world, and every hero/pet ability stays testable.
- The world is one long road through ordered regions (`src/game/regions.ts`, anchored on the road; `getWorld().regionAt` / `roadRegion`); scenery density, ground colour and road surface are chosen per region — so the journey stays organised as the map grows.
- Built-up placements (farm plots, pasture, village houses, city blocks, palms) are pure data in `src/game/layout.ts`; `scatter.ts` turns them into instanced models + colliders and `City.tsx`/`Farm.tsx`/`Coast.tsx` render the procedural parts — layout stays testable and renderers never invent positions.
- Static scenery renders as chunked instanced meshes (`InstancedGLB`, distance-culled per chunk) or merged vertex-coloured geometry (city blocks, palms, cars) — keeps draw calls low on a world this size.
- Model geometry is dequantized to floats before transforms are baked in — some GLBs store compressed vertices and baking in place shreds them.
- Rides (picker vehicles + yacht: handling, terrain ability, engine voice) are one table in `src/game/vehicles.ts`; the audio engine and `PlayerController` read it — so picker stats, physics and sound never disagree.
- Enterable buildings are indexed in `src/game/buildings.ts` (doors) and generated as rooms in `src/game/interiors.ts`, rendered far away at `INTERIOR_ORIGIN` while the island is hidden — interiors get their own floor/stair physics without colliding with the outdoor world.
- City traffic follows the closed ring road from `getCityLoop`/`loopPose` in `src/game/layout.ts`; never a back-and-forth path — keeps traffic believable and testable.
- Moving solids (villagers, animals, traffic, tractors) register with `addDynamicBody` in `src/game/scatter.ts`; `collidersNear` appends them — so walking/driving can't pass through anything that moves, without rebuilding the static hash.
- Pettable animals and your own pet register in `src/game/creatures.ts`; `interact()` (E / the one prompt button) resolves door → seat/bed/lift → pet, and the HUD shows `nearAction` — one context button instead of many.
- Interior furniture uses rot = 0 ⇒ model front faces the door (+z); seats/beds become `Spot`s automatically from the `SEATS` table and lifts via `Room.lift` — so layouts stay data and rest/lift prompts never drift from the furniture.
- Roadside posts come from `getLamps()` in `src/game/layout.ts`, filtered with `clearOfRoads`; anything placed beside a road must pass that check — nothing may stand on the main road or the ring road.
- Explorer looks (coat/hoodie style, radium trim, jeans, build, gear — never stick weapons) are data on `HeroLook`, built onto bones in `src/game/heroOutfit.ts` (hair/face in `heroModel.ts`, shared helpers in `heroRig.ts`); pet outfits/magic are data on `Pet`; ride paint/glow is `skin` on `VehicleDef` applied by `vehicleModel.ts` — looks stay one table each, shared by pickers and the world.
- Trees carry a per-instance leaf `tint` set in `scatter.ts` (leaf materials go neutral so the tint shows) and grid trees keep a minimum trunk gap — colour variety and breathing space without extra models.
- The number of lights in the world never changes at runtime: outdoor decor uses emissive glow (no point lights), rooms use the always-mounted `RoomLights` pool (max 4, tested), rides share one `RideLamp`, and `stylizeModel` strips lights shipped inside GLBs — a changing light count rebuilds every shader and stutters.
- Still procedural scenery is wrapped in `StaticBatch` (merges meshes into few draws); anything animated must sit under `userData.keep` or it may be frozen into the merge.
- Instanced vegetation casts shadows only through `ShadowCasters` (near-player instances on `SHADOW_LAYER`, seen only by the sun's shadow camera); chunk meshes never cast — keeps the shadow pass small.
- Skinned agents/animals cull themselves with `inView()` (`components/world/cull.ts`) because three can't frustum-cull skinned meshes; swaying materials share one program via a `uWind` uniform.
- Procedural limb posing (petting hand, walk→run swing, signature-move kicks) lives in `src/game/heroPose.ts`, and pet/hero signature motion curves in `src/game/moves.ts`; poses are undone each frame (`beginPose`/`endPose`) because idle clips don't animate the arms — so the world and picker previews share one implementation and poses never accumulate.
- Colliders are circles or oriented boxes (`hw`/`hd`/`rot`, see `boxCollider` in `src/game/scatter.ts`), hashed into every cell they cover; all movers resolve through `pushOut`/`overlaps`/`footprintDist` in sub-steps — so walls have real corners and fast moves can't tunnel.
- The "Mayur's World" wordmark is a bird-free image; birds, creepers, blossoms and petals are an animated SVG overlay in `components/game/TitleSign.tsx` (rAF-driven birds, CSS wind) — so nature on the sign can move without regenerating art.
- Interaction moments (chill spots + lounger shape in `src/game/chill.ts`, trophy lift in `trophy.ts`, bro dap in `dap.ts`) are pure placement/timing modules read by `interact.ts`, `Player` and `Hero` (and `Agents` for the dap partner) — new context actions follow the same pattern so renderer and pose never disagree.
- The world map's top-down picture is drawn once from terrain + layout data in `components/game/mapImage.ts` (cached data URL); tap-to-teleport goes through the store's `warpTo` and lands via `clearSpot` in `PlayerController` — never place the player directly from UI code.
- Dev-only `window.__game` ({ player, useGame }) is set in `src/game/store.ts` — scripted browser checks drive the live store through it (`useGame.getState().warpTo(x, z)`) instead of importing modules, which can load a second store instance.
