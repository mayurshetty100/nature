import { Briefcase, Cog, GraduationCap, House, Lightbulb, Send, Trophy, type LucideIcon } from "lucide-react";
import type { StopId } from "@/game/stops";

export const STOP_ICONS: Record<StopId, LucideIcon> = {
  gate: House,
  academy: GraduationCap,
  city: Briefcase,
  forest: Lightbulb,
  skills: Cog,
  peak: Trophy,
  cove: Send,
};
