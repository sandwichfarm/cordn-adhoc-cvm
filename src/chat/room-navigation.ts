import { createInviteUrl, type ChatInvite } from "./invite";
import { hostIdentityForRoom, type StoredRoom } from "./room-store";

/** Build a room URL on the current app shell without changing its coordinator target. */
export function createSameShellChatHref(shellOrigin: string, room: StoredRoom | ChatInvite): string {
  if ("groupId" in room) return createInviteUrl(shellOrigin, room);

  return createInviteUrl(shellOrigin, {
    groupId: room.id,
    coordinatorPubkey: room.coordinatorPubkey,
    relayUrls: room.relayUrls,
    title: room.title,
    coordinatorOrigin: room.coordinatorOrigin,
    host: hostIdentityForRoom(room),
    coordinatorKeyMode: room.coordinatorKeyMode,
  });
}
