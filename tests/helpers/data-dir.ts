import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/*
 * `lib/store/json-file.ts` resolve `data/` a partir de `process.cwd()` no
 * momento em que é carregado. Para um teste não escrever no `data/` de
 * desenvolvimento, basta trocar o diretório de trabalho ANTES de importar o
 * módulo — e é seguro fazer isso: o `node --test` roda cada arquivo de teste
 * no seu próprio processo.
 */
export function usarDataDirTemporario(prefixo: string): string {
  const dir = mkdtempSync(path.join(tmpdir(), `bb-${prefixo}-`));
  mkdirSync(path.join(dir, "data"), { recursive: true });
  process.chdir(dir);
  return dir;
}

/** Escreve um arquivo dentro do `data/` do diretório temporário atual. */
export function escreverData(nome: string, conteudo: unknown): string {
  const arquivo = path.join(process.cwd(), "data", nome);
  writeFileSync(arquivo, JSON.stringify(conteudo, null, 2), "utf8");
  return arquivo;
}
