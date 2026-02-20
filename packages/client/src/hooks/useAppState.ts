import { useState, useEffect, useCallback } from 'react';
import { KanbanBoard, Card, BillingStatus } from '../types';
import * as boardsApi from '../api/boards';
import { getBillingStatus } from '../api/stripe';

interface BoardListItem {
  id: string;
  title: string;
  cardCount: number;
}

function serverBoardToKanban(board: boardsApi.BoardDetail): KanbanBoard {
  return {
    id: board.id,
    title: board.title,
    cards: board.cards.map(
      (c): Card => ({
        id: c.id,
        title: c.title,
        description: c.description,
        category: c.category,
        priority: c.priority as Card['priority'],
        dueDate: c.dueDate,
        tags: c.tags,
        columnId: c.columnId as Card['columnId'],
        order: c.order,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      })
    ),
    categories: board.categories.map((c) => c.name),
    categoryColors: board.categories.map((c) => ({
      category: c.name,
      color: c.color,
    })),
  };
}

export function useAppState() {
  const [boards, setBoards] = useState<BoardListItem[]>([]);
  const [activeBoardId, setActiveBoardId] = useState<string | null>(null);
  const [activeBoard, setActiveBoard] = useState<KanbanBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [billingStatus, setBillingStatus] = useState<BillingStatus | null>(null);

  // Load board list
  const refreshBoards = useCallback(async () => {
    try {
      const boardList = await boardsApi.listBoards();
      const items = boardList.map((b) => ({
        id: b.id,
        title: b.title,
        cardCount: b._count.cards,
      }));
      setBoards(items);

      // If no active board or active board was deleted, pick first
      if (items.length > 0) {
        setActiveBoardId((prev) => {
          if (prev && items.some((b) => b.id === prev)) return prev;
          return items[0].id;
        });
      } else {
        setActiveBoardId(null);
        setActiveBoard(null);
      }
    } catch {
      // User might not be authenticated yet
    }
  }, []);

  // Load active board detail
  const refreshBoard = useCallback(async () => {
    if (!activeBoardId) return;
    try {
      const detail = await boardsApi.getBoard(activeBoardId);
      setActiveBoard(serverBoardToKanban(detail));
    } catch {
      setActiveBoard(null);
    }
  }, [activeBoardId]);

  // Load billing status
  const refreshBilling = useCallback(async () => {
    try {
      const status = await getBillingStatus();
      setBillingStatus(status);
    } catch {
      // ignore
    }
  }, []);

  // Initial load
  useEffect(() => {
    Promise.all([refreshBoards(), refreshBilling()]).finally(() =>
      setLoading(false)
    );
  }, [refreshBoards, refreshBilling]);

  // Load board detail when active board changes
  useEffect(() => {
    if (activeBoardId) {
      refreshBoard();
    }
  }, [activeBoardId, refreshBoard]);

  const addBoard = useCallback(
    async (title: string) => {
      const board = await boardsApi.createBoard(title);
      await refreshBoards();
      setActiveBoardId(board.id);
    },
    [refreshBoards]
  );

  const deleteBoard = useCallback(
    async (boardId: string) => {
      await boardsApi.deleteBoard(boardId);
      await refreshBoards();
    },
    [refreshBoards]
  );

  const updateBoardTitle = useCallback(
    async (boardId: string, title: string) => {
      await boardsApi.updateBoard(boardId, title);
      await refreshBoards();
      await refreshBoard();
    },
    [refreshBoards, refreshBoard]
  );

  // Convert boards list to the format the Sidebar expects
  const boardsForSidebar = boards.map((b) => ({
    id: b.id,
    title: b.title,
    cards: Array(b.cardCount).fill(null) as unknown[],
    categories: [] as string[],
    categoryColors: [] as { category: string; color: string }[],
  })) as KanbanBoard[];

  return {
    boards: boardsForSidebar,
    activeBoard,
    activeBoardId,
    loading,
    setActiveBoard: setActiveBoardId,
    addBoard,
    deleteBoard,
    updateBoardTitle,
    refreshBoards,
    refreshBoard,
    billingStatus,
    refreshBilling,
  };
}
