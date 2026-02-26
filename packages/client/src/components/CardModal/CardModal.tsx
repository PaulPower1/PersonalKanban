import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Card, ColumnId, ParsedCardData, Priority } from '../../types';
import { StyledSelect } from '../StyledSelect/StyledSelect';

interface Props {
  card: Card | null; // null = add mode
  allCategories: string[];
  allTags: string[];
  initialCardData?: ParsedCardData;
  initialColumnId?: ColumnId;
  categoryColorMap?: Record<string, string>;
  onSave: (data: {
    title: string;
    description: string;
    category: string;
    priority: Priority;
    dueDate: string | null;
    tags: string[];
    columnId: ColumnId;
  }) => void;
  onUpdate: (id: string, data: Partial<Card>) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
  saving?: boolean;
  cardLimitError?: {
    limit: number;
    currentCount: number;
    tier: string;
  } | null;
}

export function CardModal({
  card,
  allCategories,
  allTags,
  initialCardData,
  initialColumnId,
  categoryColorMap,
  onSave,
  onUpdate,
  onDelete,
  onClose,
  saving,
  cardLimitError,
}: Props) {
  const [title, setTitle] = useState(card?.title ?? initialCardData?.title ?? '');
  const [description, setDescription] = useState(card?.description ?? initialCardData?.description ?? '');
  const [category, setCategory] = useState(card?.category ?? initialCardData?.category ?? '');
  const [newCategory, setNewCategory] = useState('');
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [priority, setPriority] = useState<Priority>(card?.priority ?? initialCardData?.priority ?? 'medium');
  const [dueDate, setDueDate] = useState(card?.dueDate ?? initialCardData?.dueDate ?? '');
  const [tags, setTags] = useState<string[]>(card?.tags ?? initialCardData?.tags ?? []);
  const [tagInput, setTagInput] = useState('');
  const [columnId, setColumnId] = useState<ColumnId>(card?.columnId ?? initialCardData?.columnId ?? initialColumnId ?? 'todo');

  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const addTagsFromInput = () => {
    const newTags = tagInput
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t && !tags.includes(t));
    if (newTags.length > 0) {
      setTags([...tags, ...newTags]);
    }
    setTagInput('');
  };

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTagsFromInput();
    }
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const finalCategory = showNewCategory ? newCategory.trim() : category;

    // Include any pending tag input
    const finalTags = [...tags];
    if (tagInput.trim()) {
      tagInput
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter((t) => t && !finalTags.includes(t))
        .forEach((t) => finalTags.push(t));
    }

    const data = {
      title: title.trim(),
      description: description.trim(),
      category: finalCategory,
      priority,
      dueDate: dueDate || null,
      tags: finalTags,
      columnId,
    };

    if (card) {
      onUpdate(card.id, data);
      onClose();
    } else {
      // Don't close on save — let parent handle it (may show limit error)
      onSave(data);
    }
  };

  const handleDelete = () => {
    if (card) {
      onDelete(card.id);
      onClose();
    }
  };

  const handleCategoryChange = (value: string) => {
    if (value === '__new__') {
      setShowNewCategory(true);
      setCategory('');
    } else {
      setShowNewCategory(false);
      setCategory(value);
    }
  };

  // Suggestions: tags used elsewhere but not yet on this card
  const tagSuggestions = allTags.filter((t) => !tags.includes(t));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal__title">{card ? 'Edit Card' : 'New Card'}</h2>

        {cardLimitError && (
          <div className="modal__limit-error">
            <p>
              You&apos;ve reached your {cardLimitError.tier} plan limit of{' '}
              {cardLimitError.limit} cards. Upgrade your plan to add more.
            </p>
            <Link to="/billing" className="modal__limit-error-link">
              Upgrade Plan
            </Link>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="modal__field">
            <label className="modal__label">Title</label>
            <input
              ref={titleRef}
              className="modal__input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Card title..."
              required
            />
          </div>

          <div className="modal__field">
            <label className="modal__label">Description</label>
            <textarea
              className="modal__textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description..."
            />
          </div>

          <div className="modal__field">
            <label className="modal__label">Category</label>
            <StyledSelect
              value={showNewCategory ? '__new__' : category}
              onChange={handleCategoryChange}
              placeholder="None"
              options={[
                { value: '', label: 'None' },
                ...allCategories.map((cat) => ({
                  value: cat,
                  label: cat,
                  color: categoryColorMap?.[cat],
                })),
                { value: '__new__', label: '+ Add new category...' },
              ]}
            />
            {showNewCategory && (
              <input
                className="modal__input"
                style={{ marginTop: '8px' }}
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="New category name..."
                autoFocus
              />
            )}
          </div>

          <div className="modal__field">
            <label className="modal__label">Tags</label>
            {tags.length > 0 && (
              <div className="modal__tags">
                {tags.map((tag) => (
                  <span key={tag} className="tag-badge tag-badge--removable" onClick={() => removeTag(tag)}>
                    {tag} ×
                  </span>
                ))}
              </div>
            )}
            <input
              className="modal__input"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleTagKeyDown}
              onBlur={addTagsFromInput}
              placeholder="Add tags (comma-separated)..."
              list="tag-suggestions"
            />
            {tagSuggestions.length > 0 && (
              <datalist id="tag-suggestions">
                {tagSuggestions.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            )}
          </div>

          <div className="modal__row">
            <div className="modal__field">
              <label className="modal__label">Priority</label>
              <StyledSelect
                value={priority}
                onChange={(v) => setPriority(v as Priority)}
                options={[
                  { value: 'low', label: 'Low', color: '#3b82f6' },
                  { value: 'medium', label: 'Medium', color: '#f59e0b' },
                  { value: 'high', label: 'High', color: '#ef4444' },
                  { value: 'urgent', label: 'Urgent', color: '#ff2d55' },
                ]}
              />
            </div>

            <div className="modal__field">
              <label className="modal__label">Due Date</label>
              <input
                className="modal__input"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          <div className="modal__field">
            <label className="modal__label">Column</label>
            <select
              className="modal__select"
              value={columnId}
              onChange={(e) => setColumnId(e.target.value as ColumnId)}
            >
              <option value="backlog">Backlog</option>
              <option value="todo">To Do</option>
              <option value="in-progress">In Progress</option>
              <option value="done">Done</option>
            </select>
          </div>

          <div className="modal__actions">
            {card && (
              <button
                type="button"
                className="modal__btn modal__btn--delete"
                onClick={handleDelete}
              >
                Delete
              </button>
            )}
            <button
              type="button"
              className="modal__btn modal__btn--cancel"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="modal__btn modal__btn--save"
              disabled={saving}
            >
              {saving ? 'Saving...' : card ? 'Save' : 'Add Card'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
