import React from 'react';

export default function SettingsNav({
  tabs = [],
  activeTab,
  onSelectTab,
}) {
  return (
    <aside className="w-full lg:w-64 shrink-0 lg:sticky lg:top-20 lg:self-start">
      {/* Mobile Horizontal Pill Tabs (visible < lg) */}
      <div className="lg:hidden flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-[#dee2e6] dark:border-slate-800 scrollbar-none">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSelectTab(tab.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-[0.375rem] text-xs font-semibold whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-[#3970e1] text-white shadow-argon-sm'
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
        <div className="px-3 pb-2 text-[12px] font-bold uppercase tracking-wider text-[#8898aa] dark:text-slate-400">
          Categories
        </div>

        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSelectTab(tab.id)}
              className={`group w-full text-left p-3 rounded-[0.375rem] transition-all flex items-start gap-3 border ${
                isActive
                  ? 'bg-white dark:bg-slate-800/90 border-[#3970e1]/30 dark:border-blue-500/30 shadow-argon dark:shadow-lg'
                  : 'bg-white/60 dark:bg-slate-900/60 hover:bg-white dark:hover:bg-slate-800/70 border-transparent hover:border-[#dee2e6] dark:hover:border-slate-800 text-[#525f7f] dark:text-slate-300'
              }`}
            >
              <div
                className={`w-8 h-8 rounded-[0.375rem] flex items-center justify-center shrink-0 transition-colors ${
                  isActive
                    ? 'bg-[#ebf2ff] dark:bg-blue-950/80 text-[#3970e1] dark:text-blue-400 border border-[#3970e1]/20'
                    : 'bg-gray-100 dark:bg-slate-800 text-[#8898aa] dark:text-slate-400 group-hover:text-[#3970e1] dark:group-hover:text-blue-400'
                }`}
              >
                <Icon className="w-4 h-4" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <span
                    className={`text-xs font-bold truncate ${
                      isActive ? 'text-[#3970e1] dark:text-blue-400' : 'text-[#32325d] dark:text-white'
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
