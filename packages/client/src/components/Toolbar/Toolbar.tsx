import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { KanbanBoard } from '../../types';
import { downloadBoardAsCsv, readBoardFromFile } from '../../utils/export';

interface Props {
  board: KanbanBoard | null;
  onImport: (board: KanbanBoard) => void;
  onAddCard: () => void;
  onTitleChange: (title: string) => void;
  onOpenCategories: () => void;
  // Voice readout
  onListen: () => void;
  onStopListen: () => void;
  isSpeaking: boolean;
  isListenSupported: boolean;
  // Voice dictation
  onDictate: () => void;
  onStopDictate: () => void;
  isDictating: boolean;
  isDictateSupported: boolean;
  // User
  userName?: string;
  onLogout?: () => void;
  // Mobile
  onToggleMobileSidebar?: () => void;
}

export function Toolbar({
  board,
  onImport,
  onAddCard,
  onTitleChange,
  onOpenCategories,
  onListen,
  onStopListen,
  isSpeaking,
  isListenSupported,
  onDictate,
  onStopDictate,
  isDictating,
  isDictateSupported,
  userName,
  onLogout,
  onToggleMobileSidebar,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(board?.title ?? '');

  const handleExport = () => {
    if (board) downloadBoardAsCsv(board);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const data = await readBoardFromFile(file);
      onImport(data);
    } catch (err) {
      alert('Failed to import: ' + (err instanceof Error ? err.message : 'Invalid file'));
    }

    e.target.value = '';
  };

  const handleTitleDoubleClick = () => {
    if (!board) return;
    setTitleDraft(board.title);
    setIsEditingTitle(true);
  };

  const handleTitleBlur = () => {
    setIsEditingTitle(false);
    const trimmed = titleDraft.trim();
    if (trimmed && board && trimmed !== board.title) {
      onTitleChange(trimmed);
    }
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur();
    } else if (e.key === 'Escape') {
      setTitleDraft(board?.title ?? '');
      setIsEditingTitle(false);
    }
  };

  return (
    <div className="toolbar">
      {onToggleMobileSidebar && (
        <button className="toolbar__hamburger" onClick={onToggleMobileSidebar} title="Toggle sidebar">
          <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="2" y1="4" x2="14" y2="4" />
            <line x1="2" y1="8" x2="14" y2="8" />
            <line x1="2" y1="12" x2="14" y2="12" />
          </svg>
        </button>
      )}

      {isEditingTitle ? (
        <input
          className="toolbar__title-input"
          value={titleDraft}
          onChange={(e) => setTitleDraft(e.target.value)}
          onBlur={handleTitleBlur}
          onKeyDown={handleTitleKeyDown}
          autoFocus
        />
      ) : (
        <h1
          className="toolbar__title"
          onDoubleClick={handleTitleDoubleClick}
          title="Double-click to rename"
        >
          {board?.title ?? 'Personal Kanban'}
        </h1>
      )}

      <div className="toolbar__actions">
        {/* Voice group */}
        {(isListenSupported || isDictateSupported) && (
          <>
            <div className="toolbar__group">
              {isListenSupported && (
                <button
                  className={`toolbar__btn${isSpeaking ? ' toolbar__btn--active' : ''}`}
                  onClick={isSpeaking ? onStopListen : onListen}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="2,5 6,5 10,2 10,14 6,11 2,11" fill="currentColor" stroke="none" />
                    <path d="M12 5.5c.8.8.8 4.2 0 5" />
                    <path d="M13.5 4c1.3 1.5 1.3 6.5 0 8" />
                  </svg>
                  <span className="toolbar__btn-label">{isSpeaking ? 'Stop' : 'Listen'}</span>
                </button>
              )}
              {isDictateSupported && (
                <button
                  className={`toolbar__btn${isDictating ? ' toolbar__btn--recording' : ''}`}
                  onClick={isDictating ? onStopDictate : onDictate}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="5" y="1" width="6" height="9" rx="3" />
                    <path d="M3 7a5 5 0 0 0 10 0" />
                    <line x1="8" y1="12" x2="8" y2="15" />
                  </svg>
                  <span className="toolbar__btn-label">{isDictating ? 'Listening...' : 'Dictate'}</span>
                </button>
              )}
            </div>
            <div className="toolbar__separator" />
          </>
        )}

        {/* Content group */}
        <div className="toolbar__group">
          <button className="toolbar__btn" onClick={onOpenCategories}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="1" y="1" width="6" height="6" rx="1" />
              <rect x="9" y="1" width="6" height="6" rx="1" />
              <rect x="1" y="9" width="6" height="6" rx="1" />
              <rect x="9" y="9" width="6" height="6" rx="1" />
            </svg>
            <span className="toolbar__btn-label">Categories</span>
          </button>
          <button className="toolbar__btn" onClick={handleImportClick}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 10V2" />
              <path d="M5 5l3-3 3 3" />
              <path d="M2 10v3a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-3" />
            </svg>
            <span className="toolbar__btn-label">Import</span>
          </button>
          <button className="toolbar__btn" onClick={handleExport}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 2v8" />
              <path d="M5 7l3 3 3-3" />
              <path d="M2 10v3a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-3" />
            </svg>
            <span className="toolbar__btn-label">Export</span>
          </button>
          <button className="toolbar__btn toolbar__btn--primary" onClick={onAddCard}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <circle cx="8" cy="8" r="6.5" />
              <line x1="8" y1="5" x2="8" y2="11" />
              <line x1="5" y1="8" x2="11" y2="8" />
            </svg>
            <span className="toolbar__btn-label">Add Card</span>
          </button>
        </div>

        <div className="toolbar__separator" />

        {/* Navigation group */}
        <div className="toolbar__group">
          <Link to="/billing" className="toolbar__btn">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="1" y="3" width="14" height="10" rx="2" />
              <line x1="1" y1="7" x2="15" y2="7" />
            </svg>
            <span className="toolbar__btn-label">Billing</span>
          </Link>
          {userName && (
            <div className="toolbar__user">
              <span className="toolbar__user-name">{userName}</span>
              {onLogout && (
                <button className="toolbar__btn" onClick={onLogout}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 14H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1h3" />
                    <path d="M10 11l3-3-3-3" />
                    <line x1="6" y1="8" x2="13" y2="8" />
                  </svg>
                  <span className="toolbar__btn-label">Logout</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
    </div>
  );
}
