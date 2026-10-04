/// <reference types="@types/google.maps" />

import { CivicMap } from "@/components/CivicMap";
import { AIDetectionCard } from "@/components/AIDetectionCard";
import { CivicShell } from "@/components/CivicShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import {
  AlertTriangle,
  Check,
  ChevronRight,
  CircleAlert,
  Compass,
  FileImage,
  Loader2,
  LocateFixed,
  MapPin,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Upload,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Link, useLocation } from "wouter";

type LocationDraft = { latitude: number; longitude: number; address: string };

const severityStyle: Record<string, string> = {
  LOW: "bg-emerald-100 text-emerald-800",
  MEDIUM: "bg-amber-100 text-amber-800",
  HIGH: "bg-orange-100 text-orange-800",
  CRITICAL: "bg-red-100 text-red-800",
};

function drawDemoPothole() {
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 700;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  const road = ctx.createLinearGradient(0, 0, 1200, 700);
  road.addColorStop(0, "#68716d");
  road.addColorStop(1, "#333d3a");
  ctx.fillStyle = road;
  ctx.fillRect(0, 0, 1200, 700);
  ctx.strokeStyle = "#d9c44e";
  ctx.lineWidth = 14;
  ctx.setLineDash([45, 34]);
  ctx.beginPath();
  ctx.moveTo(0, 360);
  ctx.lineTo(1200, 360);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.ellipse(610, 410, 200, 110, -0.15, 0, Math.PI * 2);
  ctx.fillStyle = "#16201d";
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(610, 400, 165, 82, -0.15, 0, Math.PI * 2);
  ctx.fillStyle = "#101714";
  ctx.fill();
  ctx.strokeStyle = "#a0aaa3";
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.arc(610, 410, 176, 0.2, 4.5);
  ctx.stroke();
  return canvas.toDataURL("image/jpeg", 0.86);
}

