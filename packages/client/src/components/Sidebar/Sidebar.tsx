import { useState } from 'react';
import { Link } from 'react-router-dom';
import { KanbanBoard, BillingStatus } from '../../types';

interface Props {
  boards: KanbanBoard[];
  activeBoardId: string;
  onSelectBoard: (boardId: string) => void;
  onAddBoard: (title: string) => void;
  onDeleteBoard: (boardId: string) => void;
  billingStatus?: BillingStatus | null;
}

export function Sidebar({
  boards,
  activeBoardId,
  onSelectBoard,
  onAddBoard,
  onDeleteBoard,
  billingStatus,
}: Props) {
  const [collapsed, setCollapsed] = useState(false);

  const handleAddBoard = () => {
    const title = `Board ${boards.length + 1}`;
    onAddBoard(title);
  };

  const usagePercent = billingStatus
    ? (billingStatus.cardCount / billingStatus.cardLimit) * 100
    : 0;
  const showUpgradeBadge = usagePercent >= 90;

  return (
    <div className={`sidebar${collapsed ? ' sidebar--collapsed' : ''}`}>
      <button
        className="sidebar__toggle"
        onClick={() => setCollapsed(!collapsed)}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? '\u25B6' : '\u25C0'}
      </button>

      {!collapsed && (
        <>
          <div className="sidebar__header">
            <span>Boards</span>
            {billingStatus && (
              <span className="sidebar__card-count">
                {billingStatus.cardCount} / {billingStatus.cardLimit}
                {showUpgradeBadge && (
                  <Link to="/billing" className="sidebar__upgrade-badge">
                    Upgrade
                  </Link>
                )}
              </span>
            )}
          </div>
          <div className="sidebar__list">
            {boards.map((board) => (
              <div
                key={board.id}
                className={`sidebar__item${board.id === activeBoardId ? ' sidebar__item--active' : ''}`}
                onClick={() => onSelectBoard(board.id)}
              >
                <div className="sidebar__item-info">
                  <span className="sidebar__item-title">{board.title}</span>
                  <span className="sidebar__item-count">{board.cards.length} cards</span>
                </div>
                {boards.length > 1 && (
                  <button
                    className="sidebar__item-delete"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteBoard(board.id);
                    }}
                    title="Delete board"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
          <button className="sidebar__add-btn" onClick={handleAddBoard}>
            + New Board
          </button>
        </>
      )}
    </div>
  );
}
