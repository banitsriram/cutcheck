"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { demoCopy } from "@/copy/journey";
import { captureCopy } from "@/copy/screens";
import { SHOTS, hairProfileSchema, type Shot } from "@/lib/hair/types";
import { photoMemory } from "@/lib/client/photo-memory";
import { captureFrame, preparePhoto } from "@/lib/client/photo";
import { GATE, type GateIssue, type GateResult } from "@/lib/client/quality-gate";
import { sessionState } from "@/lib/client/session-store";
import { useTurnstile } from "@/lib/client/turnstile";

// Capture: three guided shots (front, left, right), each
// gated on-device, then one upload to /api/scan. A shot that fails the gate never leaves the
// device; the whole set is sent only once all three pass.

type Phase = "idle" | "camera" | "checking" | "sending";
type ErrorKey = keyof typeof captureCopy.errors;
type Taken = { upload: Blob; url: string };

const API_ERRORS = new Set<string>(["rate_limited", "budget_exhausted", "bot_check_failed", "image_rejected", "no_session"]);

export function CaptureFlow() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const { container: turnstileBox, getToken } = useTurnstile();

  const [phase, setPhase] = useState<Phase>("idle");
  const [current, setCurrent] = useState<Shot>("front");
  const [taken, setTaken] = useState<Partial<Record<Shot, Taken>>>({});
  const [issues, setIssues] = useState<GateIssue[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [gate, setGate] = useState<GateResult | null>(null);

  const done = SHOTS.every((s) => taken[s]);
  const step = SHOTS.indexOf(current) + 1;
  const shotCopy = captureCopy.shots[current];

  useEffect(() => {
    if (!sessionState.hasConsent()) router.replace("/consent");
  }, [router]);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };
  useEffect(() => stopCamera, []);

  // Revoke thumbnail URLs when they are replaced or the screen unmounts.
  const takenRef = useRef(taken);
  useEffect(() => {
    takenRef.current = taken;
  }, [taken]);
  useEffect(() => () => Object.values(takenRef.current).forEach((t) => t && URL.revokeObjectURL(t.url)), []);

  // Attach on mount too: on iOS Safari the <video> often mounts after the rAF below has run,
  // which left the camera on but the preview black.
  const setVideo = (el: HTMLVideoElement | null) => {
    videoRef.current = el;
    attachNow();
  };
  const attachNow = () => {
    const el = videoRef.current;
    if (!el || !streamRef.current) return;
    if (el.srcObject !== streamRef.current) el.srcObject = streamRef.current;
    void el.play().catch(() => {});
  };
  const attachStream = () => requestAnimationFrame(attachNow);

  async function startCamera() {
    setError(null);
    if (streamRef.current) {
      setPhase("camera");
      attachStream();
      return;
    }
    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 1280 } },
        audio: false,
      });
      setPhase("camera");
      attachStream();
    } catch (e) {
      const name = e instanceof DOMException ? e.name : "";
      setError(name === "NotAllowedError" ? captureCopy.cameraDenied : captureCopy.cameraUnavailable);
      setPhase("idle");
    }
  }

  /** First shot not yet taken after `shot`, or null when all three are in. */
  const nextMissing = (after: Partial<Record<Shot, Taken>>) => SHOTS.find((s) => !after[s]) ?? null;

  async function check(photo: Blob, fromCamera: boolean) {
    setPhase("checking");
    setError(null);
    try {
      const prepared = await preparePhoto(photo, current);
      setIssues(prepared.gate.issues);
      setGate(prepared.gate);
      if (!prepared.upload) {
        setPhase(fromCamera ? "camera" : "idle");
        if (fromCamera) attachStream();
        return;
      }
      const previous = taken[current];
      if (previous) URL.revokeObjectURL(previous.url);
      const next = { ...taken, [current]: { upload: prepared.upload, url: URL.createObjectURL(prepared.upload) } };
      setTaken(next);
      const missing = nextMissing(next);
      if (missing) {
        setCurrent(missing);
        setPhase(fromCamera ? "camera" : "idle");
        if (fromCamera) attachStream();
      } else {
        stopCamera();
        setPhase("idle");
      }
    } catch {
      setError(captureCopy.errors.image_rejected);
      setPhase(fromCamera ? "camera" : "idle");
    }
  }

  async function onCapture() {
    if (!videoRef.current) return;
    await check(await captureFrame(videoRef.current), true);
  }

  function retake(shot: Shot) {
    setCurrent(shot);
    setIssues([]);
    void startCamera();
  }

  async function send() {
    if (!done) return;
    setPhase("sending");
    setError(null);
    try {
      const form = new FormData();
      for (const s of SHOTS) form.append(s, taken[s]!.upload, `${s}.jpg`);
      const token = await getToken();
      if (token) form.append("turnstileToken", token);
      const res = await fetch("/api/scan", { method: "POST", body: form });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const key: ErrorKey = API_ERRORS.has(body.error) ? body.error : "generic";
        throw new Error(captureCopy.errors[key]);
      }
      const profile = hairProfileSchema.safeParse(body.profile);
      if (!profile.success) throw new Error(captureCopy.errors.generic);
      sessionState.saveProfile(profile.data, body.source === "mock" ? "mock" : "youcam");
      photoMemory.set(taken.front!.upload);
      router.push("/readings");
    } catch (e) {
      setError(!navigator.onLine ? captureCopy.errors.offline : e instanceof Error ? e.message : captureCopy.errors.generic);
      setPhase("idle");
    }
  }

  const busy = phase === "checking" || phase === "sending";

  return (
    <div className="flex flex-col gap-4">
      {!done && (
        <div>
          <p className="text-sm text-muted">{captureCopy.progress(step, SHOTS.length)}</p>
          <h2 className="text-lg font-semibold">{shotCopy.name}</h2>
          <p>{shotCopy.guide}</p>
        </div>
      )}

      {!done && (
        <div className="relative aspect-[3/4] overflow-hidden rounded-2xl border border-line bg-surface">
          {phase === "camera" || phase === "checking" ? (
            <video ref={setVideo} autoPlay playsInline muted className="size-full -scale-x-100 object-cover" aria-label="Camera preview" />
          ) : null}
          {current === "front" && (
            // Framing guide: head and hair inside the oval, shoulders on the line below (length needs them).
            <>
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-[24%] top-[6%] bottom-[36%] rounded-[50%] border-2 border-dashed border-white/80 mix-blend-difference"
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-[6%] bottom-0 h-[24%] rounded-t-[50%] border-x-2 border-t-2 border-dashed border-white/70 mix-blend-difference"
              />
            </>
          )}
        </div>
      )}

      <ol className="grid grid-cols-3 gap-2" aria-label={captureCopy.title}>
        {SHOTS.map((s) => (
          <li key={s} className="flex flex-col items-center gap-1">
            <button
              type="button"
              onClick={() => retake(s)}
              disabled={busy || !taken[s]}
              className={`aspect-[3/4] w-full overflow-hidden rounded-lg border ${s === current && !done ? "border-2 border-accent" : "border-line"} bg-surface`}
              aria-label={taken[s] ? captureCopy.retakeShot(captureCopy.shots[s].name) : captureCopy.shots[s].name}
            >
              {taken[s] && (
                // eslint-disable-next-line @next/next/no-img-element -- local blob preview, never uploaded from here
                <img src={taken[s].url} alt="" className="size-full object-cover" />
              )}
            </button>
            <span className="text-center text-xs text-muted">{captureCopy.shots[s].name}</span>
          </li>
        ))}
      </ol>

      <div aria-live="polite" className="flex flex-col gap-2">
        {phase === "checking" && <p className="text-muted">{captureCopy.checking}</p>}
        {phase === "sending" && <p className="text-muted">{captureCopy.sending}</p>}
        {issues.length > 0 && (
          <ul className="card flex flex-col gap-1 border-warn bg-warn-bg text-warn">
            {issues.map((i) => (
              <li key={i}>{captureCopy.gate[i]}</li>
            ))}
          </ul>
        )}
        {error && (
          <div className="card flex flex-col gap-2 border-no bg-no-bg text-no" role="alert">
            <p>{error}</p>
            {(error === captureCopy.errors.budget_exhausted || error === captureCopy.errors.rate_limited) && (
              <Link href="/demo" className="underline">
                {demoCopy.offer}
              </Link>
            )}
          </div>
        )}
        {/* Dev-only readout for tuning GATE thresholds on real selfies; stripped from production builds. */}
        {process.env.NODE_ENV !== "production" && gate && (
          <pre className="card overflow-x-auto text-xs">
            {JSON.stringify({ measured: { ...gate.metrics, ...gate.framing, faceCheck: gate.faceCheck }, limits: GATE }, null, 1)}
          </pre>
        )}
      </div>

      {done ? (
        <button type="button" className="btn-primary" onClick={send} disabled={busy}>
          {captureCopy.readHair}
        </button>
      ) : phase === "camera" || phase === "checking" ? (
        <button type="button" className="btn-primary" onClick={onCapture} disabled={busy}>
          {captureCopy.capture}
        </button>
      ) : (
        <button type="button" className="btn-primary" onClick={startCamera} disabled={busy}>
          {captureCopy.startCamera}
        </button>
      )}

      {!done && (
        <label className={`btn-secondary cursor-pointer ${busy ? "pointer-events-none opacity-50" : ""}`}>
          {captureCopy.upload}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void check(file, phase === "camera");
            }}
          />
        </label>
      )}
      <p className="text-center text-sm text-muted">{captureCopy.uploadHint}</p>
      <div ref={turnstileBox} />
    </div>
  );
}
