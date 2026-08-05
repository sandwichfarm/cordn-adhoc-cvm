<script lang="ts">
  import { gsap } from "gsap";
  import { onMount } from "svelte";
  import { startupProgressTweenDuration } from "./startup-progress-motion";

  interface Props {
    targetPercent: number;
    displayValue?: string;
    retrying?: boolean;
    ariaLabel: string;
    ariaValueText: string;
  }

  let {
    targetPercent,
    displayValue,
    retrying = false,
    ariaLabel,
    ariaValueText,
  }: Props = $props();

  let root: HTMLDivElement | undefined = $state();
  let fillElement: HTMLSpanElement | undefined = $state();
  let applyProgress = $state<((percent: number, value: string | undefined) => void) | undefined>();
  let renderedPercent = $state(0);
  let renderedValue = $state("0%");
  const semanticPercent = $derived(Math.round(Math.min(100, Math.max(0, targetPercent))));

  $effect(() => {
    applyProgress?.(semanticPercent, displayValue);
  });

  onMount(() => {
    if (!root || !fillElement) return;

    const state = { percent: 0 };
    let tween: gsap.core.Timeline | undefined;
    const media = gsap.matchMedia();
    const context = gsap.context(() => {
      const render = (value: string | undefined) => {
        renderedPercent = state.percent;
        renderedValue = value ?? `${Math.round(state.percent)}%`;
      };

      const update = (percent: number, value: string | undefined, reduced = false) => {
        const next = gsap.utils.clamp(0, 100, percent);
        tween?.kill();

        if (reduced) {
          state.percent = next;
          gsap.set(fillElement, { scaleX: next / 100 });
          render(value);
          return;
        }

        const duration = startupProgressTweenDuration(state.percent, next);
        tween = gsap.timeline({ defaults: { overwrite: "auto" } })
          .to(state, {
            percent: next,
            duration,
            ease: next >= 80 ? "sine.inOut" : "power1.inOut",
            onUpdate: () => render(value),
            onComplete: () => render(value),
          }, 0)
          .to(fillElement, {
            scaleX: next / 100,
            duration,
            ease: next >= 80 ? "sine.inOut" : "power1.inOut",
          }, 0);
      };

      media.add("(prefers-reduced-motion: reduce)", () => {
        applyProgress = (percent, value) => update(percent, value, true);
        applyProgress(semanticPercent, displayValue);
      });
      media.add("(prefers-reduced-motion: no-preference)", () => {
        applyProgress = (percent, value) => update(percent, value, false);
        applyProgress(semanticPercent, displayValue);
      });
    }, root);

    return () => {
      applyProgress = undefined;
      tween?.kill();
      media.revert();
      context.revert();
    };
  });
</script>

<div
  bind:this={root}
  class="startup-progress-meter"
  data-progress-target={semanticPercent}
  style={`--startup-rendered-progress: ${renderedPercent.toFixed(2)};`}
>
  <span
    class:retrying
    class="startup-progress-value"
    data-testid="startup-progress-value"
    aria-hidden="true"
  >{renderedValue}</span>
  <div
    class="startup-progress-track"
    role="progressbar"
    aria-label={ariaLabel}
    aria-valuemin="0"
    aria-valuemax="100"
    aria-valuenow={semanticPercent}
    aria-valuetext={ariaValueText}
  >
    <span bind:this={fillElement}></span>
  </div>
</div>

<style>
  .startup-progress-meter { display: contents; }
  .startup-progress-value {
    flex: 0 0 auto;
    color: #e8f5eb;
    font-size: .72rem;
    font-variant-numeric: tabular-nums;
  }
  .startup-progress-value.retrying { color: #e4e78d; }
  .startup-progress-track {
    position: relative;
    grid-column: 1 / -1;
    height: .28rem;
    margin-top: .7rem;
    overflow: hidden;
    background: #1a2820;
  }
  .startup-progress-track::after {
    position: absolute;
    inset: 0;
    background: repeating-linear-gradient(90deg, transparent 0 calc(20% - 1px), rgb(6 12 8 / .72) calc(20% - 1px) 20%);
    content: "";
  }
  .startup-progress-track > span {
    display: block;
    width: 100%;
    height: 100%;
    transform: scaleX(0);
    transform-origin: 0 50%;
    background: linear-gradient(90deg, #4cae67, #7cf59d);
    box-shadow: 0 0 12px rgb(124 245 157 / .24);
    will-change: transform;
  }
</style>
