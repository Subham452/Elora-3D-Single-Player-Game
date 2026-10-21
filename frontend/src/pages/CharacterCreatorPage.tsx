import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/services/api";
import { useAuthStore } from "@/stores/authStore";
import { useCharacterDraft } from "@/stores/characterStore";
import { SKIN_TONES, HAIR_COLORS, TOP_COLORS, BOTTOM_COLORS } from "@/shared/types";
import type { BodyType } from "@/shared/types";
import CharacterPreviewCanvas from "@/game/CharacterPreviewCanvas";

const BODY_TYPES: ReadonlyArray<{ value: BodyType; label: string }> = [
  { value: "slim", label: "Slim" },
  { value: "average", label: "Average" },
  { value: "athletic", label: "Athletic" },
];

const HAIR_STYLES = ["Short", "Cropped", "Bun", "Ponytail"] as const;

/** Simple circle-head thumbnails with a hair-path variant per style (0..3). */
function HairThumb({ style, className }: { style: number; className?: string }) {
  const paths = [
    <path key="0" d="M7 9.5c0-3 2.2-5 5-5s5 2 5 5v.4c-1.4-1.2-3.1-1.8-5-1.8s-3.6.6-5 1.8v-.4Z" fill="currentColor" />,
    <path key="1" d="M7 10.2v-1c0-2.9 2.2-4.7 5-4.7s5 1.8 5 4.7v1c-1.5-.9-3.2-1.4-5-1.4s-3.5.5-5 1.4Z" fill="currentColor" />,
    <g key="2" fill="currentColor">
      <circle cx="12" cy="4.6" r="1.7" />
      <path d="M7 10.2v-1c0-2.9 2.2-4.7 5-4.7s5 1.8 5 4.7v1c-1.5-.9-3.2-1.4-5-1.4s-3.5.5-5 1.4Z" />
    </g>,
    <g key="3" fill="currentColor">
      <path d="M15.5 7.5c1.8 1.1 2.6 3.3 2.3 5.8-.9-.6-1.7-1.7-2-3.1-.2-1-.2-1.9-.3-2.7Z" />
      <path d="M7 10.2v-1c0-2.9 2.2-4.7 5-4.7s5 1.8 5 4.7v1c-1.5-.9-3.2-1.4-5-1.4s-3.5.5-5 1.4Z" />
    </g>,
  ];
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="12" cy="12.5" r="6" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="1.5" />
      {paths[style]}
    </svg>
  );
}

interface SwatchProps {
  color: string;
  active: boolean;
  onPick: (c: string) => void;
  title: string;
}

function Swatch({ color, active, onPick, title }: SwatchProps) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      onClick={() => onPick(color)}
      className={`h-8 w-8 rounded-lg border transition ${
        active ? "border-emerald-300 shadow-[0_0_0_2px_rgba(98,190,137,0.4)]" : "border-white/15 hover:border-white/40"
      }`}
      style={{ backgroundColor: color }}
    />
  );
}

interface ColorRowProps {
  label: string;
  value: string;
  palette: ReadonlyArray<string>;
  onPick: (c: string) => void;
}

