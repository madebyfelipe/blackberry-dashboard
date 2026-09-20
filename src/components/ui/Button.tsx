import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
};

/*
 * `w-full` NÃO mora aqui de propósito: como largura é `flex-basis` num item
 * flex, um consumidor tentando encolher com `w-fit`/`w-auto` perde para o
 * `w-full` do `base` sempre que os dois caem na mesma ordem de cascata do
 * Tailwind — foi assim que o "Adicionar tarefa" do quadro vazou 311px para
 * fora da tela. Quem precisa de botão de largura total (login, cadastro)
 * passa `w-full` no próprio `className`.
 */
const base =
  // `tap`: afunda 2% no clique (globals.css) e respeita prefers-reduced-motion.
  "tap inline-flex h-fit items-center justify-center rounded-field px-4 py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border-strong";

const variants: Record<Variant, string> = {
  // Invertido: fundo `primary` sobre texto `on-primary`.
  primary: "bg-primary text-on-primary hover:bg-white",
  // Secondary — surface with border
  secondary:
    "bg-surface text-fg-soft border border-border hover:bg-surface-2",
};

export function Button({
  variant = "primary",
  className,
  ...props
}: ButtonProps) {
  return (
    <button className={cn(base, variants[variant], className)} {...props} />
  );
}
