<script lang="ts">
  import { gsap } from "gsap";
  import { onMount } from "svelte";
  import type { StartupSignalPresentation } from "./startup-signal-presentation";

  interface Props {
    signal: StartupSignalPresentation;
  }

  let { signal }: Props = $props();

  const columns = 210;
  const rows = 112;
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

  onMount(() => {
    if (!field) return;
    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      const context = gsap.context(() => {
        gsap.set(".ascii-ring", { transformOrigin: "50% 50%" });
        gsap.set(".ascii-texture", { transformOrigin: "50% 50%" });

        gsap.to(".ascii-bed .ascii-texture", {
          xPercent: -.65,
          yPercent: .8,
          opacity: .8,
          duration: 15,
          ease: "sine.inOut",
          repeat: -1,
          yoyo: true,
        });

        gsap.to(".ring-outer", {
          scale: 1.035,
          opacity: .72,
          duration: 8.5,
          ease: "sine.inOut",
          repeat: -1,
          yoyo: true,
        });
        gsap.to(".ring-middle", {
          scale: .965,
          opacity: .58,
          duration: 6.2,
          ease: "sine.inOut",
          repeat: -1,
          yoyo: true,
        });
        gsap.to(".ring-inner", {
          scale: 1.055,
          opacity: .68,
          duration: 4.8,
          ease: "sine.inOut",
          repeat: -1,
          yoyo: true,
        });
        gsap.to(".ring-outer .ascii-texture", {
          xPercent: -1.8,
          yPercent: 1.1,
          rotation: 1.2,
          duration: 12,
          ease: "sine.inOut",
          repeat: -1,
          yoyo: true,
        });
        gsap.to(".ring-middle .ascii-texture", {
          xPercent: 1.4,
          yPercent: -1.6,
          rotation: -1.4,
          duration: 9,
          ease: "sine.inOut",
          repeat: -1,
          yoyo: true,
        });
        gsap.to(".ring-inner .ascii-texture", {
          xPercent: -1,
          yPercent: -1.2,
          rotation: .9,
          duration: 7,
          ease: "sine.inOut",
          repeat: -1,
          yoyo: true,
        });
        gsap.to(".field-glow", {
          scale: 1.12,
          opacity: .8,
          duration: 5.5,
          ease: "sine.inOut",
          repeat: -1,
          yoyo: true,
        });
      }, field);
      return () => context.revert();
    });
    return () => media.revert();
  });
</script>

<div
  bind:this={field}
  class="signal-field"
  aria-hidden="true"
  data-testid="startup-ascii-field"
  data-phase={signal.phase}
  data-recovery-state={signal.recoveryState}
  data-forward-target={signal.forwardPercent}
  data-mode={signal.mode}
  style={`--signal-forward-target: ${signal.forwardPercent}`}
>
  <div class="field-glow"></div>
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

  .field-glow {
    position: absolute;
    top: 50%;
    left: 50%;
    width: min(44rem, 84vmin);
    aspect-ratio: 1;
    border-radius: 50%;
    background: radial-gradient(circle, rgb(65 126 81 / .13), rgb(31 69 43 / .045) 48%, transparent 72%);
    filter: blur(18px);
    opacity: .52;
    transform: translate(-50%, -50%);
  }

  .ascii-bed {
    position: absolute;
    inset: -6%;
    overflow: hidden;
    opacity: .17;
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
  }

  .ascii-ring {
    position: absolute;
    inset: 4%;
    overflow: hidden;
    opacity: .52;
    -webkit-mask-position: center;
    -webkit-mask-repeat: no-repeat;
    -webkit-mask-size: 100% 100%;
    mask-position: center;
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
    color: #6fbd82;
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
    .ascii-ring, .ascii-texture, .field-glow { transform: none !important; }
  }
</style>
