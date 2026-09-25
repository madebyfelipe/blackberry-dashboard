import type { StepIcon } from "@/lib/flows/types";
import {
  CheckCheckIcon,
  ClapperboardIcon,
  FileTextIcon,
  MegaphoneIcon,
  PaletteIcon,
  PenLineIcon,
  ScanEyeIcon,
  SearchIcon,
  SendIcon,
  SlidersIcon,
  TargetIcon,
} from "@/components/icons";

/** O ícone de uma etapa pelo nome guardado no fluxo. */
export function StepGlyph({ icon, size = 16 }: { icon: StepIcon; size?: number }) {
  switch (icon) {
    case "pen-line":
      return <PenLineIcon size={size} />;
    case "palette":
      return <PaletteIcon size={size} />;
    case "scan-eye":
      return <ScanEyeIcon size={size} />;
    case "check-check":
      return <CheckCheckIcon size={size} />;
    case "send":
      return <SendIcon size={size} />;
    case "clapperboard":
      return <ClapperboardIcon size={size} />;
    case "megaphone":
      return <MegaphoneIcon size={size} />;
    case "search":
      return <SearchIcon size={size} />;
    case "target":
      return <TargetIcon size={size} />;
    case "sliders":
      return <SlidersIcon size={size} />;
    default:
      return <FileTextIcon size={size} />;
  }
}
