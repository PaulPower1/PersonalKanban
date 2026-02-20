import { useState } from 'react';
import { KanbanBoard } from '../../types';
import { getCategoryColor, getCategoryBadgeStyle } from '../../utils/colors';

interface Props {
  board: KanbanBoard;
  onSave: (board: KanbanBoard) => void;
  onClose: () => void;
}

export function CategoryManager({ board, onSave, onClose }: Props) {
  const [categories, setCategories] = useState<string[]>([...board.categories]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [newCategory, setNewCategory] = useState('');

  const handleAdd = () => {
    const trimmed = newCategory.trim();
    if (!trimmed || categories.includes(trimmed)) return;
    setCategories([...categories, trimmed]);
    setNewCategory('');
  };

  const handleAddKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleAdd();
  };

  const handleDelete = (index: number) => {
    setCategories(categories.filter((_, i) => i !== index));
  };

  const handleStartRename = (index: number) => {
    setEditingIndex(index);
    setEditValue(categories[index]);
  };

  const handleFinishRename = () => {
    if (editingIndex === null) return;
    const trimmed = editValue.trim();
    if (trimmed && !categories.includes(trimmed)) {
      const updated = [...categories];
      updated[editingIndex] = trimmed;
      setCategories(updated);
    }
    setEditingIndex(null);
    setEditValue('');
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleFinishRename();
    if (e.key === 'Escape') {
      setEditingIndex(null);
      setEditValue('');
    }
  };

  const handleSave = () => {
    // Build the mapping of old→new category names
    const deletedCategories = board.categories.filter((c) => !categories.includes(c));
    // For renamed categories, they're handled via the UI sequence (delete old + add new)

    // Update cards: clear category for deleted categories
    const cards = board.cards.map((card) => {
      if (deletedCategories.includes(card.category)) {
        return { ...card, category: '' };
      }
      return card;
    });

    const categoryColors = categories.map((cat) => ({
      category: cat,
      color: getCategoryColor(cat),
    }));

    onSave({ ...board, cards, categories, categoryColors });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal category-manager" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal__title">Manage Categories</h2>

        <div className="category-manager__list">
          {categories.map((cat, index) => (
            <div key={`${cat}-${index}`} className="category-manager__item">
              <span
                className="project-badge"
                style={getCategoryBadgeStyle(getCategoryColor(cat))}
              >
                {cat}
              </span>
              {editingIndex === index ? (
                <input
                  className="modal__input category-manager__rename-input"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={handleFinishRename}
                  onKeyDown={handleRenameKeyDown}
                  autoFocus
                />
              ) : (
                <div className="category-manager__item-actions">
                  <button
                    className="category-manager__btn"
                    onClick={() => handleStartRename(index)}
                  >
                    Rename
                  </button>
                  <button
                    className="category-manager__btn category-manager__btn--delete"
                    onClick={() => handleDelete(index)}
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          ))}
          {categories.length === 0 && (
            <div className="category-manager__empty">No categories yet</div>
          )}
        </div>

        <div className="category-manager__add">
          <input
            className="modal__input"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            onKeyDown={handleAddKeyDown}
            placeholder="New category name..."
          />
          <button
            className="toolbar__btn toolbar__btn--primary"
            onClick={handleAdd}
            disabled={!newCategory.trim()}
          >
            Add
          </button>
        </div>

        <div className="modal__actions">
          <button
            type="button"
            className="modal__btn modal__btn--cancel"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="modal__btn modal__btn--save"
            onClick={handleSave}
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
