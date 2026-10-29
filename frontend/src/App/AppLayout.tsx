import { useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { Navbar } from "@/widgets/navbar/Navbar";
import { CreateMeetingModal } from "@/widgets/create-meeting/CreateMeetingModal";
import type { MeetingFormData } from "@/features/meetings/types";
import { useCreateMeeting, useUpdateMeeting } from "@/features/meetings/hooks";
import { toCreateInput } from "@/lib/meetingPayload";

export function AppLayout() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const navigate = useNavigate();
  const create = useCreateMeeting();
  const update = useUpdateMeeting();

  const handleCreate = async (data: MeetingFormData) => {
    const meeting = await create.mutateAsync(toCreateInput(data));
    if (data.publish) {
      try {
        await update.mutateAsync({ id: meeting.id, input: { status: "published" } });
      } catch {
        // Встреча уже создана черновиком — опубликовать можно со страницы встречи
      }
    }
    navigate(`/meetings/${meeting.id}`);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar onCreateClick={() => setIsCreateOpen(true)} />

      <div className="mx-auto max-w-350 px-4 py-6">
        <Outlet />
      </div>

      <CreateMeetingModal
        key={`create-${isCreateOpen}`}
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreate}
        mode="create"
      />
    </div>
  );
}
