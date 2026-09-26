import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Menu,
  ChevronRight,
  UserPlus,
  ArrowLeft,
  Users,
  Tv,
  Search,
  X,
  SlidersHorizontal,
  ChevronDown,
  Calendar
} from 'lucide-react';
import UserProfileMenu from './layout/UserProfileMenu';

export default function Navbar({ 
  currentPlaylist, 
  userCount = 0, 
  onNewUser, 
  onExportCsv, 
  admin, 
  onLogout,
  onOpenMobileSidebar,
  searchQuery = '',
  onSearchChange,
  patternParam1 = '',
  onPatternParam1Change,
  patternParam2 = '',
  onPatternParam2Change,
  patternType = '',
  onPatternTypeChange,
  availablePatternTypes = [],
  expiryPreset = 'all',
  onExpiryPresetChange,
  expiryBeforeDate = '',
  onExpiryBeforeDateChange,
  onlineCount = 0,
  onResetFilters
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [showProviderPopover, setShowProviderPopover] = React.useState(false);
  const providerPopoverRef = React.useRef(null);

  React.useEffect(() => {
    function handleClickOutside(e) {
      if (providerPopoverRef.current && !providerPopoverRef.current.contains(e.target)) {
        setShowProviderPopover(false);
      }
    }
    if (showProviderPopover) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showProviderPopover]);

  // Determine breadcrumb context based on current route
  const getBreadcrumbs = () => {
    const p = location.pathname;

    if (p === '/playlists') {
      return [
        { label: 'All Playlists' }
      ];
    }
    if (p === '/team' || p === '/collaborators' || p === '/subadmins') {
      return [
        { label: 'Team Management' }
      ];
    }
    if (p === '/security') {
      return [
        { label: 'Security & Logs' }
      ];
    }
    if (p === '/tokens' || p === '/api-tokens') {
      return [
        { label: 'API Tokens' }
      ];
    }
    if (p === '/settings') {
      return [
        { label: 'Settings & Backups' }
      ];
    }
    const pId = currentPlaylist?.id ? String(currentPlaylist.id) : '';
    const playlistHome = pId ? `/users/${pId}` : '/playlists';
    const playlistLabel = currentPlaylist?.name || 'Playlist';

    if (p === `/users/${pId}/new-user` || p === '/dashboard/new-user') {
      return [
        { label: 'Playlists', path: '/playlists' },
        { label: playlistLabel, path: playlistHome },
        { label: 'New User Wizard' }
      ];
    }
    if (p === `/users/${pId}/bulk-categories` || p === '/dashboard/bulk-categories') {
      return [
        { label: 'Playlists', path: '/playlists' },
        { label: playlistLabel, path: playlistHome },
        { label: 'Bulk Categories' }
      ];
    }
    if (p === `/users/${pId}/edit-providers` || p === `/users/${pId}/edit-provider` || p === '/dashboard/edit-providers') {
      return [
        { label: 'Playlists', path: '/playlists' },
        { label: playlistLabel, path: playlistHome },
        { label: 'Edit Providers' }
      ];
    }
    if (p === `/users/${pId}/welcome-info` || p === '/dashboard/welcome-info') {
      return [
        { label: 'Playlists', path: '/playlists' },
        { label: playlistLabel, path: playlistHome },
        { label: 'Welcome Info' }
      ];
    }
    if (p === `/users/${pId}/portal-branding` || p === '/dashboard/portal-branding') {
      return [
        { label: 'Playlists', path: '/playlists' },
        { label: playlistLabel, path: playlistHome },
        { label: 'Portal Branding' }
      ];
    }

    const nonUserRoutes = ['new-user', 'bulk-categories', 'edit-providers', 'edit-provider', 'welcome-info', 'portal-branding', 'import-editor', 'import', 'restore', 'restore-users'];
    const userMatch = p.match(new RegExp(`^/users/${pId}/([^/]+)(?:/([^/]+))?`));
    if (userMatch && !nonUserRoutes.includes(userMatch[1])) {
      const uId = userMatch[1];
      const action = userMatch[2];
      let actionLabel = '';
      if (action === 'info' || action === 'links') actionLabel = 'Streaming Links';
      else if (action === 'credentials' || action === 'creds') actionLabel = 'Credentials';
      else if (action === 'm3u') actionLabel = 'Customize M3U';
      else if (action === 'move') actionLabel = 'Move User';
      else if (action === 'edit') actionLabel = 'Edit';

      return [
        { label: 'Playlists', path: '/playlists' },
        { label: playlistLabel, path: playlistHome },
        { label: `User #${uId}`, path: action ? `/users/${pId}/${uId}` : undefined },
        ...(actionLabel ? [{ label: actionLabel }] : [])
      ];
    }

    // Default dashboard / users root
    return [
      { label: 'Playlists', path: '/playlists' },
      { label: playlistLabel, path: playlistHome },
      { label: 'Users' }
    ];
  };

  const pId = currentPlaylist?.id ? String(currentPlaylist.id) : '';
  const breadcrumbs = getBreadcrumbs();
  const isDashboardRoot = location.pathname === '/dashboard' ||
    (Boolean(pId) && (
      location.pathname === `/users/${pId}` ||
      location.pathname === `/users/${pId}/import-editor` ||
      location.pathname === `/users/${pId}/restore` ||
      Boolean(location.pathname.match(new RegExp(`^/users/${pId}/[^/]+(?:/(?:info|credentials|creds|m3u|move|edit))?$`)))
    ) && !location.pathname.includes('/new-user') && !location.pathname.includes('/bulk-categories') && !location.pathname.includes('/edit-providers') && !location.pathname.includes('/welcome-info'));
  const isDashboardSubpage = (location.pathname.startsWith('/dashboard/') && location.pathname !== '/dashboard') ||
    (Boolean(pId) && location.pathname.startsWith(`/users/${pId}/`) && !isDashboardRoot);

  return (
    <header className="bg-[#3970e1] border-b border-[#2c5ec2] sticky top-0 z-30 shadow-sm text-white flex flex-col shrink-0">
      <div className="w-full flex items-center justify-between gap-3 px-3 sm:px-6 h-14">
        {/* Left: Hamburger (mobile) & Breadcrumbs */}
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          {/* Mobile hamburger button */}
          <button
            type="button"
            onClick={onOpenMobileSidebar}
            aria-label="Open navigation menu"
            className="lg:hidden p-1.5 rounded-lg text-white hover:bg-white/15 active:scale-95 transition"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Breadcrumb path */}
          <nav className="flex items-center gap-1.5 text-xs text-white/80 min-w-0" aria-label="Breadcrumb">
            {breadcrumbs.map((crumb, idx) => {
              const isLast = idx === breadcrumbs.length - 1;
              return (
                <React.Fragment key={idx}>
                  {idx > 0 && <ChevronRight className="w-3.5 h-3.5 text-white/50 shrink-0" />}
                  {crumb.path && !isLast ? (
                    <button
                      type="button"
                      onClick={() => navigate(crumb.path)}
                      className="hover:text-white transition truncate max-w-[140px] font-medium"
                    >
                      {crumb.label}
                    </button>
                  ) : (
                    <span className={`truncate max-w-[180px] ${isLast ? 'text-white font-bold' : 'font-medium'}`}>
                      {crumb.label}
                    </span>
                  )}
                </React.Fragment>
              );
            })}
          </nav>

          {/* User count pill when in dashboard */}
          {isDashboardRoot && currentPlaylist && (
            <div className="hidden md:flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/15 border border-white/20 text-xs text-white select-none">
              <Users className="w-3 h-3 text-white/80" />
              <span className="font-mono font-bold">{userCount}</span>
              <span className="text-[13px] text-white/80">users</span>
            </div>
          )}
        </div>

        {/* Center: Search Bar & Filters in playlistlabs5 style */}
        {isDashboardRoot && currentPlaylist && (
          <div className="hidden sm:flex flex-1 items-center justify-center gap-2 mx-2 min-w-0">
            {/* Search Input */}
            <div className="relative flex items-center w-full max-w-[180px] md:max-w-[240px] lg:max-w-[280px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/70 pointer-events-none shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange?.(e.target.value)}
                placeholder="Search users..."
                className="h-9 w-full rounded-xl border border-white/20 bg-white/15 pl-9 pr-8 text-xs text-white placeholder:text-white/70 outline-none transition-colors duration-150 focus:border-white focus:bg-white focus:text-[#32325d] focus:placeholder:text-slate-400"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => onSearchChange?.('')}
                  className="absolute right-2.5 p-0.5 text-white/70 hover:text-[#32325d] rounded-full transition"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Provider Params Popover */}
            <div className="relative shrink-0" ref={providerPopoverRef}>
              <button
                type="button"
                onClick={() => setShowProviderPopover(!showProviderPopover)}
                className={`h-9 px-2.5 lg:px-3 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 shadow-sm ${
                  showProviderPopover || patternParam1 || patternParam2 || patternType
                    ? 'bg-white text-[#3970e1] border-white shadow-md'
                    : 'bg-white/15 hover:bg-white/25 text-white border-white/20'
                }`}
                title="Filter by source provider parameters (Username, Password, Server pattern)"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">Provider Params</span>
                <span className="hidden md:inline lg:hidden">Provider</span>
                {(patternParam1 || patternParam2 || patternType) && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#3970e1] md:bg-white" />
                )}
                <ChevronDown className={`w-3 h-3 transition-transform ${showProviderPopover ? 'rotate-180' : ''}`} />
              </button>

              {/* Provider Params Popover Dropdown */}
              {showProviderPopover && (
                <div className="absolute right-0 sm:left-0 sm:right-auto mt-2 w-72 bg-white dark:bg-slate-900 rounded-xl shadow-argon-dropdown border border-[#dee2e6] dark:border-slate-800 p-3.5 z-50 animate-in fade-in zoom-in-95 duration-100 text-[#32325d] dark:text-slate-200 space-y-3">
                  <div className="flex items-center justify-between border-b border-[#e9ecef] dark:border-slate-800 pb-2">
                    <div className="flex items-center gap-1.5">
                      <SlidersHorizontal className="w-3.5 h-3.5 text-[#3970e1] dark:text-blue-400" />
                      <span className="text-xs font-bold text-[#32325d] dark:text-white">Provider Parameters</span>
                    </div>
                    {(patternParam1 || patternParam2 || patternType) && (
                      <button
                        type="button"
                        onClick={() => {
                          onPatternParam1Change?.('');
                          onPatternParam2Change?.('');
                          onPatternTypeChange?.('');
                        }}
                        className="text-[13px] text-[#f5365c] dark:text-rose-400 hover:underline font-semibold"
                      >
                        Reset
                      </button>
                    )}
                  </div>

                  <div className="space-y-2.5">
                    <div className="space-y-1">
                      <label className="text-[12px] text-[#525f7f] dark:text-slate-400 font-bold uppercase tracking-wider block">
                        Provider Username / Key
                      </label>
                      <input
                        type="text"
                        placeholder="Search provider username..."
                        value={patternParam1}
                        onChange={(e) => onPatternParam1Change?.(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded-lg text-xs text-[#32325d] dark:text-white placeholder-[#adb5bd] dark:placeholder-slate-500 focus:outline-none focus:border-[#3970e1] focus:ring-1 focus:ring-[#3970e1]/30"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[12px] text-[#525f7f] dark:text-slate-400 font-bold uppercase tracking-wider block">
                        Provider Password / Profile
                      </label>
                      <input
                        type="text"
                        placeholder="Search provider password..."
                        value={patternParam2}
                        onChange={(e) => onPatternParam2Change?.(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded-lg text-xs text-[#32325d] dark:text-white placeholder-[#adb5bd] dark:placeholder-slate-500 focus:outline-none focus:border-[#3970e1] focus:ring-1 focus:ring-[#3970e1]/30"
                      />
                    </div>

                    {availablePatternTypes.length > 0 && (
                      <div className="space-y-1">
                        <label className="text-[12px] text-[#525f7f] dark:text-slate-400 font-bold uppercase tracking-wider block">
                          Server Pattern Type
                        </label>
                        <select
                          value={patternType}
                          onChange={(e) => onPatternTypeChange?.(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded-lg text-xs text-[#32325d] dark:text-white focus:outline-none focus:border-[#3970e1]"
                        >
                          <option value="">All patterns</option>
                          {availablePatternTypes.map((pt) => (
                            <option key={pt} value={pt}>{pt}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Expiry / Status Preset Filter */}
            <div className="relative flex items-center gap-1.5 shrink-0">
              <div className="relative">
                <select
                  value={expiryPreset}
                  onChange={(e) => onExpiryPresetChange?.(e.target.value)}
                  className={`h-9 rounded-xl border pl-3 pr-7 text-xs font-semibold outline-none transition cursor-pointer appearance-none ${
                    expiryPreset !== 'all'
                      ? 'bg-white text-[#3970e1] border-white shadow-md'
                      : 'border-white/20 bg-white/15 text-white hover:bg-white/25 focus:bg-white focus:text-[#32325d]'
                  }`}
                  title="Filter users by expiration or online status"
                >
                  <option value="all" className="text-[#32325d]">All Statuses</option>
                  <option value="online" className="text-[#32325d]">{onlineCount > 0 ? `Online (${onlineCount})` : 'Online'}</option>
                  <option value="active" className="text-[#32325d]">Active</option>
                  <option value="expiring_7" className="text-[#32325d]">Exp. 7 Days</option>
                  <option value="expiring_30" className="text-[#32325d]">Exp. 30 Days</option>
                  <option value="expired" className="text-[#32325d]">Expired</option>
                  <option value="unlimited" className="text-[#32325d]">Unlimited</option>
                  <option value="custom" className="text-[#32325d]">Custom Date...</option>
                </select>
                <ChevronDown className={`absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none ${
                  expiryPreset !== 'all' ? 'text-[#3970e1]' : 'text-white/70'
                }`} />
              </div>

              {/* Custom Date Input when 'custom' is selected */}
              {expiryPreset === 'custom' && (
                <div className="relative flex items-center">
                  <input
                    type="date"
                    value={expiryBeforeDate}
                    onChange={(e) => onExpiryBeforeDateChange?.(e.target.value)}
                    className="h-9 rounded-xl border border-white/20 bg-white text-xs text-[#32325d] px-2.5 outline-none font-semibold shadow-sm"
                    title="Filter users expiring before date"
                  />
                  {expiryBeforeDate && (
                    <button
                      type="button"
                      onClick={() => onExpiryBeforeDateChange?.('')}
                      className="absolute right-1.5 p-0.5 text-gray-400 hover:text-gray-700"
                      title="Clear date"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Right: Context Actions & User Profile Menu */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Subpage back button */}
          {isDashboardSubpage && (
            <button
              type="button"
              onClick={() => navigate(currentPlaylist ? `/users/${currentPlaylist.id}` : '/playlists')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-semibold border border-white/25 transition active:scale-95 shadow-sm"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Back to Users</span>
              <span className="sm:hidden">Back</span>
            </button>
          )}

          {/* Root Dashboard Actions */}
          {isDashboardRoot && currentPlaylist && (
            <button
              type="button"
              onClick={onNewUser}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#2dce89] hover:bg-[#26af74] text-white font-bold rounded-lg text-xs shadow-argon-btn transition active:scale-95"
              title="Create a new user account"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>New User</span>
            </button>
          )}

          {/* Divider */}
          <div className="h-6 w-px bg-white/20 hidden sm:block" />

          {/* User Profile Menu */}
          <UserProfileMenu admin={admin} onLogout={onLogout} />
        </div>
      </div>

      {/* Mobile Dedicated Toolbar Row (Visible only on < sm screens) */}
      {isDashboardRoot && currentPlaylist && (
        <div className="flex sm:hidden items-center gap-1.5 px-3 pt-1 pb-2.5 border-t border-white/10 w-full">
          {/* Mobile Search */}
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-white/70 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange?.(e.target.value)}
              placeholder="Search users..."
              className="h-8 w-full rounded-lg border border-white/20 bg-white/15 pl-7 pr-6 text-xs text-white placeholder:text-white/70 outline-none focus:border-white focus:bg-white focus:text-[#32325d]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange?.('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-white/70 hover:text-[#32325d]"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Mobile Expiry Select */}
          <div className="relative shrink-0">
            <select
              value={expiryPreset}
              onChange={(e) => onExpiryPresetChange?.(e.target.value)}
              className={`h-8 rounded-lg border pl-2 pr-6 text-xs font-semibold outline-none appearance-none ${
                expiryPreset !== 'all'
                  ? 'bg-white text-[#3970e1] border-white shadow-sm'
                  : 'border-white/20 bg-white/15 text-white'
              }`}
            >
              <option value="all" className="text-[#32325d]">All</option>
              <option value="online" className="text-[#32325d]">{onlineCount > 0 ? `Online (${onlineCount})` : 'Online'}</option>
              <option value="active" className="text-[#32325d]">Active</option>
              <option value="expiring_7" className="text-[#32325d]">Exp 7d</option>
              <option value="expired" className="text-[#32325d]">Expired</option>
              <option value="unlimited" className="text-[#32325d]">Unlimited</option>
            </select>
            <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none text-white/70" />
          </div>

          {/* Mobile Provider Params button */}
          <button
            type="button"
            onClick={() => setShowProviderPopover(!showProviderPopover)}
            className={`h-8 px-2 rounded-lg border text-xs font-semibold flex items-center gap-1 transition ${
              showProviderPopover || patternParam1 || patternParam2 || patternType
                ? 'bg-white text-[#3970e1] border-white'
                : 'bg-white/15 text-white border-white/20'
            }`}
            title="Provider Params"
          >
            <SlidersHorizontal className="w-3 h-3" />
            {(patternParam1 || patternParam2 || patternType) && (
              <span className="w-1.5 h-1.5 rounded-full bg-[#3970e1]" />
            )}
          </button>
        </div>
      )}
    </header>
  );
}
