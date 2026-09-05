"use client";

import { useRef } from "react";

/**
 * Wave color presets for the masthead's ColorBends layer, named and styled
 * to match React Bits' own ColorBends demo exactly. All four share
 * identical motion params (tuned for this wide banner, see Masthead.tsx)
 * and differ only in `colors`, so switching never rebuilds the WebGL
 * context.
 */
export const WAVE_THEMES = {
  nebula: { label: "Nebula", color: "#A855F7" },
  aurora: { label: "Aurora", color: "#10B981" },
  ember: { label: "Ember", color: "#F97316" },
  ice: { label: "Ice", color: "#06B6D4" },
} as const;

export type WaveThemeKey = keyof typeof WAVE_THEMES;

/** The resting theme on load and what the reset button returns to. */
export const DEFAULT_WAVE_THEME: WaveThemeKey = "ice";

/** The wave's motion params — genuinely live now: dragging a value here
 * writes straight into the ColorBends instance behind the panel (see
 * Masthead.tsx). `fadeTop` isn't a ColorBends prop; it drives the CSS mask
 * Masthead already used to fade the wave near the header. */
export type WaveParams = {
  speed: number;
  frequency: number;
  noise: number;
  bandWidth: number;
  rotation: number;
  fadeTop: number;
  iterations: number;
  intensity: number;
};

export const DEFAULT_WAVE_PARAMS: WaveParams = {
  speed: 0.2,
  frequency: 1.0,
  noise: 0.15,
  bandWidth: 0.49,
  rotation: 90,
  fadeTop: 0.58,
  iterations: 1,
  intensity: 2.0,
};

const PARAM_CONFIG: {
  key: keyof WaveParams;
  min: number;
  max: number;
  decimals: number;
}[] = [
  { key: "speed", min: 0.1, max: 1.0, decimals: 1 },
  { key: "frequency", min: 1, max: 3, decimals: 1 },
  { key: "noise", min: 0.0, max: 0.9, decimals: 2 },
  { key: "bandWidth", min: 0.1, max: 1, decimals: 2 },
  { key: "rotation", min: 0, max: 169, decimals: 0 },
  { key: "fadeTop", min: 0.4, max: 1, decimals: 2 },
  { key: "iterations", min: 1, max: 2, decimals: 0 },
  { key: "intensity", min: 0.1, max: 2, decimals: 1 },
];

const THEME_KEYS = Object.keys(WAVE_THEMES) as WaveThemeKey[];

/** Horizontal drag distance, in px, that sweeps a value across its entire
 * min→max range — independent of that range's own magnitude. */
const DRAG_RANGE_PX = 160;

/**
 * A number that scrubs like a code-editor's inline literal: hover shows a
 * horizontal resize cursor, and holding the pointer down and dragging
 * changes the value between `min` and `max`. Pointer capture (not window
 * listeners) keeps the drag tracking even once the cursor leaves the span.
 */
