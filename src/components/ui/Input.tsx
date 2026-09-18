import { cn } from "@/lib/cn";

type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

/**
 * Text field per black berry: bg #000, border #414141, radius 24, 13px.
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
