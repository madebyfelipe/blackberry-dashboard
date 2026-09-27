"use client";

import { useState } from "react";
import type { PublicBatch } from "@/lib/approval/public";
import { ApprovalIntro } from "./ApprovalIntro";
import { SwipeApproval } from "./SwipeApproval";

/**
 * Link público do cliente: abre na tela de início (export "Aprovação
 * (início)") e segue para o swipe quando ele decide começar.
 */
export function ApprovalFlow({ batch, agencyLogoUrl = null }: { batch: PublicBatch; agencyLogoUrl?: string | null }) {
  const [started, setStarted] = useState(false);
  if (!started) return <ApprovalIntro batch={batch} agencyLogoUrl={agencyLogoUrl} onStart={() => setStarted(true)} />;
  return <SwipeApproval batch={batch} />;
}
