# Visual Verification Notes

Desktop verification confirmed the intended deep-evergreen, warm-paper, and coral/lime civic-tech visual system across the public landing page and citizen dashboard. The city dashboard seeded its 20 demonstration reports correctly.

The browser environment temporarily rejected the Google Maps proxy script during capture. The map component now degrades to a visible location-preview state while preserving the address and coordinates workflow. In regular supported sessions, the same component uses the configured Google Maps proxy for map rendering, geocoding, markers, and location picking.

The second verification pass confirmed that report tracking resolves the seeded `CIV-2026-08-000124` record and shows its status pipeline. The report builder, tracking view, analytics filters, and citizen dashboard all render without blank map areas under the proxy-failure condition.

Mobile verification at 375 pixels confirmed that the citizen dashboard collapses into readable single-column cards and that the report workflow preserves its capture, analysis, and location stages without horizontal overflow.

## Accessibility and Console Check

The final manual accessibility review covered native buttons and links, labelled file upload and text inputs, accessible names for the map, notification, account, and filter controls, visible focus-ring styles in the dashboard shell, semantic headings, responsive text sizing, and severity labels that are communicated by text as well as colour. The final analytics render retained the expected location fallback. The latest client-console entries contained only the intentional Google Maps availability warning and standard development information; no new runtime errors were observed after the accessibility refinements.

## Demo-Readiness Polish Pass

The refreshed authority command centre now presents critical, high-priority, aging, and new reports in a dedicated needs-attention briefing, with evidence and map context next to the workflow tools. The analytics page now derives total, resolved, resolution-rate, average-resolution-time, category, severity, status, hotspot, and daily trend summaries from the seeded report data. The map proxy remained unavailable in the verification browser, and the designed location-preview fallback remained legible and non-blocking.

The resolved seeded report `CIV-2026-08-000113` now renders a dedicated verification panel with before/after evidence placeholders, a 93% evidence-based confidence result, a likely-resolved status, and a non-guarantee notice. The guided report entry state remains concise, exposes its pothole demo action, and preserves the non-blocking location fallback.

The final mobile pass confirmed that the authority needs-attention briefing, queue, evidence strip, operational controls, and analytics distributions all stack cleanly at 375 pixels. Filter controls remain legible, cards retain semantic status labels, and no horizontal overflow was visible in the captures.

The final empty-state pass confirmed that an unknown report reference displays a calm, actionable no-match state and that an authenticated citizen with no updates sees a clear notification empty state. Both retained the established visual system without exposing technical detail.

The authority page is intentionally authentication-gated by the supplied dashboard shell. Unsigned visitors see its loading/authentication state; project-owner accounts receive authority controls enforced by the server-side administrator procedure.

## Authenticated Lifecycle Verification

The OAuth callback state failure was reproduced and corrected without exposing credentials. Login initiation is idempotent, background unauthenticated queries no longer rotate the one-time state nonce, and public-preview session cookies remain `Secure` when a TLS proxy omits a protocol header. The project-owner session then reached the authority command centre under the existing server-side administrator authorization.

The authenticated report `CIV-2026-08-407696` was submitted, assigned to **Ward Roads Response Team**, transitioned to **In Progress**, and closed with a completion note and a stored resolution image. The browser optimises evidence before it uses the protected octet-stream upload route, avoiding the rejected base64 tRPC payload. Persisted evidence confirms the stored resolution key, image URL, assignment record, In Progress event, Resolved event, and resolution timestamp. The citizen tracking view showed the full timeline and the inbox showed submitted, In Progress, and Resolved notifications.

The completion image used for the controlled test was intentionally a non-matching interface screenshot. The verification service returned a 0 score with explicit **manual review** guidance rather than falsely approving the repair, which confirms the conservative evidence-handling path.

## Final Error-State Checks

The final report-builder check simulated a denied browser location response. CivicFix displayed a clear, non-blocking message—“Location permission was not granted. You can still submit using a manual address.”—while retaining the address field, coordinates, and map selection path. A controlled text-file upload was rejected with the message “Use a JPG, PNG, or WebP image smaller than 5 MB.” and left the reporting form usable.

Automated coverage passes for duplicate matching, structured AI fallback, conservative resolution verification, and authority-only procedure access. The browser checks also confirmed the unknown-report and empty-notification states, while the existing map component exposes a usable address-and-coordinate fallback if mapping infrastructure is unavailable. The final build, type check, and test suite completed successfully; remaining console output consists of Google Maps vendor deprecation/performance warnings rather than application errors.

## Duplicate Warning Verification

The live report builder was exercised with the guided pothole scenario at Civil Lines, Kanpur. The image service identified the illustration as a civic pothole and the review stage displayed: **“Possible duplicate: We found 1 similar report within 500 meters.”** It offered an existing-report tracking link and retained the option to submit, without creating a second report during the verification. When a vision response identifies an illustrative asset as `Other`, the explicit **pothole** hint is now applied only to the guided review path with reduced confidence and a clear fallback explanation; standard image classifications remain unchanged.

The automated authorization regression invokes the protected authority list procedure with a citizen role and confirms a `FORBIDDEN` response; the live authority route independently displayed only its guarded view before administrator access was granted. The structured-AI fallback regression supplies unavailable/invalid vision input and verifies that the returned result remains validated JSON with an issue type, severity, confidence, department, and priority rather than unsafe free text. These checks preserve server-side authority enforcement and keep the report builder usable when AI analysis is unavailable.
