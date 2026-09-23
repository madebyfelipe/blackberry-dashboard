"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Batch } from "@/lib/approval/types";
import { useToast } from "@/components/ui/Toast";
import { ArrowLeftIcon, CheckIcon, CopyIcon } from "@/components/icons";
import { ModalShell, modalPrimary, modalTitleInput } from "@/components/ui/ModalShell";

/*
 * O lote salvo, pronto para o cliente: QR code do link público, o campo com
 * o link e "copiar", e a volta para a tela do lote (não para o editor —
 * quem salvou terminou de montar).
 *
 * Tela provisória: o modal não tem desenho ainda. O QR é gerado no navegador
 * (`qrcode`), em preto sobre branco — é um código para câmera ler, não cor de
 * interface, e é a única exceção à régua de cor aqui, como a íris do login.
 */

export function ShareBatchModal({
  batch,
  clientSlug,
  onClose,
}: {
  batch: Batch;
  clientSlug: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [svg, setSvg] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const url = typeof window === "undefined" ? `/a/${batch.token}` : `${window.location.origin}/a/${batch.token}`;

  useEffect(() => {
    let vivo = true;
    void import("qrcode").then((QR) =>
      QR.toString(url, {
        type: "svg",
        margin: 1,
        errorCorrectionLevel: "M",
        color: { dark: "#000000", light: "#ffffff" },
      }).then((s) => vivo && setSvg(s)),
    );
    return () => {
      vivo = false;
    };
  }, [url]);


  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast("Link copiado.");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast("Não deu para copiar — selecione o link e copie à mão.", "error");
    }
  }

  const back = () => router.push(`/social/${clientSlug}/${batch.id}`);

  return (
    <ModalShell
      trail={[batch.client, batch.label]}
      title="Lote salvo"
      onClose={onClose}
      footerStart={
        <span className="text-[12px] text-muted">
          {batch.pieces.length} {batch.pieces.length === 1 ? "criativo" : "criativos"} · o cliente aprova sem senha
        </span>
      }
      footerEnd={
        <button type="button" onClick={back} className={`${modalPrimary} flex items-center gap-2`}>
          <ArrowLeftIcon size={15} />
          Voltar para o lote
        </button>
      }
    >
      <p className={modalTitleInput}>Pronto para o cliente</p>
      <div className="flex flex-col items-center gap-4 py-2 sm:flex-row sm:items-start sm:gap-5">
        <div
          className="flex h-[176px] w-[176px] shrink-0 items-center justify-center overflow-hidden rounded-panel bg-white p-2 [&>svg]:h-full [&>svg]:w-full"
          aria-label="QR code do link de aprovação"
          role="img"
          // SVG gerado pela biblioteca a partir do link — nada vindo de usuário.
          dangerouslySetInnerHTML={{ __html: svg }}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <p className="text-[14px] leading-[21px] text-fg-soft">
            Mande o link (ou mostre o QR code) para o cliente. Ele abre no celular, desliza e aprova
            ou pede ajuste — cada decisão já anda a tarefa do criativo.
          </p>
          <div className="flex w-full items-center gap-2 rounded-field bg-surface-2 py-1.5 pl-4 pr-1.5 inset-ring-1 inset-ring-border">
            <input
              readOnly
              value={url}
              aria-label="Link de aprovação"
              onFocus={(e) => e.currentTarget.select()}
              className="min-w-0 flex-1 bg-transparent font-mono text-[12px] text-fg-3 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => void copy()}
              className="tap flex shrink-0 items-center gap-1.5 rounded-pill bg-primary px-3.5 py-2 text-[12px] font-semibold text-on-primary transition-colors hover:bg-white"
            >
              {copied ? <CheckIcon size={13} strokeWidth={2.5} /> : <CopyIcon size={13} />}
              {copied ? "Copiado" : "Copiar link"}
            </button>
          </div>
        </div>
      </div>
    </ModalShell>
  );
}
