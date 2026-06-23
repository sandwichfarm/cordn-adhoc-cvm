export type CoordinatorStatus = "idle" | "starting" | "running" | "stopping";

export type CoordinatorEvent = "start" | "started" | "stop" | "stopped" | "error";

export type CoordinatorLoadState = "prompting" | "ready";

export type RelayConnectionStatus = "idle" | "connecting" | "connected" | "error";

export interface StatusSnapshot {
  status: CoordinatorStatus;
  error: string | null;
}
