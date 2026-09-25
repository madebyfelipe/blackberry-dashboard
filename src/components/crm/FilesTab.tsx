"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { useToast } from "@/components/ui/Toast";
import { Popover } from "@/components/ui/Popover";
import { Spinner } from "@/components/ui/Spinner";
import type { Client } from "@/lib/clients/types";
import { FILE_FOLDERS, FILE_TONES } from "@/lib/crm/constants";
import type { ClientAccount, FileFolder } from "@/lib/crm/types";
import { fileTone, fileTypeLabel, folderLabel, relativeAgo } from "@/lib/crm/view";
import { ATTACHMENT_MIME, formatBytes } from "@/lib/media/constants";
import {
  ChartColumnIcon,
  ChevronRightIcon,
  ClipboardListIcon,
  FileCheckIcon,
  ImageIcon,
  LayoutGridIcon,
  ListIcon,
  SearchIcon,
  UploadIcon,
  XIcon,
} from "@/components/icons";
import { crmApi } from "./api";
import { FileGlyph, SectionLabel } from "./parts";
import { RowMenu, type RowMenuItem } from "./RowMenu";

/** Uma arte de lote do cliente — entra na pasta Criativos, só para ver e baixar. */
export type CreativeFile = {
  id: string;
  name: string;
  mime: string;
  size: number;
  createdAt: string;
  url: string;
  batchLabel: string;
  batchHref: string;
};

/** O que a grade e a lista desenham — arquivo da ficha ou arte de lote. */
type Item = {
  key: string;
  name: string;
  mime: string;
  size: number;
  createdAt: string;
  url: string;
  folder: FileFolder;
  /** Arquivo da ficha (move e exclui); ausente = arte de lote. */
  fileId?: string;
  batch?: { label: string; href: string };
};

const ACCEPT = Object.keys(ATTACHMENT_MIME).join(",");

function FolderGlyph({ id }: { id: FileFolder }) {
  if (id === "contratos") return <FileCheckIcon size={19} />;
  if (id === "briefings") return <ClipboardListIcon size={19} />;
  if (id === "criativos") return <ImageIcon size={19} />;
  return <ChartColumnIcon size={19} />;
}

/**
 * Arquivos — o quarto quadro do export: as quatro pastas e os arquivos
 * recentes, em grade ou lista. A pasta Criativos junta o que foi enviado
 * aqui com as artes dos lotes do cliente (essas só se abrem e baixam — quem
 * mexe nelas é o editor de lote).
 */
