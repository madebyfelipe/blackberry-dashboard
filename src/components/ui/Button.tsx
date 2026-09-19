import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
};

const base =
  // `tap`: afunda 2% no clique (globals.css) e respeita prefers-reduced-motion.
  "tap inline-flex h-fit w-full items-center justify-center rounded-field px-4 py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border-strong";

const variants: Record<Variant, string> = {
  // Inverted primary — bg #e8e8e8, text #141414
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
