import { NextResponse } from "next/server";
import { updateContract } from "@/lib/crm/repository";
import { withClient } from "@/lib/crm/http";
import type { Contract, PaymentMethod } from "@/lib/crm/types";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** "Resumo do contrato" e "Método de pagamento" — `payment: null` tira a forma de pagamento. */
export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  return withClient(req, id, async ({ session, body }) => {
    const account = await updateContract(session.scope, id, {
      contract: body.contract && typeof body.contract === "object" ? (body.contract as Partial<Contract>) : undefined,
      payment:
        body.payment === null
          ? null
          : body.payment && typeof body.payment === "object"
            ? (body.payment as Partial<PaymentMethod>)
            : undefined,
    });
    return NextResponse.json({ account });
  });
}
