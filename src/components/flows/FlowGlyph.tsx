import type { FlowIcon } from "@/lib/flows/types";
import {
  CalendarIcon,
  ChartLineIcon,
  ClapperboardIcon,
  FileTextIcon,
  GitBranchIcon,
  MegaphoneIcon,
  PaletteIcon,
  PenLineIcon,
  SendIcon,
  TargetIcon,
  UsersIcon,
  ZapIcon,
} from "@/components/icons";

/** O ícone do fluxo ("Ícone e cor") pelo nome guardado. */
export function FlowGlyph({ icon, size = 16 }: { icon: FlowIcon; size?: number }) {
  switch (icon) {
    case "megaphone":
      return <MegaphoneIcon size={size} />;
    case "pen-line":
      return <PenLineIcon size={size} />;
    case "target":
      return <TargetIcon size={size} />;
    case "palette":
      return <PaletteIcon size={size} />;
    case "clapperboard":
      return <ClapperboardIcon size={size} />;
    case "send":
      return <SendIcon size={size} />;
    case "chart-line":
      return <ChartLineIcon size={size} />;
    case "calendar":
      return <CalendarIcon size={size} />;
    case "users":
      return <UsersIcon size={size} />;
    case "file-text":
      return <FileTextIcon size={size} />;
    case "git-branch":
      return <GitBranchIcon size={size} />;
    default:
      return <ZapIcon size={size} />;
  }
}
