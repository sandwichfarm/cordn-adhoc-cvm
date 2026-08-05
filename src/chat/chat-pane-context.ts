import type { RoomHostIdentity } from "./invite";
import type { StoredRoom } from "./room-store";

export type ChatPaneConnection = "cached" | "connecting" | "connected" | "offline" | "deleted";

export interface ChatPaneContext {
  room: StoredRoom | null;
  host: RoomHostIdentity | null;
  connection: ChatPaneConnection | null;
  soundsEnabled: boolean;
  removalMode: "delete" | "leave" | null;
  toggleSounds?: () => void | Promise<void>;
  requestRemoval?: () => void;
}
