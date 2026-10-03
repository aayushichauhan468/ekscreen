/** Central place for tunable settings, so no magic numbers are scattered around. */
export const config = {
  port: Number(process.env.PORT ?? 4000),
  clientOrigin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173",
  maxParticipantsPerRoom: 100,
  maxUsernameLength: 24,
  roomCodeLength: 6,
  // How long a disconnected person keeps their seat (page refresh, Wi-Fi blip, phone lock).
  reconnectGraceMs: 45_000,
  maxSeekSeconds: 60 * 60 * 24, // 24 hours: anything bigger is certainly a bad value

  // ---- starter video ----
  // Every new room opens with this video (paused at 0:00) so nobody sees a blank player.
  // The Host or a Moderator can replace it at any time. Override with EKSCREEN_DEFAULT_VIDEO_ID.
  defaultVideoId: process.env.EKSCREEN_DEFAULT_VIDEO_ID ?? "s2HYl12gmOY", // starter video chosen by the project owner

  // ---- chat and reactions ----
  maxChatLength: 500, // characters per message
  chatHistoryLimit: 100, // newest messages kept per room (late joiners receive these)
  // Rate limits stop one person from flooding the room (a sliding window: at most `max` per `windowMs`).
  chatRateLimit: { max: 6, windowMs: 5_000 },
  reactionRateLimit: { max: 10, windowMs: 3_000 },
} as const;
