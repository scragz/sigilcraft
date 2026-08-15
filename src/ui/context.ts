import type { Derived, Session, StageId } from "../state";

export interface StagePanel {
  node: HTMLElement;
  /** Called when the stage is left. Stops timers and audio. */
  dispose?: () => void;
}

export interface AppContext {
  session: Session;
  derived: Derived;
  /** Merge a patch into the session, persist it, and re-render. */
  update(patch: Partial<Session>): void;
  /** As `update`, but leaves the current stage's DOM in place. */
  updateQuiet(patch: Partial<Session>): void;
  goto(stage: StageId): void;
  /** Destroy the mark and the stored session. Irreversible. */
  release(): void;
  /** True only for the render immediately following a release. */
  justReleased: boolean;
}

export interface StageMeta {
  id: StageId;
  num: string;
  title: string;
}

export const STAGES: StageMeta[] = [
  { id: 1, num: "01", title: "State the Intent" },
  { id: 2, num: "02", title: "Strip the Letters" },
  { id: 3, num: "03", title: "Compress the Glyph" },
  { id: 4, num: "04", title: "Charge" },
  { id: 5, num: "05", title: "Release" },
];

/** Null when the stage is open; otherwise the reason it is not. */
export function lockReason(stage: StageId, ctx: AppContext): string | null {
  const { analysis, composition } = ctx.derived;
  switch (stage) {
    case 2:
      return ctx.session.statement.trim() ? null : "no statement yet";
    case 3:
    case 4:
      if (!ctx.session.statement.trim()) return "no statement yet";
      return composition ? null : `no letters survived — ${analysis.status.replace("-", " ")}`;
    default:
      // Stage 05 stays reachable; the screen itself explains what is missing.
      return null;
  }
}
