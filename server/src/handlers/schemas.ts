import { z } from "zod";
import { config } from "../config.js";
import { AVATAR_PART_COUNTS, REACTION_EMOJIS } from "../types/domain.js";
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

/**
 * "2-0-1-3-0-0-0-2": 8 numbers, each below its part's option count. Optional, so a client that sends
 * no avatar still works (the browser then draws a face from the userId instead).
 */
const Avatar = z
  .string()
  .regex(/^\d{1,2}(?:-\d{1,2}){7}$/, "Invalid avatar.")
  .refine((code) => code.split("-").every((n, i) => Number(n) < AVATAR_PART_COUNTS[i]), "Invalid avatar.")
  .optional();

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

export const CreateRoomSchema = z.object({ username: Username, avatar: Avatar });
export const JoinRoomSchema = z.object({ roomId: RoomCode, username: Username, avatar: Avatar });
export const RejoinRoomSchema = z.object({ roomId: RoomCode, token: z.string().min(8).max(100) });
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

/**
 * A chat line: trimmed, 1..maxChatLength characters, and no invisible control characters
 * (newline and tab are allowed). The browser also escapes text when showing it, so a message
 * like "<script>" is displayed as plain text and never runs.
 */
export const ChatSchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, "Type a message first.")
    .max(config.maxChatLength, `Messages can be at most ${config.maxChatLength} characters.`)
    .regex(/^(?:[^\p{Cc}]|[\n\t])*$/u, "Your message contains invalid characters."),
});

/** Only emojis from the shared allow-list are accepted (a client can't broadcast arbitrary text as a "reaction"). */
export const ReactionSchema = z.object({ emoji: z.enum(REACTION_EMOJIS) });
