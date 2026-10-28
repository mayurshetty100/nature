/**
 * Bro dap: walk up to someone, press the action button, and the two of you
 * reach out, clasp hands, give it a shake, pull in for a shoulder bump and
 * finish with a snap. Pure timing shared by the explorer and the person.
 */
export const DAP = {
  ms: 2400,
  /** how far apart the two stand for the handshake (m) */
  gap: 0.95,
};

export type DapPose = {
  /** right arm reaching out to clasp, 0‥1 */
  reach: number;
  /** small up-down shake of the clasped hands (body-space y offset) */
  shake: number;
  /** pull-in shoulder bump with the free arm round the back, 0‥1 */
  bump: number;
  /** finger snap on release, 0‥1 */
  snap: number;
};

const ease = (k: number) => {
  const c = Math.min(1, Math.max(0, k));
  return c * c * (3 - 2 * c);
};
const bumpOf = (k: number, a: number, b: number) => (k <= a || k >= b ? 0 : Math.sin(((k - a) / (b - a)) * Math.PI));

/** The handshake pose `ms` after it started (all zero outside it). */
export function dapPose(ms: number): DapPose {
  const k = ms / DAP.ms;
  if (k <= 0 || k >= 1) return { reach: 0, shake: 0, bump: 0, snap: 0 };
  const reach = ease(k / 0.25) * (1 - ease((k - 0.82) / 0.12));
  const shake = k > 0.25 && k < 0.5 ? Math.sin(((k - 0.25) / 0.25) * Math.PI * 4) * 0.12 : 0;
  const bump = bumpOf(k, 0.48, 0.82);
  const snap = bumpOf(k, 0.82, 1);
  return { reach, shake, bump, snap };
}
