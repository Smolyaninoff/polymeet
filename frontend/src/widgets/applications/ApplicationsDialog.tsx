import { useDecideApplication, useMeetingApplications } from "@/features/applications/hooks";

export function ApplicationsDialog({ meetingId, onClose }: { meetingId: number; onClose: () => void }) {
  const applications = useMeetingApplications(meetingId);
  const decision = useDecideApplication();
  const items = applications.data?.pages.flatMap((page) => page.items) ?? [];
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4">
      <section role="dialog" aria-modal="true" aria-label="Заявки" className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-xl bg-[#131a30] p-6 text-white">
        <div className="mb-4 flex justify-between"><h2>Заявки на встречу</h2><button onClick={onClose}>Закрыть</button></div>
        {applications.isLoading && <p>Загружаем заявки…</p>}
        {applications.error && <p role="alert">Не удалось загрузить заявки.</p>}
        {!applications.isLoading && items.length === 0 && <p>Заявок пока нет.</p>}
        {items.map((item) => <div key={item.id} className="border-t border-white/10 py-3">
          <p>{item.user.display_name} · {item.status}</p>
          {item.message && <p className="text-sm text-slate-400">{item.message}</p>}
          {(item.status === "pending" || item.status === "waitlist") && <div className="mt-2 flex gap-2">
            <button disabled={decision.isPending} className="rounded bg-blue-600 px-3 py-1" onClick={() => decision.mutate({ applicationId: item.id, input: { decision: "accepted" } })}>Принять</button>
            <button disabled={decision.isPending} className="rounded bg-white/10 px-3 py-1" onClick={() => decision.mutate({ applicationId: item.id, input: { decision: "rejected" } })}>Отклонить</button>
          </div>}
        </div>)}
        {decision.error && <p role="alert" className="text-red-400">{decision.error.message}</p>}
        {applications.hasNextPage && <button onClick={() => void applications.fetchNextPage()}>Загрузить ещё</button>}
      </section>
    </div>
  );
}
