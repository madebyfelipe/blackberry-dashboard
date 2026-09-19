"use client";

import { useRef, useState } from "react";
import { ACCEPT_ATTR } from "@/lib/media/constants";
import { cn } from "@/lib/cn";

/**
 * Área que recebe arte por clique ou arrastando. Não sabe o que fazer com os
 * arquivos — só entrega em `onFiles`, para servir tanto ao "Subir artes"
 * (várias peças) quanto ao "trocar arte" de uma peça só.
 *
 * O contador de `dragDepth` existe porque `dragleave` dispara ao passar por
 * cima de cada filho: sem ele, o realce pisca enquanto o arquivo se move
 * dentro da própria zona.
 */
export function MediaDropzone({
  onFiles,
  multiple = false,
  disabled = false,
  className,
  activeClassName = "border-fg-3 bg-surface",
  children,
}: {
  onFiles: (files: File[]) => void;
  multiple?: boolean;
  disabled?: boolean;
  className?: string;
  activeClassName?: string;
  children: React.ReactNode;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const depth = useRef(0);

  function handleFiles(list: FileList | null) {
    const files = [...(list ?? [])];
    if (files.length) onFiles(multiple ? files : files.slice(0, 1));
  }

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        onDragEnter={(e) => {
          e.preventDefault();
          depth.current += 1;
          setOver(true);
        }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={() => {
          depth.current = Math.max(0, depth.current - 1);
          if (depth.current === 0) setOver(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          depth.current = 0;
          setOver(false);
          if (!disabled) handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          "tap transition-[border-color,background-color,transform] duration-200 disabled:cursor-wait disabled:opacity-70",
          className,
          over && !disabled ? activeClassName : "",
        )}
      >
        {children}
      </button>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_ATTR}
        multiple={multiple}
        hidden
        onChange={(e) => {
          handleFiles(e.target.files);
          // Permite reenviar o mesmo arquivo logo em seguida.
          e.target.value = "";
        }}
      />
    </>
  );
}
