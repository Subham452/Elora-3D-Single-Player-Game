import { useGameStore } from "@/stores/gameStore";
import { useAuthStore } from "@/stores/authStore";

/**
 * Bag & character info. Phase-2 real inventory arrives with server
 * ownership; this panel is honest about it while exposing actual state:
 * session pouch, discoveries, character identity, live position.
 */
export default function InventoryPanel() {
  const hotbar = useGameStore((s) => s.hotbar);
  const discoveries = useGameStore((s) => s.discoveries);
  const charFallbacks = useGameStore((s) => s.charFallbacks);
  const checkpoint = useGameStore((s) => s.checkpoint);
  const perf = useGameStore((s) => s.perf);
  const setOverlay = useGameStore((s) => s.setOverlay);
  const user = useAuthStore((s) => s.user);

  const pouch: { label: string; count: number }[] = [
    { label: "Golden Seed", count: hotbar.seeds },
    { label: "Valley Bloom", count: hotbar.blooms },
    { label: "Stone Shard", count: hotbar.shards },
  ];
  const total = hotbar.seeds + hotbar.blooms + hotbar.shards;

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#0a0f14f2] backdrop-blur-sm">
      <div className="elora-card w-[min(640px,94vw)] max-h-[86vh] overflow-y-auto p-6">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white/95">Bag & Character</h2>
          <button
            type="button"
            className="elora-btn-secondary px-4 py-2"
            onClick={() => {
              setOverlay(null);
              useGameStore.getState().setOverlay(null);
            }}
          >
            Close · Esc
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <section>
            <div className="elora-label mb-2">Pouch — session only</div>
            {pouch.map((s) => (
              <div key={s.label} className="mb-2 rounded-lg bg-white/[0.04] px-3 py-2 ring-1 ring-white/8">
                <span className="text-sm text-white/85">{s.label}</span>
                <span className="elora-mono float-right text-sm text-emerald-300/90">{s.count}</span>
              </div>
            ))}
            <p className="mt-2 text-[11px] text-white/40">
              {total} item{total === 1 ? "" : "s"} carried. Server-side inventory
              with grants & purchases is the Phase-2 milestone (kept separate
              from empty "cart" buttons on purpose).
            </p>

            <div className="elora-label mb-2 mt-5">Discoveries</div>
            <div className="flex flex-wrap gap-1.5">
              {discoveries.length === 0 && (
                <span className="text-xs text-white/40">None yet — walk to a marker.</span>
              )}
              {discoveries.map((d) => (
                <span
                  key={d}
                  className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] text-emerald-200/90 ring-1 ring-emerald-400/30"
                >
                  {d}
                </span>
              ))}
            </div>
          </section>

          <section>
            <div className="elora-label mb-2">Character</div>
            <div className="space-y-1.5 rounded-lg bg-white/[0.04] px-3 py-3 ring-1 ring-white/8">
              <Row k="Name" v={user?.profile.appearance.displayName ?? "—"} />
              <Row k="Body" v={user?.profile.appearance.bodyType ?? "—"} />
              <Row k="Hair" v={user?.profile.appearance.hairStyle.toString() ?? "—"} />
              <Row k="Zone" v="Frontier Valley" />
              <Row
                k="Position"
                v={checkpoint ? `${Math.round(checkpoint.x)}, ${Math.round(checkpoint.z)}` : "—"}
              />
              <Row k="Gold" v={String(user?.profile.coins ?? 0)} />
            </div>

            <div className="elora-label mb-2 mt-5">Asset diagnostics</div>
            <div className="rounded-lg bg-white/[0.04] px-3 py-3 text-[12px] ring-1 ring-white/8">
              <Row
                k="Rigged GLB"
                v={charFallbacks.length === 0 ? "loaded" : "fallback"}
                mono
              />
              {charFallbacks.length > 0 && (
                <div className="mt-1 text-[11px] text-amber-200/70">
                  Procedural stand-ins active for: {charFallbacks.join(", ")} —
                  see docs/CREDITS.md to swap the model.
                </div>
              )}
            </div>

            <div className="elora-label mb-2 mt-5">World clock</div>
            <div className="rounded-lg bg-white/[0.04] px-3 py-3 ring-1 ring-white/8">
              <Row k="Draw calls (last sample)" v={String(perf.draws)} mono />
              <Row k="Triangles" v={String(perf.tris)} mono />
              <p className="mt-1 text-[11px] text-white/40">
                Two accounts keep separate tiles; multiplayer sessions arrive Phase 4.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v, mono = false }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[11px] uppercase tracking-wider text-white/40">{k}</span>
      <span className={`${mono ? "elora-mono" : ""} text-sm text-white/85`}>{v}</span>
    </div>
  );
}
