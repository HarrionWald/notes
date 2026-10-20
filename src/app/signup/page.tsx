"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthCard } from "@/components/auth-card";
import { Button, Input, Label } from "@/components/ui";
import { useWorkspace } from "@/components/workspace-provider";

export default function SignupPage() {
  const workspace = useWorkspace();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <AuthCard title="Create your account" subtitle="Use the same email as your free Supabase account so password mail can be delivered.">
      <form
        className="space-y-3"
        onSubmit={async (event) => {
          event.preventDefault();
          if (password.length < 8) {
            setError("Use at least 8 characters.");
            return;
          }
          const message = await workspace.signUp(name, email, password);
          setError(message);
          if (!message) router.push("/");
        }}
      >
        <Label htmlFor="name">Name</Label>
        <Input id="name" value={name} onChange={(event) => setName(event.target.value)} required />
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        <Label htmlFor="password">Password</Label>
        <Input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button type="submit" className="w-full">Create account</Button>
      </form>
      <p className="mt-4 text-sm"><Link href="/login">Already have an account</Link></p>
    </AuthCard>
  );
}
