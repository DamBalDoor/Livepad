import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { RoomSummary, RoomTemplate } from "@livepad/shared";
import { authClient } from "../auth-client";
import { closeRoom, createRoom, listRooms, roomLink, rotateInvite } from "../api";
import {
  Badge,
  Banner,
  Button,
  Card,
  ConfirmModal,
  EmptyState,
  Input,
  PageCanvas,
} from "../components/ui";
import { ThemeToggle } from "../components/ThemeToggle";
import { copy } from "../lib/copy";

export default function DashboardPage() {
  const navigate = useNavigate();
  const { data: session, isPending } = authClient.useSession();
  const [rooms, setRooms] = useState<(RoomSummary & { inviteToken?: string })[]>([]);
  const [title, setTitle] = useState("Live-coding");
  const [template, setTemplate] = useState<RoomTemplate>("node-hello");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState("");
  const [busySlug, setBusySlug] = useState("");
  const [closeTarget, setCloseTarget] = useState<string | null>(null);
  const [menuSlug, setMenuSlug] = useState<string | null>(null);
  const [rotateHint, setRotateHint] = useState("");

  useEffect(() => {
    if (!isPending && !session) navigate("/login");
  }, [isPending, session, navigate]);

  async function reloadRooms() {
    const next = await listRooms();
    setRooms(next);
  }

  useEffect(() => {
    if (!session) return;
    setLoading(true);
    reloadRooms()
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [session]);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const room = await createRoom(title.trim() || "Комната", template);
      navigate(`/r/${room.slug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось создать комнату");
    }
  }

  async function copyInvite(slug: string, token: string) {
    await navigator.clipboard.writeText(roomLink(slug, token));
    setCopied(slug);
    setTimeout(() => setCopied(""), 1500);
  }

  async function onRotate(slug: string) {
    setBusySlug(slug);
    setError("");
    setMenuSlug(null);
    try {
      const res = await rotateInvite(slug);
      await reloadRooms();
      await navigator.clipboard.writeText(roomLink(slug, res.inviteToken));
      setRotateHint(copy.invite.rotateDone);
      setTimeout(() => setRotateHint(""), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось обновить ссылку");
    } finally {
      setBusySlug("");
    }
  }

  async function confirmClose() {
    if (!closeTarget) return;
    setBusySlug(closeTarget);
    setError("");
    try {
      await closeRoom(closeTarget);
      await reloadRooms();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось закрыть комнату");
    } finally {
      setBusySlug("");
      setCloseTarget(null);
    }
  }

  if (isPending || !session) {
    return (
      <PageCanvas themeCorner>
        <p className="p-8 text-[length:var(--lp-text-sm)] text-lp-muted-text">{copy.dash.loading}</p>
      </PageCanvas>
    );
  }

  return (
    <PageCanvas>
      <header className="border-b border-lp-subtle bg-lp-surface">
        <div className="mx-auto flex max-w-[960px] items-center justify-between gap-4 px-6 py-4">
          <span className="text-[length:var(--lp-text-lg)] font-semibold text-lp-primary">{copy.auth.brand}</span>
          <div className="flex items-center gap-2 text-[length:var(--lp-text-sm)] text-lp-secondary">
            <ThemeToggle />
            <span className="hidden sm:inline">{session.user.email}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => authClient.signOut().then(() => navigate("/login"))}
            >
              {copy.auth.signOut}
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[960px] px-6 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-[length:var(--lp-text-xl)] font-semibold text-lp-primary">{copy.dash.roomsTitle}</h1>
        </div>

        <Card as="form" className="mb-8" onSubmit={onCreate}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Input
              className="flex-1"
              label={copy.auth.roomTitlePlaceholder}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <div>
              <label className="mb-1 block text-[length:var(--lp-text-sm)] font-medium text-lp-secondary">
                Шаблон
              </label>
              <select
                value={template}
                onChange={(e) => setTemplate(e.target.value as RoomTemplate)}
                className="h-9 w-full rounded-lp-md border border-lp-strong bg-lp-surface px-3 text-[length:var(--lp-text-sm)] outline-none focus:border-lp-accent sm:w-auto"
              >
                <option value="node-hello">Node: пример</option>
                <option value="empty">Пустая</option>
              </select>
            </div>
            <Button type="submit" size="md" className="shrink-0">
              {copy.auth.createRoom}
            </Button>
          </div>
        </Card>

        {error ? (
          <Banner tone="danger" className="mb-4 rounded-lp-md border">
            {copy.dash.error}: {error}
          </Banner>
        ) : null}
        {rotateHint ? (
          <Banner tone="info" className="mb-4 rounded-lp-md border">
            {rotateHint}
          </Banner>
        ) : null}

        {loading ? (
          <p className="text-[length:var(--lp-text-sm)] text-lp-muted-text">{copy.dash.loading}</p>
        ) : rooms.length === 0 ? (
          <Card>
            <EmptyState
              title={copy.dash.empty}
              action={copy.dash.emptyCta}
              onAction={() => {
                const form = document.querySelector("form");
                form?.querySelector("input")?.focus();
              }}
            />
          </Card>
        ) : (
          <ul className="divide-y divide-lp-subtle overflow-hidden rounded-lp-lg border border-lp-subtle bg-lp-surface shadow-lp-sm">
            {rooms.map((room) => (
              <li
                key={room.id}
                className="flex min-h-[56px] flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      to={`/r/${room.slug}`}
                      className="font-medium text-lp-primary hover:text-lp-accent"
                    >
                      {room.title}
                    </Link>
                    {room.closedAt ? <Badge tone="neutral">{copy.dash.roomClosed}</Badge> : null}
                  </div>
                  <div className="font-mono text-[length:var(--lp-text-xs)] text-lp-muted-text">/{room.slug}</div>
                </div>
                <div className="relative flex flex-wrap items-center gap-2">
                  {room.inviteToken && !room.closedAt ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => copyInvite(room.slug, room.inviteToken!)}
                    >
                      {copied === room.slug ? copy.room.copyLinkDone : copy.room.copyLink}
                    </Button>
                  ) : null}
                  <Button variant="ghost" size="sm" onClick={() => setMenuSlug(menuSlug === room.slug ? null : room.slug)}>
                    ⋯
                  </Button>
                  {menuSlug === room.slug ? (
                    <div className="absolute right-0 top-full z-10 mt-1 min-w-[200px] rounded-lp-md border border-lp-subtle bg-lp-elevated py-1 shadow-lp-sm">
                      <Link
                        to={`/r/${room.slug}`}
                        className="block px-3 py-2 text-[length:var(--lp-text-sm)] hover:bg-lp-muted"
                        onClick={() => setMenuSlug(null)}
                      >
                        {copy.dash.openRoom}
                      </Link>
                      {!room.closedAt ? (
                        <>
                          <button
                            type="button"
                            disabled={busySlug === room.slug}
                            className="block w-full px-3 py-2 text-left text-[length:var(--lp-text-sm)] hover:bg-lp-muted disabled:opacity-50"
                            onClick={() => onRotate(room.slug)}
                          >
                            {copy.invite.rotateCta}
                          </button>
                          <p className="px-3 pb-1 text-[length:var(--lp-text-xs)] text-lp-muted-text">
                            {copy.invite.rotateHint}
                          </p>
                          <button
                            type="button"
                            className="block w-full px-3 py-2 text-left text-[length:var(--lp-text-sm)] text-lp-danger hover:bg-lp-danger-muted"
                            onClick={() => {
                              setMenuSlug(null);
                              setCloseTarget(room.slug);
                            }}
                          >
                            {copy.room.closeCta}
                          </button>
                        </>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>

      <ConfirmModal
        open={Boolean(closeTarget)}
        title={copy.room.closeCta}
        body={copy.room.closeConfirm}
        confirmLabel={copy.room.closeCta}
        danger
        busy={Boolean(closeTarget && busySlug === closeTarget)}
        onCancel={() => setCloseTarget(null)}
        onConfirm={confirmClose}
      />
    </PageCanvas>
  );
}
