export type CoordinatorStatus = "idle" | "starting" | "running" | "stopping";

export type CoordinatorEvent = "start" | "started" | "stop" | "stopped" | "error";

export interface StatusSnapshot {
  status: CoordinatorStatus;
  error: string | null;
}
