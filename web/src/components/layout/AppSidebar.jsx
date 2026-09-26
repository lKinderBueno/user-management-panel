import React from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import {
  Tv,
  Users,
  UserPlus,
  Radio,
  Layers,
  ShieldCheck,
  ShieldAlert,
  Settings,
  Server,
  Sparkles,
  Pin,
  PinOff,
  LogOut,
  X,
  ChevronDown,
  ChevronsUpDown,
  Search,
  Check,
  PanelLeftClose,
  PanelLeftOpen,
  Moon,
  Sun,
  Key,
  Palette
} from 'lucide-react';
import SidebarItem from './SidebarItem';
import Switch from '../ui/Switch';
import PlaylistSettingsModal from '../PlaylistSettingsModal';
import { useTheme } from '../../context/ThemeContext';
import bannerBlack from '../../assets/banner_b_pl.png';
import bannerWhite from '../../assets/banner_w_pl.png';

export default function AppSidebar({
  currentPlaylist,
  playlists = [],
  onSelectPlaylist,
  userCount = 0,
  admin,
  isPinned = true,
  onTogglePin,
  isMobileOpen = false,
  onCloseMobile,
  onLogout,
  onPlaylistsRefreshed,
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isDark, toggleDark } = useTheme();

  const [isHovered, setIsHovered] = React.useState(false);
  const [isPlaylistSettingsOpen, setIsPlaylistSettingsOpen] = React.useState(false);
  const [playlistDropdownOpen, setPlaylistDropdownOpen] = React.useState(false);
  const [dropdownCoords, setDropdownCoords] = React.useState({ top: 0, left: 0, width: 270 });
  const [playlistSearch, setPlaylistSearch] = React.useState('');
  const dropdownRef = React.useRef(null);
  const sidebarRef = React.useRef(null);

  // Expanded if pinned, hovered, or while the playlist dropdown is open
  const isExpanded = isPinned || isHovered || playlistDropdownOpen;

  React.useEffect(() => {
    setPlaylistDropdownOpen(false);
  }, [isPinned]);

  // Close dropdown on outside click
  React.useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target) &&
        !e.target.closest?.('[data-playlist-trigger="true"]')
      ) {
        setPlaylistDropdownOpen(false);
        setIsHovered(false);
      }
    };
    if (playlistDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [playlistDropdownOpen]);

  const handleToggleDropdown = (e, isCompact) => {
    e.stopPropagation();
    if (playlistDropdownOpen) {
      setPlaylistDropdownOpen(false);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    if (isCompact) {
      setDropdownCoords({
        top: Math.max(10, Math.min(window.innerHeight - 340, rect.top)),
        left: rect.right + 10,
        width: 270,
      });
    } else {
      setDropdownCoords({
        top: rect.bottom + 6,
        left: rect.left,
        width: Math.max(rect.width, 256),
      });
    }
    setPlaylistDropdownOpen(true);
  };

  const handleNav = (path) => {
    navigate(path);
    if (isMobileOpen && onCloseMobile) {
      onCloseMobile();
    }
  };

  const filteredPlaylists = React.useMemo(() => {
    if (!playlistSearch.trim()) return playlists;
    const q = playlistSearch.toLowerCase();
    return playlists.filter((p) => (p.name || '').toLowerCase().includes(q));
  }, [playlists, playlistSearch]);

  const isCurrentActive = (path) => {
    if (path === '/playlists') {
      return location.pathname === '/playlists';
    }
    if (path === '/team') {
      return (
        location.pathname === '/team' ||
        location.pathname === '/collaborators' ||
        location.pathname === '/subadmins'
      );
    }
    if (path === '/security') {
      return location.pathname === '/security';
    }
    if (path === '/tokens') {
      return location.pathname === '/tokens' || location.pathname === '/api-tokens';
    }
    if (path === '/settings') {
      return location.pathname === '/settings';
    }
    if (currentPlaylist) {
      const pId = String(currentPlaylist.id);
      if (path === `/users/${pId}` || path === '/dashboard') {
        return (
          location.pathname === `/users/${pId}` ||
          location.pathname === `/users/${pId}/import-editor` ||
          location.pathname === `/users/${pId}/import` ||
          location.pathname === `/users/${pId}/restore` ||
          location.pathname === `/users/${pId}/restore-users` ||
          location.pathname === '/dashboard' ||
          (location.pathname.startsWith(`/users/${pId}/`) &&
            !location.pathname.startsWith(`/users/${pId}/new-user`) &&
            !location.pathname.startsWith(`/users/${pId}/bulk-categories`) &&
            !location.pathname.startsWith(`/users/${pId}/edit-providers`) &&
            !location.pathname.startsWith(`/users/${pId}/edit-provider`) &&
            !location.pathname.startsWith(`/users/${pId}/welcome-info`) &&
            !location.pathname.startsWith(`/users/${pId}/portal-branding`))
        );
      }
      if (path === `/users/${pId}/new-user` || path === '/dashboard/new-user') {
        return location.pathname === `/users/${pId}/new-user` || location.pathname === '/dashboard/new-user';
      }
      if (path === `/users/${pId}/bulk-categories` || path === '/dashboard/bulk-categories') {
        return location.pathname === `/users/${pId}/bulk-categories` || location.pathname === '/dashboard/bulk-categories';
      }
      if (path === `/users/${pId}/edit-providers` || path === '/dashboard/edit-providers') {
        return (
          location.pathname === `/users/${pId}/edit-providers` ||
          location.pathname === `/users/${pId}/edit-provider` ||
          location.pathname === '/dashboard/edit-providers'
        );
      }
      if (path === `/users/${pId}/welcome-info` || path === '/dashboard/welcome-info') {
        return location.pathname === `/users/${pId}/welcome-info` || location.pathname === '/dashboard/welcome-info';
      }
      if (path === `/users/${pId}/portal-branding` || path === '/dashboard/portal-branding') {
        return location.pathname === `/users/${pId}/portal-branding` || location.pathname === '/dashboard/portal-branding';
      }
    }
    return location.pathname === path;
  };

  const renderNavContent = (compact) => (
    <div className="flex-1 flex flex-col justify-between overflow-y-auto overflow-x-hidden py-2 space-y-4">
      <div className="space-y-3 px-2">
        {/* Playlist Switcher Card */}
        {currentPlaylist ? (
          <div>
            {compact ? (
              <div className="flex justify-center my-1 relative group">
                <button
                  type="button"
                  data-playlist-trigger="true"
                  onClick={(e) => handleToggleDropdown(e, true)}
                  className="w-10 h-10 rounded-xl bg-[#eef2ff] dark:bg-blue-950/60 border border-[#3970e1]/30 dark:border-blue-800/60 flex items-center justify-center text-[#3970e1] dark:text-blue-400 hover:bg-[#dee7fc] dark:hover:bg-blue-900/60 transition shadow-sm"
                  aria-label="Current Playlist"
                >
                  <Layers className="w-4 h-4 text-[#3970e1] dark:text-blue-400" />
                </button>
                <div className="absolute left-full ml-2.5 top-1/2 -translate-y-1/2 px-2.5 py-1.5 bg-[#172b4d] dark:bg-slate-800 dark:border dark:border-slate-700 text-white text-xs font-semibold rounded-lg shadow-xl whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                  <span>{currentPlaylist.name}</span>
                  <span className="block text-[13px] text-emerald-400 font-normal">Click to switch</span>
                  <div className="absolute right-full top-1/2 -translate-y-1/2 -mr-1 border-4 border-transparent border-r-[#172b4d] dark:border-r-slate-800" />
                </div>
              </div>
            ) : (
              <div className="w-full h-11 px-2.5 rounded-xl border border-[#dee2e6] dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 hover:border-[#3970e1]/40 dark:hover:border-slate-700 transition-all flex items-center justify-between shadow-xs group">
                <button
                  type="button"
                  data-playlist-trigger="true"
                  onClick={(e) => handleToggleDropdown(e, false)}
                  className="flex items-center gap-2 min-w-0 flex-1 text-left cursor-pointer"
                >
                  <div className="w-7 h-7 rounded-lg bg-[#eef2ff] dark:bg-blue-950/60 border border-[#3970e1]/20 dark:border-blue-800/50 flex items-center justify-center shrink-0">
                    <Layers className="w-3.5 h-3.5 text-[#3970e1] dark:text-blue-400" />
                  </div>
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-[12px] uppercase font-bold text-[#8898aa] dark:text-slate-400 tracking-wider leading-none">
                      Active Playlist
                    </span>
                    <span className="text-xs font-bold text-[#32325d] dark:text-white truncate leading-tight mt-0.5">
                      {currentPlaylist.name}
                    </span>
                  </div>
                  <ChevronsUpDown className="w-3.5 h-3.5 text-[#8898aa] dark:text-slate-400 group-hover:text-[#3970e1] dark:group-hover:text-blue-400 shrink-0 ml-1 transition-colors" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsPlaylistSettingsOpen(true);
                    if (isMobileOpen && onCloseMobile) onCloseMobile();
                  }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-[#3970e1] dark:hover:text-blue-400 hover:bg-white dark:hover:bg-slate-700 transition ml-1 shrink-0"
                  title="Playlist Settings: tracking, max connections, CNAME & SSL"
                >
                  <Settings className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        ) : (
          <Link
            to="/playlists"
            onClick={() => {
              if (isMobileOpen && onCloseMobile) {
                onCloseMobile();
              }
            }}
            onAuxClick={(e) => {
              if (e.button === 1) {
                e.preventDefault();
                window.open('/playlists', '_blank');
              }
            }}
            className={`w-full ${compact ? 'h-10 justify-center' : 'h-11 px-2.5'
              } rounded-xl border border-dashed border-[#3970e1]/40 dark:border-blue-700/50 bg-[#eef2ff]/50 dark:bg-blue-950/30 hover:bg-[#eef2ff] dark:hover:bg-blue-950/60 text-[#3970e1] dark:text-blue-400 transition flex items-center gap-2 text-xs font-semibold`}
            title="Select a playlist"
          >
            <Layers className="w-4 h-4 shrink-0" />
            {!compact && <span className="truncate">Select Playlist</span>}
          </Link>
        )}

        {/* ============================================================ */}
        {/* ALL PLAYLISTS                                                */}
        {/* ============================================================ */}
        <div className="pt-2">
          <div className="space-y-0.5">
            <SidebarItem
              icon={<Layers />}
              label="All Playlists"
              to="/playlists"
              active={isCurrentActive('/playlists')}
              badge={playlists.length}
              color="blue"
              compact={compact}
              onClick={() => handleNav('/playlists')}
            />
          </div>
        </div>

        {/* ============================================================ */}
        {/* PLAYLIST MANAGEMENT (Operations on active playlist)          */}
        {/* ============================================================ */}
        {currentPlaylist && (
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            {!compact && (
              <div className="px-2 pb-1 text-[12px] font-bold uppercase tracking-wider text-[#3970e1] dark:text-blue-400 select-none">
                Users Management Panel
              </div>
            )}

            <div className="space-y-0.5">
              <SidebarItem
                icon={<Users />}
                label="Users"
                to={`/users/${currentPlaylist.id}`}
                active={isCurrentActive(`/users/${currentPlaylist.id}`)}
                badge={userCount}
                color="blue"
                compact={compact}
                onClick={() => handleNav(`/users/${currentPlaylist.id}`)}
              />

              <SidebarItem
                icon={<UserPlus />}
                label="New User"
                to={`/users/${currentPlaylist.id}/new-user`}
                active={isCurrentActive(`/users/${currentPlaylist.id}/new-user`)}
                color="blue"
                compact={compact}
                onClick={() => handleNav(`/users/${currentPlaylist.id}/new-user`)}
              />

              <SidebarItem
                icon={<Layers />}
                label="Bulk Categories"
                to={`/users/${currentPlaylist.id}/bulk-categories`}
                active={isCurrentActive(`/users/${currentPlaylist.id}/bulk-categories`)}
                color="blue"
                compact={compact}
                onClick={() => handleNav(`/users/${currentPlaylist.id}/bulk-categories`)}
              />

              <SidebarItem
                icon={<Server />}
                label="Edit Providers"
                to={`/users/${currentPlaylist.id}/edit-providers`}
                active={isCurrentActive(`/users/${currentPlaylist.id}/edit-providers`)}
                color="blue"
                compact={compact}
                onClick={() => handleNav(`/users/${currentPlaylist.id}/edit-providers`)}
              />

              <SidebarItem
                icon={<Sparkles />}
                label="Welcome Info"
                to={`/users/${currentPlaylist.id}/welcome-info`}
                active={isCurrentActive(`/users/${currentPlaylist.id}/welcome-info`)}
                color="blue"
                compact={compact}
                onClick={() => handleNav(`/users/${currentPlaylist.id}/welcome-info`)}
              />

              <SidebarItem
                icon={<Palette />}
                label="Portal Branding"
                to={`/users/${currentPlaylist.id}/portal-branding`}
                active={isCurrentActive(`/users/${currentPlaylist.id}/portal-branding`)}
                color="blue"
                compact={compact}
                onClick={() => handleNav(`/users/${currentPlaylist.id}/portal-branding`)}
              />

              <SidebarItem
                icon={<Settings />}
                label="Playlist Settings"
                active={isPlaylistSettingsOpen}
                color="blue"
                compact={compact}
                onClick={() => {
                  setIsPlaylistSettingsOpen(true);
                  if (isMobileOpen && onCloseMobile) {
                    onCloseMobile();
                  }
                }}
                title="Playlist Settings: tracking, max connections, CNAME & SSL"
              />
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* ADMINISTRATION & SYSTEM (Team, Security, Settings)           */}
        {/* ============================================================ */}
        {((admin?.can_create_admins || admin?.can_create_collaborators) || admin?.role === 'admin' || admin?.can_manage_api_tokens) && (
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            {!compact && (
              <div className="px-2 pb-1 text-[12px] font-bold uppercase tracking-wider text-[#8898aa] dark:text-slate-400 select-none">
                Administration
              </div>
            )}

            <div className="space-y-0.5">
              {(admin?.role === 'admin' || admin?.can_manage_api_tokens) && (
                <SidebarItem
                  icon={<Key />}
                  label="API Tokens"
                  to="/tokens"
                  active={isCurrentActive('/tokens')}
                  color="purple"
                  compact={compact}
                  onClick={() => handleNav('/tokens')}
                />
              )}

              {(admin?.can_create_admins || admin?.can_create_collaborators) && (
                <SidebarItem
                  icon={<ShieldCheck />}
                  label="Team"
                  to="/team"
                  active={isCurrentActive('/team')}
                  color="green"
                  compact={compact}
                  onClick={() => handleNav('/team')}
                />
              )}

              {admin?.role === 'admin' && (
                <SidebarItem
                  icon={<ShieldAlert />}
                  label="Security"
                  to="/security"
                  active={isCurrentActive('/security')}
                  color="red"
                  compact={compact}
                  onClick={() => handleNav('/security')}
                />
              )}

              {admin?.role === 'admin' && (
                <SidebarItem
                  icon={<Settings />}
                  label="Settings"
                  to="/settings"
                  active={isCurrentActive('/settings')}
                  color="blue"
                  compact={compact}
                  onClick={() => handleNav('/settings')}
                />
              )}
            </div>
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* FOOTER: Dark Mode Switch & User Card / Logout                */}
      {/* ============================================================ */}
      <div className="p-2 border-t border-slate-100 dark:border-slate-800 shrink-0 space-y-2">
        {compact ? (
          <>
            {/* Compact Dark Mode Button with Tooltip */}
            <div className="relative group flex justify-center w-full">
              <button
                type="button"
                onClick={toggleDark}
                aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                className="w-10 h-10 rounded-xl border border-slate-200/90 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-800/40 flex items-center justify-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors"
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-200/80 text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                  {isDark ? <Moon className="w-3.5 h-3.5 text-amber-400" /> : <Sun className="w-3.5 h-3.5 text-slate-600" />}
                </div>
              </button>
              <div className="absolute left-full ml-2.5 top-1/2 -translate-y-1/2 px-2.5 py-1.5 bg-[#172b4d] dark:bg-slate-800 dark:border dark:border-slate-700 text-white text-xs font-semibold rounded-lg shadow-xl whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none z-50">
                <span>{isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}</span>
                <div className="absolute right-full top-1/2 -translate-y-1/2 -mr-1 border-4 border-transparent border-r-[#172b4d] dark:border-r-slate-800" />
              </div>
            </div>

            {/* Compact User Initial & Logout */}
            <div className="flex flex-col items-center gap-1.5 pt-1 border-t border-slate-100 dark:border-slate-800/60">
              <div
                className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-[#3970e1] dark:text-blue-400 font-bold text-xs flex items-center justify-center cursor-default select-none border border-slate-200 dark:border-slate-700"
                title={`${admin?.username || 'Admin'} (${admin?.role === 'admin' ? 'Admin' : 'Collaborator'})`}
              >
                {(admin?.username || 'A').charAt(0).toUpperCase()}
              </div>
              <button
                type="button"
                onClick={onLogout}
                aria-label="Sign Out"
                title="Sign Out"
                className="w-9 h-9 rounded-xl text-slate-400 hover:text-[#f5365c] hover:bg-[#feecee] dark:hover:bg-rose-950/40 flex items-center justify-center transition"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Expanded Dark Mode Card (Matching playlistlabs5) */}
            <div
              onClick={toggleDark}
              className="h-10 w-full rounded-xl border border-slate-200/90 bg-slate-50/80 px-2.5 dark:border-slate-800 dark:bg-slate-800/40 flex items-center justify-between overflow-hidden cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors select-none"
            >
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-200/80 text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                  {isDark ? <Moon className="w-3.5 h-3.5 text-amber-400" /> : <Sun className="w-3.5 h-3.5 text-slate-600" />}
                </div>
                <p className="text-xs font-bold text-slate-700 dark:text-slate-200 leading-tight truncate">Dark Mode</p>
              </div>

              <Switch
                checked={isDark}
                onCheckedChange={toggleDark}
              />
            </div>

            {/* User Profile Card */}
            <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-[#3970e1] text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-sm">
                  {(admin?.username || 'A').charAt(0).toUpperCase()}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-bold text-[#32325d] dark:text-slate-200 truncate leading-tight">
                    {admin?.username || 'Admin'}
                  </span>
                  <span className="text-[13px] text-[#8898aa] dark:text-slate-400 font-medium leading-tight">
                    {admin?.role === 'admin' ? 'Administrator' : 'Collaborator'}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={onLogout}
                title="Sign Out"
                className="p-1.5 text-slate-400 hover:text-[#f5365c] hover:bg-[#feecee] dark:hover:bg-rose-950/40 rounded-lg transition"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* ========================================================================= */}
      {/* STATIC LAYOUT SPACER (Desktop: pushes main content based on pin state)    */}
      {/* ========================================================================= */}
      <div
        className={`hidden shrink-0 transition-all duration-300 ease-in-out lg:block ${isPinned ? 'w-64' : 'w-16'
          }`}
        aria-hidden="true"
      />

      {/* ========================================================================= */}
      {/* DESKTOP FIXED SIDEBAR (Collapsible & Floating on Hover when Unpinned)     */}
      {/* ========================================================================= */}
      <aside
        ref={sidebarRef}
        onMouseEnter={() => {
          if (!isPinned) setIsHovered(true);
        }}
        onMouseLeave={() => {
          if (!isPinned && !playlistDropdownOpen) {
            setIsHovered(false);
          }
        }}
        className={`fixed left-0 top-0 bottom-0 hidden lg:flex flex-col border-r border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 transition-all duration-300 ease-in-out ${isExpanded ? 'w-64' : 'w-16'
          } ${!isPinned && isHovered ? 'z-50 shadow-2xl ring-1 ring-black/5 dark:ring-white/5' : 'z-30'}`}
      >
        {/* Brand Header & Pin Toggler */}
        <div className="h-14 px-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
          {isExpanded ? (
            <>
              <Link
                to="/playlists"
                onClick={() => handleNav('/playlists')}
                onAuxClick={(e) => {
                  if (e.button === 1) {
                    e.preventDefault();
                    window.open('/playlists', '_blank');
                  }
                }}
                className="flex items-center cursor-pointer select-none group min-w-0 py-1"
                title="Go to Playlists Overview"
              >
                <img
                  src={isDark ? bannerWhite : bannerBlack}
                  alt="PlaylistLabs"
                  className="h-8 w-auto max-w-[170px] object-contain transition-opacity group-hover:opacity-90"
                />
              </Link>

              {/* Pin / Unpin Button */}
              <button
                type="button"
                onClick={() => {
                  setPlaylistDropdownOpen(false);
                  onTogglePin();
                }}
                title={isPinned ? 'Collapse sidebar (hover mode)' : 'Lock sidebar expanded'}
                className="p-1.5 rounded-lg text-slate-400 hover:text-[#32325d] dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition shrink-0"
              >
                {isPinned ? (
                  <Pin className="w-4 h-4 text-[#3970e1] dark:text-blue-400" />
                ) : (
                  <PinOff className="w-4 h-4 text-slate-400" />
                )}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => {
                setPlaylistDropdownOpen(false);
                onTogglePin();
              }}
              title="Lock sidebar expanded"
              className="w-full h-10 rounded-xl flex items-center justify-center text-slate-400 hover:text-[#3970e1] dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <PinOff className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Sidebar Content */}
        {renderNavContent(!isExpanded)}
      </aside>

      {/* ========================================================================= */}
      {/* MOBILE BACKDROP OVERLAY                                                  */}
      {/* ========================================================================= */}
      <div
        onClick={onCloseMobile}
        className={`fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm transition-opacity duration-300 lg:hidden ${isMobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
        aria-hidden="true"
      />

      {/* ========================================================================= */}
      {/* MOBILE DRAWER SIDEBAR                                                    */}
      {/* ========================================================================= */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col justify-between border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl transition-transform duration-300 ease-in-out lg:hidden ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
      >
        {/* Mobile Header: Brand & Close Button */}
        <div className="h-14 px-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
          <Link
            to="/playlists"
            onClick={() => handleNav('/playlists')}
            onAuxClick={(e) => {
              if (e.button === 1) {
                e.preventDefault();
                window.open('/playlists', '_blank');
              }
            }}
            className="flex items-center cursor-pointer select-none py-1"
          >
            <img
              src={isDark ? bannerWhite : bannerBlack}
              alt="PlaylistLabs"
              className="h-8 w-auto max-w-[180px] object-contain"
            />
          </Link>

          <button
            type="button"
            onClick={onCloseMobile}
            className="p-1.5 rounded-lg text-slate-400 hover:text-[#32325d] dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mobile Sidebar Content */}
        {renderNavContent(false)}
      </aside>

      {/* ========================================================================= */}
      {/* FLOATING PORTAL: Switch Playlist Dropdown (Never Clipped by Overflow)      */}
      {/* ========================================================================= */}
      {playlistDropdownOpen && currentPlaylist && createPortal(
        <div
          ref={dropdownRef}
          onMouseEnter={() => {
            if (!isPinned) setIsHovered(true);
          }}
          onMouseLeave={() => {
            if (!isPinned && !playlistDropdownOpen) setIsHovered(false);
          }}
          style={{
            position: 'fixed',
            top: `${dropdownCoords.top}px`,
            left: `${dropdownCoords.left}px`,
            width: `${dropdownCoords.width}px`,
            zIndex: 99999,
          }}
          className="bg-white dark:bg-slate-900 border border-[#dee2e6] dark:border-slate-800 rounded-2xl shadow-argon-dropdown py-1.5 animate-in fade-in zoom-in-95 duration-100 text-[#32325d] dark:text-slate-200"
        >
          <div className="px-3.5 py-2 text-[12px] font-bold uppercase text-[#8898aa] dark:text-slate-400 tracking-wider border-b border-[#e9ecef] dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-[#3970e1] dark:text-blue-400" />
              <span>Switch Playlist</span>
            </div>
            <span className="text-[12px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-full font-mono text-slate-600 dark:text-slate-300">
              {playlists.length}
            </span>
          </div>

          {playlists.length > 3 && (
            <div className="p-2 border-b border-[#e9ecef] dark:border-slate-800">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#8898aa] dark:text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search playlist..."
                  value={playlistSearch}
                  onChange={(e) => setPlaylistSearch(e.target.value)}
                  className="w-full h-8 pl-8 pr-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-[#3970e1] dark:focus:border-blue-500"
                  autoFocus
                />
              </div>
            </div>
          )}

          <div className="max-h-60 overflow-y-auto py-1">
            {filteredPlaylists.map((p) => {
              const isSelected = String(p.id) === String(currentPlaylist.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    onSelectPlaylist(p);
                    setPlaylistDropdownOpen(false);
                    setIsHovered(false);
                  }}
                  className={`w-full text-left px-3.5 py-2 text-xs flex items-center justify-between hover:bg-[#f6f9fc] dark:hover:bg-slate-800 transition ${isSelected ? 'bg-[#eef2ff] dark:bg-blue-950/60 text-[#3970e1] dark:text-blue-400 font-bold' : 'text-[#525f7f] dark:text-slate-300'
                    }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${isSelected ? 'bg-[#3970e1] text-white shadow-xs' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                      }`}>
                      <Layers className="w-3.5 h-3.5" />
                    </div>
                    <span className="truncate font-semibold">{p.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    {isSelected ? (
                      <Check className="w-3.5 h-3.5 text-[#3970e1] dark:text-blue-400 shrink-0" />
                    ) : (
                      <span className="w-3.5 shrink-0" />
                    )}
                    <span className="text-[12px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 text-[#8898aa] dark:text-slate-400 font-mono min-w-[24px] text-center">
                      {p.managed_users_count || 0}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="p-1 border-t border-[#e9ecef] dark:border-slate-800 flex items-center justify-between gap-1">
            <button
              type="button"
              onClick={() => {
                setPlaylistDropdownOpen(false);
                setIsHovered(false);
                handleNav('/playlists');
              }}
              className="flex-1 text-left px-3 py-1.5 text-xs flex items-center gap-2 font-semibold text-[#3970e1] dark:text-blue-400 hover:bg-[#eef2ff] dark:hover:bg-blue-950/60 rounded-xl transition"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>All Playlists Overview...</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setPlaylistDropdownOpen(false);
                setIsHovered(false);
                setIsPlaylistSettingsOpen(true);
              }}
              className="px-2.5 py-1.5 text-xs flex items-center gap-1.5 font-semibold text-slate-600 dark:text-slate-300 hover:text-[#3970e1] dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
              title="Open Playlist Settings"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Settings</span>
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* Playlist Settings Modal */}
      {currentPlaylist && (
        <PlaylistSettingsModal
          isOpen={isPlaylistSettingsOpen}
          playlist={currentPlaylist}
          onClose={() => setIsPlaylistSettingsOpen(false)}
          onSaved={(updated) => {
            onPlaylistsRefreshed?.();
          }}
        />
      )}
    </>
  );
}
