import { Inbox } from "lucide-react";

export function EmptyState({
  title,
  subtitle,
  action,
  icon: Icon = Inbox,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-16 text-center">
      <Icon className="h-8 w-8 text-muted-foreground" />
      <p className="font-medium">{title}</p>
      {subtitle && <p className="max-w-sm text-sm text-muted-foreground">{subtitle}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
