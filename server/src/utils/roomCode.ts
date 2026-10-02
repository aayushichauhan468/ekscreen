import { randomInt } from "node:crypto";
import { config } from "../config.js";

// No 0/O or 1/I so codes are easy to read out loud and type.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateRoomCode(): string {
  let code = "";
  for (let i = 0; i < config.roomCodeLength; i++) {
    code += ALPHABET[randomInt(ALPHABET.length)];
  }
  return code;
}
