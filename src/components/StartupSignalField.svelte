<script lang="ts">
  import { gsap } from "gsap";
  import { onMount } from "svelte";
  import type { StartupSignalPresentation } from "./startup-signal-presentation";
  import { startupProgressTweenDuration } from "./startup-progress-motion";

  interface Props {
    signal: StartupSignalPresentation;
  }

  let { signal }: Props = $props();

  // The texture overruns the largest supported content pane so no preformatted
  // edge can become visible while its layer drifts.
  const columns = 512;
  const rows = 256;
  const glyphs = "        ....::::++++**xx0011##//\\";
  const rippleShapes = [
    { cx: 486, cy: 510, rx: 448, ry: 421 },
    { cx: 507, cy: 494, rx: 374, ry: 349 },
    { cx: 491, cy: 506, rx: 300, ry: 282 },
    { cx: 513, cy: 487, rx: 234, ry: 216 },
    { cx: 496, cy: 511, rx: 174, ry: 157 },
    { cx: 509, cy: 497, rx: 112, ry: 101 },
  ];

  function asciiField(seed: number): string {
    let state = seed * 0x9e3779b1;
    const next = () => {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      return state >>> 0;
    };
    return Array.from({ length: rows }, () =>
      Array.from({ length: columns }, () => glyphs[next() % glyphs.length]).join("")
    ).join("\n");
  }

  const textures = [asciiField(3), asciiField(19)];
  const rippleLines = textures[1].split("\n");
  let field: HTMLDivElement | undefined = $state();
  let applySignal = $state<((nextSignal: StartupSignalPresentation) => void) | undefined>();

  type MotionPreference = "normal" | "reduced";
  let motionPreference = $state<MotionPreference>("reduced");

  function motionState(nextSignal: StartupSignalPresentation): string {
    return nextSignal.mode === "resting" ? "resting" : nextSignal.recoveryState;
  }

  function signalEnergy(nextSignal: StartupSignalPresentation): number {
    if (nextSignal.mode === "resting" || nextSignal.recoveryState === "exhausted") return .26;
    if (nextSignal.recoveryState === "retrying") return .58;
    return .76;
  }

  function signalColor(nextSignal: StartupSignalPresentation): string {
    return nextSignal.recoveryState === "exhausted" ? "#779184" : "#7cf59d";
  }

  const currentMotionState = $derived(motionState(signal));

  $effect(() => {
    applySignal?.(signal);
  });

  onMount(() => {
    if (!field) return;

    let preference: MotionPreference = "reduced";
    let ambient: gsap.core.Timeline | undefined;
    let disturbance: gsap.core.Timeline | undefined;
    let renderedForward = 0;
    let lastDisturbanceKey = "";
    const media = gsap.matchMedia();

    const destroyMotion = () => {
      ambient?.kill();
      disturbance?.kill();
      ambient = undefined;
      disturbance = undefined;
    };

    const context = gsap.context(() => {
      const createAmbient = () => {
        ambient?.kill();
        ambient = gsap.timeline({ repeat: -1, yoyo: true, defaults: { ease: "sine.inOut" } });
        ambient
          .to(".ascii-bed .ascii-texture", { xPercent: -.55, yPercent: .7, opacity: .78, duration: 15 }, 0)
          .to(".ripple-plane", { rotation: .65, scale: 1.018, duration: 10.5 }, 0)
          .to(".ripple-mask-lines", { x: 7, y: -5, rotation: -.45, duration: 8.5 }, 0)
          .to(".ripple-traces", { x: -5, y: 7, rotation: .35, duration: 7.5 }, 0)
          .to(".ripple-texture", { x: -14, y: 11, rotation: -.28, duration: 12 }, 0)
          .to(".ripple-noise", { attr: { baseFrequency: ".009 .014" }, duration: 9 }, 0)
          .to(".ripple-displacement", { attr: { scale: 24 }, duration: 6.5 }, 0);
        return ambient;
      };

      const launchDisturbance = (nextSignal: StartupSignalPresentation, delta: number) => {
        const key = `${nextSignal.phase}:${nextSignal.recoveryState}:${nextSignal.completed}:${nextSignal.forwardPercent}`;
        if (key === lastDisturbanceKey) return;
        lastDisturbanceKey = key;
        disturbance?.kill();

        const angle = (nextSignal.forwardPercent * 2.7 + nextSignal.phase.length * 19) * Math.PI / 180;
        const offsetX = Math.cos(angle) * (13 + Math.min(delta, 60) * .13);
        const offsetY = Math.sin(angle) * (10 + Math.min(delta, 60) * .1);
        const impactScale = 34 + Math.min(delta, 60) * .42;
        const origin = `${500 + offsetX * 2} ${500 + offsetY * 2}`;

        disturbance = gsap.timeline({ defaults: { overwrite: "auto" } });
        disturbance
          .addLabel("impact")
          .set(".ripple-contour", { transformOrigin: origin }, "impact")
          .set(".ripple-source", { x: offsetX * -1.4, y: offsetY * -1.4, scale: .4, opacity: 0 }, "impact")
          .to(".ripple-source", { x: offsetX, y: offsetY, scale: 2.2, opacity: .36, duration: .34, ease: "power2.out" }, "impact")
          .to(".ripple-displacement", { attr: { scale: impactScale }, duration: .38, ease: "power2.out" }, "impact")
          .to(".ripple-noise", { attr: { baseFrequency: ".014 .023" }, duration: .42, ease: "sine.out" }, "impact")
          .to([".ripple-mask-lines", ".ripple-traces"], {
            x: offsetX,
            y: offsetY,
            rotation: offsetX * .045,
            duration: .52,
            ease: "power2.out",
          }, "impact")
          .to(".ripple-contour", {
            scale: (index) => 1.012 + (index % rippleShapes.length) * .008,
            duration: .9,
            stagger: { each: .035, from: "end" },
            ease: "sine.out",
          }, "impact+=.06")
          .to(".ripple-source", { scale: 3.2, opacity: 0, duration: .9, ease: "power2.out" }, "impact+=.3")
          .to(".ripple-contour", {
            scale: 1,
            duration: 1.45,
            stagger: { each: .025, from: "end" },
            ease: "sine.inOut",
          }, "impact+=.7")
          .to([".ripple-mask-lines", ".ripple-traces"], {
            x: 0,
            y: 0,
            rotation: 0,
            duration: 1.5,
            ease: "sine.inOut",
          }, "impact+=.72")
          .to(".ripple-displacement", { attr: { scale: 18 }, duration: 1.6, ease: "sine.inOut" }, "impact+=.7")
          .to(".ripple-noise", { attr: { baseFrequency: ".008 .012" }, duration: 1.7, ease: "sine.inOut" }, "impact+=.68");
      };

      const updateTargets = (nextSignal: StartupSignalPresentation) => {
        const energy = signalEnergy(nextSignal);
        const forward = gsap.utils.clamp(0, 100, nextSignal.forwardPercent);
        const delta = Math.abs(forward - renderedForward);
        const settled = nextSignal.mode === "resting" || nextSignal.recoveryState === "exhausted";
        const duration = startupProgressTweenDuration(renderedForward, forward);
        const progressState = { value: renderedForward };

        if (preference === "reduced") {
          destroyMotion();
          renderedForward = forward;
          gsap.set(field, {
            "--signal-forward": forward,
            "--signal-energy": .7,
            "--signal-phase-color": signalColor(nextSignal),
          });
          gsap.set([".ripple-plane", ".ripple-mask-lines", ".ripple-traces", ".ripple-texture"], {
            x: 0,
            y: 0,
            rotation: 0,
            scale: 1,
          });
          gsap.set(".ripple-contour", { scale: 1 });
          gsap.set(".ripple-noise", { attr: { baseFrequency: ".008 .012" } });
          gsap.set(".ripple-displacement", { attr: { scale: 18 } });
          return;
        }

        if (settled) {
          destroyMotion();
          gsap.to(progressState, {
            value: forward,
            duration: Math.min(duration, .8),
            ease: "sine.out",
            overwrite: true,
            onUpdate: () => { renderedForward = progressState.value; },
          });
          gsap.to(field, {
            "--signal-forward": forward,
            "--signal-energy": energy,
            "--signal-phase-color": signalColor(nextSignal),
            duration: .8,
            ease: "sine.out",
            overwrite: true,
          });
          gsap.to(".ripple-plane", { scale: .985, rotation: 0, duration: .8, ease: "sine.out", overwrite: true });
          gsap.to(".ripple-displacement", { attr: { scale: 12 }, duration: .8, ease: "sine.out", overwrite: true });
          gsap.to(".ripple-traces", { opacity: .18, duration: .8, ease: "sine.out", overwrite: true });
          return;
        }

        (ambient ?? createAmbient()).play();
        gsap.to(progressState, {
          value: forward,
          duration,
          ease: forward >= 80 ? "sine.inOut" : "power1.inOut",
          overwrite: true,
          onUpdate: () => { renderedForward = progressState.value; },
        });
        gsap.to(field, {
          "--signal-forward": forward,
          "--signal-energy": energy,
          "--signal-phase-color": signalColor(nextSignal),
          duration,
          ease: forward >= 80 ? "sine.inOut" : "power1.inOut",
          overwrite: true,
        });
        gsap.to(".ripple-plane", {
          scale: .97 + energy * .055,
          duration: Math.min(duration, 1.4),
          ease: "sine.out",
          overwrite: "auto",
        });
        gsap.to(ambient, { timeScale: .72 + energy * .42, duration: .5, ease: "sine.out", overwrite: true });
        launchDisturbance(nextSignal, delta);
      };

      media.add("(prefers-reduced-motion: reduce)", () => {
        preference = "reduced";
        motionPreference = "reduced";
        updateTargets(signal);
      });
      media.add("(prefers-reduced-motion: no-preference)", () => {
        preference = "normal";
        motionPreference = "normal";
        gsap.set(".ripple-plane", { transformOrigin: "50% 50%" });
        gsap.set([".ripple-mask-lines", ".ripple-traces", ".ripple-contour"], { transformOrigin: "50% 50%" });
        createAmbient();
        updateTargets(signal);
        return destroyMotion;
      });

      applySignal = (nextSignal) => context.add(() => updateTargets(nextSignal));
    }, field);

    applySignal(signal);

    return () => {
      applySignal = undefined;
      destroyMotion();
      media.revert();
      context.revert();
    };
  });
