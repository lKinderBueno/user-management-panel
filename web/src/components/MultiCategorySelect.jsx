import React from 'react';
import { Layers, ChevronDown, Check, X, Search, CheckSquare, Square } from 'lucide-react';

export default function MultiCategorySelect({
  title = "Categories",
  categories = [],
  value = null, // null means "ALL categories selected"
  onChange,
  type = "channels",
  disabled = false,
  align = "left",
}) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [openUpwards, setOpenUpwards] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const containerRef = React.useRef(null);

  // Smart detection of vertical space when opening
  React.useEffect(() => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      // If less than 380px available below and more space above, open upwards
      if (spaceBelow < 380 && rect.top > spaceBelow) {
        setOpenUpwards(true);
      } else {
        setOpenUpwards(false);
      }
    }
  }, [isOpen]);

  // Close dropdown on click outside
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

  const isAllSelected = value === null || (Array.isArray(value) && value.length === 0 && categories.length === 0);

  // Set of selected category IDs
  const selectedSet = React.useMemo(() => {
    if (value === null) {
      return new Set(categories.map((c) => c.id));
    }
    if (Array.isArray(value)) {
      return new Set(value);
    }
    try {
      if (typeof value === 'string') {
        const parsed = JSON.parse(value);
        return new Set(Array.isArray(parsed) ? parsed : []);
      }
    } catch {
      return new Set();
    }
    return new Set();
  }, [value, categories]);

  // Filtered categories based on search input
  const filteredCategories = React.useMemo(() => {
    if (!search.trim()) return categories;
    const q = search.toLowerCase();
    return categories.filter((c) => c.name?.toLowerCase().includes(q));
  }, [categories, search]);

  // Check if all currently filtered items are selected
  const allFilteredSelected = React.useMemo(() => {
    if (filteredCategories.length === 0) return false;
    return filteredCategories.every((c) => selectedSet.has(c.id));
  }, [filteredCategories, selectedSet]);

  const handleToggle = (id) => {
    const nextSet = new Set(selectedSet);
    if (nextSet.has(id)) {
      nextSet.delete(id);
    } else {
      nextSet.add(id);
    }

    if (nextSet.size >= categories.length) {
      onChange(null);
    } else {
      onChange(Array.from(nextSet));
    }
  };

  // Toggle selection for all currently searched items
  const handleToggleFiltered = () => {
    if (filteredCategories.length === 0) return;
    const nextSet = new Set(selectedSet);
    const filteredIds = filteredCategories.map((c) => c.id);

    if (allFilteredSelected) {
      filteredIds.forEach((id) => nextSet.delete(id));
    } else {
      filteredIds.forEach((id) => nextSet.add(id));
    }

    if (nextSet.size >= categories.length) {
      onChange(null);
    } else {
      onChange(Array.from(nextSet));
    }
  };

  const handleSelectAll = () => {
    onChange(null);
  };

  const handleDeselectAll = () => {
    onChange([]);
  };

  const selectedCount = isAllSelected ? categories.length : selectedSet.size;

  return (
    <div className="relative" ref={containerRef}>
      <label className="block text-xs font-bold text-[#525f7f] uppercase tracking-wider mb-1">{title}</label>

      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between px-3 py-2 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded text-xs shadow-sm transition active:scale-[0.98] ${
          disabled 
            ? 'opacity-50 cursor-not-allowed bg-[#f8f9fe] dark:bg-slate-800/50' 
            : 'hover:border-[#cad1d7] dark:hover:border-slate-600 focus:border-[#3970e1] focus:ring-1 focus:ring-[#3970e1]/30'
        }`}
      >
        <div className="flex items-center gap-2 truncate">
          <Layers className="w-3.5 h-3.5 text-[#3970e1] dark:text-blue-400 flex-shrink-0" />
          <span className="truncate text-xs">
            {isAllSelected ? (
              <span className="text-[#2dce89] dark:text-emerald-400 font-bold">All ({categories.length})</span>
            ) : selectedCount === 0 ? (
              <span className="text-[#8898aa] dark:text-slate-400">None selected</span>
            ) : (
              <span className="text-[#32325d] dark:text-slate-100 font-semibold">{selectedCount} of {categories.length} selected</span>
            )}
          </span>
        </div>
        <ChevronDown className="w-3.5 h-3.5 text-[#8898aa] dark:text-slate-400 flex-shrink-0 ml-1" />
      </button>

      {isOpen && (
        <div 
          className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} ${
            openUpwards ? 'bottom-full mb-2' : 'top-full mt-1.5'
          } w-80 sm:w-96 max-w-[calc(100vw-2rem)] bg-white dark:bg-slate-900 border border-[#dee2e6] dark:border-slate-800 rounded-lg shadow-argon-dropdown dark:shadow-2xl p-3.5 z-[100] animate-in fade-in zoom-in-95 duration-100`}
        >
          {/* Header & Global Buttons */}
          <div className="flex items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-[#e9ecef] dark:border-slate-800">
            <span className="text-xs font-bold text-[#32325d] dark:text-white">
              {title} <span className="font-mono text-[#8898aa] dark:text-slate-400">({selectedCount}/{categories.length})</span>
            </span>
            <div className="flex items-center gap-1.5 text-xs">
              <button
                type="button"
                onClick={handleSelectAll}
                className="px-2.5 py-0.5 bg-white dark:bg-slate-800 hover:bg-[#f6f9fc] dark:hover:bg-slate-700 text-[#3970e1] dark:text-blue-400 border border-[#dee2e6] dark:border-slate-700 rounded transition text-[12px] font-semibold shadow-sm active:scale-[0.98]"
              >
                All
              </button>
              <button
                type="button"
                onClick={handleDeselectAll}
                className="px-2.5 py-0.5 bg-white dark:bg-slate-800 hover:bg-[#feecee] dark:hover:bg-red-950/40 text-[#8898aa] dark:text-slate-400 hover:text-[#f5365c] dark:hover:text-red-400 border border-[#dee2e6] dark:border-slate-700 rounded transition text-[12px] font-semibold shadow-sm active:scale-[0.98]"
              >
                None
              </button>
            </div>
          </div>

          {/* Search bar + Select/Deselect Filtered Button */}
          <div className="flex items-center gap-2 mb-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-[#adb5bd] dark:text-slate-500" />
              <input
                type="text"
                autoFocus
                placeholder={`Search ${type}...`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-7 py-1.5 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded text-xs text-[#32325d] dark:text-slate-100 placeholder-[#adb5bd] dark:placeholder-slate-500 focus:outline-none focus:border-[#3970e1] transition shadow-sm"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-2 text-[#adb5bd] dark:text-slate-500 hover:text-[#525f7f] dark:hover:text-slate-300"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Select/Deselect searched items button */}
            <button
              type="button"
              onClick={handleToggleFiltered}
              disabled={filteredCategories.length === 0}
              className={`px-3 py-1.5 rounded text-xs font-semibold whitespace-nowrap transition flex items-center gap-1.5 border active:scale-[0.98] ${
                allFilteredSelected
                  ? 'bg-white dark:bg-slate-800 hover:bg-[#f6f9fc] dark:hover:bg-slate-700 text-[#525f7f] dark:text-slate-200 border-[#dee2e6] dark:border-slate-700 shadow-sm'
                  : 'bg-[#3970e1] hover:bg-[#2c5ec2] text-white border-[#3970e1] shadow-argon-btn'
              } disabled:opacity-40 disabled:cursor-not-allowed`}
              title={
                allFilteredSelected
                  ? "Deselect all items currently matching search"
                  : "Select all items currently matching search"
              }
            >
              {allFilteredSelected ? (
                <>
                  <Square className="w-3 h-3" />
                  <span>Deselect</span>
                </>
              ) : (
                <>
                  <CheckSquare className="w-3 h-3" />
                  <span>Select</span>
                </>
              )}
            </button>
          </div>

          {/* Search match stats */}
          {search && (
            <div className="text-[13px] text-[#8898aa] dark:text-slate-400 mb-1.5 flex items-center justify-between px-1 font-medium">
              <span>Matching: <strong className="text-[#32325d] dark:text-white">{filteredCategories.length}</strong></span>
              <span>Selected: <strong className="text-[#32325d] dark:text-white">{filteredCategories.filter((c) => selectedSet.has(c.id)).length}</strong></span>
            </div>
          )}

          {/* Categories List */}
          <div className="max-h-60 overflow-y-auto space-y-0.5 pr-1 divide-y divide-[#f6f9fc] dark:divide-slate-800/60">
            {filteredCategories.length === 0 ? (
              <div className="py-6 text-center text-xs text-[#8898aa] dark:text-slate-400">
                No categories found matching "{search}"
              </div>
            ) : (
              filteredCategories.map((cat) => {
                const checked = selectedSet.has(cat.id);
                return (
                  <label
                    key={cat.id}
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded text-xs cursor-pointer transition ${
                      checked
                        ? 'bg-[#eef2ff] dark:bg-blue-950/60 text-[#32325d] dark:text-white font-semibold'
                        : 'hover:bg-[#f6f9fc] dark:hover:bg-slate-800 text-[#525f7f] dark:text-slate-300'
                    }`}
                  >
                    <span className="truncate pr-2">{cat.name}</span>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => handleToggle(cat.id)}
                      className="rounded border-[#dee2e6] dark:border-slate-700 dark:bg-slate-800 text-[#3970e1] focus:ring-0 cursor-pointer"
                    />
                  </label>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
