import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Layers,
  Users,
  Search,
  ArrowLeft,
  Save,
  Copy,
  Check,
  AlertCircle,
  Loader2,
  Plus,
  Minus,
  RefreshCw
} from 'lucide-react';
import { playlistApi, userApi } from '../api/client';
import MultiCategorySelect from '../components/MultiCategorySelect';
import { PageHeader } from '../components/ui';

export default function ResellerBulkEditor({ currentPlaylist, onUsersUpdated }) {
  const navigate = useNavigate();

  const [customers, setCustomers] = React.useState([]);
  const [selectedCustomers, setSelectedCustomers] = React.useState([]);
  const [categories, setCategories] = React.useState({ channels: [], vods: [], series: [] });

  const [categoriesToEdit, setCategoriesToEdit] = React.useState({
    channels_categories: [],
    vods_categories: [],
    series_categories: [],
  });

  const [customerToCopy, setCustomerToCopy] = React.useState('');
  const [mode, setMode] = React.useState(() => localStorage.getItem('res-bulk-mode') || 'add');

  const [userSearch, setUserSearch] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');
  const [successMsg, setSuccessMsg] = React.useState('');

  React.useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      if (!currentPlaylist?.id) return;
      setLoading(true);
      try {
        const [usersData, categoriesData] = await Promise.all([
          userApi.getUsers(currentPlaylist.id),
          playlistApi.getCategories(currentPlaylist.id),
        ]);
        if (isMounted) {
          const sorted = (usersData || []).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
          setCustomers(sorted);
          setCategories(categoriesData || { channels: [], vods: [], series: [] });
        }
      } catch (err) {
        if (isMounted) setError(err.message || 'Error loading bulk editor data');
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    loadData();
    return () => {
      isMounted = false;
    };
  }, [currentPlaylist?.id]);

  const editCategory = (customerCat, catToEdit, allCat, currentMode) => {
    if (currentMode === 'add') {
      if (catToEdit === null || customerCat === null) return null;
      if (!Array.isArray(customerCat) || catToEdit.length === 0) return customerCat;
      const union = Array.from(new Set([...customerCat, ...catToEdit]));
      return union.length >= allCat.length ? null : union;
    } else if (currentMode === 'remove') {
      if (Array.isArray(catToEdit) && catToEdit.length === 0) return customerCat;
      if (!Array.isArray(catToEdit) || catToEdit === null) return [];
      let current = customerCat;
      if (!Array.isArray(current)) {
        current = allCat.map((x) => x.id);
      }
      return current.filter((id) => !catToEdit.includes(id));
    } else if (currentMode === 'replace') {
      return catToEdit;
    }
    return customerCat;
  };

  const handleSave = async () => {
    if (selectedCustomers.length === 0) {
      navigate(`/users/${currentPlaylist.id}`);
      return;
    }

    setSaving(true);
    setError('');
    setSuccessMsg('');

    try {
      const updates = [];
      const targetUsers = customers.filter((u) => selectedCustomers.includes(u.id));

      if (mode === 'copy') {
        const template = customers.find((u) => String(u.id) === String(customerToCopy));
        if (!template) {
          throw new Error('Please select a valid user to copy categories from');
        }
        for (const u of targetUsers) {
          updates.push({
            ...u,
            channels_categories: template.channels_categories,
            vods_categories: template.vods_categories,
            series_categories: template.series_categories,
          });
        }
      } else {
        for (const u of targetUsers) {
          const updatedChannels = editCategory(
            u.channels_categories,
            categoriesToEdit.channels_categories,
            categories.channels,
            mode
          );
          const updatedVods = editCategory(
            u.vods_categories,
            categoriesToEdit.vods_categories,
            categories.vods,
            mode
          );
          const updatedSeries = editCategory(
            u.series_categories,
            categoriesToEdit.series_categories,
            categories.series,
            mode
          );

          updates.push({
            ...u,
            channels_categories: updatedChannels,
            vods_categories: updatedVods,
            series_categories: updatedSeries,
          });
        }
      }

      await Promise.all(
        updates.map((u) => userApi.updateUser(currentPlaylist.id, u.id, u))
      );

      localStorage.setItem('res-bulk-mode', mode);
      setSuccessMsg(`Categories updated for ${updates.length} user(s) successfully!`);
      onUsersUpdated?.();

      setTimeout(() => {
        navigate(`/users/${currentPlaylist.id}`);
      }, 900);
    } catch (err) {
      setError(err.message || 'Error updating categories in bulk');
    } finally {
      setSaving(false);
    }
  };

  const filteredCustomers = React.useMemo(() => {
    if (!userSearch.trim()) return customers;
    const q = userSearch.toLowerCase().trim();
    return customers.filter(
      (u) => (u.name || '').toLowerCase().includes(q) || (u.username || '').toLowerCase().includes(q)
    );
  }, [customers, userSearch]);

  const handleSelectAllUsers = () => {
    if (selectedCustomers.length === filteredCustomers.length) {
      setSelectedCustomers([]);
    } else {
      setSelectedCustomers(filteredCustomers.map((u) => u.id));
    }
  };

  const handleToggleUserId = (id) => {
    setSelectedCustomers((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  if (!currentPlaylist) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center space-y-3">
        <Users className="w-10 h-10 mx-auto text-[#adb5bd] dark:text-slate-500 stroke-[1.5]" />
        <h3 className="text-base font-bold text-[#32325d] dark:text-white">No Playlist Selected</h3>
        <p className="text-xs text-[#8898aa] dark:text-slate-400">Please select a playlist first before using the bulk category editor.</p>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#3970e1] hover:bg-[#2c5ec2] text-white rounded text-xs font-semibold shadow-argon-btn transition active:scale-[0.98]"
        >
          <span>Select Playlist</span>
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 text-[#3970e1] animate-spin" />
        <span className="text-xs font-semibold text-[#8898aa] dark:text-slate-400">Loading users and categories...</span>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[1920px] mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Standardized Header Bar */}
      <PageHeader
        onBack={() => navigate(`/users/${currentPlaylist.id}`)}
        backTitle="Back to Users"
        icon={Layers}
        color="blue"
        title="Add / Remove Categories in Bulk"
        badge={
          <span className="text-xs font-semibold text-[#3970e1] dark:text-blue-400 bg-[#eef2ff] dark:bg-blue-950/60 border border-[#3970e1]/20 dark:border-blue-700/40 px-2 py-0.5 rounded-[0.375rem]">
            {currentPlaylist.name}
          </span>
        }
        description="Select multiple managed users and apply, replace, or copy channel and VOD category access permissions."
      />

      <div className="bg-white dark:bg-slate-900 border border-[#dee2e6] dark:border-slate-800 rounded-xl shadow-argon dark:shadow-2xl">
        <div className="p-6 space-y-6">
          {error && (
            <div className="p-3 bg-[#feecee] dark:bg-rose-950/40 border border-[#f5365c]/30 dark:border-rose-800/40 rounded text-xs text-[#f5365c] dark:text-rose-300 font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-white dark:bg-emerald-950/40 border border-[#2dce89]/30 dark:border-emerald-800/40 rounded text-xs text-[#2dce89] dark:text-emerald-300 font-semibold flex items-center gap-2 shadow-sm">
              <Check className="w-4 h-4 flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* 1. User Selection Box */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[#525f7f] dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-[#3970e1] dark:text-blue-400" />
                <span>Select Target Users</span>
                <span className="text-[12px] px-2 py-0.5 rounded bg-[#eef2ff] dark:bg-blue-950/60 text-[#3970e1] dark:text-blue-300 border border-[#3970e1]/20 dark:border-blue-800/40 font-bold">
                  {selectedCustomers.length} of {customers.length} selected
                </span>
              </label>

              <button
                type="button"
                onClick={handleSelectAllUsers}
                className="text-xs text-[#3970e1] dark:text-blue-400 hover:underline font-semibold transition"
              >
                {selectedCustomers.length === filteredCustomers.length && filteredCustomers.length > 0
                  ? 'Deselect All'
                  : 'Select All'}
              </button>
            </div>

            <div className="bg-[#f8f9fe] dark:bg-slate-800/50 border border-[#dee2e6] dark:border-slate-700 rounded-lg p-3 space-y-2">
              {/* User search */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#adb5bd] dark:text-slate-500" />
                <input
                  type="text"
                  placeholder="Filter users by name or username..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-white dark:bg-slate-900 border border-[#dee2e6] dark:border-slate-700 rounded text-xs text-[#32325d] dark:text-slate-100 placeholder-[#adb5bd] dark:placeholder:text-slate-500 focus:outline-none focus:border-[#3970e1] transition shadow-sm"
                />
              </div>

              {/* User List */}
              <div className="max-h-56 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 p-0.5">
                {filteredCustomers.length === 0 ? (
                  <div className="col-span-2 py-4 text-center text-xs text-[#8898aa] dark:text-slate-500">
                    No users matching search
                  </div>
                ) : (
                  filteredCustomers.map((u) => {
                    const isChecked = selectedCustomers.includes(u.id);
                    return (
                      <label
                        key={u.id}
                        className={`flex items-center justify-between p-2.5 rounded-lg text-xs cursor-pointer transition-all shadow-sm ${isChecked
                            ? 'bg-[#eef2ff] dark:bg-blue-950/60 border-2 border-[#3970e1] dark:border-blue-500 text-[#32325d] dark:text-white font-semibold'
                            : 'bg-white dark:bg-slate-900 border border-[#dee2e6] dark:border-slate-700/80 hover:border-[#b4c6fc] dark:hover:border-slate-600 text-[#525f7f] dark:text-slate-300'
                          }`}
                      >
                        <div className="flex items-center gap-2.5 truncate pr-2">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleUserId(u.id)}
                            className="rounded border-[#dee2e6] dark:border-slate-600 dark:bg-slate-900 text-[#3970e1] focus:ring-0 cursor-pointer w-4 h-4"
                          />
                          <div className="truncate">
                            <div className="flex items-center gap-1.5 truncate">
                              <span className="font-mono text-[11px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[#3970e1] dark:text-blue-400 border border-[#dee2e6]/60 dark:border-slate-700">
                                #{u.id}
                              </span>
                              <span className="truncate font-semibold text-slate-800 dark:text-slate-100">
                                {u.name || u.username}
                              </span>
                            </div>
                            {u.username && u.name && (
                              <span className="text-[11px] font-mono text-[#8898aa] dark:text-slate-400 truncate block mt-0.5">
                                {u.username}
                              </span>
                            )}
                          </div>
                        </div>
                      </label>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* 2. Operation Mode Segmented Control */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-[#525f7f] dark:text-slate-300 uppercase tracking-wider block">
              Operation Mode
            </label>
            <div className="p-0.5 bg-[#f6f9fc] dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded flex text-xs">
              <button
                type="button"
                onClick={() => setMode('add')}
                className={`flex-1 py-1.5 rounded text-xs font-semibold transition flex items-center justify-center gap-1.5 ${mode === 'add' ? 'bg-[#3970e1] text-white shadow-sm' : 'text-[#525f7f] dark:text-slate-300 hover:text-[#32325d] dark:hover:text-white'
                  }`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Categories</span>
              </button>

              <button
                type="button"
                onClick={() => setMode('remove')}
                className={`flex-1 py-1.5 rounded text-xs font-semibold transition flex items-center justify-center gap-1.5 ${mode === 'remove' ? 'bg-[#3970e1] text-white shadow-sm' : 'text-[#525f7f] dark:text-slate-300 hover:text-[#32325d] dark:hover:text-white'
                  }`}
              >
                <Minus className="w-3.5 h-3.5" />
                <span>Remove Categories</span>
              </button>

              <button
                type="button"
                onClick={() => setMode('replace')}
                className={`flex-1 py-1.5 rounded text-xs font-semibold transition flex items-center justify-center gap-1.5 ${mode === 'replace' ? 'bg-[#3970e1] text-white shadow-sm' : 'text-[#525f7f] dark:text-slate-300 hover:text-[#32325d] dark:hover:text-white'
                  }`}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Overwrite</span>
              </button>

              {customers.length > 1 && (
                <button
                  type="button"
                  onClick={() => setMode('copy')}
                  className={`flex-1 py-1.5 rounded text-xs font-semibold transition flex items-center justify-center gap-1.5 ${mode === 'copy' ? 'bg-[#3970e1] text-white shadow-sm' : 'text-[#525f7f] dark:text-slate-300 hover:text-[#32325d] dark:hover:text-white'
                    }`}
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy from User</span>
                </button>
              )}
            </div>

            {/* Mode descriptions */}
            <p className="text-[13px] text-[#8898aa] dark:text-slate-400 pl-1 font-medium">
              {mode === 'add' && 'Adds the selected categories to each user\'s existing access without removing anything.'}
              {mode === 'remove' && 'Removes the selected categories from each user\'s existing access.'}
              {mode === 'replace' && 'Completely overwrites each user\'s categories with the chosen selection.'}
              {mode === 'copy' && 'Copies category configuration directly from a selected template user.'}
            </p>
          </div>

          {/* 3. Category Selectors (when mode !== 'copy') */}
          {mode !== 'copy' && (
            <div className="space-y-2 pt-2 border-t border-[#e9ecef] dark:border-slate-800 relative z-20">
              <label className="text-xs font-bold text-[#525f7f] dark:text-slate-300 uppercase tracking-wider block">
                Categories to Apply
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <MultiCategorySelect
                  title="Live Channels"
                  type="channels"
                  categories={categories.channels || []}
                  value={categoriesToEdit.channels_categories}
                  onChange={(val) =>
                    setCategoriesToEdit({ ...categoriesToEdit, channels_categories: val })
                  }
                  disabled={selectedCustomers.length === 0}
                  align="left"
                />

                <MultiCategorySelect
                  title="Movies / VOD"
                  type="movies"
                  categories={categories.vods || []}
                  value={categoriesToEdit.vods_categories}
                  onChange={(val) =>
                    setCategoriesToEdit({ ...categoriesToEdit, vods_categories: val })
                  }
                  disabled={selectedCustomers.length === 0}
                  align="left"
                />

                <MultiCategorySelect
                  title="TV Series"
                  type="series"
                  categories={categories.series || []}
                  value={categoriesToEdit.series_categories}
                  onChange={(val) =>
                    setCategoriesToEdit({ ...categoriesToEdit, series_categories: val })
                  }
                  disabled={selectedCustomers.length === 0}
                  align="right"
                />
              </div>

              {selectedCustomers.length === 0 && (
                <p className="text-[13px] text-[#fb6340] dark:text-orange-400 font-semibold pt-1">
                  Please select at least one user above to configure categories.
                </p>
              )}
            </div>
          )}

          {/* 4. Copy From Template User (when mode === 'copy') */}
          {mode === 'copy' && (
            <div className="space-y-2 pt-2 border-t border-[#e9ecef] dark:border-slate-800">
              <label className="text-xs font-bold text-[#525f7f] dark:text-slate-300 uppercase tracking-wider block">
                Select Source User
              </label>
              <select
                value={customerToCopy}
                onChange={(e) => setCustomerToCopy(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-[#dee2e6] dark:border-slate-700 rounded text-xs text-[#32325d] dark:text-slate-100 focus:outline-none focus:border-[#3970e1] shadow-sm"
              >
                <option value="">-- Choose a template user to copy from --</option>
                {customers
                  .filter((u) => !selectedCustomers.includes(u.id))
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      #{u.id} {u.name || u.username} {u.name && u.username ? `(${u.username})` : ''}
                    </option>
                  ))}
              </select>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="px-6 py-4 border-t border-[#e9ecef] dark:border-slate-800 bg-[#f8f9fe] dark:bg-slate-800/80 flex items-center justify-between rounded-b-lg relative z-10">
          <button
            type="button"
            onClick={() => navigate(`/users/${currentPlaylist.id}`)}
            className="px-4 py-2 bg-white dark:bg-slate-800 hover:bg-[#f6f9fc] dark:hover:bg-slate-700 text-[#525f7f] dark:text-slate-300 border border-[#dee2e6] dark:border-slate-700 rounded text-xs font-semibold transition active:scale-[0.98] shadow-sm"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving || selectedCustomers.length === 0}
            className="flex items-center gap-1.5 px-5 py-2 bg-[#2dce89] hover:bg-[#26af74] text-white font-semibold rounded text-xs shadow-argon-btn transition active:scale-[0.98] disabled:opacity-40"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            <span>Apply to {selectedCustomers.length} User(s)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
