import React from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Palette,
  Save,
  Check,
  Copy,
  Image,
  Trash2,
  ExternalLink,
  Loader2,
  AlertCircle,
  Key,
  Tv,
  Layers,
  Sparkles,
  Info,
  ChevronDown,
  RefreshCw,
  Eye,
  Sliders,
  CheckCircle2,
  FileCode,
  Calendar,
  Clock,
  MonitorPlay,
  Film,
  Clapperboard,
  LogOut,
  Search,
} from 'lucide-react';
import { playlistApi, settingsApi } from '../api/client';
import { PageHeader } from '../components/ui';
import {
  PORTAL_COLOR_PRESETS,
  PORTAL_THEME_OPTIONS,
  PORTAL_THEMES,
  PORTAL_DYNAMIC_TAGS,
} from './settings/constants/portalConstants';

export default function PlaylistPortalBranding({
  currentPlaylist,
  playlists: propPlaylists = [],
  defaultTab = 'playlist',
  onBrandingUpdated,
  isEmbedded = false,
}) {
  const { listId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Tab State: 'login' (Tab 1: Public Login) | 'playlist' (Tab 2: User Dashboard per Playlist)
  const portalTabParam = searchParams.get('portal_tab');
  const [activeTab, setActiveTab] = React.useState(() => {
    if (portalTabParam === 'login' || portalTabParam === 'playlist') return portalTabParam;
    return defaultTab;
  });

  React.useEffect(() => {
    const pt = searchParams.get('portal_tab');
    if (pt === 'login' || pt === 'playlist') {
      setActiveTab(pt);
    } else if (defaultTab) {
      setActiveTab(defaultTab);
    }
  }, [searchParams, defaultTab]);

  const handleSelectTab = (tab) => {
    setActiveTab(tab);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('portal_tab', tab);
      return next;
    }, { replace: true });
  };

  // Playlists State
  const [playlists, setPlaylists] = React.useState(propPlaylists);
  const [selectedListId, setSelectedListId] = React.useState(() => {
    if (listId) return String(listId);
    if (currentPlaylist?.id) return String(currentPlaylist.id);
    if (propPlaylists.length > 0) return String(propPlaylists[0].id);
    return '';
  });

  // Global Settings State (Tab 1)
  const [globalSettings, setGlobalSettings] = React.useState({
    user_dashboard_enabled: true,
    user_dashboard_title: 'User Portal',
    user_dashboard_allow_hide_categories: true,
    user_dashboard_html: '',
    user_dashboard_logo: '',
    user_dashboard_primary_color: '#3b82f6',
    user_dashboard_secondary_color: '#6366f1',
    user_dashboard_accent_color: '#10b981',
    user_dashboard_background_theme: 'slate',
  });

  // Playlist Branding State (Tab 2)
  const [branding, setBranding] = React.useState({
    enabled: false,
    title: '',
    logo: '',
    html: '',
    primary_color: '#3b82f6',
    secondary_color: '#6366f1',
    accent_color: '#10b981',
    background_theme: 'slate',
  });

  // UI / Action states
  const [loading, setLoading] = React.useState(true);
  const [loadingPlaylistBranding, setLoadingPlaylistBranding] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [notification, setNotification] = React.useState(null);
  const [copiedTag, setCopiedTag] = React.useState('');
  const [showCopyDropdown, setShowCopyDropdown] = React.useState(false);
  const [globalPreviewMode, setGlobalPreviewMode] = React.useState('dashboard');

  const globalLogoInputRef = React.useRef(null);
  const playlistLogoInputRef = React.useRef(null);
  const playlistHtmlTextareaRef = React.useRef(null);
  const globalHtmlTextareaRef = React.useRef(null);

  const notify = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3500);
  };

  // Load Initial Data (Global Settings & Playlists)
  React.useEffect(() => {
    let isMounted = true;
    setLoading(true);

    const promises = [
      settingsApi.getSettings().catch(() => null),
    ];

    if (!propPlaylists || propPlaylists.length === 0) {
      promises.push(playlistApi.getPlaylists().catch(() => []));
    }

    Promise.all(promises)
      .then(([settingsRes, loadedPlaylists]) => {
        if (!isMounted) return;

        if (settingsRes?.settings) {
          const s = settingsRes.settings;
          setGlobalSettings({
            user_dashboard_enabled: s.user_dashboard_enabled !== undefined ? Boolean(s.user_dashboard_enabled) : true,
            user_dashboard_title: s.user_dashboard_title || 'User Portal',
            user_dashboard_allow_hide_categories: s.user_dashboard_allow_hide_categories !== undefined ? Boolean(s.user_dashboard_allow_hide_categories) : true,
            user_dashboard_html: s.user_dashboard_html || '',
            user_dashboard_logo: s.user_dashboard_logo || '',
            user_dashboard_primary_color: s.user_dashboard_primary_color || '#3b82f6',
            user_dashboard_secondary_color: s.user_dashboard_secondary_color || '#6366f1',
            user_dashboard_accent_color: s.user_dashboard_accent_color || '#10b981',
            user_dashboard_background_theme: s.user_dashboard_background_theme || 'slate',
          });
        }

        if (loadedPlaylists && Array.isArray(loadedPlaylists)) {
          setPlaylists(loadedPlaylists);
          if (!selectedListId && loadedPlaylists.length > 0) {
            setSelectedListId(String(loadedPlaylists[0].id));
          }
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Update selected playlist when props or params change
  React.useEffect(() => {
    if (listId) {
      setSelectedListId(String(listId));
    } else if (currentPlaylist?.id) {
      setSelectedListId(String(currentPlaylist.id));
    }
  }, [listId, currentPlaylist?.id]);

  // Load Playlist Branding when selectedListId changes
  React.useEffect(() => {
    if (!selectedListId) return;
    let isMounted = true;
    setLoadingPlaylistBranding(true);

    playlistApi.getPortalBranding(selectedListId)
      .then((res) => {
        if (!isMounted) return;
        const pb = res?.portal_branding;
        if (pb && typeof pb === 'object') {
          setBranding({
            enabled: Boolean(pb.enabled),
            title: pb.title || '',
            logo: pb.logo || '',
            html: pb.html || '',
            primary_color: pb.primary_color || globalSettings.user_dashboard_primary_color || '#3b82f6',
            secondary_color: pb.secondary_color || globalSettings.user_dashboard_secondary_color || '#6366f1',
            accent_color: pb.accent_color || globalSettings.user_dashboard_accent_color || '#10b981',
            background_theme: pb.background_theme || globalSettings.user_dashboard_background_theme || 'slate',
          });
        } else {
          setBranding({
            enabled: false,
            title: '',
            logo: '',
            html: '',
            primary_color: globalSettings.user_dashboard_primary_color || '#3b82f6',
            secondary_color: globalSettings.user_dashboard_secondary_color || '#6366f1',
            accent_color: globalSettings.user_dashboard_accent_color || '#10b981',
            background_theme: globalSettings.user_dashboard_background_theme || 'slate',
          });
        }
      })
      .catch(() => {
        if (isMounted) {
          setBranding((prev) => ({ ...prev, enabled: false }));
        }
      })
      .finally(() => {
        if (isMounted) setLoadingPlaylistBranding(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedListId, globalSettings.user_dashboard_primary_color]);

  const activePlaylistObj = React.useMemo(() => {
    return playlists.find((p) => String(p.id) === String(selectedListId)) || currentPlaylist || null;
  }, [playlists, selectedListId, currentPlaylist]);

  // -------------------------------------------------------------
  // SAVE HANDLERS
  // -------------------------------------------------------------
  const handleSaveGlobal = async (e) => {
    e?.preventDefault();
    setSaving(true);
    try {
      await settingsApi.updateSettings({
        user_dashboard_enabled: globalSettings.user_dashboard_enabled,
        user_dashboard_title: globalSettings.user_dashboard_title,
        user_dashboard_allow_hide_categories: globalSettings.user_dashboard_allow_hide_categories,
        user_dashboard_html: globalSettings.user_dashboard_html,
        user_dashboard_logo: globalSettings.user_dashboard_logo,
        user_dashboard_primary_color: globalSettings.user_dashboard_primary_color,
        user_dashboard_secondary_color: globalSettings.user_dashboard_secondary_color,
        user_dashboard_accent_color: globalSettings.user_dashboard_accent_color,
        user_dashboard_background_theme: globalSettings.user_dashboard_background_theme,
      });

      try {
        window.dispatchEvent(new CustomEvent('settings-updated'));
      } catch { }

      notify('Global portal & login settings saved successfully!');
    } catch (err) {
      notify(err.message || 'Failed to save global settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSavePlaylistBranding = async (e) => {
    e?.preventDefault();
    if (!selectedListId) return;
    setSaving(true);
    try {
      await playlistApi.savePortalBranding(selectedListId, branding);
      notify(`Branding for "${activePlaylistObj?.name || `ID ${selectedListId}`}" saved successfully!`);
      if (onBrandingUpdated) {
        onBrandingUpdated();
      }
    } catch (err) {
      notify(err.message || 'Failed to save playlist branding', 'error');
    } finally {
      setSaving(false);
    }
  };

  // -------------------------------------------------------------
  // COPY CONFIGURATION
  // -------------------------------------------------------------
  const handleCopyFromGlobal = () => {
    setBranding((prev) => ({
      ...prev,
      enabled: true,
      title: globalSettings.user_dashboard_title || '',
      logo: globalSettings.user_dashboard_logo || '',
      html: globalSettings.user_dashboard_html || '',
      primary_color: globalSettings.user_dashboard_primary_color || '#3b82f6',
      secondary_color: globalSettings.user_dashboard_secondary_color || '#6366f1',
      accent_color: globalSettings.user_dashboard_accent_color || '#10b981',
      background_theme: globalSettings.user_dashboard_background_theme || 'slate',
    }));
    setShowCopyDropdown(false);
    notify('Copied from Global Login Style!');
  };

  const handleCopyFromPlaylist = async (sourcePlaylist) => {
    setShowCopyDropdown(false);
    try {
      const res = await playlistApi.getPortalBranding(sourcePlaylist.id);
      const pb = res?.portal_branding;
      if (pb) {
        setBranding({
          enabled: true,
          title: pb.title || sourcePlaylist.name || '',
          logo: pb.logo || '',
          html: pb.html || '',
          primary_color: pb.primary_color || '#3b82f6',
          secondary_color: pb.secondary_color || '#6366f1',
          accent_color: pb.accent_color || '#10b981',
          background_theme: pb.background_theme || 'slate',
        });
        notify(`Copied branding from "${sourcePlaylist.name}"!`);
      } else {
        notify(`Playlist "${sourcePlaylist.name}" has no custom branding.`, 'error');
      }
    } catch (err) {
      notify(`Failed to copy: ${err.message}`, 'error');
    }
  };

  // -------------------------------------------------------------
  // LOGO UPLOAD & REMOVE
  // -------------------------------------------------------------
  const handleLogoUpload = (e, isGlobal = false) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      notify('Logo image must be less than 2MB', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (isGlobal) {
        setGlobalSettings((prev) => ({ ...prev, user_dashboard_logo: reader.result }));
      } else {
        setBranding((prev) => ({ ...prev, logo: reader.result }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = (isGlobal = false) => {
    if (isGlobal) {
      setGlobalSettings((prev) => ({ ...prev, user_dashboard_logo: '' }));
      if (globalLogoInputRef.current) globalLogoInputRef.current.value = '';
    } else {
      setBranding((prev) => ({ ...prev, logo: '' }));
      if (playlistLogoInputRef.current) playlistLogoInputRef.current.value = '';
    }
  };

  // -------------------------------------------------------------
  // DYNAMIC TAG INSERTION
  // -------------------------------------------------------------
  const handleInsertTag = (tag, isGlobal = false) => {
    navigator.clipboard?.writeText(tag);
    setCopiedTag(tag);
    setTimeout(() => setCopiedTag(''), 2000);

    const textarea = isGlobal ? globalHtmlTextareaRef.current : playlistHtmlTextareaRef.current;
    if (!textarea) {
      if (isGlobal) {
        setGlobalSettings((prev) => ({ ...prev, user_dashboard_html: (prev.user_dashboard_html || '') + tag }));
      } else {
        setBranding((prev) => ({ ...prev, html: (prev.html || '') + tag }));
      }
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const oldVal = isGlobal ? (globalSettings.user_dashboard_html || '') : (branding.html || '');
    const newVal = oldVal.substring(0, start) + tag + oldVal.substring(end);

    if (isGlobal) {
      setGlobalSettings((prev) => ({ ...prev, user_dashboard_html: newVal }));
    } else {
      setBranding((prev) => ({ ...prev, html: newVal }));
    }

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + tag.length, start + tag.length);
    }, 50);
  };

  // -------------------------------------------------------------
  // PREVIEW DATA & INTERPOLATIONS
  // -------------------------------------------------------------
  const previewData = React.useMemo(() => {
    if (activeTab === 'login') {
      const themeKey = globalSettings.user_dashboard_background_theme || 'slate';
      return {
        theme: PORTAL_THEMES[themeKey] || PORTAL_THEMES.slate,
        title: globalSettings.user_dashboard_title || 'User Portal',
        logo: globalSettings.user_dashboard_logo || '',
        primary_color: globalSettings.user_dashboard_primary_color || '#3b82f6',
        secondary_color: globalSettings.user_dashboard_secondary_color || '#6366f1',
        accent_color: globalSettings.user_dashboard_accent_color || '#10b981',
        html: globalSettings.user_dashboard_html || '',
      };
    }

    if (!branding.enabled) {
      const themeKey = globalSettings.user_dashboard_background_theme || 'slate';
      return {
        theme: PORTAL_THEMES[themeKey] || PORTAL_THEMES.slate,
        title: globalSettings.user_dashboard_title || activePlaylistObj?.name || 'User Portal',
        logo: globalSettings.user_dashboard_logo || '',
        primary_color: globalSettings.user_dashboard_primary_color || '#3b82f6',
        secondary_color: globalSettings.user_dashboard_secondary_color || '#6366f1',
        accent_color: globalSettings.user_dashboard_accent_color || '#10b981',
        html: globalSettings.user_dashboard_html || '',
        isInherited: true,
      };
    }

    const themeKey = branding.background_theme || 'slate';
    return {
      theme: PORTAL_THEMES[themeKey] || PORTAL_THEMES.slate,
      title: branding.title || activePlaylistObj?.name || 'Client Portal',
      logo: branding.logo || '',
      primary_color: branding.primary_color || '#3b82f6',
      secondary_color: branding.secondary_color || '#6366f1',
      accent_color: branding.accent_color || '#10b981',
      html: branding.html || '',
      isInherited: false,
    };
  }, [activeTab, globalSettings, branding, activePlaylistObj]);

  const interpolatedPreviewHtml = React.useMemo(() => {
    const raw = activeTab === 'login' ? globalSettings.user_dashboard_html : (previewData.html || '');
    if (!raw) return '';
    let text = raw;
    const demo = {
      '%user%': 'vip_subscriber',
      '%pass%': '••••••••',
      '%name%': 'John Smith',
      '%expiry%': 'Dec 31, 2026',
      '%max_con%': '2',
      '%message%': 'Premium Ultra FHD package active.',
      '%m3u_url%': 'http://example.com/get.php?username=vip_subscriber&password=...',
      '%epg_url%': 'http://example.com/xmltv.php?username=vip_subscriber&password=...',
      '%status%': 'Active',
    };
    Object.entries(demo).forEach(([t, v]) => {
      text = text.replaceAll(t, v);
    });
    return text;
  }, [activeTab, globalSettings.user_dashboard_html, previewData.html]);

  if (loading && !isEmbedded) {
    return (
      <div className="w-full max-w-[1920px] mx-auto px-4 sm:px-6 py-12 flex flex-col items-center justify-center min-h-[400px] text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin text-[#3970e1] mb-3" />
        <span className="text-sm font-semibold">Loading Portal Studio & Branding Hub...</span>
      </div>
    );
  }

  const content = (
    <div className="space-y-5">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-[0.375rem] shadow-argon-dropdown flex items-center gap-2 text-xs font-semibold animate-in slide-in-from-bottom-5 duration-200 border pointer-events-auto ${notification.type === 'error'
            ? 'bg-[#f5365c] text-white border-[#f5365c]'
            : 'bg-[#2dce89] text-white border-[#2dce89]'
            }`}
        >
          {notification.type === 'error' ? (
            <AlertCircle className="w-4 h-4 text-white shrink-0" />
          ) : (
            <Check className="w-4 h-4 text-white shrink-0" />
          )}
          <span>{notification.msg}</span>
        </div>
      )}

      {/* Clean Page Header Bar - only shown in standalone view */}
      {!isEmbedded && (
        <PageHeader
          onBack={listId ? () => navigate(`/users/${listId}`) : undefined}
          backTitle="Back to Users"
          icon={Palette}
          color="blue"
          title="Portal Studio & Branding"
          description="Design the shared login screen and default user dashboard style, or customize post-login branding per playlist."
          actions={
            <div className="flex items-center gap-2">
              <a
                href="/portal"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-[#f6f9fc] dark:hover:bg-slate-700 text-[#525f7f] dark:text-slate-300 border border-[#dee2e6] dark:border-slate-700 rounded-[0.375rem] text-xs font-semibold shadow-argon-sm transition"
              >
                <span>Open /portal</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>

              {activeTab === 'login' ? (
                <button
                  type="button"
                  onClick={handleSaveGlobal}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-1.5 bg-[#2dce89] hover:bg-[#26af74] text-white rounded-[0.375rem] text-xs font-semibold shadow-argon-btn transition active:scale-[0.98] disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  <span>Save Global Style</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSavePlaylistBranding}
                  disabled={saving || !selectedListId}
                  className="flex items-center gap-2 px-4 py-1.5 bg-[#2dce89] hover:bg-[#26af74] text-white rounded-[0.375rem] text-xs font-semibold shadow-argon-btn transition active:scale-[0.98] disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  <span>Save Playlist Branding</span>
                </button>
              )}
            </div>
          }
        />
      )}

      {/* If embedded in Settings, show an integrated tab header bar with action buttons */}
      {isEmbedded && (
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#e9ecef] dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-[0.375rem] bg-[#3970e1]/10 dark:bg-blue-950/60 border border-[#3970e1]/20 dark:border-blue-700/40 flex items-center justify-center text-[#3970e1] dark:text-blue-400">
              <Palette className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-[#32325d] dark:text-white">Portal Studio & Branding</h2>
                <span className="text-[12px] px-2 py-0.5 rounded-[0.25rem] font-mono bg-[#eef2ff] dark:bg-blue-950/60 text-[#3970e1] dark:text-blue-400 border border-[#3970e1]/20 dark:border-blue-700/40 font-semibold">
                  /portal
                </span>
              </div>
              <p className="text-[13px] text-[#8898aa] dark:text-slate-400">
                Design the shared login screen and default user dashboard style, or customize post-login branding per playlist.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="/portal"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-[#f6f9fc] dark:hover:bg-slate-700 text-[#525f7f] dark:text-slate-300 border border-[#dee2e6] dark:border-slate-700 rounded-[0.375rem] text-xs font-semibold shadow-argon-sm transition"
            >
              <span>Open /portal</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>

            {activeTab === 'login' ? (
              <button
                type="button"
                onClick={handleSaveGlobal}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-1.5 bg-[#2dce89] hover:bg-[#26af74] text-white rounded-[0.375rem] text-xs font-semibold shadow-argon-btn transition active:scale-[0.98] disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                <span>Save Global Style</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSavePlaylistBranding}
                disabled={saving || !selectedListId}
                className="flex items-center gap-2 px-4 py-1.5 bg-[#2dce89] hover:bg-[#26af74] text-white rounded-[0.375rem] text-xs font-semibold shadow-argon-btn transition active:scale-[0.98] disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                <span>Save Playlist Branding</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Top Segmented Navigation Tabs */}
      <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-[#dee2e6] dark:border-slate-800 p-1 rounded-xl w-fit shadow-xs">
        <button
          type="button"
          onClick={() => handleSelectTab('login')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${activeTab === 'login'
            ? 'bg-[#3970e1] text-white shadow-sm font-bold'
            : 'text-[#525f7f] dark:text-slate-400 hover:text-[#32325d] dark:hover:text-white'
            }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>Global Style & Login</span>
          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${activeTab === 'login' ? 'bg-white/20 text-white' : 'bg-gray-100 dark:bg-slate-800 text-gray-500'
            }`}>
            Default Style
          </span>
        </button>

        <button
          type="button"
          onClick={() => handleSelectTab('playlist')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${activeTab === 'playlist'
            ? 'bg-[#3970e1] text-white shadow-sm font-bold'
            : 'text-[#525f7f] dark:text-slate-400 hover:text-[#32325d] dark:hover:text-white'
            }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>User Dashboard by Playlist</span>
          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${activeTab === 'playlist' ? 'bg-white/20 text-white' : 'bg-gray-100 dark:bg-slate-800 text-gray-500'
            }`}>
            Playlist Override
          </span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 2-COLUMN SPLIT VIEW: CONTROLS ON LEFT, REAL-TIME STICKY PREVIEW ON RIGHT */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

        {/* LEFT COLUMN: CUSTOMIZATION CONTROLS (col-span-5) */}
        <div className="lg:col-span-5 space-y-4">

          {/* TAB 1 CONTROLS */}
          {activeTab === 'login' && (
            <div className="space-y-4">
              {/* Card 1: Portal Access & General Permissions */}
              <div className="bg-white dark:bg-slate-900 border border-[#dee2e6] dark:border-slate-800 rounded-xl p-4 space-y-3.5 shadow-argon">
                <div className="pb-2 border-b border-gray-100 dark:border-slate-800">
                  <span className="text-xs font-bold text-[#32325d] dark:text-white uppercase tracking-wider">
                    General Access
                  </span>
                </div>

                <div className="space-y-2.5">
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#f8f9fe] dark:bg-slate-800/60 border border-[#dee2e6] dark:border-slate-700">
                    <div>
                      <span className="text-xs font-bold text-[#32325d] dark:text-white block">Enable /portal Access</span>
                      <span className="text-[11px] text-[#8898aa] block">Allow subscribers to open web dashboard</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={globalSettings.user_dashboard_enabled}
                        onChange={(e) => setGlobalSettings({ ...globalSettings, user_dashboard_enabled: e.target.checked })}
                      />
                      <div className="w-10 h-5 bg-[#dee2e6] dark:bg-slate-700 rounded-full peer peer-checked:after:translate-x-5 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#2dce89]"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#f8f9fe] dark:bg-slate-800/60 border border-[#dee2e6] dark:border-slate-700">
                    <div>
                      <span className="text-xs font-bold text-[#32325d] dark:text-white block">Allow Hiding Categories</span>
                      <span className="text-[11px] text-[#8898aa] block">Users can toggle on/off categories</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={globalSettings.user_dashboard_allow_hide_categories}
                        onChange={(e) => setGlobalSettings({ ...globalSettings, user_dashboard_allow_hide_categories: e.target.checked })}
                      />
                      <div className="w-10 h-5 bg-[#dee2e6] dark:bg-slate-700 rounded-full peer peer-checked:after:translate-x-5 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#2dce89]"></div>
                    </label>
                  </div>
                </div>
              </div>

              {/* Card 2: Global Identity & Logo */}
              <div className="bg-white dark:bg-slate-900 border border-[#dee2e6] dark:border-slate-800 rounded-xl p-4 space-y-3.5 shadow-argon">
                <div className="pb-2 border-b border-gray-100 dark:border-slate-800">
                  <span className="text-xs font-bold text-[#32325d] dark:text-white uppercase tracking-wider">
                    Global Brand Identity
                  </span>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#32325d] dark:text-white block">
                    Global Portal & Dashboard Title
                  </label>
                  <input
                    type="text"
                    value={globalSettings.user_dashboard_title}
                    onChange={(e) => setGlobalSettings({ ...globalSettings, user_dashboard_title: e.target.value })}
                    placeholder="e.g. User Portal"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded-[0.375rem] text-xs text-[#495057] dark:text-slate-200 focus:outline-none focus:border-[#3970e1]"
                  />
                  <span className="text-[11px] text-[#8898aa] block">
                    Displayed on the public login page and as the default title for user dashboards.
                  </span>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#32325d] dark:text-white block">
                    Global Brand Logo
                  </label>

                  <input
                    type="file"
                    ref={globalLogoInputRef}
                    onChange={(e) => handleLogoUpload(e, true)}
                    accept="image/png,image/jpeg,image/svg+xml,image/webp,image/gif"
                    className="hidden"
                  />

                  {globalSettings.user_dashboard_logo ? (
                    <div className="p-2.5 bg-[#f8f9fe] dark:bg-slate-800/60 border border-[#dee2e6] dark:border-slate-700 rounded-lg flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-12 h-10 rounded bg-slate-950/40 border border-slate-700/50 flex items-center justify-center overflow-hidden p-1 shrink-0">
                          <img
                            src={globalSettings.user_dashboard_logo}
                            alt="Logo"
                            className="max-h-full max-w-full object-contain"
                          />
                        </div>
                        <span className="text-xs font-semibold text-[#32325d] dark:text-white truncate">Logo Active</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => globalLogoInputRef.current?.click()}
                          className="px-2 py-1 bg-white dark:bg-slate-800 hover:bg-gray-50 text-[#3970e1] border border-[#dee2e6] dark:border-slate-700 rounded text-xs font-semibold"
                        >
                          Change
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveLogo(true)}
                          className="p-1 text-rose-600 hover:bg-rose-50 rounded"
                          title="Remove Logo"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => globalLogoInputRef.current?.click()}
                      className="w-full p-3 border border-dashed border-[#dee2e6] dark:border-slate-700 hover:border-[#3970e1] rounded-lg bg-[#f8f9fe]/50 dark:bg-slate-800/30 text-center transition flex items-center justify-center gap-2 text-xs font-semibold text-[#525f7f] dark:text-slate-300"
                    >
                      <Image className="w-4 h-4 text-[#8898aa]" />
                      <span>Upload Public Logo</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Card 3: Theme Atmosphere & Color Palette */}
              <div className="bg-white dark:bg-slate-900 border border-[#dee2e6] dark:border-slate-800 rounded-xl p-4 space-y-3.5 shadow-argon">
                <span className="text-xs font-bold text-[#32325d] dark:text-white uppercase tracking-wider block pb-2 border-b border-gray-100 dark:border-slate-800">
                  Theme & Colors
                </span>

                {/* Theme Selector */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#32325d] dark:text-white block">Background Atmosphere</label>
                  <div className="grid grid-cols-5 gap-1.5">
                    {PORTAL_THEME_OPTIONS.map((thm) => {
                      const isSelected = (globalSettings.user_dashboard_background_theme || 'slate') === thm.id;
                      return (
                        <button
                          key={thm.id}
                          type="button"
                          onClick={() => setGlobalSettings({ ...globalSettings, user_dashboard_background_theme: thm.id })}
                          title={thm.name}
                          className={`p-1.5 rounded-lg border text-center transition flex flex-col items-center gap-1 ${isSelected
                            ? 'border-[#3970e1] bg-blue-50/50 dark:bg-blue-950/40 ring-1 ring-[#3970e1]'
                            : 'border-[#dee2e6] dark:border-slate-700 hover:border-slate-400 bg-white dark:bg-slate-800'
                            }`}
                        >
                          <div
                            className="w-6 h-6 rounded border shadow-inner overflow-hidden p-0.5"
                            style={{ backgroundColor: thm.swatchBg, borderColor: thm.swatchBorder }}
                          >
                            <div className="w-full h-full rounded-[2px]" style={{ backgroundColor: thm.swatchCard }} />
                          </div>
                          <span className="text-[10px] font-semibold text-[#32325d] dark:text-slate-200 truncate max-w-full">
                            {thm.name.split(' ')[0]}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Color Presets */}
                <div className="space-y-1.5 pt-2 border-t border-gray-100 dark:border-slate-800">
                  <label className="text-xs font-semibold text-[#32325d] dark:text-white block">Color Palette</label>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {PORTAL_COLOR_PRESETS.map((preset) => {
                      const isSelected =
                        globalSettings.user_dashboard_primary_color === preset.primary &&
                        globalSettings.user_dashboard_secondary_color === preset.secondary;
                      return (
                        <button
                          key={preset.name}
                          type="button"
                          onClick={() =>
                            setGlobalSettings((prev) => ({
                              ...prev,
                              user_dashboard_primary_color: preset.primary,
                              user_dashboard_secondary_color: preset.secondary,
                              user_dashboard_accent_color: preset.accent,
                            }))
                          }
                          title={preset.name}
                          className={`flex items-center gap-1 px-2 py-1 rounded border text-[11px] font-medium transition ${isSelected
                            ? 'border-[#3970e1] bg-blue-50 dark:bg-blue-950/40 text-[#3970e1] font-bold ring-1 ring-[#3970e1]'
                            : 'border-[#dee2e6] dark:border-slate-700 bg-white dark:bg-slate-800 text-[#525f7f] dark:text-slate-300 hover:border-slate-400'
                            }`}
                        >
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: preset.primary }} />
                          <span className="truncate">{preset.name}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Inline Hex Pickers */}
                  <div className="grid grid-cols-3 gap-2 pt-2">
                    <div className="space-y-1">
                      <span className="text-[10px] font-semibold text-[#8898aa] block">Primary</span>
                      <div className="flex items-center gap-1 p-1 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded">
                        <input
                          type="color"
                          value={globalSettings.user_dashboard_primary_color || '#3b82f6'}
                          onChange={(e) => setGlobalSettings({ ...globalSettings, user_dashboard_primary_color: e.target.value })}
                          className="w-5 h-5 rounded cursor-pointer border-0 p-0 bg-transparent"
                        />
                        <input
                          type="text"
                          value={globalSettings.user_dashboard_primary_color || '#3b82f6'}
                          onChange={(e) => setGlobalSettings({ ...globalSettings, user_dashboard_primary_color: e.target.value })}
                          className="w-full text-[10px] font-mono text-[#32325d] dark:text-white bg-transparent focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] font-semibold text-[#8898aa] block">Secondary</span>
                      <div className="flex items-center gap-1 p-1 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded">
                        <input
                          type="color"
                          value={globalSettings.user_dashboard_secondary_color || '#6366f1'}
                          onChange={(e) => setGlobalSettings({ ...globalSettings, user_dashboard_secondary_color: e.target.value })}
                          className="w-5 h-5 rounded cursor-pointer border-0 p-0 bg-transparent"
                        />
                        <input
                          type="text"
                          value={globalSettings.user_dashboard_secondary_color || '#6366f1'}
                          onChange={(e) => setGlobalSettings({ ...globalSettings, user_dashboard_secondary_color: e.target.value })}
                          className="w-full text-[10px] font-mono text-[#32325d] dark:text-white bg-transparent focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] font-semibold text-[#8898aa] block">Accent</span>
                      <div className="flex items-center gap-1 p-1 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded">
                        <input
                          type="color"
                          value={globalSettings.user_dashboard_accent_color || '#10b981'}
                          onChange={(e) => setGlobalSettings({ ...globalSettings, user_dashboard_accent_color: e.target.value })}
                          className="w-5 h-5 rounded cursor-pointer border-0 p-0 bg-transparent"
                        />
                        <input
                          type="text"
                          value={globalSettings.user_dashboard_accent_color || '#10b981'}
                          onChange={(e) => setGlobalSettings({ ...globalSettings, user_dashboard_accent_color: e.target.value })}
                          className="w-full text-[10px] font-mono text-[#32325d] dark:text-white bg-transparent focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 4: Global Announcement Notice */}
              <div className="bg-white dark:bg-slate-900 border border-[#dee2e6] dark:border-slate-800 rounded-xl p-4 space-y-2.5 shadow-argon">
                <div className="pb-1 border-b border-gray-100 dark:border-slate-800">
                  <span className="text-xs font-bold text-[#32325d] dark:text-white uppercase tracking-wider">
                    Default Announcement Notice
                  </span>
                </div>
                <p className="text-[11px] text-[#8898aa] dark:text-slate-400">
                  Displayed at the top of the user dashboard for all playlists inheriting the global style.
                </p>

                {/* Compact Tag Toolbar */}
                <div className="flex flex-wrap items-center gap-1 p-1.5 rounded-lg bg-gray-50 dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700">
                  <span className="text-[10px] font-bold text-[#8898aa] px-1">Tags:</span>
                  {PORTAL_DYNAMIC_TAGS.map((t) => {
                    const isCopied = copiedTag === t.tag;
                    return (
                      <button
                        key={t.tag}
                        type="button"
                        onClick={() => handleInsertTag(t.tag, true)}
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono transition ${isCopied
                          ? 'bg-emerald-500 text-white font-bold'
                          : 'bg-white dark:bg-slate-900 text-[#3970e1] dark:text-blue-400 border border-gray-200 dark:border-slate-700 hover:border-[#3970e1]'
                          }`}
                        title={`Click to insert ${t.tag} (${t.label})`}
                      >
                        <span>{t.tag}</span>
                        {isCopied ? <Check className="w-2.5 h-2.5" /> : null}
                      </button>
                    );
                  })}
                </div>

                <textarea
                  ref={globalHtmlTextareaRef}
                  rows={3}
                  value={globalSettings.user_dashboard_html || ''}
                  onChange={(e) => setGlobalSettings({ ...globalSettings, user_dashboard_html: e.target.value })}
                  placeholder="e.g. <p>Welcome <strong>%name%</strong>! Your account expires on <strong>%expiry%</strong>.</p>"
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded-lg text-xs font-mono text-[#495057] dark:text-slate-200 placeholder-[#8898aa] focus:outline-none focus:border-[#3970e1] resize-y min-h-[75px]"
                />
              </div>
            </div>
          )}

          {/* TAB 2 CONTROLS */}
          {activeTab === 'playlist' && (
            <div className="space-y-4">
              {/* Card 1: Playlist Selector & Mode Switcher */}
              <div className="bg-white dark:bg-slate-900 border border-[#dee2e6] dark:border-slate-800 rounded-xl p-4 space-y-3 shadow-argon">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#32325d] dark:text-white uppercase tracking-wider">
                    Playlist Target
                  </span>
                  {/* Status Indicator */}
                  {branding.enabled ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Custom Override
                    </span>
                  ) : (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-[#3970e1] border border-blue-200 dark:border-blue-800">
                      ⚡ Inheriting Global
                    </span>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="relative">
                    <select
                      value={selectedListId}
                      onChange={(e) => setSelectedListId(e.target.value)}
                      className="w-full px-3 py-2 pr-8 bg-[#f8f9fe] dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded-lg text-xs font-semibold text-[#32325d] dark:text-white focus:outline-none focus:border-[#3970e1] appearance-none cursor-pointer"
                    >
                      {playlists.map((pl) => (
                        <option key={pl.id} value={pl.id}>
                          {pl.name} (ID #{pl.id})
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-[#8898aa] absolute right-2.5 top-2.5 pointer-events-none" />
                  </div>

                  {/* Mode Segmented Switch */}
                  <div className="grid grid-cols-2 gap-1 p-1 bg-gray-100 dark:bg-slate-800 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setBranding({ ...branding, enabled: false })}
                      className={`py-1.5 rounded-md text-xs font-semibold transition ${!branding.enabled
                        ? 'bg-white dark:bg-slate-900 text-[#3970e1] font-bold shadow-xs'
                        : 'text-[#525f7f] dark:text-slate-400 hover:text-[#32325d]'
                        }`}
                    >
                      Use Global Style
                    </button>
                    <button
                      type="button"
                      onClick={() => setBranding({ ...branding, enabled: true })}
                      className={`py-1.5 rounded-md text-xs font-semibold transition ${branding.enabled
                        ? 'bg-white dark:bg-slate-900 text-[#3970e1] font-bold shadow-xs'
                        : 'text-[#525f7f] dark:text-slate-400 hover:text-[#32325d]'
                        }`}
                    >
                      Customize Override
                    </button>
                  </div>

                  {!branding.enabled && (
                    <div className="p-3 rounded-lg bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 space-y-2">
                      <div className="flex items-start gap-2.5">
                        <Info className="w-4 h-4 text-[#3970e1] dark:text-blue-400 mt-0.5 shrink-0" />
                        <div className="space-y-0.5 text-xs">
                          <span className="font-bold text-[#32325d] dark:text-white block">
                            Inheriting Global Style
                          </span>
                          <p className="text-[#525f7f] dark:text-slate-300 leading-relaxed">
                            This playlist is currently using the shared Global Style (title, logo, theme, colors, and default announcement).
                          </p>
                        </div>
                      </div>
                      <div className="pt-1.5 border-t border-blue-200/60 dark:border-blue-800/60">
                        <button
                          type="button"
                          onClick={() => handleSelectTab('login')}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#3970e1] hover:bg-[#3262c5] text-white rounded text-xs font-semibold shadow-xs transition"
                        >
                          <Sliders className="w-3.5 h-3.5" />
                          <span>Customize Global Style</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Quick actions row */}
                <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-slate-800">
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowCopyDropdown((prev) => !prev)}
                      className="flex items-center gap-1.5 text-xs font-semibold text-[#3970e1] hover:underline"
                    >
                      <Copy className="w-3 h-3" />
                      <span>Copy Style From...</span>
                    </button>

                    {showCopyDropdown && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowCopyDropdown(false)} />
                        <div className="absolute left-0 mt-1 w-64 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded-lg shadow-xl z-50 py-1 divide-y divide-gray-100 dark:divide-slate-700">
                          <button
                            type="button"
                            onClick={handleCopyFromGlobal}
                            className="w-full text-left px-3 py-1.5 text-xs text-[#32325d] dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center gap-2"
                          >
                            <Key className="w-3 h-3 text-[#3970e1]" />
                            <span>Global Style (Login & Default Dashboard)</span>
                          </button>
                          {playlists.filter((p) => String(p.id) !== String(selectedListId)).map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => handleCopyFromPlaylist(p)}
                              className="w-full text-left px-3 py-1.5 text-xs text-[#32325d] dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center gap-2 truncate"
                            >
                              <Tv className="w-3 h-3 text-blue-500 shrink-0" />
                              <span className="truncate">{p.name}</span>
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>

                  {branding.enabled && (
                    <button
                      type="button"
                      onClick={handleCopyFromGlobal}
                      className="text-[11px] text-[#8898aa] hover:text-[#525f7f] underline"
                    >
                      Reset to Global
                    </button>
                  )}
                </div>
              </div>

              {/* Card 2: Playlist Customization Controls (Disabled when inheriting) */}
              <div className={`space-y-4 transition-opacity ${!branding.enabled ? 'opacity-40 pointer-events-none' : ''}`}>
                {/* Identity */}
                <div className="bg-white dark:bg-slate-900 border border-[#dee2e6] dark:border-slate-800 rounded-xl p-4 space-y-3 shadow-argon">
                  <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-slate-800">
                    <span className="text-xs font-bold text-[#32325d] dark:text-white uppercase tracking-wider">
                      Playlist Identity
                    </span>
                    {!branding.enabled && (
                      <span className="text-[10px] text-[#3970e1] font-semibold bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800">
                        Inherited from Global Style
                      </span>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#32325d] dark:text-white block">
                      Dashboard Header Title
                    </label>
                    <input
                      type="text"
                      value={branding.enabled ? branding.title : (branding.title || globalSettings.user_dashboard_title || '')}
                      disabled={!branding.enabled}
                      onChange={(e) => setBranding({ ...branding, title: e.target.value })}
                      placeholder={activePlaylistObj?.name ? `${activePlaylistObj.name} Portal` : 'e.g. VIP Sports Portal'}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded-[0.375rem] text-xs text-[#495057] dark:text-slate-200 focus:outline-none focus:border-[#3970e1]"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#32325d] dark:text-white block">
                      Playlist Custom Logo
                    </label>

                    <input
                      type="file"
                      ref={playlistLogoInputRef}
                      disabled={!branding.enabled}
                      onChange={(e) => handleLogoUpload(e, false)}
                      accept="image/png,image/jpeg,image/svg+xml,image/webp,image/gif"
                      className="hidden"
                    />

                    {branding.logo ? (
                      <div className="p-2.5 bg-[#f8f9fe] dark:bg-slate-800/60 border border-[#dee2e6] dark:border-slate-700 rounded-lg flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-12 h-10 rounded bg-slate-950/40 border border-slate-700/50 flex items-center justify-center overflow-hidden p-1 shrink-0">
                            <img src={branding.logo} alt="Logo" className="max-h-full max-w-full object-contain" />
                          </div>
                          <span className="text-xs font-semibold text-[#32325d] dark:text-white truncate">Logo Active</span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => playlistLogoInputRef.current?.click()}
                            className="px-2 py-1 bg-white dark:bg-slate-800 hover:bg-gray-50 text-[#3970e1] border border-[#dee2e6] dark:border-slate-700 rounded text-xs font-semibold"
                          >
                            Change
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveLogo(false)}
                            className="p-1 text-rose-600 hover:bg-rose-50 rounded"
                            title="Remove Logo"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ) : !branding.enabled && globalSettings.user_dashboard_logo ? (
                      <div className="p-2.5 bg-[#f8f9fe] dark:bg-slate-800/60 border border-[#dee2e6] dark:border-slate-700 rounded-lg flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-12 h-10 rounded bg-slate-950/40 border border-slate-700/50 flex items-center justify-center overflow-hidden p-1 shrink-0">
                            <img src={globalSettings.user_dashboard_logo} alt="Logo" className="max-h-full max-w-full object-contain" />
                          </div>
                          <div>
                            <span className="text-xs font-semibold text-[#32325d] dark:text-white block">Global Logo Active</span>
                            <span className="text-[10px] text-[#8898aa] block">Inherited from Global Style</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => playlistLogoInputRef.current?.click()}
                        className="w-full p-3 border border-dashed border-[#dee2e6] dark:border-slate-700 hover:border-[#3970e1] rounded-lg bg-[#f8f9fe]/50 dark:bg-slate-800/30 text-center transition flex items-center justify-center gap-2 text-xs font-semibold text-[#525f7f] dark:text-slate-300"
                      >
                        <Image className="w-4 h-4 text-[#8898aa]" />
                        <span>Upload Playlist Logo</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Theme & Palette */}
                <div className="bg-white dark:bg-slate-900 border border-[#dee2e6] dark:border-slate-800 rounded-xl p-4 space-y-3 shadow-argon">
                  <span className="text-xs font-bold text-[#32325d] dark:text-white uppercase tracking-wider block pb-2 border-b border-gray-100 dark:border-slate-800">
                    Atmosphere & Colors
                  </span>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#32325d] dark:text-white block">Background Atmosphere</label>
                    <div className="grid grid-cols-5 gap-1.5">
                      {PORTAL_THEME_OPTIONS.map((thm) => {
                        const isSelected = (branding.background_theme || 'slate') === thm.id;
                        return (
                          <button
                            key={thm.id}
                            type="button"
                            onClick={() => setBranding({ ...branding, background_theme: thm.id })}
                            title={thm.name}
                            className={`p-1.5 rounded-lg border text-center transition flex flex-col items-center gap-1 ${isSelected
                              ? 'border-[#3970e1] bg-blue-50/50 dark:bg-blue-950/40 ring-1 ring-[#3970e1]'
                              : 'border-[#dee2e6] dark:border-slate-700 hover:border-slate-400 bg-white dark:bg-slate-800'
                              }`}
                          >
                            <div
                              className="w-6 h-6 rounded border shadow-inner overflow-hidden p-0.5"
                              style={{ backgroundColor: thm.swatchBg, borderColor: thm.swatchBorder }}
                            >
                              <div className="w-full h-full rounded-[2px]" style={{ backgroundColor: thm.swatchCard }} />
                            </div>
                            <span className="text-[10px] font-semibold text-[#32325d] dark:text-slate-200 truncate max-w-full">
                              {thm.name.split(' ')[0]}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-2 border-t border-gray-100 dark:border-slate-800">
                    <label className="text-xs font-semibold text-[#32325d] dark:text-white block">Palette Presets</label>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {PORTAL_COLOR_PRESETS.map((preset) => {
                        const isSelected =
                          branding.primary_color === preset.primary &&
                          branding.secondary_color === preset.secondary;
                        return (
                          <button
                            key={preset.name}
                            type="button"
                            onClick={() =>
                              setBranding((prev) => ({
                                ...prev,
                                primary_color: preset.primary,
                                secondary_color: preset.secondary,
                                accent_color: preset.accent,
                              }))
                            }
                            title={preset.name}
                            className={`flex items-center gap-1 px-2 py-1 rounded border text-[11px] font-medium transition ${isSelected
                              ? 'border-[#3970e1] bg-blue-50 dark:bg-blue-950/40 text-[#3970e1] font-bold ring-1 ring-[#3970e1]'
                              : 'border-[#dee2e6] dark:border-slate-700 bg-white dark:bg-slate-800 text-[#525f7f] dark:text-slate-300 hover:border-slate-400'
                              }`}
                          >
                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: preset.primary }} />
                            <span className="truncate">{preset.name}</span>
                          </button>
                        );
                      })}
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-2">
                      <div className="space-y-1">
                        <span className="text-[10px] font-semibold text-[#8898aa] block">Primary</span>
                        <div className="flex items-center gap-1 p-1 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded">
                          <input
                            type="color"
                            value={branding.primary_color || '#3b82f6'}
                            onChange={(e) => setBranding({ ...branding, primary_color: e.target.value })}
                            className="w-5 h-5 rounded cursor-pointer border-0 p-0 bg-transparent"
                          />
                          <input
                            type="text"
                            value={branding.primary_color || '#3b82f6'}
                            onChange={(e) => setBranding({ ...branding, primary_color: e.target.value })}
                            className="w-full text-[10px] font-mono text-[#32325d] dark:text-white bg-transparent focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[10px] font-semibold text-[#8898aa] block">Secondary</span>
                        <div className="flex items-center gap-1 p-1 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded">
                          <input
                            type="color"
                            value={branding.secondary_color || '#6366f1'}
                            onChange={(e) => setBranding({ ...branding, secondary_color: e.target.value })}
                            className="w-5 h-5 rounded cursor-pointer border-0 p-0 bg-transparent"
                          />
                          <input
                            type="text"
                            value={branding.secondary_color || '#6366f1'}
                            onChange={(e) => setBranding({ ...branding, secondary_color: e.target.value })}
                            className="w-full text-[10px] font-mono text-[#32325d] dark:text-white bg-transparent focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[10px] font-semibold text-[#8898aa] block">Accent</span>
                        <div className="flex items-center gap-1 p-1 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded">
                          <input
                            type="color"
                            value={branding.accent_color || '#10b981'}
                            onChange={(e) => setBranding({ ...branding, accent_color: e.target.value })}
                            className="w-5 h-5 rounded cursor-pointer border-0 p-0 bg-transparent"
                          />
                          <input
                            type="text"
                            value={branding.accent_color || '#10b981'}
                            onChange={(e) => setBranding({ ...branding, accent_color: e.target.value })}
                            className="w-full text-[10px] font-mono text-[#32325d] dark:text-white bg-transparent focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Announcement Notice */}
                <div className="bg-white dark:bg-slate-900 border border-[#dee2e6] dark:border-slate-800 rounded-xl p-4 space-y-2.5 shadow-argon">
                  <div className="flex items-center justify-between pb-1 border-b border-gray-100 dark:border-slate-800">
                    <span className="text-xs font-bold text-[#32325d] dark:text-white uppercase tracking-wider">
                      Announcement Notice
                    </span>
                    {!branding.enabled && (
                      <span className="text-[10px] text-[#3970e1] font-semibold bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800">
                        Inherited from Global Style
                      </span>
                    )}
                  </div>

                  {/* Compact Tag Toolbar */}
                  <div className="flex flex-wrap items-center gap-1 p-1.5 rounded-lg bg-gray-50 dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700">
                    <span className="text-[10px] font-bold text-[#8898aa] px-1">Tags:</span>
                    {PORTAL_DYNAMIC_TAGS.map((t) => {
                      const isCopied = copiedTag === t.tag;
                      return (
                        <button
                          key={t.tag}
                          type="button"
                          onClick={() => handleInsertTag(t.tag, false)}
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono transition ${isCopied
                            ? 'bg-emerald-500 text-white font-bold'
                            : 'bg-white dark:bg-slate-900 text-[#3970e1] dark:text-blue-400 border border-gray-200 dark:border-slate-700 hover:border-[#3970e1]'
                            }`}
                          title={`Click to insert ${t.tag} (${t.label})`}
                        >
                          <span>{t.tag}</span>
                          {isCopied ? <Check className="w-2.5 h-2.5" /> : null}
                        </button>
                      );
                    })}
                  </div>

                  <textarea
                    ref={playlistHtmlTextareaRef}
                    rows={3}
                    disabled={!branding.enabled}
                    value={branding.enabled ? branding.html : (branding.html || globalSettings.user_dashboard_html || '')}
                    onChange={(e) => setBranding({ ...branding, html: e.target.value })}
                    placeholder="e.g. <p>Welcome <strong>%name%</strong>! Your %max_con%-connection account expires on <strong>%expiry%</strong>.</p>"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded-lg text-xs font-mono text-[#495057] dark:text-slate-200 placeholder-[#8898aa] focus:outline-none focus:border-[#3970e1] resize-y min-h-[75px]"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: STICKY REAL-TIME LIVE PREVIEW (col-span-7) */}
        <div className="lg:col-span-7 lg:sticky lg:top-6 space-y-2">
          {/* Header over preview with active status */}
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-[#3970e1]" />
              <span className="text-xs font-bold text-[#32325d] dark:text-white uppercase tracking-wider">
                {activeTab === 'login'
                  ? (globalPreviewMode === 'login' ? 'Live Preview: Public Login Page' : 'Live Preview: Default User Dashboard')
                  : `Live Preview: ${activePlaylistObj?.name || 'Playlist Dashboard'}`}
              </span>
            </div>

            {activeTab === 'login' ? (
              <div className="flex items-center bg-gray-100 dark:bg-slate-800 p-0.5 rounded-lg border border-gray-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setGlobalPreviewMode('login')}
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold transition ${globalPreviewMode === 'login'
                    ? 'bg-white dark:bg-slate-900 text-[#3970e1] shadow-xs font-bold'
                    : 'text-[#8898aa] hover:text-[#525f7f]'
                    }`}
                >
                  Login Screen
                </button>
                <button
                  type="button"
                  onClick={() => setGlobalPreviewMode('dashboard')}
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold transition ${globalPreviewMode === 'dashboard'
                    ? 'bg-white dark:bg-slate-900 text-[#3970e1] shadow-xs font-bold'
                    : 'text-[#8898aa] hover:text-[#525f7f]'
                    }`}
                >
                  Dashboard View
                </button>
              </div>
            ) : (
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${previewData.isInherited
                ? 'bg-blue-50 text-[#3970e1] border border-blue-200'
                : 'bg-emerald-50 text-emerald-600 border border-emerald-300'
                }`}>
                {previewData.isInherited ? '⚡ Inheriting Global Style' : '✨ Custom Override Active'}
              </span>
            )}
          </div>

          {/* Rendered Live Preview Frame */}
          <div
            className={`rounded-2xl border overflow-hidden p-6 shadow-xl ${previewData.theme.bg} ${previewData.theme.border}`}
            style={previewData.theme.style}
          >
            {activeTab === 'login' && globalPreviewMode === 'login' ? (
              /* TAB 1: PRE-LOGIN SCREEN PREVIEW */
              <div className="max-w-xs mx-auto py-4">
                <div className={`p-5 rounded-2xl border shadow-2xl space-y-4 ${previewData.theme.card} ${previewData.theme.border}`}>
                  <div className="text-center space-y-1.5">
                    {previewData.logo ? (
                      <div className="w-12 h-12 mx-auto rounded-xl bg-slate-950/40 border border-slate-700/50 flex items-center justify-center p-1.5 overflow-hidden mb-1.5">
                        <img src={previewData.logo} alt="Logo" className="max-h-full max-w-full object-contain" />
                      </div>
                    ) : (
                      <div
                        className="w-11 h-11 mx-auto rounded-xl flex items-center justify-center text-white font-black text-lg shadow-md mb-1.5"
                        style={{ background: `linear-gradient(135deg, ${previewData.primary_color}, ${previewData.secondary_color})` }}
                      >
                        {(previewData.title || 'P')[0]?.toUpperCase()}
                      </div>
                    )}
                    <h3 className={`text-base font-bold ${previewData.theme.text}`}>
                      {previewData.title}
                    </h3>
                    <p className={`text-[11px] ${previewData.theme.muted}`}>
                      Sign in with your subscriber credentials
                    </p>
                  </div>

                  <div className="space-y-2.5">
                    <div className="space-y-1">
                      <label className={`text-[10px] font-bold uppercase tracking-wider ${previewData.theme.muted}`}>Username</label>
                      <input
                        type="text"
                        disabled
                        value="subscriber_user"
                        className={`w-full px-2.5 py-1.5 rounded-lg border text-xs font-mono opacity-80 ${previewData.theme.inputBg} ${previewData.theme.border} ${previewData.theme.text}`}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className={`text-[10px] font-bold uppercase tracking-wider ${previewData.theme.muted}`}>Password</label>
                      <input
                        type="password"
                        disabled
                        value="••••••••••••"
                        className={`w-full px-2.5 py-1.5 rounded-lg border text-xs font-mono opacity-80 ${previewData.theme.inputBg} ${previewData.theme.border} ${previewData.theme.text}`}
                      />
                    </div>
                    <button
                      type="button"
                      disabled
                      className="w-full py-2 rounded-lg text-xs font-bold text-white shadow-md opacity-95 transition"
                      style={{ background: `linear-gradient(135deg, ${previewData.primary_color}, ${previewData.secondary_color})` }}
                    >
                      Sign In
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* TAB 2: POST-LOGIN DASHBOARD PREVIEW */
              <div className="space-y-4">
                {/* Header preview bar */}
                <div className={`p-3.5 rounded-xl border shadow-lg flex items-center justify-between gap-3 ${previewData.theme.headerBg} ${previewData.theme.border}`}>
                  <div className="flex items-center gap-2.5 min-w-0">
                    {previewData.logo ? (
                      <div className="w-8 h-8 rounded-lg bg-slate-950/40 border border-slate-700/50 flex items-center justify-center p-1 overflow-hidden shrink-0">
                        <img src={previewData.logo} alt="Logo" className="max-h-full max-w-full object-contain" />
                      </div>
                    ) : (
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-black text-xs shadow-sm shrink-0"
                        style={{ background: `linear-gradient(135deg, ${previewData.primary_color}, ${previewData.secondary_color})` }}
                      >
                        {(previewData.title || 'P')[0]?.toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <h4 className={`text-xs font-bold truncate leading-tight ${previewData.theme.text}`}>
                        {previewData.title}
                      </h4>
                      <span className={`text-[10px] font-mono ${previewData.theme.muted}`}>
                        vip_subscriber
                        {activeTab === 'login' && ' • Global Default'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950/80 border border-emerald-800 text-emerald-300 flex items-center gap-1 shadow-xs">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span>Active</span>
                    </span>
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800/80 border border-slate-700/60 text-slate-300 text-[10px] font-medium opacity-80">
                      <LogOut className="w-2.5 h-2.5 text-slate-400" />
                      <span className="hidden sm:inline">Sign Out</span>
                    </div>
                  </div>
                </div>

                {/* Announcement Notice preview card */}
                {interpolatedPreviewHtml && (
                  <div
                    className={`p-3 rounded-xl border shadow-md ${previewData.theme.subCard} portal-preview-html relative overflow-hidden`}
                    style={{ borderLeft: `3px solid ${previewData.primary_color}` }}
                  >
                    <div className="flex items-start gap-2">
                      <div
                        className="w-5 h-5 rounded flex items-center justify-center shrink-0 mt-0.5"
                        style={{ backgroundColor: `${previewData.primary_color}25`, color: previewData.primary_color }}
                      >
                        <Info className="w-3 h-3" />
                      </div>
                      <div
                        className={`text-[11px] leading-relaxed space-y-1 ${previewData.theme.text} [&_*]:!text-inherit [&_p]:!text-inherit [&_strong]:!text-white [&_b]:!text-white [&_h1]:!text-white [&_h2]:!text-white [&_h3]:!text-white [&_h4]:!text-white [&_h5]:!text-white [&_h6]:!text-white [&_span]:!text-inherit [&_a]:!text-blue-400`}
                        dangerouslySetInnerHTML={{ __html: interpolatedPreviewHtml }}
                      />
                    </div>
                  </div>
                )}

                {/* Top 2-Column Grid: Account Status (Left) & Device & Player Access (Right) */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">

                  {/* LEFT: Account Status Card */}
                  <div className={`sm:col-span-5 p-3 rounded-xl border shadow-md ${previewData.theme.card} ${previewData.theme.border} space-y-2.5`}>
                    <div className="flex items-center justify-between pb-1.5 border-b border-slate-700/40">
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${previewData.theme.muted}`}>
                        Account Status
                      </span>
                      <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-emerald-950/90 border border-emerald-700 text-emerald-300">
                        Active
                      </span>
                    </div>

                    <div className="space-y-1.5 text-[11px]">
                      <div className="flex items-center justify-between py-0.5 border-b border-slate-700/20">
                        <span className={`flex items-center gap-1.5 ${previewData.theme.muted}`}>
                          <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>Expiration</span>
                        </span>
                        <span className={`font-semibold ${previewData.theme.text}`}>Dec 31, 2026</span>
                      </div>

                      <div className="flex items-center justify-between py-0.5 border-b border-slate-700/20">
                        <span className={`flex items-center gap-1.5 ${previewData.theme.muted}`}>
                          <Tv className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>Connections</span>
                        </span>
                        <span className={`font-semibold ${previewData.theme.text}`}>1  Device</span>
                      </div>
                    </div>
                  </div>

                  {/* RIGHT: Device & Player Access in reduced format */}
                  <div className={`sm:col-span-7 p-3 rounded-xl border shadow-md ${previewData.theme.card} ${previewData.theme.border} space-y-2`}>
                    <div className="flex items-center justify-between pb-1.5 border-b border-slate-700/40">
                      <div className="flex items-center gap-1.5">
                        <MonitorPlay className="w-3.5 h-3.5" style={{ color: previewData.primary_color }} />
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${previewData.theme.text}`}>
                          Device & Player Access
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-[9px]">
                        <span
                          className="px-1.5 py-0.5 rounded font-semibold text-white"
                          style={{ backgroundColor: previewData.primary_color }}
                        >
                          Xtream & M3U
                        </span>
                        <span className={`px-1.5 py-0.5 rounded ${previewData.theme.muted} bg-slate-800/40`}>
                          Web Player
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1.5 text-[10px]">
                      {/* Host */}
                      <div className={`p-1.5 rounded-lg border flex items-center justify-between gap-1 ${previewData.theme.subCard} ${previewData.theme.border}`}>
                        <div className="min-w-0">
                          <span className={`block text-[9px] uppercase font-bold tracking-wider ${previewData.theme.muted}`}>
                            Server URL
                          </span>
                          <span className={`font-mono text-[10px] truncate block ${previewData.theme.text}`}>
                            http://example.com:8080
                          </span>
                        </div>
                        <Copy className="w-3 h-3 text-slate-400 shrink-0" />
                      </div>

                      {/* Username & Password */}
                      <div className="grid grid-cols-2 gap-1.5">
                        <div className={`p-1.5 rounded-lg border flex items-center justify-between gap-1 ${previewData.theme.subCard} ${previewData.theme.border}`}>
                          <div className="min-w-0">
                            <span className={`block text-[9px] uppercase font-bold tracking-wider ${previewData.theme.muted}`}>
                              Username
                            </span>
                            <span className={`font-mono text-[10px] truncate block font-bold ${previewData.theme.text}`}>
                              vip_subscriber
                            </span>
                          </div>
                          <Copy className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                        </div>
                        <div className={`p-1.5 rounded-lg border flex items-center justify-between gap-1 ${previewData.theme.subCard} ${previewData.theme.border}`}>
                          <div className="min-w-0">
                            <span className={`block text-[9px] uppercase font-bold tracking-wider ${previewData.theme.muted}`}>
                              Password
                            </span>
                            <span className={`font-mono text-[10px] truncate block font-bold ${previewData.theme.text}`}>
                              ••••••••
                            </span>
                          </div>
                          <Copy className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                        </div>
                      </div>

                      {/* M3U Link */}
                      <div className={`p-1.5 rounded-lg border flex items-center justify-between gap-1 ${previewData.theme.subCard} ${previewData.theme.border}`}>
                        <div className="min-w-0">
                          <span className={`block text-[9px] uppercase font-bold tracking-wider ${previewData.theme.muted}`}>
                            M3U Plus URL
                          </span>
                          <span className="font-mono text-[10px] truncate block text-blue-400">
                            http://iptv.example.com:8080/get.php?username=...
                          </span>
                        </div>
                        <Copy className="w-3 h-3 text-slate-400 shrink-0" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* BOTTOM: Manage Category Visibility Card */}
                <div className={`p-3 rounded-xl border shadow-md ${previewData.theme.card} ${previewData.theme.border} space-y-2.5`}>
                  <div className="flex items-center justify-between pb-1.5 border-b border-slate-700/40">
                    <div>
                      <h5 className={`text-xs font-bold flex items-center gap-1.5 ${previewData.theme.text}`}>
                        <Layers className="w-3.5 h-3.5" style={{ color: previewData.primary_color }} />
                        <span>Manage Category Visibility</span>
                      </h5>
                      <p className={`text-[10px] ${previewData.theme.muted}`}>
                        Toggle off categories to hide them from M3U playlist & player outputs
                      </p>
                    </div>
                  </div>

                  {/* The 3 Section Buttons */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    {/* Live Channels (Active) */}
                    <div
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-white shadow-xs cursor-default"
                      style={{
                        background: `linear-gradient(135deg, ${previewData.primary_color}, ${previewData.secondary_color})`,
                      }}
                    >
                      <Tv className="w-3 h-3" />
                      <span>Live Channels</span>
                      <span className="px-1.5 py-0.2 rounded-full text-[9px] font-mono bg-white/20 text-white">
                        32
                      </span>
                    </div>

                    {/* Movies / VOD */}
                    <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold ${previewData.theme.muted} ${previewData.theme.subCard} border ${previewData.theme.border} cursor-default`}>
                      <Film className="w-3 h-3" />
                      <span>Movies / VOD</span>
                      <span className="px-1.5 py-0.2 rounded-full text-[9px] font-mono bg-black/20 text-slate-400">
                        41
                      </span>
                    </div>

                    {/* TV Series */}
                    <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold ${previewData.theme.muted} ${previewData.theme.subCard} border ${previewData.theme.border} cursor-default`}>
                      <Clapperboard className="w-3 h-3" />
                      <span>TV Series</span>
                      <span className="px-1.5 py-0.2 rounded-full text-[9px] font-mono bg-black/20 text-slate-400">
                        67
                      </span>
                    </div>
                  </div>

                  {/* Reduced Category Items Mockup */}
                  <div className={`p-2 rounded-lg ${previewData.theme.subCard} border ${previewData.theme.border} space-y-1.5`}>
                    <div className="flex items-center justify-between text-[10px] pb-1 border-b border-slate-700/20">
                      <div className="flex items-center gap-1 text-slate-400">
                        <Search className="w-3 h-3" />
                        <span className="italic">Filter categories...</span>
                      </div>
                      <span className={`text-[9px] ${previewData.theme.muted}`}>3 categories shown</span>
                    </div>

                    <div className="space-y-1 text-[11px]">
                      <div className="flex items-center justify-between p-1 rounded bg-slate-900/30">
                        <span className={`font-medium ${previewData.theme.text}`}>⚽ Sports & Live Events</span>
                      </div>

                      <div className="flex items-center justify-between p-1 rounded bg-slate-900/30">
                        <span className={`font-medium ${previewData.theme.text}`}>🎬 Entertainment & Cinema</span>
                      </div>

                      <div className="flex items-center justify-between p-1 rounded bg-slate-900/30 opacity-60">
                        <span className={`font-medium line-through ${previewData.theme.muted}`}>International</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  if (isEmbedded) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-[#dee2e6] dark:border-slate-800 rounded-[0.375rem] p-5 space-y-5 shadow-argon dark:shadow-2xl animate-in fade-in duration-200">
        {content}
      </div>
    );
  }

  return (
    <div className="w-full max-w-[1920px] mx-auto px-4 sm:px-6 py-6 space-y-5">
      {content}
    </div>
  );
}