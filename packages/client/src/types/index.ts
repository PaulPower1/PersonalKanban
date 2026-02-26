export type ColumnId = 'backlog' | 'todo' | 'in-progress' | 'done';
export type Priority = 'low' | 'medium' | 'high' | 'urgent';

export interface Card {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: Priority;
  dueDate: string | null;
  tags: string[];
  columnId: ColumnId;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryColor {
  category: string;
  color: string;
}

export interface KanbanBoard {
  id: string;
  title: string;
  cards: Card[];
  categories: string[];
  categoryColors: CategoryColor[];
}

export interface AppState {
  boards: KanbanBoard[];
  activeBoardId: string;
}

export interface ParsedCardData {
  title: string;
  description?: string;
  category?: string;
  priority?: Priority;
  dueDate?: string;
  tags?: string[];
  columnId?: ColumnId;
}

export interface ColumnDefinition {
  id: ColumnId;
  title: string;
  accentColor: string;
  glowColor: string;
  gradient: string;
}

// Legacy types for migration
export interface LegacyCard {
  id: string;
  title: string;
  description: string;
  project: string;
  priority: Priority;
  dueDate: string | null;
  columnId: ColumnId;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface LegacyBoardState {
  cards: LegacyCard[];
  projectColors: { project: string; color: string }[];
}

// Auth types
export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
}

// Billing types
export interface BillingStatus {
  tier: 'FREE' | 'STARTER' | 'PRO';
  cardCount: number;
  cardLimit: number;
}

// Card filters
export interface CardFilters {
  searchText: string;
  category: string;
  tag: string;
  priority: Priority | '';
}

// Card limit error
export interface CardLimitError {
  error: string;
  code: 'CARD_LIMIT_EXCEEDED';
  limit: number;
  currentCount: number;
  tier: string;
}
