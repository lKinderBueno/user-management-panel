import React from 'react';
import { Server, RefreshCw, Info, RotateCcw } from 'lucide-react';
import PatternForm from './PatternForm';
import { safeParsePatterns, getPatternKey } from '../utils/patterns';

export default function ProviderEditor({ 
  patterns = [], 
  playlistName = '',
  onResetToPlaylist = null,
  onResetCurrentProvider = null,
  onChange, 
  onForceSync, 
  syncing = false, 
  disabled = false,
  showSync = true
}) {
  const patternList = React.useMemo(() => safeParsePatterns(patterns), [patterns]);
  const [selectedKey, setSelectedKey] = React.useState('');

  const currentPattern = React.useMemo(() => {
    if (patternList.length === 0) {
      return {
        type: 'xtream',
        url: '',
        param1: '',
        param2: '',
        useCUrl: false,
        cUrl: '',
        isInherited: false,
      };
    }
    return (
      patternList.find((p, idx) => (getPatternKey(p) || String(idx)) === selectedKey) ||
      patternList[0]
    );
  }, [patternList, selectedKey]);

  const isCurrentInherited = !!currentPattern?.isInherited;

  const handleSetPattern = (updatedPattern) => {
    const customPat = { ...updatedPattern, isInherited: false };
    if (patternList.length === 0) {
      onChange([customPat]);
      return;
    }

    const targetKey = getPatternKey(currentPattern);
    let updated = false;
    const updatedList = patternList.map((p, idx) => {
      const isMatch = targetKey ? getPatternKey(p) === targetKey : p === currentPattern || idx === 0;
      if (isMatch && !updated) {
        updated = true;
        return customPat;
      }
      return p;
    });

    onChange(updatedList);
  };

  const currentKey = getPatternKey(currentPattern);

  return (
    <div className="space-y-3 bg-[#f8f9fe] dark:bg-slate-800/60 border border-[#dee2e6] dark:border-slate-800 rounded-lg p-3.5">
      {/* Provider Selector Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-[#525f7f] dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Server className="w-3.5 h-3.5 text-[#3970e1] dark:text-blue-400" />
            <span>Playlist Providers:</span>
          </label>
          {isCurrentInherited ? (
            <span
              className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60"
              title="Inherited from original playlist"
            >
              Playlist Default
            </span>
          ) : (
            <span
              className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/60"
              title="Customized for this user"
            >
              Custom Override
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {!isCurrentInherited && onResetCurrentProvider && currentPattern?.url && (
            <button
              type="button"
              onClick={() => onResetCurrentProvider(currentPattern.url)}
              disabled={disabled}
              className="flex items-center gap-1 px-2.5 py-1 bg-white dark:bg-slate-800 hover:bg-[#eef2ff] dark:hover:bg-slate-700 text-[#3970e1] dark:text-blue-400 border border-[#3970e1]/40 dark:border-blue-500/40 rounded text-xs font-semibold transition active:scale-[0.98] shadow-sm disabled:opacity-50"
              title="Revert this provider to playlist default"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset Provider</span>
            </button>
          )}

          {onResetToPlaylist && (
            <button
              type="button"
              onClick={onResetToPlaylist}
              disabled={disabled}
              className="flex items-center gap-1 px-2.5 py-1 bg-white dark:bg-slate-800 hover:bg-[#f6f9fc] dark:hover:bg-slate-700 text-[#8898aa] dark:text-slate-300 border border-[#dee2e6] dark:border-slate-700 rounded text-xs font-semibold transition active:scale-[0.98] shadow-sm disabled:opacity-50"
              title="Revert all providers to playlist defaults"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset All</span>
            </button>
          )}

          {showSync && (!currentPattern?.type || currentPattern.type.toLowerCase() === 'xtream') && onForceSync && (currentPattern?.url || currentPattern?.cUrl) && (
            <button
              type="button"
              onClick={onForceSync}
              disabled={disabled || syncing}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-[#eef2ff] dark:hover:bg-slate-700 text-[#3970e1] dark:text-blue-400 border border-[#3970e1] dark:border-blue-500 rounded text-xs font-semibold transition active:scale-[0.98] shadow-sm disabled:opacity-50"
              title="Sync provider data (expiry date & connections)"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
              <span>Sync provider data</span>
            </button>
          )}
        </div>
      </div>

      {isCurrentInherited && (
        <div className="flex items-start gap-2 p-2.5 rounded bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/40 text-amber-800 dark:text-amber-300 text-xs">
          <Info className="w-4 h-4 flex-shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
          <div>
            <span className="font-semibold">Inherited from Playlist: </span>
            <span>
              This provider uses configuration from the original playlist{playlistName ? ` (${playlistName})` : ''}. Modifying below will create a custom override for this user.
            </span>
          </div>
        </div>
      )}

      {patternList.length > 1 ? (
        <select
          disabled={disabled}
          value={currentKey || '0'}
          onChange={(e) => setSelectedKey(e.target.value)}
          className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded text-xs font-mono text-[#32325d] dark:text-slate-100 focus:outline-none focus:border-[#3970e1] disabled:opacity-50 shadow-sm"
        >
          {patternList.map((p, idx) => {
            const itemKey = getPatternKey(p) || String(idx);
            return (
              <option key={itemKey} value={itemKey}>
                {p.url || '(empty URL)'} ({p.type ? p.type.toUpperCase() : 'XTREAM'} - {p.isInherited ? 'Playlist Default' : 'Custom Override'})
              </option>
            );
          })}
        </select>
      ) : (
        <div className="px-3 py-2 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded text-xs font-mono text-[#32325d] dark:text-slate-100 flex items-center justify-between shadow-sm">
          <span className="truncate">{currentPattern.url || 'No provider URL configured'}</span>
          <span className="text-xs px-1.5 py-0.5 rounded bg-[#eef2ff] dark:bg-blue-950/60 text-[#3970e1] dark:text-blue-400 border border-[#3970e1]/20 dark:border-blue-700/40 uppercase font-sans font-bold">
            {currentPattern.type || 'xtream'}
          </span>
        </div>
      )}

      {/* Pattern Form */}
      <PatternForm
        pattern={currentPattern}
        setPattern={handleSetPattern}
        showDns={false}
        disabled={disabled}
        useCustomDns={true}
      />
    </div>
  );
}
