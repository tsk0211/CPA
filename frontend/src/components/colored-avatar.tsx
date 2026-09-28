import { colorForKey } from "@/lib/colors";
import { cn } from "@/lib/utils";

export function ColoredAvatar({ name, size = 40, className }: { name: string; size?: number; className?: string }) {
  const color = colorForKey(name);
  return (
    <div
      className={cn("flex shrink-0 items-center justify-center rounded-full font-semibold", className)}
      style={{ width: size, height: size, backgroundColor: `${color}38`, color, fontSize: size * 0.4 }}
    >
      {name ? name[0].toUpperCase() : "?"}
    </div>
  );
}
