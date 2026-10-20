"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthCard } from "@/components/auth-card";
import { Button, Input, Label } from "@/components/ui";
import { useWorkspace } from "@/components/workspace-provider";

export default function ResetPasswordPage() {
  const workspace = useWorkspace();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <AuthCard title="Choose a new password" subtitle="Open this page from the reset link so your session is active.">
      <form
        className="space-y-3"
        onSubmit={async (event) => {
          event.preventDefault();
          const message = await workspace.updatePassword(password);
          setError(message);
          if (!message) router.push("/");
        }}
      >
        <Label htmlFor="password">New password</Label>
        <Input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button type="submit" className="w-full">Update password</Button>
      </form>
    </AuthCard>
  );
}
