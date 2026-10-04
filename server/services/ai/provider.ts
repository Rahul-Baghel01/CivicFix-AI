import { z } from "zod";
import { storageImageDataUrl } from "../../storage";
// All provider wire protocol and credentials stay inside this server-only adapter.
export async function requestStructuredVision<T>(
  schema: z.ZodType<T>,
  name: string,
  instruction: string,
  prompt: string,
  images: string[]
): Promise<T> {
  const { AI_API_KEY, AI_BASE_URL, AI_MODEL } = process.env;
  if (!AI_API_KEY || !AI_BASE_URL || !AI_MODEL)
    throw new Error("Vision provider is not configured.");
  const urls = await Promise.all(images.map(url => storageImageDataUrl(url)));
  const response = await fetch(
    `${AI_BASE_URL.replace(/\/+$/, "")}/chat/completions`,
    {
      method: "POST",
      signal: AbortSignal.timeout(30000),
      headers: {
        Authorization: `Bearer ${AI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [
          { role: "system", content: instruction },
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              ...urls.map(url => ({
                type: "image_url",
                image_url: { url, detail: "low" },
              })),
            ],
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: { name, strict: true, schema: z.toJSONSchema(schema) },
        },
        max_tokens: 1000,
      }),
    }
  );
  if (!response.ok)
    throw new Error(`Vision provider failed (${response.status}).`);
  const envelope = z
    .object({
      choices: z
        .array(z.object({ message: z.object({ content: z.string() }) }))
        .min(1),
    })
    .parse(await response.json());
  return schema.parse(JSON.parse(envelope.choices[0].message.content));
}
