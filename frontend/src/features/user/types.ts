import type { UserOut, UserUpdateInput } from "@/shared/api/schema";

export interface UserProfile {
  id: number;
  email: string;
  displayName: string;
  university: string;
  faculty: string;
  telegramUsername: string;
  bio: string;
  reliabilityScore: number | null;
  attendedCount: number;
  markedCount: number;
  settings: {
    telegramBotNotifications: boolean;
    nearbyMeetingsNotifications: boolean;
    contactsVisibleToApprovedOnly: boolean;
    showLocation: boolean;
    notificationRadiusKm: number;
  };
}

export function toUserProfile(user: UserOut): UserProfile {
  return {
    id: user.id,
    email: user.email,
    displayName: user.display_name,
    university: user.university,
    faculty: user.faculty,
    telegramUsername: user.telegram_username,
    bio: user.bio,
    reliabilityScore:
      user.attendance_rate === null ? null : Math.round(user.attendance_rate * 100),
    attendedCount: user.attended_count,
    markedCount: user.marked_count,
    settings: {
      telegramBotNotifications: user.telegram_notifications,
      nearbyMeetingsNotifications: user.nearby_notifications,
      contactsVisibleToApprovedOnly: user.contacts_accepted_only,
      showLocation: user.show_location,
      notificationRadiusKm: user.notification_radius_km,
    },
  };
}

export function toUserUpdate(user: UserProfile): UserUpdateInput {
  return {
    display_name: user.displayName,
    university: user.university,
    faculty: user.faculty,
    telegram_username: user.telegramUsername,
    bio: user.bio,
    telegram_notifications: user.settings.telegramBotNotifications,
    nearby_notifications: user.settings.nearbyMeetingsNotifications,
    contacts_accepted_only: user.settings.contactsVisibleToApprovedOnly,
    show_location: user.settings.showLocation,
    notification_radius_km: user.settings.notificationRadiusKm,
  };
}
