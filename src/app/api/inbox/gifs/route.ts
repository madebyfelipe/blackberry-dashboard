import { NextResponse } from "next/server";
import { unauthorized } from "@/lib/auth/session";
import { currentInboxSession } from "@/lib/inbox/viewer";
import { isGifUrl } from "@/lib/inbox/constants";

export const dynamic = "force-dynamic";

/*
 * A biblioteca de GIFs da conversa. A chave fica no servidor (o navegador
 * pergunta aqui, não ao Giphy/Tenor): `TENOR_API_KEY` (Google Cloud → Tenor
 * API) ou `GIPHY_API_KEY` (developers.giphy.com). Com as duas, vale o Tenor.
 * Sem nenhuma, a rota diz isso e o botão de GIF explica o que configurar.
 *
 * `?q=` busca; sem `q`, os GIFs em alta. A resposta já vem filtrada pelo
 * mesmo `isGifUrl` que o envio confere — o que aparece aqui é o que dá para
 * mandar.
 */

type GifResult = {
  id: string;
  /** O GIF que vai na mensagem. */
  url: string;
  /** A versão leve, para a grade de escolha. */
  preview: string;
  width: number;
  height: number;
  title: string;
};

const LIMIT = 24;

function env(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : undefined;
}

async function tenor(key: string, q: string): Promise<GifResult[]> {
  const params = new URLSearchParams({
    key,
    client_key: "blackberry",
    limit: String(LIMIT),
    media_filter: "gif,tinygif",
    locale: "pt_BR",
    contentfilter: "medium",
  });
  if (q) params.set("q", q);
  const res = await fetch(`https://tenor.googleapis.com/v2/${q ? "search" : "featured"}?${params}`, {
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`Tenor respondeu ${res.status}`);
  const data = (await res.json()) as {
    results?: {
      id: string;
      content_description?: string;
      media_formats?: Record<string, { url: string; dims?: [number, number] }>;
    }[];
  };
  return (data.results ?? []).flatMap((r) => {
    const gif = r.media_formats?.gif;
    const tiny = r.media_formats?.tinygif ?? gif;
    if (!gif?.url || !tiny?.url) return [];
    return [
      {
        id: r.id,
        url: gif.url,
        preview: tiny.url,
        width: gif.dims?.[0] ?? 0,
        height: gif.dims?.[1] ?? 0,
        title: r.content_description ?? "GIF",
      },
    ];
  });
}

async function giphy(key: string, q: string): Promise<GifResult[]> {
  const params = new URLSearchParams({ api_key: key, limit: String(LIMIT), rating: "pg-13", lang: "pt" });
  if (q) params.set("q", q);
  const res = await fetch(`https://api.giphy.com/v1/gifs/${q ? "search" : "trending"}?${params}`, {
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`Giphy respondeu ${res.status}`);
  const data = (await res.json()) as {
    data?: {
      id: string;
      title?: string;
      images?: Record<string, { url?: string; width?: string; height?: string }>;
    }[];
  };
  return (data.data ?? []).flatMap((r) => {
    const gif = r.images?.fixed_height ?? r.images?.original;
    const small = r.images?.fixed_width_small ?? r.images?.fixed_height_small ?? gif;
    if (!gif?.url || !small?.url) return [];
    return [
      {
        id: r.id,
        url: gif.url,
        preview: small.url,
        width: Number(gif.width) || 0,
        height: Number(gif.height) || 0,
        title: r.title || "GIF",
      },
    ];
  });
}

export async function GET(req: Request) {
  const session = await currentInboxSession();
  if (!session) return unauthorized();
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 80);
  const tenorKey = env("TENOR_API_KEY");
  const giphyKey = env("GIPHY_API_KEY");
  if (!tenorKey && !giphyKey) {
    return NextResponse.json(
      {
        error:
          "A biblioteca de GIFs não está configurada. Defina TENOR_API_KEY ou GIPHY_API_KEY nas variáveis de ambiente.",
      },
      { status: 503 },
    );
  }
  try {
    const results = tenorKey ? await tenor(tenorKey, q) : await giphy(giphyKey!, q);
    return NextResponse.json({
      provider: tenorKey ? "tenor" : "giphy",
      results: results.filter((r) => isGifUrl(r.url) && isGifUrl(r.preview)),
    });
  } catch (err) {
    console.error("[gifs] busca falhou", err);
    return NextResponse.json({ error: "A biblioteca de GIFs não respondeu. Tente de novo." }, { status: 502 });
  }
}
