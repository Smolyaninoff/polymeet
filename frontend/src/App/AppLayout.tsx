import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Navbar } from "@/widgets/navbar/Navbar";
import { CreateMeetingModal } from "@/widgets/create-meeting/CreateMeetingModal";
import type { MeetingFormData } from "@/features/meetings/types";
import {
  useCreateMeeting,
  useUpdateMeeting,
} from "@/features/meetings/hooks";

export function AppLayout() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const createMeetingMutation = useCreateMeeting();
  const updateMeetingMutation = useUpdateMeeting();

  const handleCreate = async (data: MeetingFormData) => {
    try {
      // 1. Save the meeting in the backend.
      const createdMeeting = await createMeetingMutation.mutateAsync({
        title: data.title.trim(),
        description: data.description.trim(),
        category: data.categoryId,
        starts_at: new Date(data.date).toISOString(),
        duration_minutes: 120,
        address: data.address.trim(),
        capacity: data.maxSeats,
        auto_accept: false,
      });

      // 2. Publish it so it appears in the public feed.
      await updateMeetingMutation.mutateAsync({
        id: createdMeeting.id,
        input: {
          status: "published",
        },
      });
    } catch (error) {
      console.error("Failed to create meeting:", error);

      alert(
        error instanceof Error
          ? `Не удалось создать встречу: ${error.message}`
          : "Не удалось создать встречу"
      );
    }
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