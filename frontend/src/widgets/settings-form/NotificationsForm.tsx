import { cn } from "@/lib/utils";
import type { UserProfile } from "@/features/user/types";

interface NotificationsFormProps {
  settings: UserProfile["settings"];
  onChange: (settings: UserProfile["settings"]) => void;
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <span className="text-sm text-slate-300">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition-colors",
          checked ? "bg-blue-600" : "bg-white/10"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform",
            checked ? "left-6" : "left-0.5"
          )}
        />
      </button>
    </div>
  );
}

export function NotificationsForm({ settings, onChange }: NotificationsFormProps) {
  const update = (patch: Partial<UserProfile["settings"]>) => {
    onChange({ ...settings, ...patch });
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-white">Уведомления</h2>
      <div className="divide-y divide-white/5">
        <ToggleRow
          label="Уведомления в Telegram-бот"
          checked={settings.telegramBotNotifications}
          onChange={(value) => update({ telegramBotNotifications: value })}
        />
        <ToggleRow
          label={`Уведомлять о встречах рядом (радиус ${settings.notificationRadiusKm} км)`}
          checked={settings.nearbyMeetingsNotifications}
          onChange={(value) => update({ nearbyMeetingsNotifications: value })}
        />
        <ToggleRow
          label="Показывать мои контакты только одобренным участникам"
          checked={settings.contactsVisibleToApprovedOnly}
          onChange={(value) => update({ contactsVisibleToApprovedOnly: value })}
        />
      </div>
    </div>
  );
}
