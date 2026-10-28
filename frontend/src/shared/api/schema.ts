// === Auth ===
export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: UserOut;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  email: string;
  password: string;
  display_name: string;
}

export interface RefreshInput {
  refresh_token: string;
}

// === Users ===
export interface UserOut {
  id: number;
  email: string;
  display_name: string;
  role: number;
  attended_count: number;
  marked_count: number;
  attendance_rate: number | null;
  created_at: string;
}

export interface PublicUserOut {
  id: number;
  display_name: string;
  attended_count: number;
  marked_count: number;
  attendance_rate: number | null;
}

// === Categories ===
export interface CategoryOut {
  id: number;
  slug: string;
  title: string;
}

// === Meetings ===
export type MeetingStatus = "draft" | "published" | "cancelled" | "finished";
export type GeoStatus = "pending" | "resolved" | "manual" | "failed";

export interface MeetingListItem {
  id: number;
  status: MeetingStatus;
  geo_status: GeoStatus;
  title: string;
  category: string;
  starts_at: string;
  duration_minutes: number;
  address: string;
  lat: number | null;
  lon: number | null;
  capacity: number;
  accepted_count: number;
  free_places: number;
  organizer: {
    id: number;
    display_name: string;
  };
  distance_km: number | null;
}

export interface MeetingOut extends MeetingListItem {
  description: string;
  address_hint: string | null;
  address_norm: string | null;
  auto_accept: boolean;
  organizer: {
    id: number;
    display_name: string;
    attendance_rate: number | null;
  };
  my_application: {
    id: number;
    status: ApplicationStatus;
  } | null;
  created_at: string;
}

export interface MeetingPage {
  items: MeetingListItem[];
  next_cursor: string | null;
}

export interface CreateMeetingInput {
  title: string;
  description?: string;
  category: string;
  starts_at: string;
  duration_minutes: number;
  address: string;
  address_hint?: string | null;
  capacity: number;
  auto_accept?: boolean;
}

export interface UpdateMeetingInput {
  title?: string;
  description?: string;
  category?: string;
  starts_at?: string;
  duration_minutes?: number;
  address?: string;
  address_hint?: string | null;
  capacity?: number;
  auto_accept?: boolean;
  status?: MeetingStatus;
}

// === Map ===
export interface MapMeetingItem {
  id: number;
  lat: number;
  lon: number;
  title: string;
  category: string;
  starts_at: string;
  address: string;
  free_places: number;
  capacity: number;
}

// === Applications ===
export type ApplicationStatus = "pending" | "accepted" | "rejected" | "waitlist" | "withdrawn";

export interface ApplicationOut {
  id: number;
  meeting_id: number;
  status: ApplicationStatus;
  message: string;
  created_at: string;
  decided_at: string | null;
  user: {
    id: number;
    display_name: string;
    attendance_rate: number | null;
    attended_count: number;
  };
}

export interface MyApplicationItem {
  id: number;
  status: ApplicationStatus;
  message: string;
  created_at: string;
  decided_at: string | null;
  meeting: {
    id: number;
    title: string;
    starts_at: string;
    status: MeetingStatus;
    accepted_count: number;
    capacity: number;
  };
}

export interface ApplicationPage {
  items: ApplicationOut[];
  next_cursor: string | null;
}

export interface MyApplicationPage {
  items: MyApplicationItem[];
  next_cursor: string | null;
}

export interface ApplyInput {
  message?: string;
}

export interface DecisionInput {
  decision: "accepted" | "rejected";
}

// === Errors (RFC 9457) ===
export interface ProblemDetail {
  type: string;
  title: string;
  status: number;
  detail: string;
  code: string;
  instance: string;
  errors?: { field: string; message: string }[];
}

export class ApiError extends Error {
  status: number;
  code: string;
  detail: string;
  errors?: { field: string; message: string }[];
  instance: string;

  constructor(problem: ProblemDetail) {
    super(problem.detail);
    this.status = problem.status;
    this.code = problem.code;
    this.detail = problem.detail;
    this.errors = problem.errors;
    this.instance = problem.instance;
    this.name = "ApiError";
  }
}

// === Generic page ===
export interface Page<T> {
  items: T[];
  next_cursor: string | null;
}