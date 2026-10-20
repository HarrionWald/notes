"use client";

import Link from "next/link";
import { useState } from "react";
import { AuthCard } from "@/components/auth-card";
import { Button, Input, Label } from "@/components/ui";
import { useWorkspace } from "@/components/workspace-provider";

export default function ForgotPasswordPage() {
  const workspace = useWorkspace();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  return (
    <AuthCard title="Reset password" subtitle="The free email service only sends to members of your Supabase organization, about twice an hour.">
      <form
        className="space-y-3"
        onSubmit={async (event) => {
          event.preventDefault();
          const error = await workspace.sendReset(email);
          setMessage(error ?? "If your address is allowed, a reset link is on the way. Otherwise set the password in the Supabase dashboard under Authentication → Users.");
        }}
      >
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        {message ? <p className="text-sm">{message}</p> : null}
        <Button type="submit" className="w-full">Send reset link</Button>
      </form>
      <p className="mt-4 text-sm"><Link href="/login">Back to sign in</Link></p>
    </AuthCard>
  );
}
