import React from 'react';
import {
  User,
  Layers,
  Server,
  Calendar as CalendarIcon,
  Dices,
  Key,
  Check,
  ArrowLeft,
  ArrowRight,
  Loader2,
  AlertCircle,
  FileText,
  UserPlus
} from 'lucide-react';
import { userApi, playlistApi } from '../api/client';
import MultiCategorySelect from '../components/MultiCategorySelect';
import ProviderEditor from '../components/ProviderEditor';
import CalendarPicker from '../components/CalendarPicker';
import { PageHeader } from '../components/ui';

export default function CreateUserWizard({ currentPlaylist, onUserCreated, onCancel }) {
  const [currentStep, setCurrentStep] = React.useState(1);

  // Form State
  const [name, setName] = React.useState('');
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [note, setNote] = React.useState('');
  const [message, setMessage] = React.useState(currentPlaylist?.message || '');
  const [maxConnections, setMaxConnections] = React.useState(1);

  // Categories State
  const [categories, setCategories] = React.useState({ channels: [], vods: [], series: [] });
  const [channelsCategories, setChannelsCategories] = React.useState(null);
  const [vodsCategories, setVodsCategories] = React.useState(null);
  const [seriesCategories, setSeriesCategories] = React.useState(null);

  // Template user state
  const [existingUsers, setExistingUsers] = React.useState([]);
  const [templateUserId, setTemplateUserId] = React.useState('');

  // Provider State
  const [patterns, setPatterns] = React.useState([]);
  const [copyCredsToProvider, setCopyCredsToProvider] = React.useState(true);

  // Expiry State
  const defaultExpiry = React.useMemo(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    d.setHours(23, 59, 0, 0);
    return d.toISOString();
  }, []);
  const [expiry, setExpiry] = React.useState(defaultExpiry);
  const [syncExpiryDate, setSyncExpiryDate] = React.useState(true);

  // Validation state
  const [usernameChecking, setUsernameChecking] = React.useState(false);
  const [usernameAvailable, setUsernameAvailable] = React.useState(false);
  const [usernameMsg, setUsernameMsg] = React.useState('');

  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState('');

  // Load initial random username/password and playlist patterns/categories
  React.useEffect(() => {
    let isMounted = true;
    const init = async () => {
      try {
        const [uRes, pRes, nextIdRes, catData, usersData] = await Promise.all([
          userApi.generateRandom('username'),
          userApi.generateRandom('password'),
          userApi.getNextUserId(currentPlaylist.id).catch(() => null),
          playlistApi.getCategories(currentPlaylist.id),
          userApi.getUsers(currentPlaylist.id),
        ]);
        if (!isMounted) return;
        setUsername(uRes.value);
        setPassword(pRes.value);

        const nextId = nextIdRes?.next_id ?? (
          usersData && usersData.length > 0
            ? Math.max(...usersData.map((u) => Number(u.id) || 0)) + 1
            : 1
        );
        setName(`User #${nextId}`);

        setCategories(catData || { channels: [], vods: [], series: [] });
        setExistingUsers(usersData || []);

        let pList = [];
        if (currentPlaylist?.patterns) {
          if (Array.isArray(currentPlaylist.patterns)) pList = currentPlaylist.patterns;
          else if (typeof currentPlaylist.patterns === 'string') {
            try { pList = JSON.parse(currentPlaylist.patterns); } catch { }
          }
        }
        if (pList.length === 0) {
          pList = [{ type: 'xtream', url: '', param1: uRes.value, param2: pRes.value, useCUrl: false }];
        } else if (pList[0]?.param1) {
          setCopyCredsToProvider(false);
        }
        setPatterns(pList);
      } catch (err) {
        console.error('Init error:', err);
      }
    };
    init();
    return () => {
      isMounted = false;
    };
  }, [currentPlaylist?.id, currentPlaylist?.patterns]);

  // Debounced username verification
  React.useEffect(() => {
    if (!username.trim()) {
      setUsernameAvailable(false);
      setUsernameMsg('Username required');
      return;
    }

    setUsernameChecking(true);
    const timer = setTimeout(async () => {
      try {
        const res = await userApi.checkUsername(username, currentPlaylist.id);
        setUsernameAvailable(res.available);
        setUsernameMsg(res.available ? 'Available' : 'Already taken');
      } catch {
        setUsernameAvailable(false);
        setUsernameMsg('Verification error');
      } finally {
        setUsernameChecking(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [username, currentPlaylist.id]);

  const handleGenerate = async (type) => {
    try {
      const res = await userApi.generateRandom(type);
      if (type === 'username') setUsername(res.value);
      if (type === 'password') setPassword(res.value);
    } catch {
      setError('Generation failed');
    }
  };

  const handleSelectTemplateUser = (uId) => {
    setTemplateUserId(uId);
    if (!uId) return;
    const template = existingUsers.find((u) => String(u.id) === String(uId));
    if (template) {
      setChannelsCategories(template.channels_categories);
      setVodsCategories(template.vods_categories);
      setSeriesCategories(template.series_categories);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!usernameAvailable) return;
    setSubmitting(true);
    setError('');

    try {
      // If copyCredsToProvider is active, propagate username/password to the first pattern
      let finalPatterns = [...patterns];
      if (copyCredsToProvider && finalPatterns.length > 0) {
        finalPatterns = finalPatterns.map((p, idx) => {
          if (idx === 0) {
            return {
              ...p,
              param1: username.trim(),
              param2: password.trim(),
            };
          }
          return p;
        });
      }

      const payload = {
        name: name.trim(),
        username: username.trim(),
        password: password.trim(),
        note: note.trim(),
        message: message.trim(),
        max_connections: Number(maxConnections) || 1,
        channels_categories: channelsCategories,
        vods_categories: vodsCategories,
        series_categories: seriesCategories,
        patterns: finalPatterns,
        expiry: syncExpiryDate ? null : (expiry || null),
        sync_expiry_date: syncExpiryDate,
      };

      const newUser = await userApi.createUser(currentPlaylist.id, payload);
      onUserCreated(newUser);
    } catch (err) {
      setError(err.message || 'Error creating user');
    } finally {
      setSubmitting(false);
    }
  };

  const steps = [
    { num: 1, label: 'User Info', icon: User },
    { num: 2, label: 'Categories', icon: Layers },
    { num: 3, label: 'Provider', icon: Server },
    { num: 4, label: 'Expiry & Review', icon: CalendarIcon },
  ];

  return (
    <div className="w-full max-w-[1920px] mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Standardized Header Bar */}
      <PageHeader
        onBack={onCancel}
        backTitle="Cancel and return to Users"
        icon={UserPlus}
        color="blue"
        title="Create New Managed User"
        badge={
          <span className="text-xs font-semibold text-[#3970e1] dark:text-blue-400 bg-[#eef2ff] dark:bg-blue-950/60 border border-[#3970e1]/20 dark:border-blue-700/40 px-2 py-0.5 rounded-[0.375rem]">
            {currentPlaylist.name}
          </span>
        }
        description="Add a new provider account, configure categories and stream credentials for this playlist."
        actions={
          <button
            type="button"
            onClick={onCancel}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-[#f6f9fc] dark:hover:bg-slate-700 text-[#525f7f] dark:text-slate-300 border border-[#dee2e6] dark:border-slate-700 rounded-[0.375rem] text-xs font-semibold shadow-argon-sm transition"
          >
            Cancel
          </button>
        }
      />

      <div className="bg-white dark:bg-slate-900 border border-[#dee2e6] dark:border-slate-800 rounded-xl shadow-argon overflow-hidden">
        {/* Stepper Tabs Bar */}
        <div className="px-6 py-4 border-b border-[#e9ecef] dark:border-slate-800 bg-[#f8f9fe] dark:bg-slate-800/80">
          <div className="flex items-center justify-between">
            {steps.map((s) => {
              const isActive = currentStep === s.num;
              const isDone = currentStep > s.num;
              return (
                <div
                  key={s.num}
                  onClick={() => {
                    if (isDone || (s.num < currentStep)) {
                      setCurrentStep(s.num);
                    }
                  }}
                  className={`flex items-center gap-1.5 text-xs font-semibold py-1 px-2.5 rounded transition ${isActive
                      ? 'bg-[#eef2ff] dark:bg-blue-950/60 text-[#3970e1] dark:text-blue-400 border border-[#3970e1]/30 dark:border-blue-700/40 font-bold'
                      : isDone
                        ? 'text-[#2dce89] dark:text-emerald-400 hover:text-[#26af74] dark:hover:text-emerald-300 cursor-pointer'
                        : 'text-[#8898aa] dark:text-slate-400'
                    }`}
                >
                  <span className="text-[13px] font-mono">{s.num}.</span>
                  <span>{s.label}</span>
                  {isDone && <Check className="w-3 h-3 text-[#2dce89] dark:text-emerald-400 stroke-[2.5]" />}
                </div>
              );
            })}
          </div>
        </div>

        {/* Wizard Form Body */}
        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-[#feecee] dark:bg-rose-950/60 border border-[#f5365c]/30 dark:border-rose-700/40 rounded text-xs text-[#f5365c] dark:text-rose-400 font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* STEP 1: USER INFO */}
          {currentStep === 1 && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <h3 className="text-xs font-bold text-[#525f7f] dark:text-slate-300 uppercase tracking-wider">
                Account Details
              </h3>

              <div>
                <label className="block text-xs font-bold text-[#525f7f] dark:text-slate-300 uppercase tracking-wider mb-1">Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. User #1"
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded text-xs text-[#32325d] dark:text-slate-100 placeholder-[#adb5bd] dark:placeholder-slate-500 focus:outline-none focus:border-[#3970e1] focus:ring-1 focus:ring-[#3970e1]/30 transition shadow-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Username with Generator */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-[#525f7f] dark:text-slate-300 uppercase tracking-wider">
                      Username
                    </label>
                    <span className={`text-[13px] font-semibold ${usernameAvailable ? 'text-[#2dce89] dark:text-emerald-400' : 'text-[#f5365c] dark:text-rose-400'}`}>
                      {usernameChecking ? 'Checking...' : usernameMsg}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="flex-1 px-3 py-2 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded text-xs font-mono text-[#32325d] dark:text-slate-100 focus:outline-none focus:border-[#3970e1] focus:ring-1 focus:ring-[#3970e1]/30 transition shadow-sm"
                    />
                    <button
                      type="button"
                      onClick={() => handleGenerate('username')}
                      className="p-2 bg-white dark:bg-slate-800 hover:bg-[#f6f9fc] dark:hover:bg-slate-700 text-[#525f7f] dark:text-slate-300 border border-[#dee2e6] dark:border-slate-700 rounded transition active:scale-[0.98] shadow-sm"
                      title="Generate random username"
                    >
                      <Dices className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Password with Generator */}
                <div>
                  <label className="block text-xs font-bold text-[#525f7f] dark:text-slate-300 uppercase tracking-wider mb-1">
                    Password
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="flex-1 px-3 py-2 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded text-xs font-mono text-[#32325d] dark:text-slate-100 focus:outline-none focus:border-[#3970e1] focus:ring-1 focus:ring-[#3970e1]/30 transition shadow-sm"
                    />
                    <button
                      type="button"
                      onClick={() => handleGenerate('password')}
                      className="p-2 bg-white dark:bg-slate-800 hover:bg-[#f6f9fc] dark:hover:bg-slate-700 text-[#525f7f] dark:text-slate-300 border border-[#dee2e6] dark:border-slate-700 rounded transition active:scale-[0.98] shadow-sm"
                      title="Generate random password"
                    >
                      <Dices className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#525f7f] dark:text-slate-300 uppercase tracking-wider mb-1">Max Connections</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={maxConnections}
                    onChange={(e) => setMaxConnections(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded text-xs text-[#32325d] dark:text-slate-100 focus:outline-none focus:border-[#3970e1] focus:ring-1 focus:ring-[#3970e1]/30 transition shadow-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#525f7f] dark:text-slate-300 uppercase tracking-wider mb-1">User Notice / Message</label>
                  <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Optional message..."
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded text-xs text-[#32325d] dark:text-slate-100 placeholder-[#adb5bd] dark:placeholder-slate-500 focus:outline-none focus:border-[#3970e1] focus:ring-1 focus:ring-[#3970e1]/30 transition shadow-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#525f7f] dark:text-slate-300 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-[#3970e1] dark:text-blue-400" />
                  <span>Admin Notes</span>
                </label>
                <textarea
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Internal notes..."
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded text-xs text-[#32325d] dark:text-slate-100 placeholder-[#adb5bd] dark:placeholder-slate-500 focus:outline-none focus:border-[#3970e1] focus:ring-1 focus:ring-[#3970e1]/30 transition resize-none shadow-sm"
                />
              </div>
            </div>
          )}

          {/* STEP 2: CATEGORIES */}
          {currentStep === 2 && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <h3 className="text-xs font-bold text-[#525f7f] dark:text-slate-300 uppercase tracking-wider">
                Category Access
              </h3>

              {/* Template user loader */}
              {existingUsers.length > 0 && (
                <div className="p-3 bg-[#f8f9fe] dark:bg-slate-800/60 border border-[#dee2e6] dark:border-slate-700 rounded-lg">
                  <label className="block text-xs font-bold text-[#525f7f] dark:text-slate-300 uppercase tracking-wider mb-1">
                    Load categories from an existing user (Template)
                  </label>
                  <select
                    value={templateUserId}
                    onChange={(e) => handleSelectTemplateUser(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded text-xs text-[#32325d] dark:text-slate-100 focus:outline-none focus:border-[#3970e1] shadow-sm"
                  >
                    <option value="">-- Select a template user --</option>
                    {existingUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.username})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <MultiCategorySelect
                  title="Live Channels"
                  type="channels"
                  categories={categories.channels || []}
                  value={channelsCategories}
                  onChange={setChannelsCategories}
                />

                <MultiCategorySelect
                  title="Movies / VOD"
                  type="movies"
                  categories={categories.vods || []}
                  value={vodsCategories}
                  onChange={setVodsCategories}
                />

                <MultiCategorySelect
                  title="TV Series"
                  type="series"
                  categories={categories.series || []}
                  value={seriesCategories}
                  onChange={setSeriesCategories}
                />
              </div>
            </div>
          )}

          {/* STEP 3: PROVIDER INFO */}
          {currentStep === 3 && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-[#525f7f] dark:text-slate-300 uppercase tracking-wider">
                  Source Provider
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    let pList = [];
                    if (currentPlaylist?.patterns) {
                      if (Array.isArray(currentPlaylist.patterns)) pList = currentPlaylist.patterns;
                      else if (typeof currentPlaylist.patterns === 'string') {
                        try { pList = JSON.parse(currentPlaylist.patterns); } catch { }
                      }
                    }
                    if (pList.length > 0) setPatterns(pList);
                  }}
                  className="px-2.5 py-1 bg-white dark:bg-slate-800 hover:bg-[#f6f9fc] dark:hover:bg-slate-700 text-[#525f7f] dark:text-slate-300 border border-[#dee2e6] dark:border-slate-700 rounded text-xs font-semibold transition active:scale-[0.98] shadow-sm"
                >
                  Reset defaults
                </button>
              </div>

              <ProviderEditor
                patterns={patterns}
                onChange={setPatterns}
                showSync={false}
              />

              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-[#525f7f] dark:text-slate-300 p-2.5 bg-[#f8f9fe] dark:bg-slate-800/60 border border-[#dee2e6] dark:border-slate-700 rounded-lg">
                <input
                  type="checkbox"
                  checked={copyCredsToProvider}
                  onChange={(e) => setCopyCredsToProvider(e.target.checked)}
                  className="rounded border-[#dee2e6] dark:border-slate-700 text-[#3970e1] focus:ring-0 cursor-pointer"
                />
                <span>Automatically sync credentials with source provider fields</span>
              </label>
            </div>
          )}

          {/* STEP 4: EXPIRY & REVIEW */}
          {currentStep === 4 && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div>
                <h3 className="text-xs font-bold text-[#525f7f] dark:text-slate-300 uppercase tracking-wider">
                  Expiration & Summary
                </h3>
                <p className="text-xs text-[#8898aa] dark:text-slate-400 mt-0.5">
                  Set user expiration preferences and verify account details before creation.
                </p>
              </div>

              {/* Sync Preferences */}
              <div>
                <label className="block text-xs font-bold text-[#525f7f] dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Sync Preferences
                </label>
                <label className="flex items-start gap-2.5 cursor-pointer text-xs text-[#525f7f] dark:text-slate-300 p-3 bg-[#f8f9fe] dark:bg-slate-800/60 border border-[#dee2e6] dark:border-slate-700 rounded-lg hover:border-[#cad1d7] dark:hover:border-slate-600 transition">
                  <input
                    type="checkbox"
                    checked={syncExpiryDate}
                    onChange={(e) => setSyncExpiryDate(e.target.checked)}
                    className="mt-0.5 rounded border-[#dee2e6] dark:border-slate-700 text-[#3970e1] focus:ring-0 cursor-pointer"
                  />
                  <div>
                    <span className="font-semibold text-[#32325d] dark:text-slate-100 block">Auto sync expiration</span>
                    <span className="text-[13px] text-[#8898aa] dark:text-slate-400 block">Synchronize with provider when expiration is near</span>
                  </div>
                </label>
              </div>

              {/* Expiration selection (only shown if Auto sync expiration is disabled) */}
              {!syncExpiryDate ? (
                <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
                  {/* Left side: Inline Calendar Picker */}
                  <div className="md:col-span-7">
                    <CalendarPicker
                      label="Expiration Date & Time"
                      value={expiry}
                      onChange={setExpiry}
                      inline={true}
                    />
                  </div>

                  {/* Right side: Review Card */}
                  <div className="md:col-span-5 flex flex-col justify-start space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-[#525f7f] dark:text-slate-300 uppercase tracking-wider mb-1.5">
                        Account Summary
                      </label>
                      <div className="bg-[#f8f9fe] dark:bg-slate-800/60 border border-[#dee2e6] dark:border-slate-700 rounded-lg p-3.5 text-xs space-y-2">
                        <div className="flex items-center justify-between pb-1.5 border-b border-[#e9ecef] dark:border-slate-700">
                          <span className="text-[#8898aa] dark:text-slate-400">Name:</span>
                          <span className="text-[#32325d] dark:text-slate-100 font-semibold">{name}</span>
                        </div>
                        <div className="flex items-center justify-between pb-1.5 border-b border-[#e9ecef] dark:border-slate-700">
                          <span className="text-[#8898aa] dark:text-slate-400">Username:</span>
                          <span className="text-[#2dce89] dark:text-emerald-400 font-mono font-bold">{username}</span>
                        </div>
                        <div className="flex items-center justify-between pb-1.5 border-b border-[#e9ecef] dark:border-slate-700">
                          <span className="text-[#8898aa] dark:text-slate-400">Connections:</span>
                          <span className="text-[#32325d] dark:text-slate-100 font-mono font-semibold">{maxConnections}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[#8898aa] dark:text-slate-400">Expiration:</span>
                          <span className="font-mono text-[#32325d] dark:text-slate-100 font-semibold">
                            {expiry ? new Date(expiry).toLocaleDateString(undefined, { month: 'short', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Unlimited'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* Auto sync enabled: Calendar is hidden, show Account Summary */
                <div>
                  <label className="block text-xs font-bold text-[#525f7f] dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Account Summary
                  </label>
                  <div className="bg-[#f8f9fe] dark:bg-slate-800/60 border border-[#dee2e6] dark:border-slate-700 rounded-lg p-3.5 text-xs space-y-2">
                    <div className="flex items-center justify-between pb-1.5 border-b border-[#e9ecef] dark:border-slate-700">
                      <span className="text-[#8898aa] dark:text-slate-400">Name:</span>
                      <span className="text-[#32325d] dark:text-slate-100 font-semibold">{name}</span>
                    </div>
                    <div className="flex items-center justify-between pb-1.5 border-b border-[#e9ecef] dark:border-slate-700">
                      <span className="text-[#8898aa] dark:text-slate-400">Username:</span>
                      <span className="text-[#2dce89] dark:text-emerald-400 font-mono font-bold">{username}</span>
                    </div>
                    <div className="flex items-center justify-between pb-1.5 border-b border-[#e9ecef] dark:border-slate-700">
                      <span className="text-[#8898aa] dark:text-slate-400">Connections:</span>
                      <span className="text-[#32325d] dark:text-slate-100 font-mono font-semibold">{maxConnections}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[#8898aa] dark:text-slate-400">Expiration:</span>
                      <span className="font-mono text-[#3970e1] dark:text-blue-400 font-semibold flex items-center gap-1">
                        <Check className="w-3.5 h-3.5 text-[#2dce89] dark:text-emerald-400" />
                        Auto-synced with provider
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Wizard Footer Navigation */}
        <div className="px-6 py-4 border-t border-[#e9ecef] dark:border-slate-800 bg-[#f8f9fe] dark:bg-slate-800/80 flex items-center justify-between rounded-b-lg">
          <button
            type="button"
            onClick={() => setCurrentStep((prev) => Math.max(1, prev - 1))}
            disabled={currentStep === 1}
            className="flex items-center gap-1.5 px-4 py-2 bg-white dark:bg-slate-800 hover:bg-[#f6f9fc] dark:hover:bg-slate-700 text-[#525f7f] dark:text-slate-300 border border-[#dee2e6] dark:border-slate-700 rounded text-xs font-semibold transition active:scale-[0.98] shadow-sm disabled:opacity-40"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Previous</span>
          </button>

          {currentStep < 4 ? (
            <button
              type="button"
              onClick={() => setCurrentStep((prev) => Math.min(4, prev + 1))}
              disabled={currentStep === 1 && (!usernameAvailable || !name.trim())}
              className="flex items-center gap-1.5 px-5 py-2 bg-[#3970e1] hover:bg-[#2c5ec2] text-white font-semibold rounded text-xs shadow-argon-btn transition active:scale-[0.98] disabled:opacity-40"
            >
              <span>Continue</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="flex items-center gap-1.5 px-5 py-2 bg-[#2dce89] hover:bg-[#26af74] text-white font-semibold rounded text-xs shadow-argon-btn transition active:scale-[0.98] disabled:opacity-50"
            >
              {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              <span>Create User</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
