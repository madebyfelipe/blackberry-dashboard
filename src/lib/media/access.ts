import type { AgencyId } from "@/lib/agency/types";
import type { MediaAsset } from "./types";

/**
 * Se `GET /api/media/<id>` pode servir esta arte para quem tem (ou não tem)
 * esta sessão — issue #111. Sem `agencyId` no registro, a arte é pública de
 * propósito (lote do link de aprovação, foto de perfil, logo da agência):
 * `"ok"` sempre. Com `agencyId`, exige sessão da mesma agência.
 */
export function mediaAccess(
  asset: Pick<MediaAsset, "agencyId">,
  sessionAgencyId: AgencyId | undefined,
): "ok" | "sem-sessao" | "outra-agencia" {
  if (!asset.agencyId) return "ok";
  if (!sessionAgencyId) return "sem-sessao";
  return asset.agencyId === sessionAgencyId ? "ok" : "outra-agencia";
}
