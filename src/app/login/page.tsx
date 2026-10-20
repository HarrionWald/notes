"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthCard } from "@/components/auth-card";
import { Button, Input, Label } from "@/components/ui";
import { useWorkspace } from "@/components/workspace-provider";

export default function LoginPage() {
  const workspace = useWorkspace();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <AuthCard title="Sign in" subtitle="Your notes stay private to this account.">
      <form
        className="space-y-3"
        onSubmit={async (event) => {
          event.preventDefault();
          const message = await workspace.signIn(email, password);
          setError(message);
          if (!message) router.push("/");
        }}
      >
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        <Label htmlFor="password">Password</Label>
        <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button type="submit" className="w-full">Sign in</Button>
      </form>
      <p className="mt-4 text-sm text-muted-foreground"><Link href="/signup">Create an account</Link> · <Link href="/forgot-password">Forgot password</Link></p>
      {!workspace.configured ? <p className="mt-3 text-sm">Supabase is not configured. You can <Link href="/">continue on this device</Link> without an account.</p> : null}
    </AuthCard>
  );
}
