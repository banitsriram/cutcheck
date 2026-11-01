import "server-only";

// The only server log line: route, outcome, latency and units. Never images, URLs,
// ids, IPs or headers; the shape below is all a caller can pass.

export interface LogEvent {
  route: "scan" | "reupload" | "tryon" | "look-photo" | "look-clothes" | "look-shoes" | "delete";
  outcome: "ok" | "failed";
  ms: number;
  units: number;
}

export function logEvent(e: LogEvent): void {
  if (process.env.NODE_ENV === "test") return;
  console.info(JSON.stringify({ t: "cutcheck", route: e.route, outcome: e.outcome, ms: Math.round(e.ms), units: e.units }));
}
