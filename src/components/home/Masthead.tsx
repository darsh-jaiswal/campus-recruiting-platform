"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import ColorBends from "@/components/ColorBends";
import DotField from "@/components/DotField";
import { ButtonLink } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { EDITION, SITE } from "@/lib/content";
import {
  DEFAULT_WAVE_PARAMS,
  DEFAULT_WAVE_THEME,
  HeroDemoPanel,
  WAVE_THEMES,
  type WaveParams,
  type WaveThemeKey,
} from "./HeroDemoPanel";
import { useMediaQuery } from "./useMediaQuery";

/**
 * The masthead — the first screen. Deliberately holds no <h1>; the page's
 * one first-level heading belongs to the section below, which carries the
 * actual proposition ("The industry interviews here."). The large "Aspire
 * Quest" line below is a styled wordmark (a <p>, not a heading element), so
 * it doesn't compete with that h1.
 */
export function Masthead() {
  const [waveTheme, setWaveTheme] = useState<WaveThemeKey>(DEFAULT_WAVE_THEME);
  const [params, setParams] = useState<WaveParams>(DEFAULT_WAVE_PARAMS);
  const activeColor = WAVE_THEMES[waveTheme].color;

  // The wave/dot background is a real WebGL shader plus a full-canvas dot
  // grid, both animating every frame — expensive enough that leaving them
  // running after the visitor scrolls past costs frame budget site-wide for
  // no visible benefit. Pause both once this section leaves the viewport,
  // and skip them outright for a visitor who has asked for less motion.
  const sectionRef = useRef<HTMLElement>(null);
  const [inView, setInView] = useState(true);
  const prefersReducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0 },
    );
    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  const animationsPaused = !inView || prefersReducedMotion;

  const handleParamChange = (key: keyof WaveParams, value: number) => {
    setParams((prev) => ({ ...prev, [key]: value }));
  };

  const handleReset = () => {
    setWaveTheme(DEFAULT_WAVE_THEME);
    setParams(DEFAULT_WAVE_PARAMS);
  };

  return (
    <section
      ref={sectionRef}
      aria-label={`${SITE.parentEvent} — ${SITE.name}`}
      className="relative flex min-h-svh flex-col justify-end overflow-hidden bg-ink pb-8 pt-28 text-paper [--color-focus:var(--color-paper)] sm:pb-12"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          /* Fades the whole background layer (dots + wave) out over the
             bottom ~45% of the section, so it dissolves into the plain
             `bg-surface` of the next section instead of cutting off in a
             hard line at the section boundary — both resolve to the same
             #0d0d0d ink in the noir scope, so the reveal is seamless. */
          maskImage: "linear-gradient(to bottom, black 0%, black 55%, transparent 98%)",
          WebkitMaskImage:
            "linear-gradient(to bottom, black 0%, black 55%, transparent 98%)",
        }}
      >
        <DotField
          dotRadius={1.5}
          dotSpacing={14}
          cursorRadius={500}
          cursorForce={0.1}
          bulgeOnly
          bulgeStrength={67}
          glowRadius={160}
          sparkle={false}
          waveAmplitude={0}
          paused={animationsPaused}
        />
        {/* Fades the glow band out toward the top, so it doesn't fight the
            header — `fadeTop` (visitor-adjustable in the demo panel) sets
            where that fade starts. It isn't a real ColorBends prop; React
            Bits' own demo uses it to mean the same thing, so the panel
            names it that even though ours is a CSS mask, not a shader
            uniform. */}
        <div
          className="absolute inset-0"
          style={{
            maskImage: `linear-gradient(to top, black ${params.fadeTop * 100}%, transparent 100%)`,
            WebkitMaskImage: `linear-gradient(to top, black ${params.fadeTop * 100}%, transparent 100%)`,
          }}
        >
          <ColorBends
            colors={[activeColor]}
            speed={params.speed}
            frequency={params.frequency}
            noise={params.noise}
            bandWidth={params.bandWidth}
            rotation={params.rotation}
            iterations={params.iterations}
            intensity={params.intensity}
            scale={2}
            paused={animationsPaused}
          />
        </div>
      </div>

      <Container className="relative">
        <div className="flex flex-col gap-10 pt-6 lg:flex-row lg:items-end lg:justify-between lg:gap-14">
          <div className="flex max-w-xl flex-col gap-6">
            <p className="text-display font-semibold text-paper">
              {SITE.name}
            </p>

            <div className="flex flex-wrap items-center gap-3">
              {/* Custom, not ButtonLink: this is the one CTA whose fill
                  tracks the visitor-selected wave color (mirroring React
                  Bits' own "Browse Components" button), so it can't use a
                  fixed variant — same base sizing as Button.tsx's BASE. */}
              <Link
                href="/register"
                className="inline-flex items-center justify-center gap-2 rounded border border-transparent px-5 py-3 text-sm font-semibold tracking-tight text-white transition-all duration-300 hover:brightness-110 active:translate-y-px"
                style={{
                  backgroundColor: activeColor,
                  boxShadow: `0 0 24px -6px ${activeColor}99`,
                }}
              >
                For Students
              </Link>

              <ButtonLink href="/partners" variant="outline-invert">
                For Recruiters
              </ButtonLink>
            </div>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <p className="flex items-center gap-2.5 text-eyebrow font-semibold uppercase">
                <span
                  aria-hidden="true"
                  className="size-1.5 rounded-full bg-paper"
                />
                {EDITION.label}
                <span className="font-normal text-paper/45">
                  · {EDITION.dateLabel}
                </span>
              </p>

              <p className="text-eyebrow uppercase text-paper/45">
                Scroll for the detail
              </p>
            </div>
          </div>

          <div className="w-full lg:max-w-sm">
            <HeroDemoPanel
              theme={waveTheme}
              onSelect={setWaveTheme}
              params={params}
              onParamChange={handleParamChange}
              onReset={handleReset}
            />
          </div>
        </div>
      </Container>
    </section>
  );
}
