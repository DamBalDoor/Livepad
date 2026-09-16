import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { RoomSummary, RoomTemplate } from "@livepad/shared";
import { authClient } from "../auth-client";
import { closeRoom, createRoom, listRooms, roomLink, rotateInvite } from "../api";

export default function DashboardPage() {
  const navigate = useNavigate();
  const { data: session, isPending } = authClient.useSession();
  const [rooms, setRooms] = useState<(RoomSummary & { inviteToken?: string })[]>([]);
  const [title, setTitle] = useState("Live-coding");
  const [template, setTemplate] = useState<RoomTemplate>("node-hello");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const [busySlug, setBusySlug] = useState("");

  useEffect(() => {
    if (!isPending && !session) navigate("/login");
  }, [isPending, session, navigate]);

  async function reloadRooms() {
    const next = await listRooms();
    setRooms(next);
  }

  useEffect(() => {
    if (!session) return;
    reloadRooms().catch((err: Error) => setError(err.message));
  }, [session]);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const room = await createRoom(title.trim() || "Комната", template);
      navigate(`/r/${room.slug}?token=${room.inviteToken}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось создать комнату");
    }
  }

  async function copy(slug: string, token: string) {
    await navigator.clipboard.writeText(roomLink(slug, token));
    setCopied(slug);
    setTimeout(() => setCopied(""), 1500);
  }

  async function onRotate(slug: string) {
    setBusySlug(slug);
    setError("");
    try {
      await rotateInvite(slug);
      await reloadRooms();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось обновить ссылку");
    } finally {
      setBusySlug("");
    }
  }

  async function onClose(slug: string) {
    if (!window.confirm("Закрыть комнату? Кандидаты больше не смогут войти.")) return;
    setBusySlug(slug);
    setError("");
    try {
      await closeRoom(slug);
      await reloadRooms();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось закрыть комнату");
    } finally {
      setBusySlug("");
    }
  }

  if (isPending || !session) {
    return <div className="p-8 text-sm text-[#9d9d9d]">Загрузка...</div>;
  }

  return (
    <div className="mx-auto max-w-3xl p-8">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Livepad</h1>
          <p className="text-sm text-[#9d9d9d]">{session.user.name} · {session.user.email}</p>
        </div>
        <button
          className="rounded border border-[#3c3c3c] px-3 py-1.5 text-sm hover:bg-[#2a2a2a]"
          onClick={() => authClient.signOut().then(() => navigate("/login"))}
        >
          Выйти
        </button>
      </header>

      <form onSubmit={onCreate} className="mb-8 space-y-3">
        <div className="flex gap-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Название комнаты"
            className="flex-1 rounded border border-[#3c3c3c] bg-[#252526] px-3 py-2 outline-none focus:border-[#0e639c]"
          />
          <select
            value={template}
            onChange={(e) => setTemplate(e.target.value as RoomTemplate)}
            className="rounded border border-[#3c3c3c] bg-[#252526] px-3 py-2 text-sm outline-none focus:border-[#0e639c]"
          >
            <option value="node-hello">Node: пример</option>
            <option value="empty">Пустая</option>
          </select>
          <button className="rounded bg-[#0e639c] px-4 py-2 text-sm font-medium text-white hover:bg-[#1177bb]">
            Создать комнату
          </button>
        </div>
      </form>
      {error ? <p className="mb-4 text-sm text-red-400">{error}</p> : null}

      <h2 className="mb-3 text-sm uppercase tracking-wide text-[#9d9d9d]">Мои комнаты</h2>
      <ul className="divide-y divide-[#3c3c3c] rounded border border-[#3c3c3c] bg-[#252526]">
        {rooms.length === 0 ? (
          <li className="px-4 py-6 text-sm text-[#9d9d9d]">Пока пусто — создайте первую комнату для интервью.</li>
        ) : (
          rooms.map((room) => (
            <li key={room.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <div>
                <Link to={`/r/${room.slug}${room.inviteToken ? `?token=${room.inviteToken}` : ""}`} className="text-white hover:underline">
                  {room.title}
                </Link>
                <div className="text-xs text-[#9d9d9d]">
                  /{room.slug}
                  {room.closedAt ? " · закрыта" : ""}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {room.inviteToken && !room.closedAt ? (
                  <button
                    className="rounded border border-[#3c3c3c] px-2 py-1 text-xs hover:bg-[#2a2a2a]"
                    onClick={() => copy(room.slug, room.inviteToken!)}
                  >
                    {copied === room.slug ? "Скопировано" : "Копировать ссылку"}
                  </button>
                ) : null}
                {!room.closedAt ? (
                  <>
                    <button
                      disabled={busySlug === room.slug}
                      className="rounded border border-[#3c3c3c] px-2 py-1 text-xs hover:bg-[#2a2a2a] disabled:opacity-50"
                      onClick={() => onRotate(room.slug)}
                    >
                      Новая ссылка
                    </button>
                    <button
                      disabled={busySlug === room.slug}
                      className="rounded border border-red-900/60 px-2 py-1 text-xs text-red-300 hover:bg-red-950/40 disabled:opacity-50"
                      onClick={() => onClose(room.slug)}
                    >
                      Закрыть
                    </button>
                  </>
                ) : null}
              </div>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
