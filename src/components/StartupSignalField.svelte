<script lang="ts">
  import { gsap } from "gsap";
  import { onMount } from "svelte";
  import type { StartupSignalPresentation } from "./startup-signal-presentation";

  interface Props {
    signal: StartupSignalPresentation;
  }

  let { signal }: Props = $props();

  // The texture itself must overrun the largest supported content pane.
  // A full-size wrapper is not enough: finite preformatted rows otherwise
  // visibly end early on wide displays even though their element fills 100%.
  const columns = 512;
  const rows = 256;
  const glyphs = "        ....::::++++**xx0011##//\\";

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

  const textures = [asciiField(3), asciiField(11), asciiField(19), asciiField(29)];
  let field: HTMLDivElement | undefined = $state();
  let applySignal = $state<((nextSignal: StartupSignalPresentation) => void) | undefined>();

  type MotionPreference = "normal" | "reduced";
  let motionPreference = $state<MotionPreference>("reduced");

  function motionState(nextSignal: StartupSignalPresentation): string {
    return nextSignal.mode === "resting" ? "resting" : nextSignal.recoveryState;
  }

  function signalEnergy(nextSignal: StartupSignalPresentation): number {
    if (nextSignal.mode === "resting" || nextSignal.recoveryState === "exhausted") return .32;
    if (nextSignal.recoveryState === "retrying") return .52;
    return .78;
  }

  function signalColor(nextSignal: StartupSignalPresentation): string {
    if (nextSignal.recoveryState === "exhausted") return "#779184";
    return "#7cf59d";
  }

  const currentMotionState = $derived(motionState(signal));

  $effect(() => {
    applySignal?.(signal);
  });

  onMount(() => {
    if (!field) return;
    let preference: MotionPreference = "reduced";
    let ambient: gsap.core.Timeline | undefined;
    const media = gsap.matchMedia(field);
    // matchMedia can invoke its callback before gsap.context() returns, so this
    // binding must be initialized before updateTargets can observe it.
    let context: ReturnType<typeof gsap.context> | undefined;
    context = gsap.context(() => {
      const ambientTargets = [
        ".ascii-bed .ascii-texture",
        ".ring-outer",
        ".ring-middle",
        ".ring-inner",
        ".ring-outer .ascii-texture",
        ".ring-middle .ascii-texture",
        ".ring-inner .ascii-texture",
      ];
      const createAmbient = () => {
        ambient = gsap.timeline({ repeat: -1, yoyo: true, defaults: { ease: "sine.inOut" } });
        ambient
          .to(".ascii-bed .ascii-texture", { xPercent: -.65, yPercent: .8, opacity: .8, duration: 15 }, 0)
          .to(".ring-outer", { scale: 1.035, opacity: .72, duration: 8.5 }, 0)
          .to(".ring-middle", { scale: .965, opacity: .58, duration: 6.2 }, 0)
          .to(".ring-inner", { scale: 1.055, opacity: .68, duration: 4.8 }, 0)
          .to(".ring-outer .ascii-texture", { xPercent: -1.8, yPercent: 1.1, rotation: 1.2, duration: 12 }, 0)
          .to(".ring-middle .ascii-texture", { xPercent: 1.4, yPercent: -1.6, rotation: -1.4, duration: 9 }, 0)
          .to(".ring-inner .ascii-texture", { xPercent: -1, yPercent: -1.2, rotation: .9, duration: 7 }, 0);
        return ambient;
      };
      const destroyAmbient = () => {
        ambient?.kill();
        ambient = undefined;
      };
      const updateTargets = (nextSignal: StartupSignalPresentation) => {
        const energy = signalEnergy(nextSignal);
        const forward = nextSignal.forwardPercent;
        const state = motionState(nextSignal);
        const settled = nextSignal.mode === "resting" || nextSignal.recoveryState === "exhausted";
        const targets = [field, ".ring-plane", ".ascii-ring"];
        const values = {
          "--signal-forward": forward,
          "--signal-energy": energy,
          "--signal-phase-color": signalColor(nextSignal),
          "--signal-mask-offset": `${(forward - 85) * .12}%`,
        };

        gsap.killTweensOf(targets);
        if (preference === "reduced") {
          destroyAmbient();
          // Reduced motion is a fixed decorative composition. The semantic
          // status and progress remain owned by the panel outside this field.
          gsap.set(field, {
            "--signal-forward": 0,
            "--signal-energy": .78,
            "--signal-phase-color": "#7cf59d",
            "--signal-mask-offset": "0%",
          });
          gsap.set(".ring-plane", { xPercent: -50, yPercent: -50, rotation: 0, scale: 1 });
          gsap.set(".ascii-ring", { "--ring-energy": .78 });
          gsap.set(ambientTargets, { clearProps: "transform,opacity" });
          return;
        }

        if (settled) {
          // Context owns every field tween, including a previously-created
          // ambient timeline. Killing the scoped set prevents an old loop
          // from continuing after this terminal state has been rendered.
          destroyAmbient();
          context?.getTweens().forEach((tween) => tween.kill());
          gsap.to(field, { ...values, duration: .32, ease: "sine.out", overwrite: true });
          gsap.to(".ring-plane", {
            rotation: (forward - 85) * .08,
            scale: .94 + energy * .06,
            duration: .32,
            ease: "sine.out",
            overwrite: true,
          });
          gsap.to(".ascii-ring", { "--ring-energy": energy, duration: .32, ease: "sine.out", overwrite: true });
          gsap.to(".ascii-bed .ascii-texture", { xPercent: 0, yPercent: 0, rotation: 0, opacity: .64, duration: .32, ease: "sine.out", overwrite: true });
          gsap.to(".ring-outer", { scale: 1, opacity: .62, duration: .32, ease: "sine.out", overwrite: true });
          gsap.to(".ring-middle", { scale: 1, opacity: .5, duration: .32, ease: "sine.out", overwrite: true });
          gsap.to(".ring-inner", { scale: 1, opacity: .58, duration: .32, ease: "sine.out", overwrite: true });
          gsap.to(".ring-outer .ascii-texture", { xPercent: 0, yPercent: 0, rotation: 0, duration: .32, ease: "sine.out", overwrite: true });
          gsap.to(".ring-middle .ascii-texture", { xPercent: 0, yPercent: 0, rotation: 0, duration: .32, ease: "sine.out", overwrite: true });
          gsap.to(".ring-inner .ascii-texture", { xPercent: 0, yPercent: 0, rotation: 0, duration: .32, ease: "sine.out", overwrite: true });
          return;
        }

        const activeAmbient = ambient ?? createAmbient();
        activeAmbient.play();
        gsap.to(field, { ...values, duration: .32, ease: "sine.out", overwrite: true });
        gsap.to(".ring-plane", {
          rotation: (forward - 85) * .08,
          scale: .94 + energy * .06,
          duration: state === "retrying" ? .4 : .28,
          ease: "sine.out",
          overwrite: true,
        });
        gsap.to(".ascii-ring", { "--ring-energy": energy, duration: .28, ease: "sine.out", overwrite: true });
        gsap.to(activeAmbient, { timeScale: energy, duration: .28, ease: "sine.out", overwrite: true });
      };

      media.add("(prefers-reduced-motion: reduce)", () => {
        preference = "reduced";
        motionPreference = "reduced";
        destroyAmbient();
        gsap.killTweensOf([field, ".ring-plane", ".ascii-ring"]);
        updateTargets(signal);
      });
      media.add("(prefers-reduced-motion: no-preference)", () => {
        preference = "normal";
        motionPreference = "normal";
        gsap.set(".ascii-ring", { transformOrigin: "50% 50%" });
        gsap.set(".ascii-texture", { transformOrigin: "50% 50%" });
        gsap.set(".ring-plane", { xPercent: -50, yPercent: -50 });
        createAmbient();
        updateTargets(signal);
        return () => {
          destroyAmbient();
        };
      });

      applySignal = (nextSignal) => context?.add(() => updateTargets(nextSignal));
    }, field);
    applySignal(signal);

    return () => {
      applySignal = undefined;
      media.revert();
      context?.revert();
    };
  });
