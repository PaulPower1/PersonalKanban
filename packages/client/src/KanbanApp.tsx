import { useState, useCallback, useEffect } from 'react';
import './App.css';
import { Card, KanbanBoard, ParsedCardData, ColumnId, Priority } from './types';
import { parseCardTranscript } from './utils/parseCardTranscript';
import { parseVoiceCommand, findCardByTitle } from './utils/parseVoiceCommand';
import { useAppState } from './hooks/useAppState';
import { useBoard } from './hooks/useBoard';
import { useVoiceReadout } from './hooks/useVoiceReadout';
import { useVoiceDictation } from './hooks/useVoiceDictation';
import { Toolbar } from './components/Toolbar/Toolbar';
import { Board } from './components/Board/Board';
import { CardModal } from './components/CardModal/CardModal';
import { Sidebar } from './components/Sidebar/Sidebar';
import { CategoryManager } from './components/CategoryManager/CategoryManager';
import { ImportBanner } from './components/ImportBanner/ImportBanner';
import { useAuth } from './contexts/AuthContext';
import { useToast } from './contexts/ToastContext';

export function KanbanApp() {
  const { user, logout } = useAuth();
  const { showToast } = useToast();

  const {
    boards,
    activeBoard,
    activeBoardId,
    loading: boardsLoading,
    setActiveBoard,
    addBoard,
    deleteBoard,
    updateBoardTitle,
    refreshBoards,
    refreshBoard,
    billingStatus,
    refreshBilling,
  } = useAppState();

  const {
    getColumnCards,
    addCard,
    updateCard,
    deleteCard,
    moveCard,
    getCategoryColorMap,
    allCategories,
    allTags,
  } = useBoard(activeBoard, activeBoardId, refreshBoard);

  const [modalCard, setModalCard] = useState<Card | null | 'new'>(null);
  const [dictatedCardData, setDictatedCardData] = useState<ParsedCardData | null>(null);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [cardLimitError, setCardLimitError] = useState<{
    limit: number;
    currentCount: number;
    tier: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);

  // Voice readout
  const { speak, stop, isSpeaking, isSupported: isListenSupported } = useVoiceReadout();

  const handleListen = useCallback(() => {
    if (activeBoard) speak(activeBoard);
  }, [speak, activeBoard]);

  // Voice dictation — command routing
  const handleDictationResult = useCallback(
    (transcript: string) => {
      if (!activeBoard) return;
      const command = parseVoiceCommand(transcript);

      if (command.type === 'move') {
        const card = findCardByTitle(command.cardTitle, activeBoard.cards);
        if (card) {
          moveCard(card.id, command.targetColumn, 0);
        }
        return;
      }

      // Fall through to card creation
      const parsed = parseCardTranscript(transcript, allCategories);
      setDictatedCardData(parsed);
      setModalCard('new');
    },
    [allCategories, activeBoard, moveCard]
  );

  const {
    startListening: onDictate,
    stopListening: onStopDictate,
    isListening: isDictating,
    isSupported: isDictateSupported,
  } = useVoiceDictation(handleDictationResult);

  const handleAddCard = useCallback(() => {
    setDictatedCardData(null);
    setCardLimitError(null);
    setModalCard('new');
  }, []);

  const handleEditCard = useCallback((card: Card) => {
    setDictatedCardData(null);
    setCardLimitError(null);
    setModalCard(card);
  }, []);

  const handleCloseModal = useCallback(() => {
    setModalCard(null);
    setDictatedCardData(null);
    setCardLimitError(null);
  }, []);

  const handleSaveCard = useCallback(
    async (data: {
      title: string;
      description: string;
      category: string;
      priority: Priority;
      dueDate: string | null;
      tags: string[];
      columnId: ColumnId;
    }) => {
      setSaving(true);
      setCardLimitError(null);
      try {
        await addCard(data);
        setModalCard(null);
        setDictatedCardData(null);
        refreshBilling();
      } catch (err: unknown) {
        const apiErr = err as { details?: { code?: string; limit?: number; currentCount?: number; tier?: string } };
        if (apiErr.details?.code === 'CARD_LIMIT_EXCEEDED') {
          setCardLimitError({
            limit: apiErr.details.limit!,
            currentCount: apiErr.details.currentCount!,
            tier: apiErr.details.tier!,
          });
          showToast(
            `Card limit reached (${apiErr.details.currentCount}/${apiErr.details.limit})`,
            { label: 'Upgrade Plan', href: '/billing' }
          );
        }
      } finally {
        setSaving(false);
      }
    },
    [addCard, refreshBilling, showToast]
  );

  const handleTitleChange = useCallback(
    (title: string) => {
      if (activeBoardId) updateBoardTitle(activeBoardId, title);
    },
    [activeBoardId, updateBoardTitle]
  );

  const handleImport = useCallback(
    (board: KanbanBoard) => {
      // File import handled via old mechanism for non-API boards
      void board;
    },
    []
  );

  const handleCategoryManagerSave = useCallback(
    (_board: KanbanBoard) => {
      // Refresh board data from server
      refreshBoard();
    },
    [refreshBoard]
  );

  const categoryColorMap = getCategoryColorMap();

  // Dev-only: expose dictation handler for E2E tests
  useEffect(() => {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__testInjectTranscript = (transcript: string) => {
        handleDictationResult(transcript);
      };
    }
  }, [handleDictationResult]);

  if (boardsLoading) {
    return (
      <div className="app">
        <div className="toolbar">
          <div className="skeleton-text" style={{ width: '200px', height: '24px' }} />
        </div>
        <div className="app__body">
          <div className="sidebar">
            <div className="sidebar__header">Boards</div>
            <div className="skeleton-item" />
            <div className="skeleton-item" />
            <div className="skeleton-item" />
          </div>
          <div className="board">
            <div className="skeleton-column" />
            <div className="skeleton-column" />
            <div className="skeleton-column" />
            <div className="skeleton-column" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <Toolbar
        board={activeBoard}
        onImport={handleImport}
        onAddCard={handleAddCard}
        onTitleChange={handleTitleChange}
        onOpenCategories={() => setShowCategoryManager(true)}
        onListen={handleListen}
        onStopListen={stop}
        isSpeaking={isSpeaking}
        isListenSupported={isListenSupported}
        onDictate={onDictate}
        onStopDictate={onStopDictate}
        isDictating={isDictating}
        isDictateSupported={isDictateSupported}
        userName={user?.displayName}
        onLogout={logout}
      />

      <ImportBanner onImported={refreshBoards} />

      <div className="app__body">
        <Sidebar
          boards={boards}
          activeBoardId={activeBoardId || ''}
          onSelectBoard={setActiveBoard}
          onAddBoard={addBoard}
          onDeleteBoard={deleteBoard}
          billingStatus={billingStatus}
        />
        {activeBoard && (
          <Board
            getColumnCards={getColumnCards}
            moveCard={moveCard}
            categoryColorMap={categoryColorMap}
            onEditCard={handleEditCard}
          />
        )}
      </div>

      {modalCard !== null && (
        <CardModal
          card={modalCard === 'new' ? null : modalCard}
          allCategories={allCategories}
          allTags={allTags}
          initialCardData={dictatedCardData ?? undefined}
          onSave={handleSaveCard}
          onUpdate={updateCard}
          onDelete={deleteCard}
          onClose={handleCloseModal}
          saving={saving}
          cardLimitError={cardLimitError}
        />
      )}

      {showCategoryManager && activeBoard && (
        <CategoryManager
          board={activeBoard}
          onSave={handleCategoryManagerSave}
          onClose={() => setShowCategoryManager(false)}
        />
      )}
    </div>
  );
}
