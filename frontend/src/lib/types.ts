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
  google_client_id?: string;
  google_client_secret?: string;
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

// ─── Habits ───

export type FrequencyType = "daily" | "specific_days" | "times_per_week" | "every_n_days";
export type HabitStatus = "active" | "paused" | "archived";

export interface Habit {
  id: string;
  title: string;
  description: string | null;
  frequency_type: FrequencyType;
  frequency_value: Record<string, unknown>;
  target_value: number | null;
  target_unit: string | null;
  status: HabitStatus;
  goal_id: string | null;
  start_date: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface HabitDetail extends Habit {
  streak: number;
}

export interface HabitLog {
  id: string;
  habit_id: string;
  log_date: string;
  completed: boolean;
  value: number | null;
  note: string | null;
  source: string;
  created_at: string;
}

export interface HabitCreate {
  title: string;
  description?: string;
  frequency_type?: FrequencyType;
  frequency_value?: Record<string, unknown>;
  target_value?: number;
  target_unit?: string;
  goal_id?: string;
  start_date?: string;
}

export interface TodayHabitItem {
  id: string;
  title: string;
  frequency_type: string;
  scheduled_today: boolean;
  checked_in: boolean;
  completed: boolean;
  value: number | null;
  target_value: number | null;
  target_unit: string | null;
  streak: number;
  note: string | null;
}

export interface TodaySummary {
  date: string;
  total: number;
  completed: number;
  habits: TodayHabitItem[];
}

// ─── Habit Analytics ───

export interface HeatmapData {
  dates: Record<string, number>;
}

export interface TrendDay {
  date: string;
  total: number;
  completed: number;
  rate: number;
}

export interface WeekdayRate {
  day: string;
  rate: number;
}

export interface TrendData {
  daily: TrendDay[];
  weekday: WeekdayRate[];
}

export interface CompletionHabit {
  id: string;
  title: string;
  rate: number;
  total_days: number;
  completed_days: number;
}

export interface CompletionData {
  habits: CompletionHabit[];
}

export interface CorrelationPair {
  habit_a: string;
  habit_b: string;
  habit_a_title: string;
  habit_b_title: string;
  correlation: number;
}

export interface CorrelationData {
  pairs: CorrelationPair[];
}

export interface InsightResult {
  id: string;
  content: string;
  generated_at: string;
}

// ─── Automations ───

export interface AutomationRule {
  id: string;
  name: string;
  description: string | null;
  trigger_event: string;
  trigger_condition: Record<string, unknown>;
  action_type: string;
  action_config: Record<string, unknown>;
  confidence: number;
  is_active: boolean;
  execution_count: number;
  last_executed_at: string | null;
  created_at: string;
}

// ─── Knowledge ───

export interface KnowledgeDocument {
  id: string;
  title: string;
  source_type: string;
  source_url: string | null;
  chunk_count: number;
  status: string;
  created_at: string;
}

export interface AutomationRuleCreate {
  name: string;
  trigger_event: string;
  trigger_condition?: Record<string, unknown>;
  action_type: string;
  action_config: Record<string, unknown>;
  description?: string;
}

// ─── Ontology ───

export interface OntologyObjectType {
  id: string;
  name: string;
  parent_category: string;
  description: string | null;
  schema: Record<string, string>;
  is_system: boolean;
}

export interface OntologyLinkType {
  id: string;
  name: string;
  cardinality: string;
  description: string | null;
  is_system: boolean;
}

export interface OntologyNode {
  id: string;
  name: string;
  type_name: string;
  parent_category: string;
  properties: Record<string, unknown>;
  status: string;
  confidence: number;
  source_type: string;
  created_at: string;
  updated_at: string;
}

export interface OntologyEdge {
  id: string;
  source_id: string;
  target_id: string;
  relation: string;
  properties: Record<string, unknown>;
  confidence: number;
}

export interface OntologyGraph {
  nodes: OntologyNode[];
  edges: OntologyEdge[];
}

export interface OntologyStats {
  total_nodes: number;
  total_edges: number;
  nodes_by_category: Record<string, number>;
  draft_count: number;
  avg_confidence: number;
}

// ─── Ontology Insights ───

export interface OntologyInsight {
  id: string;
  insight_type: string;
  title: string;
  description: string;
  evidence: Record<string, unknown>;
  confidence: number;
  actionable: boolean;
  action_suggestion: string | null;
  status: string;
  created_at: string;
}

export interface InsightSummary {
  total: number;
  new_count: number;
  by_type: Record<string, number>;
}

// ─── Ontology Automations ───

export interface OntologyAutomation {
  id: string;
  name: string;
  insight_type: string;
  action_type: string;
  config: Record<string, unknown>;
  auto_execute: boolean;
  enabled: boolean;
  created_at: string;
}

export interface OntologyAutomationLog {
  id: string;
  automation_id: string;
  insight_id: string | null;
  action_taken: string;
  result: Record<string, unknown>;
  status: string;
  created_at: string;
}

// ─── Graph Visualization ───

export interface GraphNodeData {
  id: string;
  name: string;
  typeName: string;
  parentCategory: string;
  properties: Record<string, unknown>;
  confidence: number;
  status: string;
  val: number;
  color: string;
  x?: number;
  y?: number;
}

export interface GraphLinkData {
  source: string;
  target: string;
  relation: string;
  confidence: number;
  properties: Record<string, unknown>;
}
