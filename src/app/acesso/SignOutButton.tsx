"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export function SignOutButton() {
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);
  return (
    <Button
      type="button"
      variant="secondary"
      disabled={leaving}
      className="w-full"
      onClick={async () => {
        setLeaving(true);
        await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
        router.replace("/login");
        router.refresh();
      }}
    >
      Sair desta conta
    </Button>
  );
}
