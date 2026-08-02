export type CoordinatorStatus = "idle" | "starting" | "running" | "stopping";

export type CoordinatorStartupPhase =
  | "idle"
  | "checking-instance"
  | "opening-storage"
  | "preparing-runtime"
  | "connecting-relays"
  | "online"
  | "failed";

export interface CoordinatorStartupProgress {
  phase: CoordinatorStartupPhase;
  step: number;
  totalSteps: number;
  percent: number;
  label: string;
  detail: string;
}

export type CoordinatorEvent = "start" | "started" | "stop" | "stopped" | "error";

export type CoordinatorLoadState = "prompting" | "ready";

export type RelayConnectionStatus = "idle" | "connecting" | "connected" | "error";

export interface StatusSnapshot {
  status: CoordinatorStatus;
  error: string | null;
}
