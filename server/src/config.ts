/** Central place for tunable settings, so no magic numbers are scattered around. */
export const config = {
  port: Number(process.env.PORT ?? 4000),
  clientOrigin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173",
  maxParticipantsPerRoom: 100,
  maxUsernameLength: 24,
  roomCodeLength: 6,
  maxSeekSeconds: 60 * 60 * 24, // 24 hours: anything bigger is certainly a bad value
} as const;
