import { apiFetch } from './client';

export interface BoardSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  _count: { cards: number };
}

export interface BoardDetail {
  id: string;
  title: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  cards: ServerCard[];
  categories: ServerCategory[];
}

export interface ServerCard {
  id: string;
  boardId: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  dueDate: string | null;
  tags: string[];
  columnId: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface ServerCategory {
  id: string;
  boardId: string;
  name: string;
  color: string;
}

export function listBoards(): Promise<BoardSummary[]> {
  return apiFetch<BoardSummary[]>('/boards');
}

export function getBoard(id: string): Promise<BoardDetail> {
  return apiFetch<BoardDetail>(`/boards/${id}`);
}

export function createBoard(title: string): Promise<BoardDetail> {
  return apiFetch<BoardDetail>('/boards', {
    method: 'POST',
    body: JSON.stringify({ title }),
  });
}

export function updateBoard(id: string, title: string): Promise<void> {
  return apiFetch('/boards/' + id, {
    method: 'PATCH',
    body: JSON.stringify({ title }),
  });
}

export function deleteBoard(id: string): Promise<void> {
  return apiFetch('/boards/' + id, { method: 'DELETE' });
}

export function createCard(
  boardId: string,
  data: {
    title: string;
    description: string;
    category: string;
    priority: string;
    dueDate: string | null;
    tags: string[];
    columnId: string;
  }
): Promise<ServerCard> {
  return apiFetch<ServerCard>(`/boards/${boardId}/cards`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateCard(
  boardId: string,
  cardId: string,
  data: Partial<{
    title: string;
    description: string;
    category: string;
    priority: string;
    dueDate: string | null;
    tags: string[];
    columnId: string;
    order: number;
  }>
): Promise<ServerCard> {
  return apiFetch<ServerCard>(`/boards/${boardId}/cards/${cardId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function deleteCard(boardId: string, cardId: string): Promise<void> {
  return apiFetch(`/boards/${boardId}/cards/${cardId}`, { method: 'DELETE' });
}

export function reorderCards(
  boardId: string,
  cards: { id: string; columnId: string; order: number }[]
): Promise<void> {
  return apiFetch(`/boards/${boardId}/cards/reorder`, {
    method: 'POST',
    body: JSON.stringify({ cards }),
  });
}

export function importBoards(boards: unknown[]): Promise<void> {
  return apiFetch('/boards/import', {
    method: 'POST',
    body: JSON.stringify({ boards }),
  });
}
