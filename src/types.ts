// Core domain types for RecodeX.
// These mirror the relational schema in schema.sql (patterns 1—n problems 1—n revisions; sessions n—n problems).

export type Rating = 'green' | 'yellow' | 'red';
export type Phase = 'Reconstruction' | 'Recall/Repair' | 'Quick Recall';
export type Priority = 'High' | 'Medium' | 'Low';
export type Difficulty = 'Easy' | 'Medium' | 'Hard';
export type Track = 'active' | 'backlog';
export type LearningState = 'active' | 'yet_to_learn' | 'learning' | 'completed';
export type Status = 'Yet to Learn' | 'Not Reviewed' | 'Overdue' | 'Due Today' | 'Scheduled' | 'Mastered';
export type UrlKind = 'leetcode' | 'gfg' | 'search' | 'other' | '';

export const PHASES: Phase[] = ['Reconstruction', 'Recall/Repair', 'Quick Recall'];
export const PRIORITIES: Priority[] = ['High', 'Medium', 'Low'];
export const DIFFICULTIES: Difficulty[] = ['Easy', 'Medium', 'Hard'];
export const RATINGS: Rating[] = ['green', 'yellow', 'red'];
export const STATUSES: Status[] = ['Overdue', 'Due Today', 'Scheduled', 'Mastered', 'Not Reviewed', 'Yet to Learn'];

export interface Pattern {
  id: string;
  name: string;
  order: number;
  subPatterns: string[];
  learning: LearningState;
  description: string;
  createdAt: string;
}

export interface Problem {
  id: string;            // document id, e.g. "p-101"
  num: number;           // human-facing Problem ID (#101)
  name: string;
  patternId: string;
  subPattern: string;
  difficulty: Difficulty;
  url: string;
  priority: Priority;
  track: Track;
  lastRating: Rating | null;
  lastRevised: string | null;   // YYYY-MM-DD (local)
  nextReview: string | null;    // YYYY-MM-DD (local)
  phase: Phase;
  phaseManual: boolean;
  consecutiveGreen: number;
  revisionCount: number;
  weakness: string;      // main weakness (latest)
  notes: string;         // mistake notes / general notes
  learnedAt: string | null;     // solved while learning a backlog topic
  importedName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProblemSnapshot {
  lastRating: Rating | null;
  lastRevised: string | null;
  nextReview: string | null;
  consecutiveGreen: number;
  revisionCount: number;
  phase: Phase;
  phaseManual: boolean;
  priority: Priority;
  weakness: string;
  track: Track;                 // rating a backlog problem activates it; undo must put it back
  learnedAt: string | null;
  // Snapshots stored before these fields existed lack them; undo then keeps the current value.
}

export interface Revision {
  id: string;
  problemId: string;
  date: string;          // YYYY-MM-DD local
  at: string;            // ISO timestamp
  rating: Rating;
  phase: Phase;
  timeMin: number | null;
  independent: boolean | null;
  mistake: string;
  notes: string;
  sessionId: string | null;
  source: 'import' | 'quick' | 'today' | 'session';
  nextReview: string;
  prev: ProblemSnapshot | null;  // state before this revision (enables undo of the latest one)
}

// 'interview' and 'random' were presets before; they stay in the type so older sessions keep their kind.
export type Preset = 'daily' | 'weakness' | 'overdue' | 'mastery' | 'custom' | 'today' | 'interview' | 'random';
export type Strategy = 'random' | 'weakest' | 'overdue' | 'balanced';
export type DiffChoice = 'all' | 'Easy' | 'Medium' | 'Hard' | 'easy-medium';

export interface SessionConfig {
  preset: Preset;
  count: number;
  difficulty: DiffChoice;
  patternCount: number;   // 0 = all
  strategy: Strategy;
  includeSolved: boolean;
  includeNew: boolean;
  excludeRecentDays: number;  // 0 = off
  patternIds: string[];       // empty = any
  phases: Phase[];            // empty = any
  onlyDue: boolean;
  onlyOverdue: boolean;
  onlyWeak: boolean;
}

export interface SessionResult {
  problemId: string;
  outcome: 'rated' | 'skipped';
  rating: Rating | null;
  timeSec: number;
  revisionId: string | null;
}

export interface Session {
  id: string;
  kind: Preset;
  title: string;
  config: SessionConfig | null;
  problemIds: string[];
  results: SessionResult[];
  index: number;
  startedAt: string;
  endedAt: string | null;
  status: 'in_progress' | 'completed' | 'abandoned';
  elapsedSec: number;
}

export interface Settings {
  dailyTarget: number;
  redDays: number;
  yellowDays: number;
  greenLadder: number[];
  yellowResetsStreak: boolean;
  masteryStreak: number;
  autoPriority: boolean;
  focusIncludeWeak: boolean;
  focusIncludeHigh: boolean;
  focusNewPerDay: number;
  studyPlanPatternIds: string[];
  activationDelayDays: number;
  defaultSessionSize: number;
  defaultDifficulty: DiffChoice;
  theme: 'system' | 'light' | 'dark';
  weekStart: 0 | 1;
  notifyOverdueBanner: boolean;
  notifyTargetReminder: boolean;
  recentDays: number;
  /** Shown in the dashboard greeting. */
  displayName: string;
  /** Lifetime milestones reached: milestone id → local date (YYYY-MM-DD). Never removed. */
  milestones: Record<string, string>;
}

export interface Meta {
  settings: Settings;
  nextNum: number;
  importedAt: string | null;
  schemaVersion: number;
}

export const DEFAULT_SETTINGS: Settings = {
  dailyTarget: 10,
  redDays: 1,
  yellowDays: 3,
  greenLadder: [7, 14, 30, 60],
  yellowResetsStreak: true,
  masteryStreak: 4,
  autoPriority: true,
  focusIncludeWeak: true,
  focusIncludeHigh: true,
  focusNewPerDay: 2,
  studyPlanPatternIds: [],
  activationDelayDays: 1,
  defaultSessionSize: 10,
  defaultDifficulty: 'all',
  theme: 'light',   // Dawn
  weekStart: 1,
  notifyOverdueBanner: true,
  notifyTargetReminder: true,
  recentDays: 2,
  displayName: '',
  milestones: {},
};
