import React from 'react';
import { 
  SlidersHorizontal, 
  Calendar, 
  LayoutGrid, 
  Columns2,
  ChevronDown,
  RotateCcw
} from 'lucide-react';

export default function ManagedUserFilters({
  patternParam1,
  onPatternParam1Change,
  patternParam2,
  onPatternParam2Change,
  patternType,
  onPatternTypeChange,
  availablePatternTypes = [],
  expiryPreset,
  onExpiryPresetChange,
  expiryBeforeDate,
  onExpiryBeforeDateChange,
  onResetFilters,
  hasActiveFilters,
  viewMode,
  onViewModeChange,
  totalUsers = 0,
  filteredCount = 0,
  onlineCount = 0
}) {
  const [showAdvancedPattern, setShowAdvancedPattern] = React.useState(false);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-lg border border-[#e9ecef] dark:border-slate-800 p-3 shadow-argon space-y-3">
      {/* Top Row: Provider Filter Toggle, Expiry Presets, and View Mode Switch */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        
        {/* Left Side: Provider Filter Popover Toggle */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowAdvancedPattern(!showAdvancedPattern)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold border transition shadow-sm ${
              showAdvancedPattern || patternParam1 || patternParam2 || patternType
                ? 'bg-[#eef2ff] dark:bg-blue-950/60 border-[#3970e1] dark:border-blue-500 text-[#3970e1] dark:text-blue-400'
                : 'bg-white dark:bg-slate-800 border-[#dee2e6] dark:border-slate-700 text-[#525f7f] dark:text-slate-300 hover:text-[#32325d] dark:hover:text-white hover:bg-[#f6f9fc] dark:hover:bg-slate-700'
            }`}
            title="Filter by source provider parameters"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Provider Params</span>
            {(patternParam1 || patternParam2 || patternType) && (
              <span className="w-1.5 h-1.5 rounded-full bg-[#3970e1] dark:bg-blue-400" />
            )}
            <ChevronDown className={`w-3 h-3 transition-transform ${showAdvancedPattern ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Right Side: Expiry Segmented Presets & View Mode Toggle */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Expiry Presets Segmented Buttons */}
          <div className="p-0.5 bg-[#f6f9fc] dark:bg-slate-800/80 border border-[#dee2e6] dark:border-slate-700 rounded flex text-xs">
            {[
              { id: 'all', label: 'All' },
              { id: 'online', label: onlineCount > 0 ? `Online (${onlineCount})` : 'Online', isOnline: true },
              { id: 'active', label: 'Active' },
              { id: 'expiring_7', label: 'Exp. 7d' },
              { id: 'expiring_30', label: 'Exp. 30d' },
              { id: 'expired', label: 'Expired' },
              { id: 'unlimited', label: 'Unlimited' },
              { id: 'custom', label: 'Date...' }
            ].map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => onExpiryPresetChange(preset.id)}
                className={`px-2.5 py-1 rounded text-[12px] font-semibold transition flex items-center gap-1.5 ${
                  expiryPreset === preset.id
                    ? 'bg-[#3970e1] text-white shadow-sm'
                    : 'text-[#525f7f] dark:text-slate-400 hover:text-[#32325d] dark:hover:text-white'
                }`}
              >
                {preset.isOnline && (
                  <span className={`w-1.5 h-1.5 rounded-full ${onlineCount > 0 ? 'bg-[#2dce89] animate-pulse' : 'bg-[#adb5bd]'}`} />
                )}
                <span>{preset.label}</span>
              </button>
            ))}
          </div>

          {/* View Mode Toggle: Grid vs Split */}
          <div className="p-0.5 bg-[#f6f9fc] dark:bg-slate-800/80 border border-[#dee2e6] dark:border-slate-700 rounded flex text-xs">
            <button
              type="button"
              onClick={() => onViewModeChange('grid')}
              className={`p-1.5 rounded transition ${
                viewMode === 'grid'
                  ? 'bg-[#3970e1] text-white shadow-sm'
                  : 'text-[#525f7f] dark:text-slate-400 hover:text-[#32325d] dark:hover:text-white'
              }`}
              title="Full Data Grid View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange('split')}
              className={`p-1.5 rounded transition ${
                viewMode === 'split'
                  ? 'bg-[#3970e1] text-white shadow-sm'
                  : 'text-[#525f7f] dark:text-slate-400 hover:text-[#32325d] dark:hover:text-white'
              }`}
              title="Split Master-Detail View"
            >
              <Columns2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Reset Filters button if any filter active */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={onResetFilters}
              className="flex items-center gap-1 text-[12px] font-semibold text-[#8898aa] dark:text-slate-400 hover:text-[#f5365c] dark:hover:text-red-400 px-2 py-1 bg-white dark:bg-slate-800 hover:bg-[#feecee] dark:hover:bg-red-950/40 border border-[#dee2e6] dark:border-slate-700 rounded transition shadow-sm"
              title="Reset all filters"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Row 2: Custom Expiry Date Picker (shown if expiryPreset === 'custom') */}
      {expiryPreset === 'custom' && (
        <div className="pt-2 border-t border-[#e9ecef] dark:border-slate-800 flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5 text-[#525f7f] dark:text-slate-300 font-medium">
            <Calendar className="w-3.5 h-3.5 text-[#3970e1] dark:text-blue-400" />
            <span>Show users expiring on or before:</span>
          </div>
          <input
            type="date"
            value={expiryBeforeDate}
            onChange={(e) => onExpiryBeforeDateChange(e.target.value)}
            className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded text-xs text-[#32325d] dark:text-slate-100 focus:outline-none focus:border-[#3970e1] shadow-sm"
          />
          {expiryBeforeDate && (
            <button
              type="button"
              onClick={() => onExpiryBeforeDateChange('')}
              className="text-[13px] font-semibold text-[#8898aa] dark:text-slate-400 hover:text-[#f5365c] dark:hover:text-red-400"
            >
              Clear date
            </button>
          )}
        </div>
      )}

      {/* Row 3: Provider Parameters Filter Bar (expandable) */}
      {showAdvancedPattern && (
        <div className="pt-3 border-t border-[#e9ecef] dark:border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Param 1 Filter */}
          <div className="space-y-1">
            <label className="text-[12px] text-[#525f7f] dark:text-slate-300 font-bold uppercase tracking-wider block">
              Provider Username / Key
            </label>
            <input
              type="text"
              placeholder="e.g. provider line username..."
              value={patternParam1}
              onChange={(e) => onPatternParam1Change(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded text-xs text-[#32325d] dark:text-slate-100 placeholder-[#adb5bd] dark:placeholder-slate-500 focus:outline-none focus:border-[#3970e1] shadow-sm"
            />
          </div>

          {/* Param 2 Filter */}
          <div className="space-y-1">
            <label className="text-[12px] text-[#525f7f] dark:text-slate-300 font-bold uppercase tracking-wider block">
              Provider Password / Profile
            </label>
            <input
              type="text"
              placeholder="e.g. provider line password..."
              value={patternParam2}
              onChange={(e) => onPatternParam2Change(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded text-xs text-[#32325d] dark:text-slate-100 placeholder-[#adb5bd] dark:placeholder-slate-500 focus:outline-none focus:border-[#3970e1] shadow-sm"
            />
          </div>

          {/* Provider Type Filter */}
          <div className="space-y-1">
            <label className="text-[12px] text-[#525f7f] dark:text-slate-300 font-bold uppercase tracking-wider block">
              Provider Type
            </label>
            <select
              value={patternType}
              onChange={(e) => onPatternTypeChange(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded text-xs text-[#32325d] dark:text-slate-100 focus:outline-none focus:border-[#3970e1] shadow-sm"
            >
              <option value="">All Types</option>
              <option value="xtream">Xtream</option>
              <option value="apollo">Apollo</option>
              <option value="auth">Auth</option>
              <option value="token">Token</option>
              <option value="watch">Watch</option>
              <option value="m3u">M3U</option>
              <option value="xui_mac">XUI MAC</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
