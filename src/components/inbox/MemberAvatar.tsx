import { cn } from "@/lib/cn";
import { initialsOf } from "@/lib/inbox/view";

/*
 * O avatar de alguém do time no Inbox: a foto (Configurações › Pessoal)
 * quando a pessoa mandou uma, as iniciais quando não. Quem chama decide o
 * tamanho, o fundo e a fonte pelo `className` — é o mesmo círculo de sempre,
 * só que com a foto por cima quando ela existe.
 */
export function MemberAvatar({
  name,
  photoUrl,
  className,
  initials,
}: {
  name: string;
  photoUrl?: string | null;
  /** Tamanho, fundo, fonte — as classes que o círculo de iniciais já usava. */
  className?: string;
  /** Iniciais prontas (o grupo "MA"), no lugar das tiradas do nome. */
  initials?: string;
}) {
  return (
    <span
      className={cn("flex shrink-0 items-center justify-center overflow-hidden rounded-pill", className)}
      aria-hidden="true"
    >
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photoUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
      ) : (
        (initials ?? initialsOf(name))
      )}
    </span>
  );
}
