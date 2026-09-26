import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Info,
  Settings,
  Eye,
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  Tv,
  Film,
  Loader2,
  AlertCircle,
  Sparkles
} from 'lucide-react';
import { playlistApi } from '../api/client';
import { PageHeader } from '../components/ui';

const DEMO_CATEGORIES = [
  { id: 2, name: 'Live Sports VIP' },
  { id: 3, name: 'Entertainment & Cinema' },
  { id: 4, name: 'Documentaries & Science' },
];

const DEMO_STREAMS = [
  { id: 20, category: 2, name: 'Channel 1 HD', icon: null },
  { id: 30, category: 2, name: 'Channel 2 UHD', icon: null },
  { id: 40, category: 3, name: 'Channel Europe', icon: null },
  { id: 50, category: 3, name: 'Channel Premieres FHD', icon: null },
  { id: 60, category: 4, name: 'Channel Science FHD', icon: null },
  { id: 70, category: 4, name: 'Channel Geo', icon: null },
];

function replaceTags(text, customer) {
  if (!text) return '';
  let res = text;
  res = res.replace(/%name%/g, customer.name || 'Demo user');
  res = res.replace(/%expiry%/g, customer.expiry || new Date().toUTCString());
  res = res.replace(/%message%/g, customer.message || 'Thank you for choosing us');
  res = res.replace(/%max_con%/g, String(customer.max_connections || 2));
  res = res.replace(/%user%/g, customer.username || 'username1');
  res = res.replace(/%pass%/g, customer.password || '123456789');
  return res;
}

function WelcomeTag({ tag, label, onCopied }) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = (e) => {
    e.preventDefault();
    navigator.clipboard.writeText(tag);
    setCopied(true);
    onCopied?.(tag);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="group relative flex items-center justify-between w-full px-2.5 py-1.5 rounded bg-white dark:bg-slate-800 hover:bg-[#f6f9fc] dark:hover:bg-slate-700/60 border border-[#e9ecef] dark:border-slate-700 text-left text-xs transition active:scale-[0.99] shadow-xs"
      title={`Click to copy ${tag}`}
    >
      <div className="flex items-center gap-2 truncate">
        <code className="px-1.5 py-0.5 rounded bg-[#eef2ff] dark:bg-blue-950/60 text-[#3970e1] dark:text-blue-400 font-mono font-bold text-[12px] group-hover:bg-[#3970e1] group-hover:text-white transition-colors">
          {tag}
        </code>
        <span className="text-[#525f7f] dark:text-slate-300 text-xs truncate">{label}</span>
      </div>
      <div className="flex items-center pl-1">
        {copied ? (
          <span className="flex items-center gap-1 text-[13px] font-bold text-[#2dce89] dark:text-emerald-400">
            <Check className="w-3 h-3 text-[#2dce89] dark:text-emerald-400" />
            Copied
          </span>
        ) : (
          <Copy className="w-3 h-3 text-[#8898aa] dark:text-slate-500 opacity-40 group-hover:opacity-100 transition-opacity" />
        )}
      </div>
    </button>
  );
}

