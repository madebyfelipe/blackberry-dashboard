import { NextResponse } from "next/server";
import { ValidationError, removeInvoice, setInvoiceStatus } from "@/lib/crm/repository";
import { notFound, withClient } from "@/lib/crm/http";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; invoiceId: string }> };

/** Marcar como paga (ou reabrir). A data do pagamento é a do servidor. */
export async function PATCH(req: Request, { params }: Ctx) {
  const { id, invoiceId } = await params;
  return withClient(req, id, async ({ session, body }) => {
    if (body.status !== "pago" && body.status !== "aberto") throw new ValidationError("Status inválido.");
    const account = await setInvoiceStatus(session.scope, id, invoiceId, body.status);
    return account ? NextResponse.json({ account }) : notFound("Fatura não encontrada.");
  });
}

export async function DELETE(req: Request, { params }: Ctx) {
  const { id, invoiceId } = await params;
  return withClient(
    req,
    id,
    async ({ session }) => {
      const account = await removeInvoice(session.scope, id, invoiceId);
      return account ? NextResponse.json({ account }) : notFound("Fatura não encontrada.");
    },
    { body: false },
  );
}