</script>

<div
  bind:this={field}
  class="signal-field"
  aria-hidden="true"
  data-testid="startup-ascii-field"
  data-phase={signal.phase}
  data-recovery-state={signal.recoveryState}
  data-motion-state={currentMotionState}
  data-motion-preference={motionPreference}
  data-forward-target={signal.forwardPercent}
  data-mode={signal.mode}
  style="--signal-forward: 0; --signal-energy: .78; --signal-phase-color: #7cf59d; --signal-mask-offset: 0%;"
>
  <div class="ascii-bed"><pre class="ascii-texture">{textures[0]}</pre></div>
  <div class="ring-plane">
    <div class="ascii-ring ring-outer"><pre class="ascii-texture">{textures[1]}</pre></div>
    <div class="ascii-ring ring-middle"><pre class="ascii-texture">{textures[2]}</pre></div>
    <div class="ascii-ring ring-inner"><pre class="ascii-texture">{textures[3]}</pre></div>
  </div>
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
    opacity: calc(.08 + var(--signal-energy) * .12);
    -webkit-mask-image: radial-gradient(ellipse at center, rgb(0 0 0 / .2) 0%, rgb(0 0 0 / .42) 34%, #000 68%, rgb(0 0 0 / .12) 100%);
    mask-image: radial-gradient(ellipse at center, rgb(0 0 0 / .2) 0%, rgb(0 0 0 / .42) 34%, #000 68%, rgb(0 0 0 / .12) 100%);
  }

  .ring-plane {
    position: absolute;
    top: 50%;
    left: 50%;
    width: min(52rem, 96vmin);
    aspect-ratio: 1;
    transform: translate(-50%, -50%);
    will-change: transform;
  }

  .ascii-ring {
    position: absolute;
    inset: 4%;
    overflow: hidden;
    --ring-energy: .78;
    opacity: calc(.16 + var(--ring-energy) * .46);
    -webkit-mask-position: calc(50% + var(--signal-mask-offset)) center;
    -webkit-mask-repeat: no-repeat;
    -webkit-mask-size: 100% 100%;
    mask-position: calc(50% + var(--signal-mask-offset)) center;
    mask-repeat: no-repeat;
    mask-size: 100% 100%;
  }

  .ring-outer {
    -webkit-mask-image: radial-gradient(circle, transparent 0 47.1%, #000 47.45% 48.15%, transparent 48.5%);
    mask-image: radial-gradient(circle, transparent 0 47.1%, #000 47.45% 48.15%, transparent 48.5%);
  }

  .ring-middle {
    -webkit-mask-image: radial-gradient(circle, transparent 0 35.3%, #000 35.7% 36.55%, transparent 36.95%);
    mask-image: radial-gradient(circle, transparent 0 35.3%, #000 35.7% 36.55%, transparent 36.95%);
  }

  .ring-inner {
    -webkit-mask-image: radial-gradient(circle, transparent 0 23.1%, #000 23.55% 24.65%, transparent 25.05%);
    mask-image: radial-gradient(circle, transparent 0 23.1%, #000 23.55% 24.65%, transparent 25.05%);
  }

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
    text-shadow: 0 0 8px rgb(124 245 157 / .24);
    white-space: pre;
  }

  .ascii-bed .ascii-texture { color: #477d55; text-shadow: none; }
  .ring-middle .ascii-texture { color: #539a66; }
  .ring-inner .ascii-texture { color: #82d895; }

  @media (prefers-reduced-motion: reduce) {
    .ascii-ring, .ascii-texture { transform: none !important; }
  }
</style>
