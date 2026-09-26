import React from 'react';
import {
  X,
  Eye,
  EyeOff,
  Search,
  Save,
  Tv,
  Film,
  Clapperboard,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Layers
} from 'lucide-react';
import { Modal, Button } from './ui';

export default function UserHiddenCategoriesModal({
  isOpen,
  onClose,
  user,
  categories = { channels: [], vods: [], series: [] },
  onSave
}) {
  const [activeTab, setActiveTab] = React.useState('channels'); // 'channels' | 'vods' | 'series'
  const [searchQuery, setSearchQuery] = React.useState('');
  const [filterHiddenOnly, setFilterHiddenOnly] = React.useState(false);

  // Local settings clone
  const [settingsObj, setSettingsObj] = React.useState({});
  const [initialSettings, setInitialSettings] = React.useState({});

  React.useEffect(() => {
    if (!isOpen || !user) return;

    let parsed = {};
    if (user.user_settings) {
      let current = user.user_settings;
      while (typeof current === 'string') {
        try {
          current = JSON.parse(current);
        } catch {
          current = {};
          break;
        }
      }
      if (typeof current === 'object' && current !== null) {
        parsed = JSON.parse(JSON.stringify(current));
      }
    }

    const safe = {
      ...parsed,
      c: { ...(parsed.c || {}), hc: Array.isArray(parsed.c?.hc) ? [...parsed.c.hc] : [] },
      m: { ...(parsed.m || {}), hc: Array.isArray(parsed.m?.hc) ? [...parsed.m.hc] : [] },
      s: { ...(parsed.s || {}), hc: Array.isArray(parsed.s?.hc) ? [...parsed.s.hc] : [] }
    };

    setSettingsObj(safe);
    setInitialSettings(JSON.parse(JSON.stringify(safe)));
    setSearchQuery('');
    setFilterHiddenOnly(false);
  }, [isOpen, user]);

  if (!isOpen || !user) return null;

  const currentTabConfig = {
    channels: { key: 'c', title: 'Live Channels', icon: Tv, list: categories.channels || [] },
    vods: { key: 'm', title: 'Movies & VOD', icon: Film, list: categories.vods || [] },
    series: { key: 's', title: 'TV Series', icon: Clapperboard, list: categories.series || [] }
  }[activeTab];

  const currentHiddenList = settingsObj[currentTabConfig.key]?.hc || [];

  const isHidden = (catId) => {
    const num = Number(catId);
    return currentHiddenList.some((id) => Number(id) === num);
  };

  const toggleCategory = (catId) => {
    const num = Number(catId);
    setSettingsObj((prev) => {
      const list = prev[currentTabConfig.key]?.hc || [];
      const exists = list.some((id) => Number(id) === num);
      const nextList = exists ? list.filter((id) => Number(id) !== num) : [...list, num];

      return {
        ...prev,
        [currentTabConfig.key]: {
          ...(prev[currentTabConfig.key] || {}),
          hc: nextList
        }
      };
    });
  };

  const filteredCategories = (currentTabConfig.list || []).filter((cat) => {
    const query = searchQuery.trim().toLowerCase();
    const name = (cat.name || '').toLowerCase();
    const matchesQuery = !query || name.includes(query) || String(cat.id).includes(query);
    if (!matchesQuery) return false;
    if (filterHiddenOnly) {
      return isHidden(cat.id);
    }
    return true;
  });

  const handleBulkToggle = (makeAllVisible) => {
    const filteredIds = new Set(filteredCategories.map((c) => Number(c.id)));
    setSettingsObj((prev) => {
      const currentList = prev[currentTabConfig.key]?.hc || [];
      let nextList;
      if (makeAllVisible) {
        // Unhide only the filtered categories (remove them from hc)
        nextList = currentList.filter((id) => !filteredIds.has(Number(id)));
      } else {
        // Hide all filtered categories (add them to hc)
        const combined = new Set(currentList.map((id) => Number(id)));
        filteredIds.forEach((id) => combined.add(id));
        nextList = Array.from(combined);
      }

      return {
        ...prev,
        [currentTabConfig.key]: {
          ...(prev[currentTabConfig.key] || {}),
          hc: nextList
        }
      };
    });
  };

  const handleReset = () => {
    setSettingsObj(JSON.parse(JSON.stringify(initialSettings)));
  };

  const handleSave = () => {
    onSave?.(settingsObj);
    onClose();
  };

  const hasChanges = JSON.stringify(settingsObj) !== JSON.stringify(initialSettings);
  const isFiltered = !!(searchQuery.trim() || filterHiddenOnly);

  const totalHiddenCount = (settingsObj.c?.hc?.length || 0) + (settingsObj.m?.hc?.length || 0) + (settingsObj.s?.hc?.length || 0);

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="2xl">
      <Modal.Header
        icon={<EyeOff className="w-5 h-5 text-[#3970e1] dark:text-blue-400" />}
        iconClassName="bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800"
        title={
          <span className="flex items-center gap-2">
            <span>User Hidden Categories</span>
            <span className="text-xs font-mono font-normal text-slate-500">
              ({user.username})
            </span>
          </span>
        }
        subtitle="Categories hidden by the user in their dashboard or configured by admin"
        onClose={onClose}
      />

          {/* Subheader / Tabs */}
          <div className="px-6 py-3 border-b border-[#e9ecef] dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => { setActiveTab('channels'); setSearchQuery(''); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  activeTab === 'channels'
                    ? 'bg-[#3970e1] text-white shadow-sm'
                    : 'bg-[#f8f9fe] dark:bg-slate-800 text-[#525f7f] dark:text-slate-300 hover:bg-[#f1f3f9]'
                }`}
              >
                <Tv className="w-3.5 h-3.5" />
                <span>Live ({categories.channels?.length || 0})</span>
                {settingsObj.c?.hc?.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[12px] font-bold bg-amber-400 text-slate-950">
                    {settingsObj.c.hc.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => { setActiveTab('vods'); setSearchQuery(''); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  activeTab === 'vods'
                    ? 'bg-[#3970e1] text-white shadow-sm'
                    : 'bg-[#f8f9fe] dark:bg-slate-800 text-[#525f7f] dark:text-slate-300 hover:bg-[#f1f3f9]'
                }`}
              >
                <Film className="w-3.5 h-3.5" />
                <span>Movies ({categories.vods?.length || 0})</span>
                {settingsObj.m?.hc?.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[12px] font-bold bg-amber-400 text-slate-950">
                    {settingsObj.m.hc.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => { setActiveTab('series'); setSearchQuery(''); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  activeTab === 'series'
                    ? 'bg-[#3970e1] text-white shadow-sm'
                    : 'bg-[#f8f9fe] dark:bg-slate-800 text-[#525f7f] dark:text-slate-300 hover:bg-[#f1f3f9]'
                }`}
              >
                <Clapperboard className="w-3.5 h-3.5" />
                <span>Series ({categories.series?.length || 0})</span>
                {settingsObj.s?.hc?.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[12px] font-bold bg-amber-400 text-slate-950">
                    {settingsObj.s.hc.length}
                  </span>
                )}
              </button>
            </div>

            <div className="text-xs text-[#8898aa] dark:text-slate-400">
              Total Hidden: <span className="font-bold text-[#32325d] dark:text-white">{totalHiddenCount}</span>
            </div>
          </div>

          {/* Filter Toolbar */}
          <div className="px-6 py-2.5 bg-[#f8f9fe]/50 dark:bg-slate-800/30 border-b border-[#e9ecef] dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Search ${currentTabConfig.title.toLowerCase()}...`}
                className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded-lg text-xs text-[#32325d] dark:text-slate-100 placeholder-[#adb5bd] dark:placeholder-slate-500 focus:outline-none focus:border-[#3970e1]"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setFilterHiddenOnly(!filterHiddenOnly)}
                className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition ${
                  filterHiddenOnly
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400 font-bold'
                    : 'bg-white dark:bg-slate-800 border-[#dee2e6] dark:border-slate-700 text-[#525f7f] dark:text-slate-300'
                }`}
              >
                {filterHiddenOnly ? 'Hidden Only' : 'Filter: Hidden Only'}
              </button>

              <button
                type="button"
                onClick={() => handleBulkToggle(true)}
                disabled={filteredCategories.length === 0}
                className="px-2.5 py-1 bg-white dark:bg-slate-800 hover:bg-[#f6f9fc] text-[#525f7f] dark:text-slate-300 border border-[#dee2e6] dark:border-slate-700 rounded-lg text-xs font-semibold transition disabled:opacity-50"
                title={isFiltered ? `Unhide ${filteredCategories.length} filtered categories` : 'Unhide all categories'}
              >
                {isFiltered ? 'Unhide Filtered' : 'Unhide All'}
              </button>

              <button
                type="button"
                onClick={() => handleBulkToggle(false)}
                disabled={filteredCategories.length === 0}
                className="px-2.5 py-1 bg-white dark:bg-slate-800 hover:bg-[#f6f9fc] text-[#525f7f] dark:text-slate-300 border border-[#dee2e6] dark:border-slate-700 rounded-lg text-xs font-semibold transition disabled:opacity-50"
                title={isFiltered ? `Hide ${filteredCategories.length} filtered categories` : 'Hide all categories'}
              >
                {isFiltered ? 'Hide Filtered' : 'Hide All'}
              </button>
            </div>
          </div>

          {/* Categories Grid / List */}
          <Modal.Body className="p-6 max-h-[500px]">
            {filteredCategories.length === 0 ? (
              <div className="py-12 text-center text-[#8898aa] dark:text-slate-500 text-xs">
                No categories match the filter.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {filteredCategories.map((cat) => {
                  const hidden = isHidden(cat.id);

                  return (
                    <div
                      key={cat.id}
                      onClick={() => toggleCategory(cat.id)}
                      className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer select-none transition ${
                        hidden
                          ? 'bg-[#feecee]/40 dark:bg-rose-950/20 border-rose-300 dark:border-rose-900/60'
                          : 'bg-white dark:bg-slate-800/70 border-[#e9ecef] dark:border-slate-700 hover:border-blue-400'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0 pr-2">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${hidden ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                        <span className={`text-xs truncate ${hidden ? 'text-rose-700 dark:text-rose-400 line-through' : 'text-[#32325d] dark:text-slate-200'}`}>
                          {cat.name}
                        </span>
                      </div>

                      <span className={`text-[12px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                        hidden
                          ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                          : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                      }`}>
                        {hidden ? 'Hidden' : 'Visible'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </Modal.Body>

          {/* Footer */}
          <Modal.Footer align="between">
            <Button
              variant="secondary"
              onClick={handleReset}
              disabled={!hasChanges}
              icon={<RotateCcw className="w-3.5 h-3.5" />}
            >
              Reset
            </Button>

            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                onClick={onClose}
              >
                Cancel
              </Button>

              <Button
                variant="primary"
                onClick={handleSave}
                icon={<Save className="w-3.5 h-3.5" />}
              >
                Apply & Save
              </Button>
            </div>
          </Modal.Footer>
    </Modal>
  );
}
