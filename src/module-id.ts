import * as z from "zod";

// Preserve Unicode and spaces in scanned card IDs. Dot-separated IDs are not
// filesystem paths: separators, controls and foreign-drive syntax stay invalid.
export const MODULE_ID_PATTERN = String.raw`^[^./\\\x00-\x1f\x7f:<>"|?*]+(?:\.[^./\\\x00-\x1f\x7f:<>"|?*]+)*$`;
export const moduleIdSchema = z.string().min(1).regex(new RegExp(MODULE_ID_PATTERN), {
  message: "Memory ID must use nonempty dot-separated names, without path separators, control characters or drive syntax",
});
