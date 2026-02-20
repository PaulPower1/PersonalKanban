import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { KanbanBoard } from '../../types';
import { downloadBoardAsJson, readBoardFromFile } from '../../utils/export';

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
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(board?.title ?? '');

  const handleExport = () => {
    if (board) downloadBoardAsJson(board);
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
        {isListenSupported && (
          <button
            className={`toolbar__btn${isSpeaking ? ' toolbar__btn--active' : ''}`}
            onClick={isSpeaking ? onStopListen : onListen}
          >
            {isSpeaking ? 'Stop' : 'Listen'}
          </button>
        )}
        {isDictateSupported && (
          <button
            className={`toolbar__btn${isDictating ? ' toolbar__btn--recording' : ''}`}
            onClick={isDictating ? onStopDictate : onDictate}
          >
            {isDictating ? 'Listening...' : 'Dictate'}
          </button>
        )}
        <button className="toolbar__btn" onClick={onOpenCategories}>
          Categories
        </button>
        <button className="toolbar__btn" onClick={handleImportClick}>
          Import
        </button>
        <button className="toolbar__btn" onClick={handleExport}>
          Export
        </button>
        <button className="toolbar__btn toolbar__btn--primary" onClick={onAddCard}>
          + Add Card
        </button>
        <Link to="/billing" className="toolbar__btn">
          Billing
        </Link>
        {userName && (
          <div className="toolbar__user">
            <span className="toolbar__user-name">{userName}</span>
            {onLogout && (
              <button className="toolbar__btn" onClick={onLogout}>
                Logout
              </button>
            )}
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
    </div>
  );
}
