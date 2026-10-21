import type { CharacterAppearance } from "@/shared/types";
import { DEFAULT_APPEARANCE } from "@/stores/characterStore";
import CharacterPreviewCanvas from "@/game/CharacterPreviewCanvas";
import PageChrome from "@/components/PageChrome";

/** Locked hero avatar — same starter look every new citizen begins with. */
const HERO_AVATAR: CharacterAppearance = { ...DEFAULT_APPEARANCE, displayName: "Wanderer" };

/* — Simple geometric inline icons (no icon lib) — */

type IconProps = { className?: string };

function TownIcon({ className = "h-6 w-6" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M3 20h18" />
      <path d="M5 20V9h4v11" />
      <path d="M9 20V4h6v16" />
      <path d="M15 20V10h4v10" />
      <path d="M11.5 8h1M11.5 12h1M11.5 16h1" />
    </svg>
  );
}

function PeopleIcon({ className = "h-6 w-6" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="9" cy="8" r="3" />
      <path d="M4 20c0-2.8 2.2-5 5-5s5 2.2 5 5" />
      <circle cx="17" cy="9.5" r="2.4" />
      <path d="M15.5 14.7c2.3.4 4 2.3 4 4.7" />
    </svg>
  );
}

function StyleIcon({ className = "h-6 w-6" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M9 4.5 12 6l3-1.5 4 2.5-1.5 3L16 9.5V20H8V9.5l-1.5.5L5 7l4-2.5Z" />
      <path d="M9 4.5c0 1.4 1.3 2.5 3 2.5s3-1.1 3-2.5" />
    </svg>
  );
}

function DayNightIcon({ className = "h-6 w-6" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="7" />
      <path d="M12 5a7 7 0 0 1 0 14Z" fill="currentColor" fillOpacity="0.25" />
      <path d="M4.5 5.5 3 4M12 1.5v1.7M12 20.8v1.7M3.5 12H2M22 12h-1.5" />
    </svg>
  );
}

function ContractIcon({ className = "h-6 w-6" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M7 3h7l4 4v14H7V3Z" />
      <path d="M14 3v4h4" />
      <path d="M10 11h5M10 14h5M10 17h3" />
    </svg>
  );
}

/* — Page — */

const FEATURES = [
  {
    icon: TownIcon,
    title: "The Living Town",
    body: "Walk Elora Central City end to end: plaza, streets, storefronts. It moves with a day cycle and it's all explorable right now.",
  },
  {
    icon: PeopleIcon,
    title: "Meet Real People",
    body: "Your neighbours are other players' characters, rendered live. Phase 1 is single-player — this is the next door we open.",
  },
  {
    icon: StyleIcon,
    title: "Own Your Style",
    body: "Shape your character before you set foot inside: body type, skin tone, hair, and colours that stay yours in-world.",
  },
  {
    icon: DayNightIcon,
    title: "Day & Night World",
    body: "Warm mornings, amber evenings, real shadows. The town keeps honest time so the world feels lived-in.",
  },
  {
    icon: ContractIcon,
    title: "Contract Note",
    body: "We build in the open and tell you exactly what's live and what isn't. No fake trailers, no locked promises.",
  },
];

const DISTRICTS = [
  { name: "Elora Central City", status: "NOW" },
  { name: "Green Valley", status: "COMING" },
  { name: "Elora Coast", status: "COMING" },
  { name: "Old Town", status: "COMING" },
];

