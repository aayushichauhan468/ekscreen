import type { Role } from "../types/domain.js";

export type Permission =
  | "control_playback" // play, pause, seek, change video
  | "resolve_requests" // approve / reject a participant's request
  | "create_requests" // ask for a change
  | "manage_roles"
  | "remove_participants"
  | "transfer_host";

/** The single source of truth for "who may do what". Change a role's powers here only. */
const ROLE_PERMISSIONS: Record<Role, ReadonlySet<Permission>> = {
  host: new Set<Permission>([
    "control_playback",
    "resolve_requests",
    "manage_roles",
    "remove_participants",
    "transfer_host",
  ]),
  moderator: new Set<Permission>(["control_playback", "resolve_requests"]),
  participant: new Set<Permission>(["create_requests"]),
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].has(permission);
}

/** Friendly message shown to someone who tries something they are not allowed to do. */
export const DENIED_MESSAGE: Record<Permission, string> = {
  control_playback: "Only the Host or a Moderator can control playback. Send a request instead.",
  resolve_requests: "Only the Host or a Moderator can approve or reject requests.",
  create_requests: "You can control playback directly, so there is no need to send a request.",
  manage_roles: "Only the Host can change roles.",
  remove_participants: "Only the Host can remove participants.",
  transfer_host: "Only the Host can transfer the Host role.",
};
