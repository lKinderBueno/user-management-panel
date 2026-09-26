import React from 'react';
import { Search } from 'lucide-react';

export default function SettingsNav({
  tabs = [],
  activeTab,
  onSelectTab,
  isFiltering = false,
  categoryMatchCounts = {},
  totalMatches = 0,
}) {
  // If filtering, prepend "All Matches" option
  const effectiveTabs = React.useMemo(() => {
    if (!isFiltering) return tabs;

    const allMatchesTab = {
      id: 'all',
      name: 'All Matches',
      subtitle: `${totalMatches} ${totalMatches === 1 ? 'setting' : 'settings'} found`,
      icon: Search,
      badge: `${totalMatches}`,
      badgeColor: 'bg-[#3970e1] text-white',
    };

    const mappedTabs = tabs.map((tab) => {
      const count = categoryMatchCounts[tab.id] || 0;
      return {
        ...tab,
        badge: `${count}`,
        badgeColor:
          count > 0
            ? 'bg-blue-100 dark:bg-blue-950 text-[#3970e1] dark:text-blue-400'
            : 'bg-gray-100 dark:bg-slate-800 text-gray-400 dark:text-slate-500',
        hasMatches: count > 0,
      };
    });

    return [allMatchesTab, ...mappedTabs];
  }, [tabs, isFiltering, categoryMatchCounts, totalMatches]);

  return (
    <aside className="w-full lg:w-64 shrink-0 lg:sticky lg:top-20 lg:self-start">
      {/* Mobile Horizontal Pill Tabs (visible < lg) */}
      <div className="lg:hidden flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-[#dee2e6] dark:border-slate-800 scrollbar-none">
        {effectiveTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const isDimmed = isFiltering && tab.id !== 'all' && !tab.hasMatches;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSelectTab(tab.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-[0.375rem] text-xs font-semibold whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-[#3970e1] text-white shadow-argon-sm'
                  : isDimmed
                  ? 'bg-white/40 dark:bg-slate-800/40 text-gray-400 dark:text-slate-500 border border-[#dee2e6] dark:border-slate-800 opacity-60'
                  : 'bg-white dark:bg-slate-800 text-[#525f7f] dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700/80 border border-[#dee2e6] dark:border-slate-700'
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span>{tab.name}</span>
              {tab.badge && (
                <span
                  className={`text-[12px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                    isActive ? 'bg-white/20 text-white' : tab.badgeColor || 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Desktop Vertical Sidebar (visible >= lg) */}
      <div className="hidden lg:flex flex-col gap-1.5 max-h-[calc(100vh-6rem)] overflow-y-auto pr-1">
        <div className="px-3 pb-2 text-[12px] font-bold uppercase tracking-wider text-[#8898aa] dark:text-slate-400 flex items-center justify-between">
          <span>Categories</span>
          {isFiltering && (
            <span className="text-[11px] font-mono text-[#3970e1] dark:text-blue-400 font-semibold normal-case">
              Filtering
            </span>
          )}
        </div>

        {effectiveTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const isDimmed = isFiltering && tab.id !== 'all' && !tab.hasMatches;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSelectTab(tab.id)}
              className={`group w-full text-left p-3 rounded-[0.375rem] transition-all flex items-start gap-3 border ${
                isActive
                  ? 'bg-white dark:bg-slate-800/90 border-[#3970e1]/30 dark:border-blue-500/30 shadow-argon dark:shadow-lg'
                  : isDimmed
                  ? 'bg-white/30 dark:bg-slate-900/30 hover:bg-white/70 dark:hover:bg-slate-800/50 border-transparent hover:border-[#dee2e6] dark:hover:border-slate-800 text-[#8898aa] dark:text-slate-500 opacity-60 hover:opacity-100'
                  : 'bg-white/60 dark:bg-slate-900/60 hover:bg-white dark:hover:bg-slate-800/70 border-transparent hover:border-[#dee2e6] dark:hover:border-slate-800 text-[#525f7f] dark:text-slate-300'
              }`}
            >
              <div
                className={`w-8 h-8 rounded-[0.375rem] flex items-center justify-center shrink-0 transition-colors ${
                  isActive
                    ? 'bg-[#ebf2ff] dark:bg-blue-950/80 text-[#3970e1] dark:text-blue-400 border border-[#3970e1]/20'
                    : isDimmed
                    ? 'bg-gray-100/50 dark:bg-slate-800/50 text-[#8898aa] dark:text-slate-500'
                    : 'bg-gray-100 dark:bg-slate-800 text-[#8898aa] dark:text-slate-400 group-hover:text-[#3970e1] dark:group-hover:text-blue-400'
                }`}
              >
                <Icon className="w-4 h-4" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <span
                    className={`text-xs font-bold truncate ${
                      isActive
                        ? 'text-[#3970e1] dark:text-blue-400'
                        : isDimmed
                        ? 'text-[#8898aa] dark:text-slate-500 group-hover:text-[#32325d] dark:group-hover:text-white'
                        : 'text-[#32325d] dark:text-white'
                    }`}
                  >
                    {tab.name}
                  </span>
                  {tab.badge && (
                    <span
                      className={`text-[12px] px-1.5 py-0.5 rounded-full font-mono font-bold shrink-0 ${
                        tab.badgeColor || 'bg-gray-100 dark:bg-slate-800 text-[#525f7f] dark:text-slate-300'
                      }`}
                    >
                      {tab.badge}
                    </span>
                  )}
                </div>
                <p className="text-[13px] text-[#8898aa] dark:text-slate-400 truncate mt-0.5">
                  {tab.subtitle}
                </p>
              </div>

              {isActive && (
                <div className="w-1 h-8 rounded-full bg-[#3970e1] shrink-0 self-center"></div>
              )}
            </button>
          );
        })}
      </div>
    </aside>
  );
}
