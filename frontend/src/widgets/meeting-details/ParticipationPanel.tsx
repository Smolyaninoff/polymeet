import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useApply, useWithdraw } from "@/features/applications/hooks";
import { APPLICATION_STATUS, hasStarted } from "@/features/meetings/labels";
import { errorMessage } from "@/shared/api/client";
import type { MeetingOut, UserOut } from "@/shared/api/schema";

interface ParticipationPanelProps {
  meeting: MeetingOut;
  user: UserOut | null;
}

/** Блок участника: записаться, статус заявки, отменить участие. */
export function ParticipationPanel({ meeting, user }: ParticipationPanelProps) {
  const location = useLocation();
  const apply = useApply(meeting.id);
  const withdraw = useWithdraw(meeting.id);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string>();

  const open = meeting.status === "published" && !hasStarted(meeting.starts_at);
  const application = meeting.my_application;
  const active = application && ["pending", "waitlist", "accepted"].includes(application.status);

  const run = async (action: () => Promise<unknown>) => {
    setError(undefined);
    try {
      await action();
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  let body;
  if (!user) {
    body = open ? (
      <Link
        to="/login"
        state={{ from: location.pathname }}
        className="block w-full rounded-lg bg-blue-600 py-2.5 text-center text-sm font-semibold text-white hover:bg-blue-500"
      >
        Войти, чтобы записаться
      </Link>
    ) : (
      <p className="text-sm text-slate-400">Запись на эту встречу закрыта.</p>
    );
  } else if (application) {
    const status = APPLICATION_STATUS[application.status];
    body = (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-white">
          <span className={cn("size-2 rounded-full", status.dot)} />
          {status.label}
        </div>
        {application.status === "waitlist" && (
          <p className="text-xs text-slate-400">
            Как только кто-то откажется, место автоматически перейдёт первому в очереди.
          </p>
        )}
        {application.status === "rejected" && (
          <p className="text-xs text-slate-400">Повторно подать заявку на эту встречу нельзя.</p>
        )}
        {active && (
          <button
            onClick={() => run(() => withdraw.mutateAsync())}
            disabled={withdraw.isPending}
            className="w-full rounded-lg border border-red-500/30 py-2.5 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-60"
          >
            {withdraw.isPending ? "Отменяем…" : "Отменить участие"}
          </button>
        )}
      </div>
    );
  } else if (open) {
    body = (
      <div className="space-y-3">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={300}
          rows={2}
          placeholder="Сообщение организатору (необязательно)"
          className="w-full resize-none rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:border-blue-500 focus:outline-none"
        />
        <p className="text-xs text-slate-400">
          {meeting.free_places === 0
            ? "Мест нет — вы попадёте в лист ожидания."
            : meeting.auto_accept
              ? "Заявка будет принята сразу."
              : "Организатор рассмотрит заявку."}
        </p>
        <button
          onClick={() => run(() => apply.mutateAsync(message))}
          disabled={apply.isPending}
          className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-500 disabled:opacity-60"
        >
          {apply.isPending
            ? "Отправляем…"
            : meeting.free_places === 0
              ? "Встать в лист ожидания"
              : "Записаться"}
        </button>
      </div>
    );
  } else {
    body = <p className="text-sm text-slate-400">Запись на эту встречу закрыта.</p>;
  }

  return (
    <section className="space-y-3 rounded-xl border border-white/10 bg-[#131a30] p-5">
      <h2 className="text-xs font-medium uppercase tracking-wide text-slate-400">Участие</h2>
      {body}
      {error && <p className="text-sm text-red-400">{error}</p>}
    </section>
  );
}