export default function ReportIssue() {
  const { isAuthenticated } = useAuth();
  const [, setRoute] = useLocation();
  const [photo, setPhoto] = useState<string | null>(null);
  const [fileName, setFileName] = useState("No photo selected");
  const [hint, setHint] = useState("pothole");
  const [stage, setStage] = useState<"capture" | "review" | "submitted">(
    "capture"
  );
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [location, setLocation] = useState<LocationDraft>({
    latitude: 26.4817,
    longitude: 80.3154,
    address: "Civil Lines, Kanpur, Uttar Pradesh",
  });
  const [complaint, setComplaint] = useState("");
  const analyze = trpc.civic.analyzeUpload.useMutation({
    onSuccess: data => {
      setStage("review");
      toast.success("AI analysis is ready for your review.");
    },
    onError: error =>
      toast.error(
        error.message ||
          "We couldn’t analyze this image. Please try another clear photo."
      ),
  });
  const prepareUpload = trpc.civic.prepareUpload.useMutation();
  const create = trpc.civic.create.useMutation({
    onSuccess: report => {
      setStage("submitted");
      toast.success(`${report.reportId} was submitted successfully.`);
    },
    onError: error =>
      toast.error(error.message || "Your report could not be submitted."),
  });
  const analysis = useMemo(() => {
    if (!analyze.data) return undefined;
    // The built-in pothole scene is an illustrative graphic. If vision correctly
    // identifies it as a graphic rather than a real photo, retain the explicit
    // citizen hint for routing and duplicate matching instead of discarding it.
    if (
      analyze.data.issueType === "Other" &&
      /\bpothole\b/i.test(hint.trim())
    ) {
      return {
        ...analyze.data,
        issueType: "Pothole" as const,
        category: "Road condition",
        severity: "MEDIUM" as const,
        estimatedPriority: "MEDIUM" as const,
        recommendedDepartment: "Roads & Infrastructure",
        confidence: Math.min(analyze.data.confidence, 0.75),
        potentialRisk:
          "Road surface damage may affect cyclists, pedestrians, and vehicles.",
        description:
          "The image and citizen-provided hint indicate a possible pothole requiring municipal road inspection.",
      };
    }
    return analyze.data;
  }, [analyze.data, hint]);
  const duplicateInput = useMemo(
    () =>
      analysis
        ? {
            latitude: location.latitude,
            longitude: location.longitude,
            issueType: analysis.issueType,
          }
        : undefined,
    [analysis, location.latitude, location.longitude]
  );
  const duplicate = trpc.civic.duplicateCheck.useQuery(
    duplicateInput as {
      latitude: number;
      longitude: number;
      issueType:
        | "Pothole"
        | "Broken streetlight"
        | "Garbage dumping"
        | "Overflowing garbage bin"
        | "Water leakage"
        | "Open manhole"
        | "Damaged road"
        | "Blocked drainage"
        | "Sewage problem"
        | "Fallen tree"
        | "Traffic signal problem"
        | "Illegal dumping"
        | "Public property damage"
        | "Other";
    },
    { enabled: Boolean(duplicateInput) }
  );

  useEffect(() => {
    if (analysis)
      setComplaint(
        `Issue: ${analysis.issueType}\n\nLocation: ${location.address}\n\nDescription: ${analysis.description}\n\nPriority: ${analysis.estimatedPriority}\n\nRecommended department: ${analysis.recommendedDepartment}`
      );
  }, [analysis, location.address]);

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      toast.error(
        "Location is unavailable in this browser. Enter an address instead."
      );
      return;
    }
    navigator.geolocation.getCurrentPosition(
      position => {
        setLocation(current => ({
          ...current,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          address: "Current location (please refine address)",
        }));
        toast.success("Current coordinates added. Please confirm the address.");
      },
      () =>
        toast.message(
          "Location permission was not granted. You can still submit using a manual address."
        ),
      { enableHighAccuracy: true, timeout: 9000 }
    );
  };
  const geocodeAddress = () => {
    if (!map || !location.address.trim() || !window.google?.maps) {
      toast.message("Enter an address after the map has loaded.");
      return;
    }
    new google.maps.Geocoder().geocode(
      { address: location.address },
      (results, status) => {
        if (status === "OK" && results?.[0]?.geometry.location) {
          const point = results[0].geometry.location;
          setLocation(current => ({
            ...current,
            latitude: point.lat(),
            longitude: point.lng(),
            address: results[0].formatted_address,
          }));
          map.panTo(point);
          toast.success("Address located on the map.");
        } else
          toast.error(
            "We couldn’t locate that address. You can set the point manually on the map."
          );
      }
    );
  };
  const chooseFile = (file?: File) => {
    if (!file) return;
    if (
      !/image\/(jpeg|png|webp)/.test(file.type) ||
      file.size > 5 * 1024 * 1024
    ) {
      toast.error("Use a JPG, PNG, or WebP image smaller than 5 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setPhoto(String(reader.result));
      setFileName(file.name);
      setStage("capture");
    };
    reader.readAsDataURL(file);
  };
  const runDemo = () => {
    const demo = drawDemoPothole();
    if (demo) {
      setPhoto(demo);
      setFileName("civicfix-pothole-demo.jpg");
      setHint("pothole");
      toast.success("A realistic pothole scenario is ready to analyze.");
    }
  };
  const analyzePhoto = async () => {
    if (!photo) {
      toast.error("Upload a clear image or run the demo scenario first.");
      return;
    }
    try {
      const image = await (await fetch(photo)).blob();
      const contentType = image.type as
        | "image/jpeg"
        | "image/png"
        | "image/webp";
      const upload = await prepareUpload.mutateAsync({
        contentType,
        contentLength: image.size,
      });
      if (upload.method === "PUT") {
        const response = await fetch(upload.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": contentType },
          body: image,
        });
        if (!response.ok)
          throw new Error(
            "The image could not be uploaded. Check the object-storage CORS settings and try again."
          );
        await analyze.mutateAsync({
          imageKey: upload.key,
          evidenceToken: upload.evidenceToken,
          hint,
        });
      } else await analyze.mutateAsync({ imageDataUrl: photo, hint });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "The image could not be analyzed."
      );
    }
  };
  const submit = () => {
    if (!isAuthenticated) {
      toast.message("Please sign in to submit your report securely.");
      startLogin();
      return;
    }
    if (!analysis || !photo) return;
    create.mutate({
      issueType: analysis.issueType,
      category: analysis.category,
      description:
        complaint
          .replace(/^Issue:[\s\S]*?Description:\s*/m, "")
          .split("\n\nPriority:")[0] || analysis.description,
      imageUrl: analysis.imageUrl,
      imageKey: analysis.imageKey,
      evidenceToken: analysis.evidenceToken,
      location,
      severity: analysis.severity,
      confidence: analysis.confidence,
      potentialRisk: analysis.potentialRisk,
      priority: analysis.estimatedPriority,
      department: analysis.recommendedDepartment as
        | "Roads & Infrastructure"
        | "Sanitation & Waste"
        | "Water Supply"
        | "Drainage & Sewerage"
        | "Electrical & Street Lighting"
        | "Parks & Urban Forestry"
        | "Traffic Management"
        | "Public Works",
    });
  };

  if (stage === "submitted" && create.data)
    return (
      <CivicShell title="Your report is on its way." eyebrow="Report submitted">
        <div className="mx-auto max-w-2xl rounded-[28px] border border-[#d5e7db] bg-white p-8 text-center shadow-[0_14px_42px_rgba(21,62,53,.09)]">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[#e9f8e5] text-[#238759]">
            <Check size={32} />
          </span>
          <p className="mt-6 text-sm font-bold uppercase tracking-[.17em] text-[#e66a40]">
            Reference number
          </p>
          <h2 className="mt-2 font-mono text-2xl font-semibold text-[#153e35]">
            {create.data.reportId}
          </h2>
          <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-[#5c7169]">
            Your report has been submitted to{" "}
            <strong>{create.data.department}</strong>. You can track each step
            from review to resolution.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Button
              onClick={() => setRoute(`/track?id=${create.data!.reportId}`)}
              className="rounded-xl bg-[#153e35] hover:bg-[#0d3028]"
            >
              Track my report <ChevronRight size={16} />
            </Button>
            <Button
              variant="outline"
              onClick={() => setRoute("/dashboard")}
              className="rounded-xl"
            >
              Open dashboard
            </Button>
          </div>
        </div>
      </CivicShell>
    );

  return (
    <CivicShell title="Report a civic issue" eyebrow="Guided report builder">
      <div className="mb-6 flex items-center gap-2 overflow-x-auto pb-1">
        {[
          ["1", "Capture"],
          ["2", "AI review"],
          ["3", "Submit"],
        ].map(([number, label], index) => (
          <div key={label} className="flex items-center gap-2">
            <span
              className={`grid h-7 w-7 place-items-center rounded-full text-xs font-bold ${stage === "capture" ? "bg-[#153e35] text-white" : "bg-[#d9ede0] text-[#153e35]"}`}
            >
              {stage === "capture" ? number : <Check size={14} />}
            </span>
            <span className="whitespace-nowrap text-sm font-medium text-[#536b62]">
              {label}
            </span>
            {index < 2 && <span className="mx-1 h-px w-8 bg-[#d9e5dd]" />}
          </div>
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-[.9fr_1.1fr]">
        <section className="rounded-2xl border border-[#e0e9e2] bg-white p-5 shadow-[0_7px_22px_rgba(21,62,53,.05)] md:p-6">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#edf6ef] text-[#153e35]">
              <FileImage size={19} />
            </span>
            <div>
              <h2 className="font-display text-xl font-semibold text-[#153e35]">
                Show us what you found
              </h2>
              <p className="mt-1 text-sm leading-5 text-[#667a71]">
                Upload a clear civic-issue photo, take one with your camera, or
                run the guided pothole scenario.
              </p>
            </div>
          </div>
          <label className="mt-6 flex min-h-52 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#cbded0] bg-[#f8fbf8] p-5 text-center transition hover:border-[#153e35] hover:bg-[#f2f8f3]">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={event => chooseFile(event.target.files?.[0])}
            />
            <div className="grid h-12 w-12 place-items-center rounded-full bg-white text-[#e66a40] shadow-sm">
              <Upload size={21} />
            </div>
            {photo ? (
              <img
                src={photo}
                alt="Selected civic issue"
                className="mt-4 h-28 w-full rounded-xl object-cover"
              />
            ) : (
              <>
                <p className="mt-4 font-semibold text-[#153e35]">
                  Upload a JPG, PNG, or WebP
                </p>
                <p className="mt-1 text-xs text-[#82938b]">
                  Up to 5 MB · clear daylight images work best
                </p>
              </>
            )}
            <p className="mt-3 max-w-full truncate text-xs text-[#70827a]">
              {fileName}
            </p>
          </label>
          <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
            <Input
              value={hint}
              onChange={event => setHint(event.target.value)}
              aria-label="Optional issue hint"
              placeholder="Optional hint, e.g. pothole"
            />
            <Button variant="outline" onClick={runDemo} className="rounded-xl">
              <Sparkles size={15} />
              Run pothole demo
            </Button>
          </div>
          <Button
            onClick={analyzePhoto}
            disabled={analyze.isPending || prepareUpload.isPending}
            className="mt-4 h-12 w-full rounded-xl bg-[#153e35] font-bold hover:bg-[#0d3028]"
          >
            {analyze.isPending || prepareUpload.isPending ? (
              <>
                <Loader2 className="animate-spin" size={17} />
                Analyzing image…
              </>
            ) : (
              <>
                <ScanLine size={17} />
                Analyze civic issue
              </>
            )}
          </Button>
          {analyze.isPending && (
            <div className="mt-4 rounded-xl bg-[#edf6ef] p-4 text-sm text-[#34554a]">
              <p className="font-semibold">CivicFix AI is working</p>
              <div className="mt-2 space-y-1.5 text-xs text-[#647e72]">
                <p>✓ Detecting civic issue</p>
                <p>✓ Estimating severity</p>
                <p>• Identifying department</p>
                <p>• Preparing complaint</p>
              </div>
            </div>
          )}
        </section>
        <section className="space-y-6">
          <div className="rounded-2xl border border-[#e0e9e2] bg-white p-5 shadow-[0_7px_22px_rgba(21,62,53,.05)] md:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-xl font-semibold text-[#153e35]">
                  Pin the location
                </h2>
                <p className="mt-1 text-sm text-[#667a71]">
                  Use your device, search an address, or click the map. You can
                  submit even if location permission is denied.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={useMyLocation}
                className="shrink-0 rounded-lg"
              >
                <LocateFixed size={15} />
                Use mine
              </Button>
            </div>
            <div className="mt-4 flex gap-2">
              <Input
                value={location.address}
                onChange={event =>
                  setLocation(current => ({
                    ...current,
                    address: event.target.value,
                  }))
                }
                aria-label="Report address"
                placeholder="Enter an address or landmark"
              />
              <Button
                variant="outline"
                onClick={geocodeAddress}
                className="rounded-lg"
              >
                <Compass size={16} />
                <span className="hidden sm:inline">Find</span>
              </Button>
            </div>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs font-medium text-[#71837b]">
              <label>
                Latitude
                <Input
                  type="number"
                  step="any"
                  min={-90}
                  max={90}
                  aria-label="Latitude"
                  value={location.latitude}
                  onChange={event =>
                    setLocation(current => ({
                      ...current,
                      latitude: Number(event.target.value),
                    }))
                  }
                />
              </label>
              <label>
                Longitude
                <Input
                  type="number"
                  step="any"
                  min={-180}
                  max={180}
                  aria-label="Longitude"
                  value={location.longitude}
                  onChange={event =>
                    setLocation(current => ({
                      ...current,
                      longitude: Number(event.target.value),
                    }))
                  }
                />
              </label>
              <span className="inline-flex items-center gap-1">
                <MapPin size={12} />
                Click map to adjust
              </span>
            </div>
            <div className="mt-4 overflow-hidden rounded-xl border border-[#dde9df]">
              <CivicMap
                markers={[
                  {
                    latitude: location.latitude,
                    longitude: location.longitude,
                    label: "Report location",
                    severity: "HIGH",
                  },
                ]}
                onPick={point =>
                  setLocation(current => ({
                    ...current,
                    ...point,
                    address: current.address || "Pinned location",
                  }))
                }
                onReady={setMap}
                className="h-[270px]"
              />
            </div>
          </div>
          {analysis && <AIDetectionCard analysis={analysis} />}
          {stage === "review" && analysis && (
            <div className="rounded-2xl border border-[#d5e7db] bg-[#eff8f0] p-5 md:p-6">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-white text-[#238759] shadow-sm">
                  <ShieldCheck size={19} />
                </span>
                <div>
                  <h2 className="font-display text-xl font-semibold text-[#153e35]">
                    Review your complaint
                  </h2>
                  <p className="text-sm text-[#5d766a]">
                    Edit any detail before sending it to the city.
                  </p>
                </div>
              </div>
              {duplicate.data?.length ? (
                <div className="mt-4 rounded-xl border border-[#ead8a5] bg-[#fff9e5] p-3 text-sm text-[#6a5313]">
                  <strong>Possible duplicate:</strong> We found{" "}
                  {duplicate.data.length} similar report
                  {duplicate.data.length > 1 ? "s" : ""} within 500 meters. You
                  can still submit a new report or{" "}
                  <Link
                    href={`/track?id=${duplicate.data[0].reportId}`}
                    className="font-bold underline"
                  >
                    follow the existing report
                  </Link>
                  .
                </div>
              ) : null}
              <Textarea
                value={complaint}
                onChange={event => setComplaint(event.target.value)}
                className="mt-4 min-h-48 bg-white text-sm leading-6"
                aria-label="Editable generated complaint"
              />
              <Button
                onClick={submit}
                disabled={create.isPending}
                className="mt-4 h-12 w-full rounded-xl bg-[#153e35] font-bold hover:bg-[#0d3028]"
              >
                {create.isPending ? (
                  <>
                    <Loader2 className="animate-spin" size={17} />
                    Submitting report…
                  </>
                ) : (
                  <>
                    <Check size={17} />
                    Submit civic report
                  </>
                )}
              </Button>
            </div>
          )}
        </section>
      </div>
    </CivicShell>
  );
}
