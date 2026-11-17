import { cn } from "@/lib/utils";
import { Eye, EyeOff, MapPin } from "lucide-react";
import type { UserProfile } from "@/features/user/types";

interface PrivacyFormProps {
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

export function PrivacyForm({ settings, onChange }: PrivacyFormProps) {
  const update = (patch: Partial<UserProfile["settings"]>) => {
    onChange({ ...settings, ...patch });
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-white">Приватность и геолокация</h2>

      <section>
        <div className="flex items-center gap-3 pb-4">
          <MapPin size={18} className="text-blue-400" />
          <h3 className="text-sm font-semibold text-white">Геолокация</h3>
        </div>

        <ToggleRow
          label="Показывать моё местоположение"
          checked={settings.showLocation}
          onChange={(value) => update({ showLocation: value })}
        />

        {settings.showLocation && (
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between">
              <label htmlFor="notification-radius" className="text-xs text-slate-400">
                Радиус уведомлений
              </label>
              <span className="text-xs font-medium text-white">
                {settings.notificationRadiusKm} км
              </span>
            </div>
            <input
              id="notification-radius"
              type="range"
              min={1}
              max={50}
              value={settings.notificationRadiusKm}
              onChange={(event) =>
                update({ notificationRadiusKm: Number(event.target.value) })
              }
              className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-blue-500"
            />
            <div className="flex justify-between text-[10px] text-slate-600">
              <span>1 км</span>
              <span>50 км</span>
            </div>
          </div>
        )}
      </section>

      <section className="border-t border-white/10 pt-5">
        <div className="flex items-center gap-3 pb-4">
          {settings.contactsVisibleToApprovedOnly ? (
            <EyeOff size={18} className="text-blue-400" />
          ) : (
            <Eye size={18} className="text-blue-400" />
          )}
          <h3 className="text-sm font-semibold text-white">Контакты</h3>
        </div>

        <ToggleRow
          label="Показывать контакты только одобренным участникам"
          checked={settings.contactsVisibleToApprovedOnly}
          onChange={(value) => update({ contactsVisibleToApprovedOnly: value })}
        />
      </section>
    </div>
  );
}
