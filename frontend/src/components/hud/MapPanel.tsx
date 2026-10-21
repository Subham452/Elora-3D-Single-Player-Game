import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { useGameStore } from "@/stores/gameStore";
import { POIS, worldToMap, MAP } from "@/game/world/worldData";
import { terrainHeight, surfaceKind, WATER_LEVEL } from "@/game/world/voxel/terrainNoise";
import type { EloraGame } from "@/game/Game";
import type { PoiDefinition } from "@/shared/types";

/**
 * World map. The terrain layer is RENDERED from the same terrainHeight()
 * function the world uses — the map can never drift out of sync with the
 * actual landscape. POI dots + player marker + fast travel to discovered POIs.
 */
export default function MapPanel({ gameRef }: { gameRef: MutableRefObject<EloraGame | null> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const discoveries = useGameStore((s) => s.discoveries);
  const setOverlay = useGameStore((s) => s.setOverlay);
  const toast = useGameStore((s) => s.showToast);
  const [selected, setSelected] = useState<PoiDefinition>(POIS[0]);
  const redrawRef = useRef<(() => void) | null>(null);

  const terrainPreview = useMemo(() => {
    const N = 220;
    const colors = new Uint8Array(N * N * 4);
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const wx = (i / N) * MAP.extent - MAP.extent / 2;
        const wz = (j / N) * MAP.extent - MAP.extent / 2;
        const h = terrainHeight(wx, wz);
        let rgb: [number, number, number];
        if (h < WATER_LEVEL) {
          rgb = [32, 74, 100];
        } else {
          const k = surfaceKind(wx, wz, h);
          const t = Math.min(1, (h - WATER_LEVEL) / 12);
          if (k === "stone") rgb = [116 + t * 22, 120 + t * 22, 128];
          else if (k === "sand") rgb = [198, 180, 128];
          else rgb = [58 + t * 32, 104 + t * 30, 52 + t * 26];
        }
        const o = (j * N + i) * 4;
        colors[o] = rgb[0];
        colors[o + 1] = rgb[1];
        colors[o + 2] = rgb[2];
        colors[o + 3] = 235;
      }
    }
    return { colors, N };
  }, []);

  const discoveredSet = useMemo(() => new Set(discoveries), [discoveries]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    const draw = () => {
      const W = canvas.width;
      const H = canvas.height;
      ctx.clearRect(0, 0, W, H);
      // Terrain image layer
      const { colors, N } = terrainPreview;
      const imgData = ctx.createImageData(N, N);
      imgData.data.set(colors);
      const bmp = createImageBitmap(imgData);
      ctx.imageSmoothingEnabled = true;
      // overlay coastline contour lines by luminance bands (subtle)
      const { mx: pmx, my: pmy } = worldToMap(useGameStore.getState().checkpoint?.x ?? -16, useGameStore.getState().checkpoint?.z ?? 24);
      const playerAt = { mx: pmx, my: pmy };
      bmp.then((b) => {
        ctx.drawImage(b, 0, 0, W, H);
        // player marker
        const heading = useGameStore.getState().headingDeg;
        const px = (playerAt.mx / MAP.size) * W;
        const py = (playerAt.my / MAP.size) * H;
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate((heading * Math.PI) / 180);
        ctx.fillStyle = "#eafff2";
        ctx.beginPath();
        ctx.moveTo(0, -11);
        ctx.lineTo(7, 8);
        ctx.lineTo(0, 4);
        ctx.lineTo(-7, 8);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        // POI markers
        for (const poi of POIS) {
          const { mx, my } = worldToMap(poi.x, poi.z);
          const sx = (mx / MAP.size) * W;
          const sy = (my / MAP.size) * H;
          const known = discoveredSet.has(poi.id);
          const sel = poi.id === selected.id;
          ctx.beginPath();
          ctx.arc(sx, sy, sel ? 10 : 7, 0, Math.PI * 2);
          ctx.fillStyle = known ? "#63dda0" : "rgba(200,220,235,0.35)";
          ctx.fill();
          if (sel) {
            ctx.strokeStyle = "#eafff2";
            ctx.lineWidth = 2;
            ctx.stroke();
          }
          if (known) {
            ctx.font = "12px ui-sans-serif, system-ui";
            ctx.fillStyle = "rgba(255,255,255,0.9)";
            ctx.textAlign = "center";
            ctx.fillText(poi.name, sx, sy - 14);
          } else {
            ctx.font = "italic 12px ui-sans-serif, system-ui";
            ctx.fillStyle = "rgba(255,255,255,0.45)";
            ctx.textAlign = "center";
            ctx.fillText("???", sx, sy - 14);
          }
        }
      });
      redrawRef.current = draw;
    };
    draw();
    return () => {
      redrawRef.current = null;
    };
  }, [terrainPreview, discoveredSet, selected]);

  const clickToTravel = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const ctx = canvasRef.current?.getBoundingClientRect();
    if (!ctx) return;
    const x = ((e.clientX - ctx.left) / ctx.width) * MAP.size;
    const y = ((e.clientY - ctx.top) / ctx.height) * MAP.size;
    let bestPoi: PoiDefinition | null = null;
    let bestDist = 26; // px tolerance
    for (const poi of POIS) {
      const { mx, my } = worldToMap(poi.x, poi.z);
      const d = Math.hypot(mx - x, my - y);
      if (d < bestDist) {
        bestDist = d;
        bestPoi = poi;
      }
    }
    if (bestPoi) setSelected(bestPoi);
  };

  const travel = () => {
    if (!gameRef.current) return;
    if (!discoveredSet.has(selected.id)) {
      toast("Not discovered yet", "Visit the marker in the world first.");
      return;
    }
    if (gameRef.current.travelToPoi(selected.id)) {
      setOverlay(null);
      toast("Fast travel", selected.name);
    } else {
      toast("Cannot travel there", "Pick a land marker on the map.");
    }
  };

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#0a0f14f2] backdrop-blur-sm">
      <div className="elora-card w-[min(980px,94vw)] p-5">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white/95">Elora Frontier Valley</h2>
            <p className="text-xs text-white/50">
              Terrain rendered live from the same height function as the world.
            </p>
          </div>
          <button
            type="button"
            className="elora-btn-secondary px-4 py-2"
            onClick={() => {
              setOverlay(null);
              gameRef.current?.setPaused(false);
            }}
          >
            Back · Esc
          </button>
        </div>
        <div className="flex flex-col gap-4 md:flex-row">
          <canvas
            ref={canvasRef}
            width={900}
            height={900}
            onClick={clickToTravel}
            className="h-[54vh] w-full md:w-[54vh] shrink-0 cursor-crosshair rounded-xl bg-[#0d141a]"
          />
          <div className="flex-1">
            <div className="elora-label mb-2">Locations</div>
            <div className="flex flex-col gap-1.5 overflow-y-auto max-h-[46vh] pr-1">
              {POIS.map((poi) => {
                const known = discoveredSet.has(poi.id);
                return (
                  <button
                    key={poi.id}
                    type="button"
                    onClick={() => setSelected(poi)}
                    className={`rounded-lg px-3 py-2 text-left text-sm transition ${
                      selected.id === poi.id
                        ? "bg-emerald-500/15 ring-1 ring-emerald-400/40"
                        : "bg-white/[0.04] ring-1 ring-white/8 hover:bg-white/[0.07]"
                    }`}
                  >
                    <span className={known ? "font-semibold text-white/90" : "text-white/40"}>
                      {known ? poi.name : "Undiscovered location"}
                    </span>
                    {known && (
                      <p className="mt-0.5 text-xs text-white/45">{poi.description}</p>
                    )}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              className="elora-btn-primary mt-4 w-full"
              onClick={travel}
              disabled={!discoveredSet.has(selected.id)}
            >
              {discoveredSet.has(selected.id)
                ? `Fast travel to ${selected.name}`
                : "Travel unlocked once discovered"}
            </button>
            <p className="mt-2 text-[11px] text-white/40">
              Frontier multiplayer + shared clock land in Phase 4.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
