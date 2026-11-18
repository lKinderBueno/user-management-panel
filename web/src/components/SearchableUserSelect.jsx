import React from 'react';
import { User, Search, ChevronDown, Check, X } from 'lucide-react';

/**
 * SearchableUserSelect
 * A searchable dropdown component for selecting a user (e.g. as a template).
 *
 * @param {Array} users - Array of user objects ({ id, name, username, channels_categories, ... })
 * @param {string|number} value - Currently selected user ID
 * @param {Function} onChange - (selectedUserId, selectedUser) => void
 * @param {string} placeholder - Placeholder text when no user is selected
 * @param {string} searchPlaceholder - Placeholder text in the search input
 * @param {Array} excludeUserIds - Array of user IDs to exclude from the dropdown
 * @param {boolean} disabled - Whether the selector is disabled
 * @param {string} className - Optional container className
 */
export default function SearchableUserSelect({
  users = [],
  value = '',
  onChange,
  placeholder = '-- Select a template user --',
  searchPlaceholder = 'Search by name, username, or ID...',
  excludeUserIds = [],
  disabled = false,
  className = '',
}) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [openUpwards, setOpenUpwards] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [highlightedIndex, setHighlightedIndex] = React.useState(-1);

  const containerRef = React.useRef(null);
  const searchInputRef = React.useRef(null);
  const listRef = React.useRef(null);

  // Available users after excluding specified IDs
  const availableUsers = React.useMemo(() => {
    const excludeSet = new Set((excludeUserIds || []).map(String));
    return (users || []).filter((u) => u && !excludeSet.has(String(u.id)));
  }, [users, excludeUserIds]);

  // Selected user object
  const selectedUser = React.useMemo(() => {
    if (value === '' || value === null || value === undefined) return null;
    return (users || []).find((u) => u && String(u.id) === String(value)) || null;
  }, [users, value]);

  // Filter users based on search input
  const filteredUsers = React.useMemo(() => {
    if (!search.trim()) return availableUsers;
    const q = search.trim().toLowerCase();
    const cleanQ = q.startsWith('#') ? q.slice(1).trim() : q;
    const tokens = q.split(/\s+/).filter(Boolean);

    return availableUsers.filter((u) => {
      const idStr = String(u.id || '');
      const nameStr = (u.name || '').toLowerCase();
      const userStr = (u.username || '').toLowerCase();

      // Direct exact or partial ID match
      if (idStr === cleanQ || idStr.includes(cleanQ)) return true;

      // Multi-token match across name, username, and ID
      return tokens.every((token) => {
        const cleanToken = token.startsWith('#') ? token.slice(1) : token;
        return (
          nameStr.includes(token) ||
          userStr.includes(token) ||
          idStr.includes(cleanToken)
        );
      });
    });
  }, [availableUsers, search]);

  const MAX_VISIBLE = 100;
  const visibleUsers = React.useMemo(() => {
    return filteredUsers.slice(0, MAX_VISIBLE);
  }, [filteredUsers]);

  // Handle position detection (flip upward if not enough space below)
  React.useEffect(() => {
    if (!isOpen || !containerRef.current) return;

    const updatePosition = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;

      let upwards = false;
      if (spaceBelow >= 300) {
        upwards = false;
      } else if (spaceAbove >= 300) {
        upwards = true;
      } else {
        upwards = spaceAbove > spaceBelow;
      }
      setOpenUpwards(upwards);
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen]);

  // Handle click outside to close
  React.useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Focus search input on open
  React.useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    } else {
      setSearch('');
      setHighlightedIndex(-1);
    }
  }, [isOpen]);

  // Scroll highlighted element into view
  React.useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const itemEl = listRef.current.querySelector(`[data-index="${highlightedIndex}"]`);
      if (itemEl) {
        itemEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex]);

  const handleSelect = (user) => {
    if (!user) {
      onChange?.('', null);
    } else {
      onChange?.(user.id, user);
    }
    setIsOpen(false);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange?.('', null);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev < visibleUsers.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : visibleUsers.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && visibleUsers[highlightedIndex]) {
        handleSelect(visibleUsers[highlightedIndex]);
      } else if (visibleUsers.length === 1) {
        handleSelect(visibleUsers[0]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
    }
  };

  const formatCatCount = (cat) => {
    if (cat === null || cat === undefined) return 'All';
    if (Array.isArray(cat)) return `${cat.length}`;
    return '0';
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        className={`w-full flex items-center justify-between px-3 py-2 bg-white dark:bg-slate-900 border border-[#dee2e6] dark:border-slate-700 rounded text-xs shadow-sm transition active:scale-[0.99] text-left ${
          disabled
            ? 'opacity-50 cursor-not-allowed bg-[#f8f9fe] dark:bg-slate-800/50'
            : 'hover:border-[#cad1d7] dark:hover:border-slate-600 focus:border-[#3970e1] focus:ring-1 focus:ring-[#3970e1]/30'
        }`}
        aria-expanded={isOpen}
      >
        {selectedUser ? (
          <div className="flex items-center gap-2 truncate flex-1 min-w-0 pr-1">
            <span className="font-mono text-[11px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[#3970e1] dark:text-blue-400 border border-[#dee2e6]/60 dark:border-slate-700 shrink-0">
              #{selectedUser.id}
            </span>
            <span className="truncate font-semibold text-slate-800 dark:text-slate-100">
              {selectedUser.name || selectedUser.username}
            </span>
            {selectedUser.name && selectedUser.username && (
              <span className="text-[11px] font-mono text-[#8898aa] dark:text-slate-400 truncate shrink-0">
                ({selectedUser.username})
              </span>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 truncate flex-1 min-w-0 text-[#8898aa] dark:text-slate-400">
            <User className="w-3.5 h-3.5 text-[#adb5bd] dark:text-slate-500 shrink-0" />
            <span className="truncate text-xs">{placeholder}</span>
          </div>
        )}

        <div className="flex items-center gap-1 shrink-0 ml-1.5">
          {selectedUser && !disabled && (
            <span
              role="button"
              tabIndex={0}
              onClick={handleClear}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleClear(e);
                }
              }}
              title="Clear template selection"
              className="p-0.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-[#adb5bd] hover:text-[#f5365c] rounded transition"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown
            className={`w-3.5 h-3.5 text-[#8898aa] dark:text-slate-400 transition-transform duration-150 ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </div>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className={`absolute left-0 w-full min-w-[280px] sm:min-w-[320px] max-w-[calc(100vw-2rem)] bg-white dark:bg-slate-900 border border-[#dee2e6] dark:border-slate-800 rounded-lg shadow-argon-dropdown dark:shadow-2xl z-[100] overflow-hidden animate-in fade-in zoom-in-95 duration-100 ${
            openUpwards ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
          }`}
        >
          {/* Search Bar */}
          <div className="p-2 border-b border-[#e9ecef] dark:border-slate-800 bg-[#f8f9fe] dark:bg-slate-800/50">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-[#adb5bd] dark:text-slate-500 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setHighlightedIndex(0);
                }}
                onKeyDown={handleKeyDown}
                placeholder={searchPlaceholder}
                className="w-full pl-8 pr-7 py-1.5 bg-white dark:bg-slate-900 border border-[#dee2e6] dark:border-slate-700 rounded text-xs text-[#32325d] dark:text-slate-100 placeholder-[#adb5bd] dark:placeholder-slate-500 focus:outline-none focus:border-[#3970e1] transition shadow-sm"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    searchInputRef.current?.focus();
                  }}
                  className="absolute right-2 top-2 text-[#adb5bd] hover:text-[#525f7f] dark:text-slate-500 dark:hover:text-slate-300"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Header Stats / Clear option */}
          <div className="px-3 py-1.5 bg-white dark:bg-slate-900 border-b border-[#e9ecef]/60 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-[#8898aa] dark:text-slate-400">
            <span>
              {filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''} available
            </span>
            {selectedUser && (
              <button
                type="button"
                onClick={() => handleSelect(null)}
                className="text-[#f5365c] hover:underline font-semibold"
              >
                Clear selection
              </button>
            )}
          </div>

          {/* User List */}
          <div
            ref={listRef}
            className="max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 p-1"
          >
            {visibleUsers.length === 0 ? (
              <div className="py-6 px-4 text-center text-xs text-[#8898aa] dark:text-slate-500">
                {search.trim() ? (
                  <>
                    No users matching &quot;{search}&quot;
                  </>
                ) : (
                  'No users available to select'
                )}
              </div>
            ) : (
              visibleUsers.map((u, index) => {
                const isSelected = String(u.id) === String(value);
                const isHighlighted = index === highlightedIndex;

                const chanCount = formatCatCount(u.channels_categories);
                const vodCount = formatCatCount(u.vods_categories);
                const seriesCount = formatCatCount(u.series_categories);

                return (
                  <div
                    key={u.id}
                    data-index={index}
                    onClick={() => handleSelect(u)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    className={`flex items-center justify-between p-2 rounded cursor-pointer transition text-xs ${
                      isSelected
                        ? 'bg-[#eef2ff] dark:bg-blue-950/60 text-[#3970e1] dark:text-blue-400 font-semibold'
                        : isHighlighted
                        ? 'bg-[#f6f9fc] dark:bg-slate-800/80 text-[#32325d] dark:text-slate-100'
                        : 'text-[#525f7f] dark:text-slate-300 hover:bg-[#f6f9fc] dark:hover:bg-slate-800/80'
                    }`}
                  >
                    <div className="truncate flex-1 min-w-0 pr-2">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="font-mono text-[11px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[#3970e1] dark:text-blue-400 border border-[#dee2e6]/60 dark:border-slate-700 shrink-0">
                          #{u.id}
                        </span>
                        <span className="truncate font-semibold text-slate-800 dark:text-slate-100">
                          {u.name || u.username}
                        </span>
                        {u.username && u.name && (
                          <span className="text-[11px] font-mono text-[#8898aa] dark:text-slate-400 truncate">
                            ({u.username})
                          </span>
                        )}
                      </div>

                      {/* Category summary tags */}
                      <div className="flex items-center gap-2 text-[10px] text-[#8898aa] dark:text-slate-400 mt-1 pl-0.5">
                        <span>
                          Live: <strong className="text-slate-700 dark:text-slate-200">{chanCount}</strong>
                        </span>
                        <span>•</span>
                        <span>
                          VOD: <strong className="text-slate-700 dark:text-slate-200">{vodCount}</strong>
                        </span>
                        <span>•</span>
                        <span>
                          Series: <strong className="text-slate-700 dark:text-slate-200">{seriesCount}</strong>
                        </span>
                      </div>
                    </div>

                    {isSelected && (
                      <Check className="w-4 h-4 text-[#3970e1] dark:text-blue-400 shrink-0 ml-1.5 stroke-[2.5]" />
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Truncation Notice if exceeding limit */}
          {filteredUsers.length > MAX_VISIBLE && (
            <div className="px-3 py-1.5 text-center text-[11px] text-[#8898aa] dark:text-slate-500 bg-[#f8f9fe] dark:bg-slate-800/40 border-t border-[#dee2e6]/50 dark:border-slate-800">
              Showing first {MAX_VISIBLE} of {filteredUsers.length} users. Type to refine search.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
