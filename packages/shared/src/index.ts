export type RoomTemplate = "node-hello" | "empty";

export type RoomSummary = {
  id: string;
  slug: string;
  title: string;
  createdAt: string;
  template?: RoomTemplate;
  closedAt?: string | null;
};

export type RoomAccess = {
  slug: string;
  title: string;
  role: "host" | "guest";
  inviteToken: string;
  closedAt?: string | null;
};

export type RuntimeEvent =
  | { type: "stdout"; data: string }
  | { type: "stderr"; data: string }
  | { type: "status"; data: string }
  | { type: "exit"; code: number | null }
  | { type: "error"; message: string }
  | { type: "busy"; action: RuntimeAction }
  | { type: "idle" };

export type RuntimeAction = "install" | "run";

export type RuntimeMessage = RuntimeAction | "stop";

export type IntegrityEventKind =
  | "hello"
  | "away"
  | "back"
  | "paste"
  | "idle"
  | "active"
  | "resize"
  | "fullscreen"
  | "devtools"
  | "offline";

export type IntegrityEvent = {
  id: string;
  at: string;
  clientId: string;
  name: string;
  kind: IntegrityEventKind;
  message: string;
  meta?: Record<string, string | number | boolean | null>;
};

export type IntegrityClientState = {
  clientId: string;
  name: string;
  present: boolean;
  online: boolean;
  awayStartedAt: string | null;
  leaveCount: number;
  awayMs: number;
  largePasteCount: number;
  lastPasteChars: number | null;
  lastPasteAfterAway: boolean;
  idle: boolean;
  multiMonitor: boolean | null;
  screen: string;
  timezone: string;
  language: string;
  userAgent: string;
  fullscreen: boolean;
  devtools: boolean | null;
};

export type IntegritySnapshot = {
  clients: IntegrityClientState[];
  events: IntegrityEvent[];
};