</script>

<div
  bind:this={field}
  class="signal-field"
  aria-hidden="true"
  data-testid="startup-ascii-field"
  data-visual="fluid-ripples"
  data-phase={signal.phase}
  data-recovery-state={signal.recoveryState}
  data-motion-state={currentMotionState}
  data-motion-preference={motionPreference}
  data-forward-target={signal.forwardPercent}
  data-mode={signal.mode}
  style="--signal-forward: 0; --signal-energy: .76; --signal-phase-color: #7cf59d;"
>
  <div class="ascii-bed"><pre class="ascii-texture">{textures[0]}</pre></div>

  <svg class="ripple-plane" viewBox="0 0 1000 1000" focusable="false" role="presentation">
    <defs>
      <filter id="startup-fluid-displacement" x="-18%" y="-18%" width="136%" height="136%" color-interpolation-filters="sRGB">
        <feTurbulence class="ripple-noise" type="fractalNoise" baseFrequency=".008 .012" numOctaves="2" seed="19" result="noise" />
        <feGaussianBlur in="noise" stdDeviation="1.15" result="soft-noise" />
        <feDisplacementMap class="ripple-displacement" in="SourceGraphic" in2="soft-noise" scale="18" xChannelSelector="R" yChannelSelector="B" />
      </filter>
      <radialGradient id="startup-ripple-wash">
        <stop offset="0" stop-color="#7cf59d" stop-opacity=".04" />
        <stop offset=".52" stop-color="#5cbd75" stop-opacity=".08" />
        <stop offset="1" stop-color="#7cf59d" stop-opacity="0" />
      </radialGradient>
      <mask id="startup-ripple-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="1000" height="1000" style="mask-type: luminance;">
        <rect width="1000" height="1000" fill="black" />
        <g class="ripple-mask-lines" filter="url(#startup-fluid-displacement)">
          {#each rippleShapes as shape, index (shape.rx)}
            <ellipse
              class={`ripple-contour ripple-contour-${index}`}
              cx={shape.cx}
              cy={shape.cy}
              rx={shape.rx}
              ry={shape.ry}
              fill="none"
              stroke="white"
              stroke-width={index < 2 ? 13 : 10}
              opacity={.32 + index * .075}
            />
          {/each}
          <circle class="ripple-source" cx="500" cy="500" r="42" fill="white" opacity=".16" />
        </g>
      </mask>
    </defs>

    <circle class="ripple-wash" cx="500" cy="500" r="470" fill="url(#startup-ripple-wash)" />
    <g class="ripple-ascii-layer" mask="url(#startup-ripple-mask)">
      <g class="ripple-texture">
        {#each rippleLines as line, index (index)}
          <text class="ripple-glyph-line" x="-720" y={index * 9 - 650}>{line}</text>
        {/each}
      </g>
    </g>
    <g class="ripple-traces" filter="url(#startup-fluid-displacement)">
      {#each rippleShapes as shape, index (shape.rx)}
        <ellipse
          class={`ripple-contour ripple-contour-${index}`}
          cx={shape.cx}
          cy={shape.cy}
          rx={shape.rx}
          ry={shape.ry}
          fill="none"
          stroke="var(--signal-phase-color)"
          stroke-width={index < 2 ? 1.5 : 1.1}
          opacity={.12 + index * .025}
        />
      {/each}
    </g>
  </svg>
</div>

<style>
  .signal-field {
    position: absolute;
    z-index: 0;
    inset: 0;
    overflow: hidden;
    pointer-events: none;
    contain: strict;
  }

  .ascii-bed {
    position: absolute;
    inset: -6%;
    overflow: hidden;
    opacity: calc(.025 + var(--signal-energy) * .055);
    -webkit-mask-image: radial-gradient(ellipse at center, rgb(0 0 0 / .16) 0%, rgb(0 0 0 / .36) 37%, #000 72%, rgb(0 0 0 / .1) 100%);
    mask-image: radial-gradient(ellipse at center, rgb(0 0 0 / .16) 0%, rgb(0 0 0 / .36) 37%, #000 72%, rgb(0 0 0 / .1) 100%);
  }

  .ripple-plane {
    position: absolute;
    top: 50%;
    left: 50%;
    width: min(60rem, 112vmin);
    max-width: none;
    aspect-ratio: 1;
    overflow: visible;
    transform: translate(-50%, -50%);
    will-change: transform;
  }

  .ripple-ascii-layer { opacity: calc(.32 + var(--signal-energy) * .62); }
  .ripple-wash { opacity: calc(.3 + var(--signal-energy) * .34); }
  .ripple-traces {
    opacity: calc(.32 + var(--signal-energy) * .48);
    mix-blend-mode: screen;
    will-change: transform, opacity;
  }
  .ripple-mask-lines, .ripple-contour, .ripple-source, .ripple-texture { will-change: transform; }

  .ascii-texture {
    position: absolute;
    inset: -8%;
    width: 116%;
    height: 116%;
    overflow: hidden;
    margin: 0;
    color: var(--signal-phase-color);
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: clamp(5px, .82vmin, 8px);
    font-weight: 600;
    line-height: 1.24;
    letter-spacing: .08em;
    text-align: left;
    text-shadow: 0 0 8px rgb(124 245 157 / .22);
    white-space: pre;
  }

  .ascii-bed .ascii-texture { color: #477d55; text-shadow: none; }
  .ripple-glyph-line {
    fill: var(--signal-phase-color);
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 8px;
    font-weight: 650;
    letter-spacing: .35px;
    white-space: pre;
  }

  @media (prefers-reduced-motion: reduce) {
    .ascii-texture, .ripple-plane, .ripple-mask-lines, .ripple-traces, .ripple-contour { transform: none !important; }
  }
</style>