function ColorRow({ label, value, palette, onPick }: ColorRowProps) {
  return (
    <div className="space-y-2">
      <span className="elora-label">{label}</span>
      <div className="flex flex-wrap items-center gap-2">
        {palette.map((c) => (
          <Swatch key={c} color={c} active={c.toLowerCase() === value.toLowerCase()} onPick={onPick} title={c} />
        ))}
        <label
          title={`Custom ${label.toLowerCase()}`}
          className="relative flex h-8 w-8 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-dashed border-white/25 text-white/50 transition hover:border-white/50 hover:text-white/80"
        >
          <span className="text-sm leading-none">+</span>
          <input
            type="color"
            value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : "#2e6d4f"}
            onChange={(e) => onPick(e.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer appearance-none p-0 opacity-0 [&::-webkit-color-swatch]:rounded-lg [&::-webkit-color-swatch]:border-none [&::-webkit-color-swatch-wrapper]:p-0"
          />
        </label>
      </div>
    </div>
  );
}

export default function CharacterCreatorPage() {
  const navigate = useNavigate();
  const setUser = useAuthStore((s) => s.setUser);
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);

  const draft = useCharacterDraft((s) => s.draft);
  const setDraft = useCharacterDraft((s) => s.setDraft);

  const [submitting, setSubmitting] = useState<"world" | "dashboard" | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [nameTouched, setNameTouched] = useState(false);

  // Seed the draft from the citizen's saved look on first mount (edit flow);
  // brand-new users keep the clean default.
  const seeded = useRef(false);
  useEffect(() => {
    if (!seeded.current && user?.profile?.appearance?.displayName) {
      seeded.current = true;
      setDraft(user.profile.appearance);
    }
  }, [user, setDraft]);

  const name = draft.displayName.trim();
  const nameError =
    nameTouched || submitting !== null
      ? name.length < 3
        ? "Display name must be at least 3 characters."
        : name.length > 24
          ? "Display name must be 24 characters at most."
          : null
      : null;

  async function save(destination: "world" | "dashboard") {
    if (submitting) return;
    if (name.length < 3 || name.length > 24) {
      setNameTouched(true);
      return;
    }
    setSubmitting(destination);
    setApiError(null);
    try {
      const updated = await api.updateAppearance({ ...draft, displayName: name });
      setUser(updated);
      navigate(destination === "world" ? "/world" : "/dashboard");
    } catch (err) {
      setApiError(
        err instanceof Error
          ? `Could not save your character — ${err.message}`
          : "Could not save your character. Try again.",
      );
      setSubmitting(null);
    }
  }

  async function onSignOut(e: FormEvent) {
    e.preventDefault();
    await logout();
    navigate("/");
  }

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* Preview — 45% on desktop */}
      <div className="relative min-h-[340px] bg-[#0d141a] lg:w-[45%] lg:shrink-0">
        <div className="absolute inset-x-0 top-5 z-10 text-center">
          <span className="elora-mono rounded-full bg-black/40 px-3 py-1.5 text-[11px] uppercase tracking-[0.3em] text-white/60 backdrop-blur-sm">
            Character preview
          </span>
        </div>
        <CharacterPreviewCanvas draft={draft} turntable />
      </div>

      {/* Editor */}
      <div className="flex flex-1 justify-center px-6 py-10 lg:py-14">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save("world");
          }}
          className="w-full max-w-xl space-y-8"
          noValidate
        >
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight text-white">Shape your citizen</h1>
            <p className="text-sm text-white/50">
              This is the look you arrive with in Central City. Everything here saves to your account.
            </p>
          </div>

          {/* Display name */}
          <div className="space-y-2">
            <label htmlFor="cc-name" className="elora-label">
              Display name
            </label>
            <input
              id="cc-name"
              type="text"
              className={`elora-input ${nameError ? "!border-red-500/60" : ""}`}
              placeholder="3–24 characters — how the town knows you"
              value={draft.displayName}
              maxLength={40}
              onBlur={() => setNameTouched(true)}
              onChange={(e) => setDraft({ displayName: e.target.value })}
            />
            {nameError ? (
              <p className="text-xs text-red-300">{nameError}</p>
            ) : (
              <p className="text-xs text-white/30">{name.length}/24 characters</p>
            )}
          </div>

          {/* Body type */}
          <div className="space-y-2">
            <span className="elora-label">Body type</span>
            <div className="inline-flex rounded-xl border border-white/10 bg-white/[0.04] p-1">
              {BODY_TYPES.map((b) => (
                <button
                  key={b.value}
                  type="button"
                  onClick={() => setDraft({ bodyType: b.value })}
                  aria-pressed={draft.bodyType === b.value}
                  className={`rounded-lg px-5 py-2 text-sm font-medium transition ${
                    draft.bodyType === b.value
                      ? "bg-emerald-500/20 text-emerald-100"
                      : "text-white/55 hover:bg-white/5 hover:text-white/85"
                  }`}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>

          {/* Skin tone */}
          <ColorRow
            label="Skin tone"
            value={draft.skinTone}
            palette={SKIN_TONES}
            onPick={(c) => setDraft({ skinTone: c })}
          />

          {/* Hair */}
          <div className="space-y-4">
            <ColorRow
              label="Hair color"
              value={draft.hairColor}
              palette={HAIR_COLORS}
              onPick={(c) => setDraft({ hairColor: c })}
            />
            <div className="space-y-2">
              <span className="elora-label">Hair style</span>
              <div className="flex flex-wrap gap-3">
                {HAIR_STYLES.map((label, i) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setDraft({ hairStyle: i })}
                    aria-pressed={draft.hairStyle === i}
                    className={`flex w-20 flex-col items-center gap-1 rounded-xl border p-2 transition ${
                      draft.hairStyle === i
                        ? "border-emerald-400/70 bg-emerald-500/10 text-emerald-200"
                        : "border-white/10 bg-white/[0.03] text-white/50 hover:border-white/25 hover:text-white/80"
                    }`}
                  >
                    <HairThumb style={i} className="h-9 w-9" />
                    <span className="text-xs">{label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Clothing */}
          <div className="grid gap-5 sm:grid-cols-2">
            <ColorRow
              label="Top color"
              value={draft.topColor}
              palette={TOP_COLORS}
              onPick={(c) => setDraft({ topColor: c })}
            />
            <ColorRow
              label="Bottom color"
              value={draft.bottomColor}
              palette={BOTTOM_COLORS}
              onPick={(c) => setDraft({ bottomColor: c })}
            />
          </div>

          {/* Errors */}
          {apiError && (
            <div className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {apiError}
            </div>
          )}

          {/* Actions */}
          <div className="space-y-4 border-t border-white/5 pt-6">
            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                className="elora-btn-primary px-7"
                disabled={submitting !== null || nameError !== null}
                title={nameError ?? "Save and enter Central City"}
              >
                {submitting === "world" ? "Saving…" : "Enter Elora"}
              </button>
              <button
                type="button"
                className="elora-btn-secondary"
                onClick={() => void save("dashboard")}
                disabled={submitting !== null || nameError !== null}
                title={nameError ?? "Save without entering the world"}
              >
                {submitting === "dashboard" ? "Saving…" : "Save for later"}
              </button>
            </div>
            <button
              type="button"
              onClick={onSignOut}
              disabled={submitting !== null}
              className="text-sm text-white/40 transition hover:text-white/75 disabled:opacity-50"
            >
              Sign out
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