function PreviewGrid({ categoryName, items = [], isWelcomeDisabled = false, logoUrl = '' }) {
  const [activeTab, setActiveTab] = React.useState(1);

  const categories = React.useMemo(() => {
    if (isWelcomeDisabled || !categoryName) {
      return DEMO_CATEGORIES;
    }
    return [{ id: 1, name: categoryName, isWelcome: true }, ...DEMO_CATEGORIES];
  }, [categoryName, isWelcomeDisabled]);

  React.useEffect(() => {
    if (categories.length > 0) {
      setActiveTab(categories[0].id);
    }
  }, [categories]);

  const activeStreams = React.useMemo(() => {
    if (activeTab === 1 && !isWelcomeDisabled && categoryName) {
      return items.map((item, idx) => ({
        id: idx + 1,
        category: 1,
        name: item,
        image: logoUrl,
        isWelcomeItem: true,
      }));
    }
    return DEMO_STREAMS.filter((s) => s.category === activeTab);
  }, [activeTab, isWelcomeDisabled, categoryName, items, logoUrl]);

  return (
    <div className="bg-white dark:bg-slate-900 border border-[#dee2e6] dark:border-slate-800 rounded-lg shadow-sm overflow-hidden flex flex-col h-full min-h-[380px]">
      {/* Player header */}
      <div className="bg-[#172b4d] dark:bg-slate-950 text-white px-3.5 py-2 flex items-center justify-between border-b border-[#2d3748] dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-bold tracking-wide">Media Player Simulation</span>
        </div>
        <span className="text-[12px] text-white/70 bg-white/10 px-2 py-0.5 rounded font-mono">
          {isWelcomeDisabled ? 'Welcome: Disabled' : 'Welcome: Active'}
        </span>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Categories Sidebar */}
        <div className="w-48 bg-[#f8f9fe] dark:bg-slate-800/80 border-r border-[#e9ecef] dark:border-slate-800 flex flex-col overflow-y-auto">
          <div className="p-2 text-[12px] font-bold uppercase tracking-wider text-[#8898aa] dark:text-slate-400">
            Categories
          </div>
          <div className="space-y-0.5 px-1 pb-2">
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveTab(cat.id)}
                className={`w-full text-left px-2.5 py-2 rounded text-xs transition flex items-center justify-between font-medium ${activeTab === cat.id
                  ? 'bg-[#3970e1] text-white font-bold shadow-xs'
                  : 'text-[#525f7f] dark:text-slate-300 hover:bg-[#eef2ff] dark:hover:bg-slate-700/60'
                  }`}
              >
                <span className="truncate">{cat.name}</span>
                {cat.isWelcome && (
                  <span className={`text-[12px] px-1 py-0.2 rounded font-mono font-bold ${activeTab === cat.id ? 'bg-white/20 text-white' : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                    }`}>
                    Banner
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Streams List */}
        <div className="flex-1 flex flex-col overflow-y-auto bg-white dark:bg-slate-900">
          <div className="p-2 border-b border-[#f1f3f9] dark:border-slate-800 text-[12px] font-bold uppercase tracking-wider text-[#8898aa] dark:text-slate-400 flex items-center justify-between">
            <span>Streams in Category</span>
            <span>{activeStreams.length} items</span>
          </div>

          <div className="divide-y divide-[#f1f3f9] dark:divide-slate-800 flex-1">
            {activeStreams.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#8898aa] dark:text-slate-400">
                No streams in this category.
              </div>
            ) : (
              activeStreams.map((st, i) => (
                <div
                  key={i}
                  className={`px-3 py-2.5 flex items-center gap-3 transition hover:bg-[#f6f9fc] dark:hover:bg-slate-800/60 ${st.isWelcomeItem ? 'bg-emerald-50/40 dark:bg-emerald-950/20 hover:bg-emerald-50/70 dark:hover:bg-emerald-950/40' : ''
                    }`}
                >
                  <div className="w-7 h-7 rounded bg-[#eef2ff] dark:bg-slate-800 border border-[#d2d6df] dark:border-slate-700 flex items-center justify-center flex-shrink-0 overflow-hidden shadow-2xs">
                    {st.image ? (
                      <img
                        src={st.image}
                        alt="logo"
                        className="w-full h-full object-contain"
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    ) : (
                      <Tv className="w-3.5 h-3.5 text-[#3970e1] dark:text-blue-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-[#32325d] dark:text-white truncate">
                      {st.name}
                    </div>
                    <div className="text-[13px] text-[#8898aa] dark:text-slate-400">
                      {st.isWelcomeItem ? 'Special Stream ID 0 • Welcome Announcement' : `Channel #${st.id}`}
                    </div>
                  </div>
                  {st.isWelcomeItem && (
                    <span className="text-[12px] font-bold text-[#2dce89] dark:text-emerald-400 bg-emerald-100/70 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded flex-shrink-0">
                      Live
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function WelcomeInfoWizard({ currentPlaylist, onComplete, onCancel }) {
  const navigate = useNavigate();

  // Navigation steps state
  const skipStep1Initial = localStorage.getItem('skip-welcome-info') === '1';
  const [currentStep, setCurrentStep] = React.useState(skipStep1Initial ? 2 : 1);
  const [skipStep1, setSkipStep1] = React.useState(skipStep1Initial);
  const [loadExample, setLoadExample] = React.useState(false);

  // Form State
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [category, setCategory] = React.useState('');
  const [tagsInfo, setTagsInfo] = React.useState('');
  const [stream, setStream] = React.useState('');
  const [image, setImage] = React.useState('');
  const [where, setWhere] = React.useState({ channels: true, vods: false, series: false });
  const [disableAll, setDisableAll] = React.useState(false);
  const [playlistMessage, setPlaylistMessage] = React.useState(currentPlaylist?.message || '');

  // Fetch current playlist welcome info on mount
  React.useEffect(() => {
    let isMounted = true;
    const load = async () => {
      if (!currentPlaylist?.id) return;
      try {
        setLoading(true);
        const res = await playlistApi.getWelcomeInfo(currentPlaylist.id);
        if (!isMounted) return;

        if (res?.message) {
          setPlaylistMessage(res.message);
        }

        let info = res?.welcome_info;
        if (typeof info === 'string') {
          try { info = JSON.parse(info); } catch { }
        }

        if (info && (info.category !== undefined && info.category !== null)) {
          setCategory(typeof info.category === 'string' ? info.category : (info.category?.name || String(info.category || '')));
          setStream(typeof info.stream === 'string' ? info.stream : String(info.stream || ''));
          setImage(typeof info.image === 'string' ? info.image : String(info.image || ''));
          if (info.where) {
            setWhere({
              channels: info.where.channels ?? true,
              vods: info.where.vods ?? false,
              series: info.where.series ?? false,
            });
          }
          if (Array.isArray(info.tags)) {
            setTagsInfo(info.tags.join('\n'));
          } else if (typeof info.tags === 'string') {
            setTagsInfo(info.tags);
          } else if (info.tags !== undefined && info.tags !== null) {
            setTagsInfo(String(info.tags));
          }
          setDisableAll(false);
        } else if (info && (info.disableAll || Object.keys(info).length === 0)) {
          setDisableAll(true);
        }
      } catch (err) {
        console.error('Error fetching welcome info:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    load();
    return () => { isMounted = false; };
  }, [currentPlaylist?.id]);

  // Handle "Skip Step 1" checkbox
  React.useEffect(() => {
    localStorage.setItem('skip-welcome-info', skipStep1 ? '1' : '0');
  }, [skipStep1]);

  // Handle "Load example data" trigger
  React.useEffect(() => {
    if (loadExample && !category && !tagsInfo) {
      setCategory('Welcome to PlaylistLabs!');
      setTagsInfo('Hi %name%, welcome to PlaylistLabs\nYour account expires on: %expiry%');
      setStream('http://link_video.mp4');
      setWhere({ channels: true, vods: false, series: false });
      setDisableAll(false);
    }
  }, [loadExample, category, tagsInfo]);

  // Parse lines into tags array
  const tagsList = React.useMemo(() => {
    const rawTags = typeof tagsInfo === 'string' ? tagsInfo : String(tagsInfo || '');
    if (!rawTags.trim()) return [];
    return rawTags
      .split('\n')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
  }, [tagsInfo]);

  // Validation
  const validation = React.useMemo(() => {
    if (disableAll) {
      return { isValid: true, errors: [] };
    }
    const errors = [];
    const categoryStr = typeof category === 'string' ? category : String(category || '');
    if (!categoryStr.trim()) {
      errors.push("Category name field can't be empty");
    }
    if (tagsList.length === 0) {
      errors.push("Tags field can't be empty");
    }
    if (tagsList.length > 10) {
      errors.push("Tags field can't store more than 10 lines");
    }
    if (!where.channels && !where.vods) {
      errors.push('Select where to show the welcome information (Channels or Movies)');
    }
    return {
      isValid: errors.length === 0,
      errors,
    };
  }, [disableAll, category, tagsList, where]);

  // Demo customer for step 3
  const demoCustomer = React.useMemo(() => {
    return {
      name: 'Demo user',
      expiry: new Date().toUTCString(),
      message: playlistMessage || 'Welcome to our premium service!',
      max_connections: 2,
      username: 'username1',
      password: '••••••••• (123456789)',
    };
  }, [playlistMessage]);

  const replacedPreviewItems = React.useMemo(() => {
    if (disableAll) return [];
    return tagsList.map((tag) => replaceTags(tag, {
      ...demoCustomer,
      password: '123456789',
    }));
  }, [disableAll, tagsList, demoCustomer]);

  // Save handler
  const handleSave = async () => {
    if (!validation.isValid) return;
    setSaving(true);
    try {
      let payload = {};
      if (!disableAll) {
        payload = {
          category: (typeof category === 'string' ? category : String(category || '')).trim(),
          tags: tagsList,
          stream: (typeof stream === 'string' ? stream : String(stream || '')).trim(),
          image: (typeof image === 'string' ? image : String(image || '')).trim(),
          where: {
            channels: where.channels,
            vods: where.vods,
            series: false,
          },
        };
      }

      await playlistApi.saveWelcomeInfo(currentPlaylist.id, payload);
      onComplete?.(payload);
      navigate(`/users/${currentPlaylist.id}`);
    } catch (err) {
      alert(err.message || 'Error saving welcome information');
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    if (onCancel) onCancel();
    else navigate(`/users/${currentPlaylist.id}`);
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 text-[#3970e1] animate-spin" />
        <span className="text-xs font-semibold text-[#8898aa]">Loading welcome info settings...</span>
      </div>
    );
  }

  const stepsList = [
    { id: 1, name: 'General Info', icon: Info, hidden: skipStep1Initial && currentStep !== 1 },
    { id: 2, name: 'Tags & Setup', icon: Settings },
    { id: 3, name: 'Live Preview', icon: Eye },
  ].filter((s) => !s.hidden);

  return (
    <div className="w-full max-w-[1920px] mx-auto px-4 sm:px-6 py-6 space-y-5">
      {/* Standardized Header Bar */}
      <PageHeader
        onBack={handleBack}
        backTitle="Back to Dashboard"
        icon={Sparkles}
        color="blue"
        title="Welcome Information"
        badge={
          <span className="text-xs font-semibold text-[#3970e1] dark:text-blue-400 bg-[#eef2ff] dark:bg-blue-950/60 border border-[#3970e1]/20 dark:border-blue-700/40 px-2 py-0.5 rounded-[0.375rem]">
            {currentPlaylist?.name || 'Playlist'}
          </span>
        }
        description="Configure banner channel and user greeting shown at the top of the playlist"
        actions={
          <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded-[0.375rem] p-1 shadow-2xs">
            {stepsList.map((st) => {
              const IconComponent = st.icon;
              const isActive = currentStep === st.id;
              const isPassed = currentStep > st.id;
              return (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => {
                    if (st.id < currentStep || validation.isValid) {
                      setCurrentStep(st.id);
                    }
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-[0.25rem] text-xs font-semibold transition ${isActive
                    ? 'bg-[#3970e1] text-white shadow-xs'
                    : isPassed
                      ? 'text-[#2dce89] dark:text-emerald-400 hover:bg-[#f6f9fc] dark:hover:bg-slate-700'
                      : 'text-[#8898aa] dark:text-slate-400 hover:bg-[#f6f9fc] dark:hover:bg-slate-700'
                    }`}
                >
                  {isPassed ? (
                    <Check className="w-3.5 h-3.5 text-[#2dce89] dark:text-emerald-400" />
                  ) : (
                    <IconComponent className="w-3.5 h-3.5" />
                  )}
                  <span>{st.name}</span>
                </button>
              );
            })}
          </div>
        }
      />

      {/* STEP 1: General Info */}
      {currentStep === 1 && (
        <div className="bg-white dark:bg-slate-900 border border-[#dee2e6] dark:border-slate-800 rounded-xl shadow-sm p-6 animate-in fade-in duration-200">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-6 space-y-5">
              <div className="flex items-center gap-2.5 text-[#3970e1] dark:text-blue-400">
                <Sparkles className="w-5 h-5 text-[#3970e1] dark:text-blue-400" />
                <h2 className="text-base font-bold text-[#32325d] dark:text-white">
                  Configure Welcome Information
                </h2>
              </div>

              <div className="p-4 rounded-lg bg-[#f8f9fe] dark:bg-slate-800/60 border border-[#e9ecef] dark:border-slate-800 space-y-2 text-xs leading-relaxed text-[#525f7f] dark:text-slate-300">
                <p>
                  In this menu it is possible to configure welcome information for managed users.
                </p>
                <p>
                  PlaylistLabs will automatically add a category banner at the top of the playlist containing expiration date, contact info, and custom account notes.
                </p>
                <p className="font-semibold text-[#32325d] dark:text-white">
                  All settings, tags, and stream destinations can be fully customized or disabled at any time.
                </p>
              </div>

              <div className="space-y-3 pt-2">
                {!category && (
                  <label className="flex items-center gap-2.5 text-xs text-[#32325d] dark:text-slate-200 font-semibold cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={loadExample}
                      onChange={(e) => setLoadExample(e.target.checked)}
                      className="w-4 h-4 rounded text-[#3970e1] border-[#dee2e6] dark:border-slate-700 dark:bg-slate-800 focus:ring-[#3970e1]"
                    />
                    <span>Load recommended example data</span>
                  </label>
                )}

                <label className="flex items-center gap-2.5 text-xs text-[#8898aa] dark:text-slate-400 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={skipStep1}
                    onChange={(e) => setSkipStep1(e.target.checked)}
                    className="w-4 h-4 rounded text-[#3970e1] border-[#dee2e6] dark:border-slate-700 dark:bg-slate-800 focus:ring-[#3970e1]"
                  />
                  <span>Don't show this intro step again (skip directly to setup)</span>
                </label>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="text-xs font-bold text-[#8898aa] dark:text-slate-400 uppercase tracking-wider mb-2">
                Simulated Player Preview
              </div>
              <PreviewGrid
                categoryName="Welcome to PlaylistLabs!"
                items={[
                  'Hi Demo User, welcome to PlaylistLabs',
                  `Your account expires on: ${new Date().toUTCString()}`,
                ]}
                isWelcomeDisabled={false}
              />
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: Tags & Configuration */}
      {currentStep === 2 && (
        <div className="bg-white dark:bg-slate-900 border border-[#dee2e6] dark:border-slate-800 rounded-xl shadow-sm p-6 animate-in fade-in duration-200">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Sidebar: Tags & Options */}
            <div className="lg:col-span-4 space-y-6 lg:border-r lg:border-[#e9ecef] dark:lg:border-slate-800 lg:pr-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#32325d] dark:text-white">
                    Available Dynamic Tags
                  </h3>
                  <span className="text-[13px] text-[#8898aa] dark:text-slate-400">Click to copy</span>
                </div>
                <div className="space-y-1.5">
                  <WelcomeTag tag="%name%" label="Account name" />
                  <WelcomeTag tag="%expiry%" label="Expiry date" />
                  <WelcomeTag tag="%message%" label="Playlist message" />
                  <WelcomeTag tag="%max_con%" label="Max connections" />
                  <WelcomeTag tag="%user%" label="Xtream username" />
                  <WelcomeTag tag="%pass%" label="Xtream password" />
                </div>
              </div>

              {/* Tag Example Box */}
              <div className="p-3 bg-[#f8f9fe] dark:bg-slate-800/60 border border-[#e9ecef] dark:border-slate-800 rounded-lg text-xs space-y-1.5">
                <span className="font-bold text-[#32325d] dark:text-slate-200 text-[12px] uppercase tracking-wider block">
                  Tag Substitution Example:
                </span>
                <p className="text-[#525f7f] dark:text-slate-300">
                  Hi <b className="text-[#3970e1] dark:text-blue-400 font-mono font-semibold">%name%</b>, welcome to PlaylistLabs
                </p>
                <p className="text-[#525f7f] dark:text-slate-300">
                  Your account expires on: <b className="text-[#3970e1] dark:text-blue-400 font-mono font-semibold">%expiry%</b>
                </p>
              </div>

              {/* Where to Show */}
              <div className="space-y-3 pt-1">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#32325d] dark:text-white">
                  Where to Show:
                </h3>
                <div className="space-y-2">
                  <label className="flex items-center gap-2.5 text-xs font-semibold text-[#32325d] dark:text-slate-200 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      disabled={disableAll}
                      checked={where.channels}
                      onChange={(e) => setWhere((prev) => ({ ...prev, channels: e.target.checked }))}
                      className="w-4 h-4 rounded text-[#3970e1] border-[#dee2e6] dark:border-slate-700 dark:bg-slate-800 focus:ring-[#3970e1] disabled:opacity-50"
                    />
                    <Tv className="w-3.5 h-3.5 text-[#3970e1] dark:text-blue-400" />
                    <span>Live Channels</span>
                  </label>

                  <label className="flex items-center gap-2.5 text-xs font-semibold text-[#32325d] dark:text-slate-200 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      disabled={disableAll}
                      checked={where.vods}
                      onChange={(e) => setWhere((prev) => ({ ...prev, vods: e.target.checked }))}
                      className="w-4 h-4 rounded text-[#3970e1] border-[#dee2e6] dark:border-slate-700 dark:bg-slate-800 focus:ring-[#3970e1] disabled:opacity-50"
                    />
                    <Film className="w-3.5 h-3.5 text-[#fb6340] dark:text-amber-400" />
                    <span>VOD Movies</span>
                  </label>
                </div>
              </div>

              {/* Disable Toggle */}
              <div className="pt-2 border-t border-[#e9ecef] dark:border-slate-800">
                <label className="flex items-center gap-2.5 text-xs font-bold text-[#f5365c] dark:text-rose-400 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={disableAll}
                    onChange={(e) => setDisableAll(e.target.checked)}
                    className="w-4 h-4 rounded text-[#f5365c] border-[#dee2e6] dark:border-slate-700 dark:bg-slate-800 focus:ring-[#f5365c]"
                  />
                  <span>Disable welcome information</span>
                </label>
                <p className="text-[13px] text-[#8898aa] dark:text-slate-400 mt-1 pl-6.5">
                  Check this to remove the welcome banner and channel from playlists.
                </p>
              </div>
            </div>

            {/* Right: Form Inputs */}
            <div className="lg:col-span-8 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#32325d] dark:text-white">
                Welcome Information Settings:
              </h3>

              {/* Category Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#525f7f] dark:text-slate-300">
                  Category Name <span className="text-[#f5365c]">*</span>
                </label>
                <input
                  type="text"
                  disabled={disableAll}
                  value={disableAll ? '' : category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="e.g. Welcome to PlaylistLabs!"
                  className="w-full px-3.5 py-2 text-xs border border-[#dee2e6] dark:border-slate-700 bg-white dark:bg-slate-800 text-[#32325d] dark:text-slate-100 rounded-md focus:border-[#3970e1] focus:ring-1 focus:ring-[#3970e1] outline-none transition disabled:bg-[#f6f9fc] dark:disabled:bg-slate-800/40 disabled:text-[#8898aa] dark:disabled:text-slate-500"
                />
              </div>

              {/* Tags Field */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-[#525f7f] dark:text-slate-300">
                    Tags Field (one line per item, max 10 lines) <span className="text-[#f5365c]">*</span>
                  </label>
                  <span className={`text-[13px] font-mono font-bold ${tagsList.length > 10 ? 'text-[#f5365c]' : 'text-[#8898aa] dark:text-slate-400'}`}>
                    {tagsList.length} / 10 lines
                  </span>
                </div>
                <textarea
                  rows={5}
                  disabled={disableAll}
                  value={disableAll ? '' : tagsInfo}
                  onChange={(e) => setTagsInfo(e.target.value)}
                  placeholder={"Hi %name%, welcome to PlaylistLabs\nYour account expires on: %expiry%\nContact support: t.me/example"}
                  className="w-full px-3.5 py-2 text-xs border border-[#dee2e6] dark:border-slate-700 bg-white dark:bg-slate-800 text-[#32325d] dark:text-slate-100 rounded-md focus:border-[#3970e1] focus:ring-1 focus:ring-[#3970e1] outline-none transition font-sans disabled:bg-[#f6f9fc] dark:disabled:bg-slate-800/40 disabled:text-[#8898aa] dark:disabled:text-slate-500"
                />
              </div>

              {/* Stream URL */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#525f7f] dark:text-slate-300">
                  Stream URL (video redirected when channel ID 0 is played)
                </label>
                <input
                  type="text"
                  disabled={disableAll}
                  value={disableAll ? '' : stream}
                  onChange={(e) => setStream(e.target.value)}
                  placeholder="http://example.com/welcome_video.mp4"
                  className="w-full px-3.5 py-2 text-xs border border-[#dee2e6] dark:border-slate-700 bg-white dark:bg-slate-800 text-[#32325d] dark:text-slate-100 rounded-md focus:border-[#3970e1] focus:ring-1 focus:ring-[#3970e1] outline-none transition disabled:bg-[#f6f9fc] dark:disabled:bg-slate-800/40 disabled:text-[#8898aa] dark:disabled:text-slate-500"
                />
              </div>

              {/* Logo URL */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#525f7f] dark:text-slate-300">
                  Logo URL (channel icon)
                </label>
                <input
                  type="text"
                  disabled={disableAll}
                  value={disableAll ? '' : image}
                  onChange={(e) => setImage(e.target.value)}
                  placeholder="http://example.com/logo.png"
                  className="w-full px-3.5 py-2 text-xs border border-[#dee2e6] dark:border-slate-700 bg-white dark:bg-slate-800 text-[#32325d] dark:text-slate-100 rounded-md focus:border-[#3970e1] focus:ring-1 focus:ring-[#3970e1] outline-none transition disabled:bg-[#f6f9fc] dark:disabled:bg-slate-800/40 disabled:text-[#8898aa] dark:disabled:text-slate-500"
                />
              </div>

              {/* Error messages */}
              {!disableAll && validation.errors.length > 0 && (
                <div className="p-3 bg-[#feecee] dark:bg-rose-950/40 border border-[#f5365c]/30 dark:border-rose-800/50 rounded-lg space-y-1">
                  {validation.errors.map((err, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-xs text-[#f5365c] dark:text-rose-400 font-semibold">
                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>{err}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: Live Preview & Result */}
      {currentStep === 3 && (
        <div className="bg-white dark:bg-slate-900 border border-[#dee2e6] dark:border-slate-800 rounded-xl shadow-sm p-6 animate-in fade-in duration-200">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Column: Demo User */}
            <div className="lg:col-span-4 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-[#e9ecef] dark:border-slate-800">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#32325d] dark:text-white">
                  Demo User Details:
                </h3>
                <span className="text-[13px] text-[#8898aa] dark:text-slate-400">Simulated client</span>
              </div>

              <div className="space-y-3 p-4 bg-[#f8f9fe] dark:bg-slate-800/60 border border-[#e9ecef] dark:border-slate-800 rounded-lg text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[#8898aa] dark:text-slate-400">Name:</span>
                  <span className="font-bold text-[#32325d] dark:text-white">{demoCustomer.name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#8898aa] dark:text-slate-400">Expiry:</span>
                  <span className="font-mono text-[13px] font-semibold text-[#32325d] dark:text-slate-200">{demoCustomer.expiry}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#8898aa] dark:text-slate-400">Message:</span>
                  <span className="font-semibold text-[#32325d] dark:text-slate-200 truncate max-w-[180px]">{demoCustomer.message}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#8898aa] dark:text-slate-400">Max Connections:</span>
                  <span className="font-bold text-[#32325d] dark:text-white">{demoCustomer.max_connections}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#8898aa] dark:text-slate-400">Username:</span>
                  <span className="font-mono font-bold text-[#3970e1] dark:text-blue-400">{demoCustomer.username}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#8898aa] dark:text-slate-400">Password:</span>
                  <span className="font-mono text-[#525f7f] dark:text-slate-300">{demoCustomer.password}</span>
                </div>
              </div>

              {/* Status summary */}
              <div className="p-3 bg-white dark:bg-slate-800/60 border border-[#e9ecef] dark:border-slate-800 rounded-lg space-y-1 text-xs">
                <span className="text-[#8898aa] dark:text-slate-400 text-[12px] uppercase font-bold block">Status:</span>
                {disableAll ? (
                  <span className="text-[#f5365c] dark:text-rose-400 font-bold">Welcome Information is Disabled</span>
                ) : (
                  <div className="space-y-1 text-[#32325d] dark:text-slate-200">
                    <div>Showing on: <strong className="text-[#3970e1] dark:text-blue-400">{where.channels ? 'Live Channels' : ''}{where.channels && where.vods ? ' & ' : ''}{where.vods ? 'VOD Movies' : ''}</strong></div>
                    <div>Banner Items: <strong className="dark:text-white">{replacedPreviewItems.length} streams</strong></div>
                    {stream && <div className="truncate text-[#8898aa] dark:text-slate-400 text-[13px]">Stream: {stream}</div>}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Live Result Grid */}
            <div className="lg:col-span-8 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#32325d] dark:text-white">
                  Resulting Playlist Display:
                </h3>
                {disableAll && (
                  <span className="text-xs font-bold text-[#f5365c] dark:text-rose-400 bg-[#feecee] dark:bg-rose-950/50 border border-[#f5365c]/30 dark:border-rose-800/50 px-2 py-0.5 rounded">
                    (Welcome info disabled)
                  </span>
                )}
              </div>
              <PreviewGrid
                categoryName={category}
                items={replacedPreviewItems}
                isWelcomeDisabled={disableAll}
                logoUrl={image}
              />
            </div>
          </div>
        </div>
      )}

      {/* Footer Navigation Bar */}
      <div className="flex items-center justify-between pt-2">
        <div>
          {currentStep > 1 ? (
            <button
              type="button"
              onClick={() => setCurrentStep(currentStep - 1)}
              className="flex items-center gap-1.5 px-4 py-2 bg-white dark:bg-slate-800 hover:bg-[#f6f9fc] dark:hover:bg-slate-700 border border-[#dee2e6] dark:border-slate-700 rounded-md text-xs font-semibold text-[#525f7f] dark:text-slate-300 transition shadow-xs active:scale-[0.98]"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Previous</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleBack}
              className="px-4 py-2 bg-white dark:bg-slate-800 hover:bg-[#f6f9fc] dark:hover:bg-slate-700 border border-[#dee2e6] dark:border-slate-700 rounded-md text-xs font-semibold text-[#8898aa] dark:text-slate-400 transition"
            >
              Cancel
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {currentStep < 3 ? (
            <button
              type="button"
              disabled={currentStep === 2 && !validation.isValid}
              onClick={() => setCurrentStep(currentStep + 1)}
              className="flex items-center gap-1.5 px-5 py-2 bg-[#3970e1] hover:bg-[#2c5ec2] text-white rounded-md text-xs font-semibold transition shadow-xs disabled:opacity-50 active:scale-[0.98]"
            >
              <span>Next</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              disabled={saving || !validation.isValid}
              onClick={handleSave}
              className="flex items-center gap-1.5 px-6 py-2 bg-[#2dce89] hover:bg-[#26af74] text-white rounded-md text-xs font-bold transition shadow-xs disabled:opacity-50 active:scale-[0.98]"
            >
              {saving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Save Welcome Info</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
