import { NextResponse } from "next/server";
import { generateInvoice } from "@/lib/crm/repository";
import { withClient } from "@/lib/crm/http";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * "Gerar cobrança": valor, vencimento e competência saem do servidor (os
 * serviços e o dia do faturamento da ficha) — nada disso vem do corpo.
 */
export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  return withClient(
    req,
    id,
    async ({ session, client }) => {
      const account = await generateInvoice(session.scope, id, { billingDay: client.billingDay });
      return NextResponse.json({ account }, { status: 201 });
    },
    { body: false },
  );
}
