import React from 'react';
import { Globe, User, Key } from 'lucide-react';

export const getPanelType = (type) => {
  switch (type) {
    case 'xtream':
      return { type: 'XtreamCodes', param1: 'Username', param2: 'Password' };
    case 'apollo':
      return { type: 'API stream auth', param1: 'Username', param2: 'Password' };
    case 'auth':
      return { type: 'Auth', param1: 'Auth key', param2: 'Profile' };
    case 'watch':
      return { type: 'Watch', param1: 'Watch key' };
    case 'xui_mac':
      return { type: 'XUI MAC', param1: 'MAC' };
    case 'token':
      return { type: 'Token', param1: 'Token' };
    default:
      return { type: 'XtreamCodes', param1: 'Username', param2: 'Password' };
  }
};

export default function PatternForm({
  pattern = {},
  setPattern,
  panelType,
  showDns = false,
  disabled = false,
  useCustomDns = true,
}) {
  const pType = panelType || getPanelType(pattern?.type);

  if (!pattern || !pType || !pType.param1) {
    return null;
  }

  return (
    <div className="space-y-3">
      {/* Optional DNS / URL */}
      {showDns && (
        <div>
          <label className="block text-xs font-bold text-[#525f7f] dark:text-slate-300 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5 text-[#3970e1] dark:text-blue-400" />
            <span>DNS / URL</span>
          </label>
          <input
            type="text"
            disabled={disabled}
            value={pattern.url || ''}
            onChange={(e) => setPattern({ ...pattern, url: e.target.value })}
            placeholder="http://example.com:8080"
            className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded text-xs font-mono text-[#32325d] dark:text-slate-100 placeholder-[#adb5bd] dark:placeholder-slate-500 focus:outline-none focus:border-[#3970e1] focus:ring-1 focus:ring-[#3970e1]/30 disabled:opacity-50 transition shadow-sm"
          />
        </div>
      )}

      {/* Custom DNS / URL Replacement Input if useCUrl is true */}
      {pattern.useCUrl && (
        <div className="animate-in fade-in duration-150">
          <label className="block text-xs font-bold text-[#525f7f] dark:text-slate-300 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5 text-[#3970e1] dark:text-blue-400" />
            <span>Custom DNS / URL Replacement</span>
          </label>
          <input
            type="text"
            disabled={disabled}
            value={pattern.cUrl || pattern.url || ''}
            onChange={(e) => setPattern({ ...pattern, cUrl: e.target.value })}
            placeholder="http://custom-dns.domain.com:8080"
            className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded text-xs font-mono text-[#32325d] dark:text-slate-100 placeholder-[#adb5bd] dark:placeholder-slate-500 focus:outline-none focus:border-[#3970e1] focus:ring-1 focus:ring-[#3970e1]/30 disabled:opacity-50 transition shadow-sm"
          />
        </div>
      )}

      {/* Params grid (e.g. Username / Password) */}
      <div className={`grid grid-cols-1 ${pType.param2 ? 'sm:grid-cols-2' : ''} gap-3`}>
        <div>
          <label className="block text-xs font-bold text-[#525f7f] dark:text-slate-300 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-[#3970e1] dark:text-blue-400" />
            <span>{pType.param1}</span>
          </label>
          <input
            type="text"
            disabled={disabled}
            value={pattern.param1 || ''}
            onChange={(e) => setPattern({ ...pattern, param1: e.target.value })}
            placeholder={`Enter ${pType.param1}`}
            className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded text-xs font-mono text-[#32325d] dark:text-slate-100 placeholder-[#adb5bd] dark:placeholder-slate-500 focus:outline-none focus:border-[#3970e1] focus:ring-1 focus:ring-[#3970e1]/30 disabled:opacity-50 transition shadow-sm"
          />
        </div>

        {pType.param2 && (
          <div>
            <label className="block text-xs font-bold text-[#525f7f] dark:text-slate-300 uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-[#3970e1] dark:text-blue-400" />
              <span>{pType.param2}</span>
            </label>
            <input
              type="text"
              disabled={disabled}
              value={pattern.param2 || ''}
              onChange={(e) => setPattern({ ...pattern, param2: e.target.value })}
              placeholder={`Enter ${pType.param2}`}
              className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded text-xs font-mono text-[#32325d] dark:text-slate-100 placeholder-[#adb5bd] dark:placeholder-slate-500 focus:outline-none focus:border-[#3970e1] focus:ring-1 focus:ring-[#3970e1]/30 disabled:opacity-50 transition shadow-sm"
            />
          </div>
        )}
      </div>

      {useCustomDns && (
        <div className="pt-1">
          <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-[#525f7f] dark:text-slate-300">
            <input
              type="checkbox"
              disabled={disabled}
              checked={!!pattern.useCUrl}
              onChange={(e) => setPattern({ ...pattern, useCUrl: e.target.checked })}
              className="rounded border-[#dee2e6] dark:border-slate-700 dark:bg-slate-800 text-[#3970e1] focus:ring-0 cursor-pointer"
            />
            <span>Use Custom DNS</span>
          </label>
        </div>
      )}
    </div>
  );
}
