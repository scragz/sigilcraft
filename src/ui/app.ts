/**
 * The shell: a persistent stepper and one stage at a time.
 *
 * Only the current stage is mounted. Leaving a stage disposes it, which is how
 * the charge field gets torn down — walking away from stage 04 stops the audio,
 * which is the behaviour anyone would expect of it.
 */

import {
  blankSession,
  clearSession,
  derive,
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
import { thresholdStage } from "./stages/threshold";

const BUILDERS: Record<StageId, (ctx: AppContext) => StagePanel> = {
  0: thresholdStage,
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
  const host = h("main", { class: "stage-host", id: "stage-host" });

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
      host.scrollIntoView({ block: "start", behavior: "auto" });
      window.scrollTo({ top: 0 });
    },
    release() {
      clearSession();
      session = blankSession();
      visited = new Set<StageId>([0]);
      justReleased = true;
      render();
    },
  };

  function renderRail(): void {
    clear(rail);
    const current = justReleased ? 5 : session.stage;
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
      const button = h(
        "button",
        {
          class: `rail-item is-${state}`,
          type: "button",
          "aria-current": isCurrent ? "step" : undefined,
          "aria-disabled": reason ? "true" : undefined,
          title: reason ?? undefined,
          onClick: () => {
            if (reason) return;
            ctx.goto(meta.id);
          },
        },
        h("span", { class: "rail-num", text: meta.num }),
        h("span", { class: "rail-title", text: meta.title }),
        h("span", { class: "rail-purpose", text: reason ?? meta.purpose }),
      );
      list.append(h("li", {}, button));
      // On narrow screens the rail is a horizontal strip; keep the current
      // stage visible in it without moving the page.
      if (isCurrent) {
        queueMicrotask(() => {
          if (list.scrollWidth > list.clientWidth) {
            button.scrollIntoView({ inline: "center", block: "nearest" });
          }
        });
      }
    }
    rail.append(list);
  }

  function render(): void {
    panel?.dispose?.();
    panel = null;

    const stage = (justReleased ? 5 : session.stage) as StageId;
    // A stage whose preconditions have gone away sends you back rather than
    // rendering an empty room.
    const reason = lockReason(stage, ctx);
    if (reason) {
      session = { ...session, stage: session.statement.trim() ? 1 : 0 };
      saveSession(session);
      render();
      return;
    }

    visited.add(stage);
    renderRail();
    clear(host);
    panel = BUILDERS[stage](ctx);
    host.append(panel.node);

    const heading = panel.node.querySelector<HTMLElement>(".stage-title");
    heading?.setAttribute("tabindex", "-1");
  }

  clear(root);
  root.append(
    h(
      "header",
      { class: "brand" },
      h("span", { class: "brand-mark", text: "Sigil Craft" }),
      h("span", { class: "brand-note", text: "runs entirely in this browser" }),
    ),
    rail,
    host,
    h(
      "footer",
      { class: "colophon" },
      h("p", {
        text: "No account, no server, no analytics. The statement is held in this browser until it is released.",
      }),
      h(
        "p",
        {},
        "A ",
        h("a", { href: "https://splasteen.com", rel: "noreferrer", text: "SPLASTEEN" }),
        " object.",
      ),
    ),
  );
  root.removeAttribute("aria-busy");
  render();
}
