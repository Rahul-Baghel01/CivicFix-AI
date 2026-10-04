import { afterEach, describe, expect, it, vi } from "vitest";
import {
  analyzeCivicIssue,
  analysisSchema,
  getFallback,
  verifyResolution,
} from "./services/ai/civicIssueAnalyzer";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
function configured() {
  vi.stubEnv("AI_API_KEY", "test-key");
  vi.stubEnv("AI_BASE_URL", "https://vision.example/v1");
  vi.stubEnv("AI_MODEL", "vision-test");
}
describe("validated civic vision", () => {
  it("uses a conservative guided fallback with no fabricated confidence", async () => {
    vi.stubEnv("AI_API_KEY", "");
    const result = await analyzeCivicIssue(
      "data:image/png;base64,aGVsbG8=",
      "Open manhole"
    );
    expect(analysisSchema.safeParse(result).success).toBe(true);
    expect(result).toMatchObject({
      issueType: "Open manhole",
      confidence: 0,
      severity: "CRITICAL",
    });
    expect(getFallback().issueType).toBe("Other");
  });
  it.each([
    "not JSON",
    JSON.stringify({ ...getFallback("pothole"), severity: "EXTREME" }),
    JSON.stringify({ ...getFallback("pothole"), confidence: 2 }),
    JSON.stringify({ ...getFallback("pothole"), unexpected: true }),
  ])("rejects invalid provider output: %s", async content => {
    configured();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ choices: [{ message: { content } }] }))
        )
    );
    expect(
      await analyzeCivicIssue(
        "data:image/png;base64,aGVsbG8=",
        "Blocked drainage"
      )
    ).toMatchObject({ issueType: "Blocked drainage", confidence: 0 });
  });
  it("uses the configured model and validates structured vision results", async () => {
    configured();
    const result = { ...getFallback("Pothole"), confidence: 0.8 };
    const request = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: JSON.stringify(result) } }],
          })
        )
      );
    vi.stubGlobal("fetch", request);
    expect(await analyzeCivicIssue("data:image/png;base64,aGVsbG8=")).toEqual(
      result
    );
    expect(request.mock.calls[0][0]).toBe(
      "https://vision.example/v1/chat/completions"
    );
    expect(JSON.parse(request.mock.calls[0][1].body).model).toBe("vision-test");
  });
  it("analyzes a signed object URL without sending image bytes through the API", async () => {
    configured();
    const result = { ...getFallback("Pothole"), confidence: 0.8 };
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(result) } }] })));
    vi.stubGlobal("fetch", request);
    expect(await analyzeCivicIssue("https://objects.example/photo.jpg?signature=test", "Pothole")).toEqual(result);
    const payload = JSON.parse(request.mock.calls[0][1].body);
    expect(payload.messages[1].content[1].image_url.url).toBe("https://objects.example/photo.jpg?signature=test");
  });
  it("returns manual review on AI outage, even with both evidence images", async () => {
    configured();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    expect(
      await verifyResolution(
        "https://example.com/before.jpg",
        "https://example.com/after.jpg"
      )
    ).toMatchObject({ verificationScore: 0, issueAppearsResolved: false });
  });
  it("does not display a successful score when the provider says unresolved", async () => {
    configured();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({
              choices: [
                {
                  message: {
                    content: JSON.stringify({
                      verificationScore: 95,
                      issueAppearsResolved: false,
                      explanation: "Different site.",
                    }),
                  },
                },
              ],
            })
          )
        )
    );
    expect(
      await verifyResolution(
        "https://example.com/before.jpg",
        "https://example.com/after.jpg"
      )
    ).toMatchObject({ verificationScore: 79, issueAppearsResolved: false });
  });
});
