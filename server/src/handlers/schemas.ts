import { z } from "zod";
import { config } from "../config.js";
import { extractYouTubeId } from "../utils/youtube.js";

/**
 * Zod schemas = the "front door" of the server. Every payload from a client is
 * checked here BEFORE any room logic runs. Never trust data coming from a browser.
 */

const Username = z
  .string()
  .trim()
  .min(1, "Please enter a name.")
  .max(config.maxUsernameLength, `Name must be at most ${config.maxUsernameLength} characters.`)
  .regex(/^[^\p{C}]+$/u, "Name contains invalid characters.");

const RoomCode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(new RegExp(`^[A-Z0-9]{${config.roomCodeLength}}$`), "Room codes have 6 letters or numbers.");

const UserId = z.string().min(1).max(64);

/** Accepts a YouTube link or an 11-character ID and always returns the clean ID. */
const VideoId = z
  .string()
  .trim()
  .min(1)
  .max(300)
  .transform((value, ctx) => {
    const id = extractYouTubeId(value);
    if (!id) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "That doesn't look like a valid YouTube link." });
      return z.NEVER;
    }
    return id;
  });

export const CreateRoomSchema = z.object({ username: Username });
export const JoinRoomSchema = z.object({ roomId: RoomCode, username: Username });
export const LeaveRoomSchema = z.object({ roomId: z.string().max(32) });

export const SeekSchema = z.object({ time: z.number().finite().min(0).max(config.maxSeekSeconds) });
export const ChangeVideoSchema = z.object({ videoId: VideoId });

export const AssignRoleSchema = z.object({ userId: UserId, role: z.enum(["moderator", "participant"]) });
export const TargetSchema = z.object({ userId: UserId });

export const PlaybackActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("play") }),
  z.object({ type: z.literal("pause") }),
  z.object({ type: z.literal("seek"), time: z.number().finite().min(0).max(config.maxSeekSeconds) }),
  z.object({ type: z.literal("change_video"), videoId: VideoId }),
]);
export const RequestActionSchema = z.object({ action: PlaybackActionSchema });
export const RequestIdSchema = z.object({ requestId: z.string().min(1).max(64) });
