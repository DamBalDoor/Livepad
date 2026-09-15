import type { FormEvent } from "react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authClient } from "../auth-client";

export default function RegisterPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setPending(true);
    const { error: authError } = await authClient.signUp.email({ name, email, password });
    setPending(false);
    if (authError) {
      setError(authError.message ?? "Не удалось зарегистрироваться");
      return;
    }
    navigate("/");
  }

  return (
    <div className="flex min-h-full items-center justify-center p-6">
      <form onSubmit={onSubmit} className="w-full max-w-sm rounded-lg border border-[#3c3c3c] bg-[#252526] p-6">
        <h1 className="mb-1 text-xl font-semibold text-white">Создать аккаунт</h1>
        <p className="mb-5 text-sm text-[#9d9d9d]">Для интервьюера Livepad</p>
        <label className="mb-3 block text-sm">
          Имя
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded border border-[#3c3c3c] bg-[#1e1e1e] px-3 py-2 outline-none focus:border-[#0e639c]"
          />
        </label>
        <label className="mb-3 block text-sm">
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded border border-[#3c3c3c] bg-[#1e1e1e] px-3 py-2 outline-none focus:border-[#0e639c]"
          />
        </label>
        <label className="mb-4 block text-sm">
          Пароль (от 8 символов)
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded border border-[#3c3c3c] bg-[#1e1e1e] px-3 py-2 outline-none focus:border-[#0e639c]"
          />
        </label>
        {error ? <p className="mb-3 text-sm text-red-400">{error}</p> : null}
        <button
          disabled={pending}
          className="w-full rounded bg-[#0e639c] px-3 py-2 text-sm font-medium text-white hover:bg-[#1177bb] disabled:opacity-60"
        >
          {pending ? "Создаём..." : "Зарегистрироваться"}
        </button>
        <p className="mt-4 text-center text-sm text-[#9d9d9d]">
          Уже есть аккаунт?{" "}
          <Link to="/login" className="text-[#4fc1ff]">
            Войти
          </Link>
        </p>
      </form>
    </div>
  );
}
