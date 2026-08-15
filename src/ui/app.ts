/**
 * The shell: a stack of screens with a numeral bar along the bottom.
 *
 * Mobile is the design; a wide viewport gets the same screen with more room
 * around it, not a different layout.
 *
 * Only the current screen is mounted. Leaving one disposes it, which is how the
 * charge field gets torn down — walking away from 04 stops the audio, which is
 * what anyone would expect of it.
 */

import {
  blankSession,
  clearSession,
  derive,
  FIRST_STAGE,
  LAST_STAGE,
  loadSession,
  saveSession,
  type Session,
  type StageId,
} from "../state";
import { lockReason, STAGES, type AppContext, type StagePanel } from "./context";
import { clear, h } from "./dom";
import { chargeStage } from "./stages/charge";
import { compressStage } from "./stages/compress";
import { intentStage } from "./stages/intent";
import { releaseStage } from "./stages/release";
import { stripStage } from "./stages/strip";

const BUILDERS: Record<StageId, (ctx: AppContext) => StagePanel> = {
  1: intentStage,
  2: stripStage,
  3: compressStage,
  4: chargeStage,
  5: releaseStage,
};

export function mountApp(root: HTMLElement): void {
  let session = loadSession();
  let justReleased = false;
  let panel: StagePanel | null = null;
  let visited = new Set<StageId>([session.stage]);

  const rail = h("nav", { class: "rail", "aria-label": "stages" });
  const host = h("main", { class: "screen-host" });

  const ctx: AppContext = {
    get session() {
      return session;
    },
    get derived() {
      return derive(session);
    },
    get justReleased() {
      return justReleased;
    },
    update(patch: Partial<Session>) {
      session = { ...session, ...patch };
      saveSession(session);
      render();
    },
    updateQuiet(patch: Partial<Session>) {
      session = { ...session, ...patch };
      saveSession(session);
      renderRail();
    },
    goto(stage: StageId) {
      justReleased = false;
      visited.add(stage);
      ctx.update({ stage });
      window.scrollTo({ top: 0 });
    },
    release() {
      clearSession();
      session = blankSession();
      visited = new Set<StageId>([FIRST_STAGE]);
      justReleased = true;
      render();
    },
  };

  function renderRail(): void {
    clear(rail);
    const current = justReleased ? LAST_STAGE : session.stage;
    const list = h("ol", { class: "rail-list" });
    for (const meta of STAGES) {
      const reason = lockReason(meta.id, ctx);
      const isCurrent = meta.id === current;
      const state = isCurrent
        ? "current"
        : reason
          ? "locked"
          : visited.has(meta.id)
            ? "visited"
            : "open";
      const button = h("button", {
        class: `rail-item is-${state}`,
        type: "button",
        text: meta.num,
        "aria-current": isCurrent ? "step" : undefined,
        "aria-disabled": reason ? "true" : undefined,
        "aria-label": reason ? `${meta.num} ${meta.title} — ${reason}` : `${meta.num} ${meta.title}`,
        title: reason ?? meta.title,
        onClick: () => {
          if (reason) return;
          ctx.goto(meta.id);
        },
      });
      list.append(h("li", {}, button));
    }
    rail.append(list);
  }

  function render(): void {
    panel?.dispose?.();
    panel = null;

    const stage = (justReleased ? LAST_STAGE : session.stage) as StageId;
    // A screen whose preconditions have gone away sends you back rather than
    // rendering an empty room.
    if (lockReason(stage, ctx)) {
      session = { ...session, stage: FIRST_STAGE };
      saveSession(session);
      render();
      return;
    }

    visited.add(stage);
    renderRail();
    clear(host);
    panel = BUILDERS[stage](ctx);
    host.append(panel.node);
    root.dataset.stage = String(stage);

    const heading = panel.node.querySelector<HTMLElement>(".screen-title");
    heading?.setAttribute("tabindex", "-1");
  }

  clear(root);
  root.append(
    h("header", { class: "brand", text: "Sigil Craft" }),
    host,
    h(
      "footer",
      { class: "colophon" },
      "No server · No record · ",
      h("a", { href: "https://splasteen.com", rel: "noreferrer", text: "Splasteen" }),
    ),
    rail,
  );
  root.removeAttribute("aria-busy");
  render();
}
