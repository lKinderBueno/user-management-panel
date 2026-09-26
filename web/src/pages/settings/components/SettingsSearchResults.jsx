import React from 'react';
import { Search, ArrowRight, XCircle, Sliders } from 'lucide-react';

/**
 * Empty state component shown when the currently active category has no matching settings,
 * but other categories have matches, or when no settings match anywhere.
 */
export function SettingsSearchEmptyState({
  query,
  currentCategoryName,
  categoriesWithMatches = [],
  onSelectCategory,
  onClearFilter,
  onViewAllMatches,
}) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-[#dee2e6] dark:border-slate-800 rounded-[0.375rem] p-8 text-center space-y-5 shadow-argon dark:shadow-2xl">
      <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-950/60 text-[#3970e1] dark:text-blue-400 flex items-center justify-center mx-auto border border-blue-200 dark:border-blue-800/50">
        <Search className="w-6 h-6" />
      </div>

      <div className="space-y-1">
        <h3 className="text-base font-bold text-[#32325d] dark:text-white">
          No settings in {currentCategoryName || 'this category'} match &ldquo;{query}&rdquo;
        </h3>
        <p className="text-xs text-[#8898aa] dark:text-slate-400 max-w-md mx-auto">
          {categoriesWithMatches.length > 0
            ? `However, we found matching settings in other categories below:`
            : `Try checking for spelling or searching for general keywords like redis, token, brute force, throttle, ssl, or backup.`}
        </p>
      </div>

      {categoriesWithMatches.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-2 max-w-lg mx-auto pt-2">
          {categoriesWithMatches.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => onSelectCategory(cat.id)}
              className="flex items-center gap-2 px-3 py-1.5 bg-[#ebf2ff] hover:bg-[#3970e1] hover:text-white text-[#3970e1] dark:bg-blue-950/70 dark:text-blue-300 dark:hover:bg-blue-700 border border-[#3970e1]/30 rounded-[0.375rem] text-xs font-semibold transition active:scale-[0.98] shadow-sm"
            >
              <span>{cat.name}</span>
              <span className="text-[11px] px-1.5 py-0.2 rounded-full bg-white/60 dark:bg-black/30 font-mono font-bold">
                {cat.count} {cat.count === 1 ? 'match' : 'matches'}
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center justify-center gap-3 pt-3 border-t border-[#e9ecef] dark:border-slate-800">
        {categoriesWithMatches.length > 0 && onViewAllMatches && (
          <button
            type="button"
            onClick={onViewAllMatches}
            className="px-3.5 py-1.5 bg-[#3970e1] text-white hover:bg-[#2b5cc4] text-xs font-semibold rounded-[0.375rem] shadow-argon-sm transition active:scale-[0.98]"
          >
            View All Matches
          </button>
        )}
        <button
          type="button"
          onClick={onClearFilter}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 text-[#525f7f] dark:text-slate-300 border border-[#dee2e6] dark:border-slate-700 text-xs font-semibold rounded-[0.375rem] shadow-argon-sm transition active:scale-[0.98]"
        >
          <XCircle className="w-3.5 h-3.5" />
          <span>Clear Filter</span>
        </button>
      </div>
    </div>
  );
}

/**
 * Full Search Results view displayed when user selects the "All Matches" view.
 */
export default function SettingsSearchResults({
  query,
  matchingSections = [],
  categories = [],
  onSelectCategory,
  onClearFilter,
}) {
  const categoryMap = React.useMemo(() => {
    const map = {};
    categories.forEach((cat) => {
      map[cat.id] = cat;
    });
    return map;
  }, [categories]);

  // Group sections by category
  const grouped = React.useMemo(() => {
    const g = {};
    matchingSections.forEach((s) => {
      if (!g[s.categoryId]) g[s.categoryId] = [];
      g[s.categoryId].push(s);
    });
    return g;
  }, [matchingSections]);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Search Header Banner */}
      <div className="bg-white dark:bg-slate-900 border border-[#dee2e6] dark:border-slate-800 rounded-[0.375rem] p-4 sm:p-5 shadow-argon dark:shadow-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-[0.375rem] bg-[#ebf2ff] dark:bg-blue-950/60 border border-[#3970e1]/20 dark:border-blue-700/40 flex items-center justify-center text-[#3970e1] dark:text-blue-400">
            <Search className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-[#32325d] dark:text-white flex items-center gap-2">
              <span>Settings matching &ldquo;{query}&rdquo;</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-[#3970e1] dark:text-blue-400 font-mono font-semibold">
                {matchingSections.length} {matchingSections.length === 1 ? 'match' : 'matches'}
              </span>
            </h2>
            <p className="text-[13px] text-[#8898aa] dark:text-slate-400">
              Click on any setting card or category button to navigate and configure.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClearFilter}
          className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 text-[#525f7f] dark:text-slate-300 border border-[#dee2e6] dark:border-slate-700 rounded-[0.375rem] text-xs font-semibold shadow-argon-sm transition active:scale-[0.98] shrink-0"
        >
          <XCircle className="w-3.5 h-3.5" />
          <span>Clear Filter</span>
        </button>
      </div>

      {/* Results Grouped by Category */}
      {Object.keys(grouped).map((catId) => {
        const catObj = categoryMap[catId];
        const Icon = catObj?.icon || Sliders;
        const sections = grouped[catId];

        return (
          <div
            key={catId}
            className="bg-white dark:bg-slate-900 border border-[#dee2e6] dark:border-slate-800 rounded-[0.375rem] p-5 space-y-4 shadow-argon dark:shadow-2xl"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#e9ecef] dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-[0.375rem] bg-[#ebf2ff] dark:bg-blue-950/60 border border-[#dee2e6] dark:border-blue-700/40 flex items-center justify-center text-[#3970e1] dark:text-blue-400">
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#32325d] dark:text-white">
                    {catObj?.name || catId}
                  </h3>
                  <p className="text-[13px] text-[#8898aa] dark:text-slate-400">
                    {catObj?.desc || catObj?.subtitle}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onSelectCategory(catId)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#3970e1] hover:bg-[#2b5cc4] text-white rounded-[0.375rem] text-xs font-semibold shadow-argon-sm transition active:scale-[0.98] shrink-0"
              >
                <span>Go to {catObj?.name || 'Category'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              {sections.map((section) => (
                <div
                  key={section.id}
                  onClick={() => onSelectCategory(catId)}
                  className="group p-3.5 rounded-[0.375rem] border border-[#dee2e6] dark:border-slate-800 bg-[#f8f9fe]/70 dark:bg-slate-800/40 hover:bg-white dark:hover:bg-slate-800 hover:border-[#3970e1]/40 transition cursor-pointer shadow-sm hover:shadow"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-bold text-[#32325d] dark:text-white group-hover:text-[#3970e1] dark:group-hover:text-blue-400 transition">
                      {section.title}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-[#8898aa] group-hover:text-[#3970e1] shrink-0 transition group-hover:translate-x-0.5" />
                  </div>
                  <p className="text-[13px] text-[#8898aa] dark:text-slate-400 mt-1 leading-relaxed">
                    {section.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
