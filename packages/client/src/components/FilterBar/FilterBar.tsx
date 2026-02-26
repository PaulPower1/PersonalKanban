import { CardFilters, Priority } from '../../types';

interface Props {
  filters: CardFilters;
  onFiltersChange: (filters: CardFilters) => void;
  categories: string[];
  tags: string[];
  visibleCount: number;
  totalCount: number;
}

export function FilterBar({ filters, onFiltersChange, categories, tags, visibleCount, totalCount }: Props) {
  const hasActiveFilters = filters.searchText || filters.category || filters.tag || filters.priority;

  const update = (partial: Partial<CardFilters>) => {
    onFiltersChange({ ...filters, ...partial });
  };

  const clearFilters = () => {
    onFiltersChange({ searchText: '', category: '', tag: '', priority: '' });
  };

  return (
    <div className="filter-bar">
      <div className="filter-bar__search">
        <svg className="filter-bar__search-icon" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="7" cy="7" r="5" />
          <line x1="11" y1="11" x2="14" y2="14" />
        </svg>
        <input
          className="filter-bar__search-input"
          type="text"
          placeholder="Search cards..."
          value={filters.searchText}
          onChange={(e) => update({ searchText: e.target.value })}
        />
      </div>

      <div className="filter-bar__selects">
        <select
          className="filter-bar__select"
          value={filters.category}
          onChange={(e) => update({ category: e.target.value })}
        >
          <option value="">All Categories</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>

        <select
          className="filter-bar__select"
          value={filters.tag}
          onChange={(e) => update({ tag: e.target.value })}
        >
          <option value="">All Tags</option>
          {tags.map((tag) => (
            <option key={tag} value={tag}>{tag}</option>
          ))}
        </select>

        <select
          className="filter-bar__select"
          value={filters.priority}
          onChange={(e) => update({ priority: e.target.value as Priority | '' })}
        >
          <option value="">All Priorities</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </select>
      </div>

      <div className="filter-bar__info">
        {hasActiveFilters && (
          <>
            <span className="filter-bar__count">
              {visibleCount} / {totalCount}
            </span>
            <button className="filter-bar__clear" onClick={clearFilters}>
              Clear
            </button>
          </>
        )}
      </div>
    </div>
  );
}