export default function LandingPage() {
  return (
    <PageChrome
      showBanner
      showFooter
      navActions={
        <>
          <a href="/login" className="px-4 py-2 text-sm text-white/70 transition hover:text-white">
            Sign in
          </a>
          <a href="/register" className="elora-btn-primary px-4 py-2 text-sm">
            Create your life
          </a>
        </>
      }
    >
    <div>
      {/* — Hero — */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(1000px 520px at 78% 18%, rgba(61,138,99,0.16), transparent 62%), radial-gradient(720px 420px at 12% 88%, rgba(201,162,39,0.07), transparent 60%)",
          }}
        />
        <div className="relative mx-auto grid w-full max-w-6xl items-center gap-14 px-6 pb-24 pt-20 lg:grid-cols-[1.05fr_0.95fr] lg:pt-28">
          <div className="space-y-8">
            <p className="elora-mono text-xs uppercase tracking-[0.3em] text-emerald-300/80">
              A 3D virtual life, built with care
            </p>
            <h1 className="elora-h1 max-w-xl">
              <span className="bg-gradient-to-b from-white to-white/70 bg-clip-text text-transparent">
                Arrive in a town that keeps living after you log off.
              </span>
            </h1>
            <p className="max-w-lg text-lg leading-relaxed text-white/60">
              ELORA is a premium 3D world where you shape a character, wander a hand-built Central City, and
              make it yours — one district at a time. Early and honest: Central City is playable today as a
              single-player world.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <a href="/register" className="elora-btn-primary px-7 py-3 text-base">
                Create your life
              </a>
              <a href="/login" className="elora-btn-secondary px-6 py-3 text-base">
                Sign in
              </a>
            </div>
            <p className="text-xs text-white/35">
              Free while in development · Runs in your browser, nothing to install
            </p>
          </div>

          <div className="relative">
            <div
              aria-hidden="true"
              className="absolute inset-6 -z-10 rounded-[2.5rem]"
              style={{
                background: "radial-gradient(400px 340px at 50% 55%, rgba(61,138,99,0.28), transparent 70%)",
              }}
            />
            <div className="elora-card overflow-hidden rounded-3xl p-2">
              <div className="h-[380px] overflow-hidden rounded-[1.35rem] lg:h-[480px]">
                <CharacterPreviewCanvas draft={HERO_AVATAR} turntable />
              </div>
              <div className="flex items-center justify-between px-4 py-3 text-xs text-white/45">
                <span className="elora-mono uppercase tracking-[0.25em]">Starter citizen</span>
                <span className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Central City · v0.1
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* — Features — */}
      <section className="mx-auto w-full max-w-6xl px-6">
        <div className="mb-10 max-w-xl space-y-3">
          <h2 className="text-3xl font-semibold tracking-tight text-white">What ELORA is becoming</h2>
          <p className="text-white/50">
            Four things we&apos;re building, and one promise about how we talk about them.
          </p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <article key={title} className="elora-card space-y-4 p-6 transition-colors hover:border-white/20">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-300">
                <Icon />
              </div>
              <h3 className="text-lg font-semibold text-white">{title}</h3>
              <p className="text-sm leading-relaxed text-white/50">{body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* — Roadmap strip — */}
      <section className="mx-auto w-full max-w-6xl px-6 pt-24">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-3xl font-semibold tracking-tight text-white">The world, district by district</h2>
          <span className="elora-mono text-xs uppercase tracking-[0.25em] text-white/35">Roadmap</span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {DISTRICTS.map((d) => {
            const now = d.status === "NOW";
            return (
              <div
                key={d.name}
                className={`elora-card flex items-center justify-between gap-3 p-5 ${now ? "border-emerald-500/30" : ""}`}
              >
                <div className="space-y-1">
                  <p className="font-medium text-white">{d.name}</p>
                  <p className="text-xs text-white/40">{now ? "Playable now" : "In design"}</p>
                </div>
                <span
                  className={`elora-mono rounded-full px-2.5 py-1 text-[11px] tracking-widest ${
                    now ? "bg-emerald-500/15 text-emerald-300" : "bg-white/5 text-white/35"
                  }`}
                >
                  {d.status}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* — System requirements — */}
      <section className="mx-auto w-full max-w-6xl px-6 pt-24">
        <div className="elora-card p-6 md:p-8">
          <h2 className="mb-4 text-xl font-semibold text-white">Runs on almost anything</h2>
          <p className="elora-mono space-y-0 text-sm leading-7 text-white/50">
            Browser · Chrome, Edge or Firefox with WebGL 2
            <br />
            Graphics · Any hardware-accelerated GPU, integrated is fine
            <br />
            Display · 1280 × 720 or larger
            <br />
            Network · Broadband connection to the ELORA services
          </p>
          <p className="mt-4 text-xs text-white/35">
            Native launcher is not required — the world streams straight into the browser tab.
          </p>
        </div>
      </section>
    </div>
    </PageChrome>
  );
}
