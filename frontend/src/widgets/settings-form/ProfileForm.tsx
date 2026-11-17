import { cn } from "@/lib/utils";
import type { UserProfile } from "@/features/user/types";
import { getUserInitials } from "@/features/user/presentation";

interface ProfileFormProps {
  user: UserProfile;
  onChange: (user: UserProfile) => void;
}

function Field({
  label,
  value,
  onChange,
  readOnly = false,
  maxLength,
}: {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  maxLength?: number;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-xs font-medium text-slate-400">{label}</span>
      <input
        type="text"
        value={value}
        readOnly={readOnly}
        maxLength={maxLength}
        onChange={(event) => onChange?.(event.target.value)}
        className={cn(
          "w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:outline-none",
          readOnly ? "cursor-default text-slate-500" : "focus:border-blue-500"
        )}
      />
    </label>
  );
}

export function ProfileForm({ user, onChange }: ProfileFormProps) {
  const update = (patch: Partial<UserProfile>) => {
    onChange({ ...user, ...patch });
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-white">Основной профиль</h2>

      <div className="flex items-center gap-5">
        <div
          aria-label={`Аватар пользователя ${user.displayName}`}
          className="grid h-24 w-24 shrink-0 place-items-center rounded-full bg-blue-600/20 text-2xl font-semibold text-blue-300 ring-2 ring-white/10"
        >
          {getUserInitials(user.displayName)}
        </div>

        <div className="space-y-1">
          <p className="font-medium text-white">{user.displayName}</p>
          <p className="text-sm text-slate-400">{user.email}</p>
          <span className="inline-flex items-center rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-400">
            {user.reliabilityScore === null
              ? "Пока нет отметок о посещении"
              : `Надёжность ${user.reliabilityScore}%`}
          </span>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Имя и фамилия"
          value={user.displayName}
          maxLength={50}
          onChange={(displayName) => update({ displayName })}
        />
        <Field label="Электронная почта" value={user.email} readOnly />
        <Field
          label="Университет"
          value={user.university}
          maxLength={120}
          onChange={(university) => update({ university })}
        />
        <Field
          label="Факультет"
          value={user.faculty}
          maxLength={120}
          onChange={(faculty) => update({ faculty })}
        />
        <Field
          label="Telegram username"
          value={user.telegramUsername}
          maxLength={33}
          onChange={(telegramUsername) => update({ telegramUsername })}
        />
      </div>

      <label className="block space-y-2">
        <span className="text-xs font-medium text-slate-400">О себе</span>
        <textarea
          value={user.bio}
          maxLength={1000}
          onChange={(event) => update({ bio: event.target.value })}
          rows={4}
          className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-blue-500 focus:outline-none"
        />
      </label>
    </div>
  );
}
