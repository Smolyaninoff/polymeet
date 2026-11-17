import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/features/auth/context";
import { useMe, useUpdateMe } from "@/features/user/hooks";
import {
  toUserProfile,
  toUserUpdate,
  type UserProfile,
} from "@/features/user/types";
import type { UserOut } from "@/shared/api/schema";
import { SettingsSidebar, type SettingsTab } from "@/widgets/settings-sidebar/SettingsSidebar";
import { ProfileForm } from "@/widgets/settings-form/ProfileForm";
import { NotificationsForm } from "@/widgets/settings-form/NotificationsForm";
import { PrivacyForm } from "@/widgets/settings-form/PrivacyForm";
import { SecurityForm } from "@/widgets/settings-form/SecurityForm";

interface SettingsContentProps {
  user: UserOut;
  activeTab: SettingsTab;
}

function SettingsContent({ user, activeTab }: SettingsContentProps) {
  const { updateUser } = useAuth();
  const updateMutation = useUpdateMe();
  const [draftUser, setDraftUser] = useState<UserProfile>(() =>
    toUserProfile(user)
  );
  const [isDirty, setIsDirty] = useState(false);
  const [error, setError] = useState("");
  const [isSaved, setIsSaved] = useState(false);

  const handleUserChange = (nextUser: UserProfile) => {
    setDraftUser(nextUser);
    setIsDirty(true);
    setIsSaved(false);
  };

  const handleSettingsChange = (settings: UserProfile["settings"]) => {
    setDraftUser((current) => ({ ...current, settings }));
    setIsDirty(true);
    setIsSaved(false);
  };

  const handleSave = async () => {
    setError("");
    setIsSaved(false);

    try {
      const updated = await updateMutation.mutateAsync(toUserUpdate(draftUser));
      updateUser(updated);
      setDraftUser(toUserProfile(updated));
      setIsDirty(false);
      setIsSaved(true);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Не удалось сохранить профиль"
      );
    }
  };

  const handleCancel = () => {
    setDraftUser(toUserProfile(user));
    setIsDirty(false);
    setError("");
    setIsSaved(false);
  };

  return (
    <div className="min-w-0 flex-1 space-y-6">
      <div className="rounded-xl border border-white/10 bg-[#131a30] p-6">
        {activeTab === "profile" && (
          <ProfileForm user={draftUser} onChange={handleUserChange} />
        )}
        {activeTab === "notifications" && (
          <NotificationsForm
            settings={draftUser.settings}
            onChange={handleSettingsChange}
          />
        )}
        {activeTab === "privacy" && (
          <PrivacyForm
            settings={draftUser.settings}
            onChange={handleSettingsChange}
          />
        )}
        {activeTab === "security" && <SecurityForm />}
      </div>

      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
      {isSaved && (
        <p role="status" className="text-sm text-emerald-400">
          Изменения сохранены.
        </p>
      )}

      {isDirty && (
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={handleCancel}
            disabled={updateMutation.isPending}
            className="rounded-lg px-5 py-2 text-sm font-medium text-slate-400 transition-colors hover:text-white disabled:opacity-50"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={updateMutation.isPending}
            className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
          >
            {updateMutation.isPending ? "Сохраняем…" : "Сохранить изменения"}
          </button>
        </div>
      )}
    </div>
  );
}

export function ModerationPage() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const meQuery = useMe();
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");

  const handleLogout = async () => {
    await logout();
    navigate("/auth", { replace: true });
  };

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <SettingsSidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onLogout={() => void handleLogout()}
      />

      {meQuery.isLoading && (
        <p className="flex-1 rounded-xl border border-white/10 bg-[#131a30] p-6 text-sm text-slate-400">
          Загружаем профиль…
        </p>
      )}

      {meQuery.isError && (
        <p
          role="alert"
          className="flex-1 rounded-xl border border-white/10 bg-[#131a30] p-6 text-sm text-red-400"
        >
          {meQuery.error instanceof Error
            ? meQuery.error.message
            : "Не удалось загрузить профиль"}
        </p>
      )}

      {meQuery.data && (
        <SettingsContent
          key={meQuery.data.id}
          user={meQuery.data}
          activeTab={activeTab}
        />
      )}
    </div>
  );
}
