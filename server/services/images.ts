export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export function validateImage(bytes: Buffer, contentType: string) {
  if (!IMAGE_TYPES.includes(contentType as (typeof IMAGE_TYPES)[number]))
    throw new Error("Upload a JPG, PNG, or WebP image.");
  if (!bytes.length || bytes.length > MAX_IMAGE_BYTES)
    throw new Error("Images must be nonempty and 5 MB or smaller.");
  const valid =
    contentType === "image/jpeg"
      ? bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))
      : contentType === "image/png"
        ? bytes
            .subarray(0, 8)
            .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        : bytes.toString("ascii", 0, 4) === "RIFF" &&
          bytes.toString("ascii", 8, 12) === "WEBP";
  if (!valid)
    throw new Error("Image contents do not match the supported image type.");
}
export function decodeImage(data: string) {
  const match =
    /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(
      data
    );
  if (!match) throw new Error("Unsupported image format or invalid base64.");
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.toString("base64") !== match[2])
    throw new Error("Invalid image encoding.");
  validateImage(bytes, match[1]);
  return { mime: match[1], bytes };
}
