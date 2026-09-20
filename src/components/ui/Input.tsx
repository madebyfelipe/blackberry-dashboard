import { cn } from "@/lib/cn";

type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

/**
 * Campo de texto do black berry: fundo `bg`, borda `border-strong`, raio de
 * campo (`--radius-field`) e 13px.
 */
export function Input({ className, ...props }: InputProps) {
  return (
    <input
      className={cn(
        "w-full rounded-field border border-border-strong bg-bg px-4 py-3 text-[13px] text-fg-soft",
        "placeholder:text-muted focus:border-fg-3 focus:outline-none",
        className,
      )}
      {...props}
    />
  );
}
