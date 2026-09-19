/*
 * Ponto de entrada do `--import` do `npm test`: registra o hook que ensina o
 * Node a resolver `@/…` e imports sem extensão. Precisa ser um arquivo à parte
 * porque `register()` carrega o hook em outra thread.
 */
import { register } from "node:module";

register("./ts-resolve.mjs", import.meta.url);
