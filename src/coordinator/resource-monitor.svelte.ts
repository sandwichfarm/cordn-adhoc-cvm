import type { RunningTransport } from "../lib/transport";

type TransportEventSource = {
  on?: (event: string, handler: () => void) => unknown;
  off?: (event: string, handler: () => void) => unknown;
  removeListener?: (event: string, handler: () => void) => unknown;
};

type BrowserPerformance = Performance & {
  memory?: {
    usedJSHeapSize: number;
  };
};

export class ResourceMonitor {
  subscriptionCount = $state(0);
  messageRate = $state(0);
  memoryBytes = $state<number | null>(null);

  private messageTimes: number[] = [];
  private rateTimer: ReturnType<typeof setInterval> | null = null;
  private cleanupHandlers: Array<() => void> = [];

  start(transport: RunningTransport): void {
    this.stop();
    this.bindTransportEvents(transport.transport as TransportEventSource);
    if (typeof transport.adapter.setTelemetrySink === "function") {
      transport.adapter.setTelemetrySink({
        recordOperation: () => this.recordMessage(),
        setActiveSubscriptions: (count) => {
          this.subscriptionCount = count;
        },
      });
      this.cleanupHandlers.push(() => transport.adapter.setTelemetrySink());
    }
    this.readMemory();
    this.updateRate();
    this.rateTimer = setInterval(() => {
      this.updateRate();
      this.readMemory();
    }, 5_000);
  }

  stop(): void {
    this.cleanupHandlers.forEach((cleanup) => cleanup());
    this.cleanupHandlers = [];

    if (this.rateTimer) {
      clearInterval(this.rateTimer);
      this.rateTimer = null;
    }

    this.messageTimes = [];
    this.subscriptionCount = 0;
    this.messageRate = 0;
    this.memoryBytes = null;
  }

  private bindTransportEvents(source: TransportEventSource): void {
    this.bind(source, "subscribed", () => {
      this.subscriptionCount += 1;
    });
    this.bind(source, "unsubscribed", () => {
      this.subscriptionCount = Math.max(0, this.subscriptionCount - 1);
    });
    ["message", "event", "request"].forEach((event) => {
      this.bind(source, event, () => this.recordMessage());
    });
  }

  private bind(source: TransportEventSource, event: string, handler: () => void): void {
    if (typeof source.on !== "function") {
      return;
    }

    source.on(event, handler);
    this.cleanupHandlers.push(() => {
      if (typeof source.off === "function") {
        source.off(event, handler);
        return;
      }

      source.removeListener?.(event, handler);
    });
  }

  private recordMessage(): void {
    this.messageTimes.push(Date.now());
    this.updateRate();
  }

  private updateRate(): void {
    const cutoff = Date.now() - 60_000;
    this.messageTimes = this.messageTimes.filter((time) => time > cutoff);
    this.messageRate = this.messageTimes.length;
  }

  private readMemory(): void {
    const memory = (performance as BrowserPerformance).memory;
    this.memoryBytes = memory?.usedJSHeapSize ?? null;
  }
}

export const resourceMonitor = new ResourceMonitor();
