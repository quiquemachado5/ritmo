import { describe, expect, it } from "vitest";
import { errorCopy } from "../error-copy";

describe("errorCopy", () => {
  it.each([
    ["Auth session missing!", "session"],
    ["Failed to fetch", "network"],
    ["revision conflict", "sync"],
    ["ingrediente no reconocido", "nutrition"],
    ["row-level permission denied", "permission"],
    ["invalid data schema", "data"],
    ["boom", "unknown"],
  ] as const)("clasifica %s", (message, kind) => expect(errorCopy(new Error(message)).kind).toBe(kind));
});