export function FilesTab({
  client,
  account,
  creatives,
  blobUploads,
  now,
  onChange,
}: {
  client: Client;
  account: ClientAccount;
  creatives: CreativeFile[];
  blobUploads: boolean;
  now: Date;
  onChange: (a: ClientAccount) => void;
}) {
  const { toast } = useToast();
  const [folder, setFolder] = useState<FileFolder | null>(null);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"grade" | "lista">("grade");
  const [choosing, setChoosing] = useState(false);
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const target = useRef<FileFolder>("briefings");

  const items: Item[] = useMemo(
    () =>
      [
        ...account.files.map((f) => ({
          key: f.id,
          name: f.name,
          mime: f.mime,
          size: f.size,
          createdAt: f.createdAt,
          url: `/api/media/${f.mediaId}`,
          folder: f.folder,
          fileId: f.id,
        })),
        ...creatives.map((c) => ({
          key: `lote:${c.id}`,
          name: c.name,
          mime: c.mime,
          size: c.size,
          createdAt: c.createdAt,
          url: c.url,
          folder: "criativos" as const,
          batch: { label: c.batchLabel, href: c.batchHref },
        })),
      ].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [account.files, creatives],
  );

  const counts = (id: FileFolder) => items.filter((i) => i.folder === id).length;
  const q = query.trim().toLowerCase();
  const visible = items.filter((i) => (!folder || i.folder === folder) && (!q || i.name.toLowerCase().includes(q)));
  // Sem pasta e sem busca, a grade é a dos recentes — as últimas 12.
  const shown = folder || q ? visible : visible.slice(0, 12);

  function pick(to: FileFolder) {
    target.current = to;
    setChoosing(false);
    input.current?.click();
  }

  async function upload(files: FileList | null) {
    if (!files || files.length === 0) return;
    const list = Array.from(files);
    setUploading({ done: 0, total: list.length });
    let ok = 0;
    for (const [i, f] of list.entries()) {
      try {
        onChange(await crmApi.uploadFile(client.id, f, target.current, blobUploads));
        ok++;
      } catch (err) {
        toast(`${f.name}: ${err instanceof Error ? err.message : "não foi possível enviar."}`, "error");
      }
      setUploading({ done: i + 1, total: list.length });
    }
    setUploading(null);
    if (input.current) input.current.value = "";
    if (ok) toast(ok === 1 ? `Arquivo enviado para ${folderLabel(target.current)}.` : `${ok} arquivos enviados para ${folderLabel(target.current)}.`);
  }

  async function run(fn: () => Promise<ClientAccount>, done: string) {
    try {
      onChange(await fn());
      toast(done);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Algo deu errado.", "error");
    }
  }

  function menuFor(item: Item): RowMenuItem[] {
    const out: RowMenuItem[] = [{ label: "Baixar", onSelect: () => undefined, href: item.url }];
    if (item.batch) {
      out.push({ label: `Abrir ${item.batch.label}`, onSelect: () => (window.location.href = item.batch!.href) });
      return out;
    }
    for (const f of FILE_FOLDERS) {
      if (f.id === item.folder) continue;
      out.push({
        label: `Mover para ${f.label}`,
        onSelect: () => void run(() => crmApi.moveFile(client.id, item.fileId!, f.id), `Movido para ${f.label}.`),
      });
    }
    out.push({
      label: "Excluir",
      danger: true,
      onSelect: () => void run(() => crmApi.removeFile(client.id, item.fileId!), `${item.name} excluído.`),
    });
    return out;
  }

  const meta = (i: Item) => `${fileTypeLabel(i.name)} · ${formatBytes(i.size)} · ${relativeAgo(i.createdAt, now)}`;

  return (
    <div className="@container flex flex-col gap-[18px]">
      <input
        ref={input}
        type="file"
        multiple
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => void upload(e.target.files)}
      />

      {/* Busca · grade/lista · enviar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex w-full items-center gap-2 rounded-mark border border-border bg-surface-2 px-3 py-[9px] sm:w-[300px]">
          <SearchIcon size={15} className="text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar arquivos..."
            aria-label="Buscar arquivos"
            className="min-w-0 flex-1 bg-transparent text-[13px] text-fg-soft placeholder:text-muted focus:outline-none"
          />
        </label>
        <div className="flex items-center gap-2">
          <div className="flex gap-0.5 rounded-mark border border-border bg-surface-2 p-[3px]" role="group" aria-label="Visualização">
            {(
              [
                ["grade", "Grade", <LayoutGridIcon key="g" size={15} />],
                ["lista", "Lista", <ListIcon key="l" size={15} />],
              ] as const
            ).map(([id, label, icon]) => (
              <button
                key={id}
                type="button"
                aria-label={label}
                aria-pressed={view === id}
                title={label}
                onClick={() => setView(id)}
                className={cn(
                  "flex h-7 w-[30px] items-center justify-center rounded-check transition-colors",
                  view === id ? "bg-border text-fg-soft" : "text-muted hover:text-fg-soft",
                )}
              >
                {icon}
              </button>
            ))}
          </div>
          <Popover
            open={choosing}
            onClose={() => setChoosing(false)}
            align="right"
            trigger={
              <button
                type="button"
                disabled={!!uploading}
                aria-haspopup={folder ? undefined : "menu"}
                onClick={() => (folder ? pick(folder) : setChoosing((c) => !c))}
                className="tap flex items-center gap-[7px] rounded-mark bg-primary px-4 py-[9px] text-[13px] font-semibold text-on-primary transition-colors hover:bg-white disabled:opacity-70"
              >
                {uploading ? <Spinner /> : <UploadIcon size={15} />}
                {uploading ? `Enviando ${uploading.done + 1 > uploading.total ? uploading.total : uploading.done + 1}/${uploading.total}…` : "Enviar arquivo"}
              </button>
            }
          >
            <div role="menu" className="w-[200px] animate-pop-in rounded-menu border border-border bg-surface p-1 shadow-[0_8px_24px_rgba(0,0,0,0.5)]">
              <p className="px-2.5 pb-1 pt-1.5 text-[11px] text-muted">Enviar para a pasta</p>
              {FILE_FOLDERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  role="menuitem"
                  onClick={() => pick(f.id)}
                  className="flex w-full items-center gap-2 rounded-mark px-2.5 py-[7px] text-left text-[12.5px] text-fg-soft hover:bg-row-raised"
                >
                  <span className="text-fg-3 [&_svg]:h-[14px] [&_svg]:w-[14px]">
                    <FolderGlyph id={f.id} />
                  </span>
                  {f.label}
                </button>
              ))}
            </div>
          </Popover>
        </div>
      </div>

      <SectionLabel>Pastas</SectionLabel>
      <div className="grid grid-cols-1 gap-3 @md:grid-cols-2 @3xl:grid-cols-4">
        {FILE_FOLDERS.map((f) => {
          const on = folder === f.id;
          const n = counts(f.id);
          return (
            <button
              key={f.id}
              type="button"
              aria-pressed={on}
              onClick={() => setFolder(on ? null : f.id)}
              className={cn(
                "flex items-center gap-3 rounded-thumb border p-3.5 text-left transition-colors",
                on ? "border-border-strong bg-row-raised" : "border-rule bg-flow-btn hover:bg-row-raised",
              )}
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-chip bg-badge-neutral text-fg-3">
                <FolderGlyph id={f.id} />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-[13px] font-medium text-fg">{f.label}</span>
                <span className="text-[12px] text-muted">
                  {n} {n === 1 ? "arquivo" : "arquivos"}
                </span>
              </span>
              <ChevronRightIcon size={16} className={cn("text-muted transition-transform", on && "rotate-90")} />
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-3">
        <SectionLabel>{folder ? folderLabel(folder) : q ? "Resultado da busca" : "Arquivos recentes"}</SectionLabel>
        {(folder || q) && (
          <button
            type="button"
            onClick={() => {
              setFolder(null);
              setQuery("");
            }}
            className="flex items-center gap-1 text-[12px] font-medium text-muted hover:text-fg-soft"
          >
            <XIcon size={12} />
            Limpar
          </button>
        )}
      </div>

      {shown.length === 0 ? (
        <p className="rounded-thumb border border-dashed border-border px-4 py-10 text-center text-[13px] text-muted">
          {items.length === 0
            ? `Nenhum arquivo de ${client.name} ainda. Envie contratos, briefings, criativos e relatórios — cada um vai para a pasta dele.`
            : q
              ? "Nenhum arquivo com esse nome."
              : "Nada nesta pasta ainda."}
        </p>
      ) : view === "grade" ? (
        <ul className="grid grid-cols-1 gap-3 @sm:grid-cols-2 @2xl:grid-cols-3 @4xl:grid-cols-4">
          {shown.map((i) => {
            const tone = FILE_TONES[fileTone(i.mime, i.name)];
            return (
              <li key={i.key} className="group relative flex flex-col overflow-hidden rounded-thumb border border-rule bg-flow-btn">
                <a href={i.url} target="_blank" rel="noreferrer" className="flex flex-col focus-visible:outline-none">
                  <span className="flex h-[88px] items-center justify-center" style={{ background: tone.bg }}>
                    <FileGlyph mime={i.mime} name={i.name} size={28} />
                  </span>
                  <span className="flex flex-col gap-[3px] p-3">
                    <span className="truncate text-[12.5px] font-medium text-fg-soft">{i.name}</span>
                    <span className="truncate text-[11px] text-muted">{i.batch ? `${i.batch.label} · ${relativeAgo(i.createdAt, now)}` : meta(i)}</span>
                  </span>
                </a>
                <div className="absolute right-1.5 top-1.5 rounded-mark bg-surface/80 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                  <RowMenu label={`Ações de ${i.name}`} items={menuFor(i)} />
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <ul className="flex flex-col overflow-hidden rounded-tile border border-rule bg-flow-btn">
          {shown.map((i) => {
            const tone = FILE_TONES[fileTone(i.mime, i.name)];
            return (
              <li key={i.key} className="flex items-center gap-3 border-b border-rule-soft px-4 py-2.5 last:border-b-0">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-chip" style={{ background: tone.bg }}>
                  <FileGlyph mime={i.mime} name={i.name} size={15} />
                </span>
                <a href={i.url} target="_blank" rel="noreferrer" className="flex min-w-0 flex-1 flex-col gap-px hover:underline">
                  <span className="truncate text-[13px] font-medium text-fg-soft">{i.name}</span>
                  <span className="truncate text-[11.5px] text-muted">{meta(i)}</span>
                </a>
                <span className="hidden w-[120px] shrink-0 truncate text-[12px] text-muted sm:block">
                  {i.batch ? (
                    <Link href={i.batch.href} className="hover:text-fg-soft">
                      {i.batch.label}
                    </Link>
                  ) : (
                    folderLabel(i.folder)
                  )}
                </span>
                <RowMenu label={`Ações de ${i.name}`} items={menuFor(i)} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
