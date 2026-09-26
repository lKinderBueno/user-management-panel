import React from 'react';
import {
  Settings,
  RefreshCw,
  Save,
  Search,
} from 'lucide-react';
import { Button, PageHeader } from '../../../components/ui';

export default function SettingsHeader({
  onBack,
  activeTab,
  tabs = [],
  onReload,
  onSave,
  saving = false,
  isDirty = false,
  searchQuery = '',
  onSearchChange,
}) {
  const currentTabObj = tabs.find((t) => t.id === activeTab) || tabs[0];

  return (
    <PageHeader
      onBack={onBack}
      backTitle="Go back"
      icon={Settings}
      color="blue"
      title={
        <h1 className="text-lg font-bold text-[#32325d] dark:text-white flex items-center gap-1.5 leading-tight">
          <span>Settings</span>
          <span className="text-[#8898aa] dark:text-slate-500 font-normal">/</span>
          <span className="text-[#3970e1] dark:text-blue-400">{currentTabObj?.name}</span>
        </h1>
      }
      badge={
        <div className="flex items-center gap-1.5 flex-wrap">

          {isDirty && (
            <span className="text-xs px-2 py-0.5 rounded-[0.375rem] font-medium bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-300 dark:border-amber-700/50 flex items-center gap-1 animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
              Unsaved changes
            </span>
          )}
        </div>
      }
      description={currentTabObj?.desc || 'Manage system synchronization, security, traffic limits, cache, and client portal.'}
      actions={
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap justify-end">
          {onSearchChange && (
            <div className="relative w-full sm:w-52">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8898aa] dark:text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Filter settings..."
                className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded-[0.375rem] text-xs text-[#32325d] dark:text-white placeholder-[#8898aa] dark:placeholder-slate-400 focus:outline-none focus:border-[#3970e1]"
              />
            </div>
          )}

          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onReload}
            title="Reload settings from server"
            icon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            <span className="hidden sm:inline">Reload</span>
          </Button>

          <Button
            type="button"
            variant="success"
            size="sm"
            onClick={onSave}
            loading={saving}
            className={isDirty ? 'ring-2 ring-emerald-500/40 shadow-sm' : ''}
            icon={<Save className="w-3.5 h-3.5" />}
          >
            Save Settings
          </Button>
        </div>
      }
    />
  );
}
