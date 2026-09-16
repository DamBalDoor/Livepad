import type { FormEvent } from "react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authClient } from "../auth-client";
import { AuthShell, Button, Card, FieldGroup, Input } from "../components/ui";
import { copy } from "../lib/copy";

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
    <AuthShell>
      <Card as="form" onSubmit={onSubmit}>
        <h1 className="mb-1 text-[length:var(--lp-text-xl)] font-semibold text-lp-primary">{copy.auth.registerTitle}</h1>
        <p className="mb-6 text-[length:var(--lp-text-md)] text-lp-secondary">{copy.auth.registerSubtitle}</p>
        <FieldGroup>
          <Input label={copy.auth.name} required value={name} onChange={(e) => setName(e.target.value)} />
          <Input
            type="email"
            label={copy.auth.email}
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            type="password"
            label={copy.auth.passwordHint}
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </FieldGroup>
        {error ? (
          <p className="mt-4 text-[length:var(--lp-text-sm)] text-lp-danger" role="alert">
            {error}
          </p>
        ) : null}
        <Button type="submit" className="mt-6 w-full" busy={pending} disabled={pending}>
          {pending ? copy.auth.ctaRegisterBusy : copy.auth.ctaRegister}
        </Button>
        <p className="mt-4 text-center text-[length:var(--lp-text-sm)] text-lp-secondary">
          {copy.auth.hasAccount}{" "}
          <Link to="/login" className="font-medium text-lp-accent hover:underline">
            {copy.auth.loginLink}
          </Link>
        </p>
      </Card>
    </AuthShell>
  );
}
