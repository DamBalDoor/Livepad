import type { RoomAccess, RoomSummary } from "@livepad/shared";

async function parseError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string; message?: string };
    return data.error ?? data.message ?? res.statusText;
  } catch {
    return res.statusText;
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: "include",
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    throw new Error(await parseError(res));
  }
  return (await res.json()) as T;
}

export function listRooms() {
  return api<RoomSummary[]>("/api/rooms");
}

export function createRoom(title: string) {
  return api<RoomSummary & { inviteToken: string }>("/api/rooms", {
    method: "POST",
    body: JSON.stringify({ title }),
  });
}

export function getRoom(slug: string, token?: string) {
  const q = token ? `?token=${encodeURIComponent(token)}` : "";
  return api<RoomAccess & { hostName?: string }>(`/api/rooms/${encodeURIComponent(slug)}${q}`);
}

export function roomLink(slug: string, token: string): string {
  return `${window.location.origin}/r/${slug}?token=${token}`;
}
