import { z } from "zod";
const configSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z
    .string()
    .url()
    .refine(v => v.startsWith("mysql://"), "Use a mysql:// DATABASE_URL"),
  JWT_SECRET: z
    .string()
    .min(32)
    .refine(
      v => !v.startsWith("change-me"),
      "Replace the example JWT_SECRET with a random secret"
    ),
  STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
});
export function validateServerConfig() {
  const result = configSchema.safeParse(process.env);
  if (!result.success)
    throw new Error(
      `Invalid server configuration: ${result.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; ")}`
    );
  if (result.data.STORAGE_DRIVER === "s3") {
    for (const key of ["S3_BUCKET", "S3_REGION"])
      if (!process.env[key])
        throw new Error(`${key} is required for S3 storage.`);
    if (
      Boolean(process.env.S3_ACCESS_KEY_ID) !==
      Boolean(process.env.S3_SECRET_ACCESS_KEY)
    )
      throw new Error(
        "Set both S3 credentials, or use the standard AWS credential chain."
      );
  }
  if (
    process.env.AI_API_KEY &&
    (!process.env.AI_BASE_URL || !process.env.AI_MODEL)
  )
    throw new Error(
      "AI_BASE_URL and AI_MODEL are required when AI_API_KEY is set."
    );
  const checksum = process.env.AWS_REQUEST_CHECKSUM_CALCULATION;
  if (checksum && !["WHEN_REQUIRED", "WHEN_SUPPORTED"].includes(checksum))
    throw new Error(
      "AWS_REQUEST_CHECKSUM_CALCULATION must be WHEN_REQUIRED or WHEN_SUPPORTED."
    );
  for (const key of ["AI_BASE_URL", "S3_ENDPOINT"]) {
    const value = process.env[key];
    if (value && !/^https?:\/\//.test(value))
      throw new Error(`${key} must be an HTTP(S) URL.`);
  }
  return result.data;
}