function DraggableValue({
  value,
  min,
  max,
  decimals,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  decimals: number;
  onChange: (next: number) => void;
}) {
  const dragRef = useRef<{ x: number; value: number } | null>(null);

  const handlePointerDown = (event: React.PointerEvent<HTMLSpanElement>) => {
    dragRef.current = { x: event.clientX, value };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLSpanElement>) => {
    const start = dragRef.current;
    if (!start) return;
    const deltaValue = ((event.clientX - start.x) / DRAG_RANGE_PX) * (max - min);
    const next = Math.min(max, Math.max(min, start.value + deltaValue));
    onChange(Number(next.toFixed(decimals)));
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLSpanElement>) => {
    dragRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return (
    <span
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      className="cursor-ew-resize touch-none rounded bg-white/10 px-1 tabular-nums select-none hover:bg-white/20"
    >
      {value.toFixed(decimals)}
    </span>
  );
}

/**
 * A faux code-editor panel, styled after React Bits' own ColorBends demo:
 * plain (not traffic-light-colored) window dots, a glass panel that lets
 * the real wave bleed through behind it, and numeric values that scrub the
 * real wave behind it (see DraggableValue) rather than sitting there as
 * inert text — the pill tab row below drives `theme` the same way.
 */
export function HeroDemoPanel({
  theme,
  onSelect,
  params,
  onParamChange,
  onReset,
}: {
  theme: WaveThemeKey;
  onSelect: (key: WaveThemeKey) => void;
  params: WaveParams;
  onParamChange: (key: keyof WaveParams, value: number) => void;
  onReset: () => void;
}) {
  const active = WAVE_THEMES[theme];

  return (
    <div className="w-full overflow-hidden rounded-xl border border-white/15 bg-white/[0.04] shadow-xl shadow-black/30 backdrop-blur-2xl">
      <div className="flex items-center justify-between border-b border-white/10 px-3.5 py-2.5">
        <div className="flex items-center gap-1.5" aria-hidden="true">
          <span className="size-2 rounded-full bg-white/25" />
          <span className="size-2 rounded-full bg-white/25" />
          <span className="size-2 rounded-full bg-white/25" />
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onReset}
            aria-label="Reset the wave to its default values"
            title="Reset to defaults"
            className="rounded-md p-1 text-white/45 transition-colors hover:bg-white/10 hover:text-white/80"
          >
            <svg
              viewBox="0 0 16 16"
              className="size-3"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden="true"
            >
              <path
                d="M13.5 8a5.5 5.5 0 1 1-1.65-3.93"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path d="M13.5 2.5v3.3h-3.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <span className="rounded-md bg-white/5 px-2 py-1 text-[11px] font-medium text-white/60">
            ColorBends
          </span>
        </div>
      </div>

      <div className="space-y-1 overflow-x-auto px-4 py-4 font-mono text-[11.5px] leading-5 whitespace-pre text-white/85">
        <p>
          <span className="text-[#c792ea]">import</span> {"{ "}
          <span className="text-[#a5b4fc]">ColorBends</span>
          {" }"} <span className="text-[#c792ea]">from</span>{" "}
          <span className="text-[#a3e6b5]">&apos;@components/ColorBends&apos;</span>;
        </p>
        <p>&nbsp;</p>
        <p>
          <span className="text-[#c792ea]">function</span>{" "}
          <span className="text-[#a5b4fc]">App</span>() {"{"}
        </p>
        <p className="pl-4">
          <span className="text-[#c792ea]">return</span> (
        </p>
        <p className="pl-8">
          <span className="text-[#a5b4fc]">&lt;ColorBends</span>
        </p>
        <p className="pl-12">
          color=
          <span
            className="mx-1 inline-block size-2.5 rounded-[3px] align-middle transition-colors duration-300"
            style={{ backgroundColor: active.color }}
          />
          <span className="rounded bg-white/10 px-1 text-[#a3e6b5]">
            &quot;{active.color}&quot;
          </span>
        </p>
        {PARAM_CONFIG.map(({ key, min, max, decimals }) => (
          <p key={key} className="pl-12">
            {key}={"{"}
            <DraggableValue
              value={params[key]}
              min={min}
              max={max}
              decimals={decimals}
              onChange={(next) => onParamChange(key, next)}
            />
            {"}"}
          </p>
        ))}
        <p className="pl-8">
          <span className="text-[#a5b4fc]">/&gt;</span>
        </p>
        <p className="pl-4">)</p>
        <p>{"}"}</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-3.5 py-2.5">
        <div className="flex items-center gap-1 rounded-full bg-white/5 p-1">
          {THEME_KEYS.map((key) => {
            const isActive = key === theme;
            const t = WAVE_THEMES[key];
            return (
              <button
                key={key}
                type="button"
                onClick={() => onSelect(key)}
                aria-pressed={isActive}
                aria-label={`Switch wave color to ${t.label}`}
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors duration-200 ${
                  isActive ? "text-white" : "text-white/40 hover:text-white/70"
                }`}
                style={
                  isActive
                    ? {
                        backgroundColor: `${t.color}33`,
                        boxShadow: `inset 0 0 0 1px ${t.color}99`,
                      }
                    : undefined
                }
              >
                {t.label}
              </button>
            );
          })}
        </div>
        <span className="hidden items-center gap-1.5 text-[11px] text-white/30 sm:inline-flex">
          <span aria-hidden="true">↔</span> Drag a value to reshape the wave
        </span>
      </div>
    </div>
  );
}
