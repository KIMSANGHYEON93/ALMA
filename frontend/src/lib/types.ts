/**
 * ALMA API Types — auto-derived from OpenAPI schema
 * Source: GET /openapi.json
 *
 * 이 파일은 백엔드 API 스펙과 1:1 매칭됩니다.
 * 백엔드 스키마 변경 시 이 파일도 업데이트 필요.
 */

// ─── Auth ───

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  display_name?: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

// ─── Conversations ───

export interface Conversation {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Messages ───

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export interface MessagesPage {
  messages: Message[];
  has_more: boolean;
}

// ─── Goals ───

export type GoalCategory = "personal" | "career" | "health" | "learning" | "finance" | "other";
export type GoalStatus = "active" | "completed" | "paused" | "abandoned";

export interface Goal {
  id: string;
  title: string;
  description: string | null;
  category: GoalCategory;
  status: GoalStatus;
  target_date: string | null;
  progress: number;
  created_at: string;
  updated_at: string;
}

export interface GoalDetail extends Goal {
  milestones: Milestone[];
  suggest_complete: boolean;
}

export interface GoalSummary {
  total_goals: number;
  active_goals: number;
  average_progress: number;
}

export interface GoalCreate {
  title: string;
  description?: string;
  category?: GoalCategory;
  target_date?: string;
}

export interface GoalUpdate {
  title?: string;
  description?: string;
  category?: GoalCategory;
  target_date?: string;
}

export interface Milestone {
  id: string;
  title: string;
  description: string | null;
  status: "pending" | "completed";
  sort_order: number;
  completed_at: string | null;
}

// ─── Profile / Preferences ───

export interface UserPreferences {
  language?: string;
  response_style?: string;
  interests?: string[];
  timezone?: string;
  [key: string]: unknown;  // explicit preferences are user-defined
}

// ─── Integrations ───

export type IntegrationProvider = "google_calendar";
export type IntegrationStatus = "pending" | "active" | "disconnected" | "expired";

export interface Integration {
  id: string;
  provider: IntegrationProvider;
  status: IntegrationStatus;
  created_at: string;
}

export interface AuthUrlResponse {
  auth_url: string;
}

export interface CalendarEvent {
  id: string;
  summary: string;
  start: string;
  end: string;
  timezone?: string;
}

// ─── Insights / Retrospectives ───

export type InsightCategory = "topic_trend" | "goal_pattern" | "activity_pattern" | "recommendation";

export interface Retrospective {
  id: string;
  period_type: string;
  period_start: string;
  period_end: string;
  summary: string;
  highlights: string[];
  challenges: string[];
  goals_progress: Record<string, unknown>;
  conversation_count: number;
  message_count: number;
  created_at: string;
  insights?: InsightItem[];
}

export interface InsightItem {
  id: string;
  category: InsightCategory;
  title: string;
  content: string;
  data: Record<string, unknown>;
  source_period: string | null;
  created_at: string;
}

export interface InsightDashboard {
  latest_retrospective: Retrospective | null;
  recent_insights: InsightItem[];
  stats: {
    active_goals: number;
    completed_goals: number;
    streak_days: number;
  };
}
