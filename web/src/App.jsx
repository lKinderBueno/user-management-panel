import React from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation, useParams, Outlet, useOutletContext } from 'react-router-dom';
import Navbar from './components/Navbar';
import AppSidebar from './components/layout/AppSidebar';
import Login from './pages/Login';
import PlaylistSelect from './pages/PlaylistSelect';
import ResellerDashboard from './pages/ResellerDashboard';
import CreateUserWizard from './pages/CreateUserWizard';
import ResellerBulkEditor from './pages/ResellerBulkEditor';
import EditProviders from './pages/EditProviders';
import WelcomeInfoWizard from './pages/WelcomeInfoWizard';
import TeamManagement from './pages/TeamManagement';
import ApiTokens from './pages/ApiTokens';
import SettingsDashboard from './pages/SettingsDashboard';
import SecurityManagement from './pages/SecurityManagement';
import UserPortal from './pages/UserPortal';
import PlaylistPortalBranding from './pages/PlaylistPortalBranding';
import InitialSetup from './pages/InitialSetup';
import BackupReminderManager from './components/BackupReminderManager';
import LicenseSuspendedBanner from './components/LicenseSuspendedBanner';
import { getToken, getAdmin, setToken, setAdmin, removeToken, authApi, playlistApi, userApi, setupApi, settingsApi } from './api/client';
import { Loader2 } from 'lucide-react';

function PlaylistRouteWrapper({ playlists, currentPlaylist, setCurrentPlaylist, children }) {
  const { listId } = useParams();
  const navigate = useNavigate();

  const matched = (playlists && playlists.length > 0)
    ? playlists.find((p) => String(p.id) === String(listId))
    : null;

  React.useEffect(() => {
    if (matched && (!currentPlaylist || String(currentPlaylist.id) !== String(matched.id))) {
      setCurrentPlaylist(matched);
      sessionStorage.setItem('playlistlabs_selected_playlist_id', matched.id);
    }
  }, [matched, currentPlaylist, setCurrentPlaylist]);

  // If playlists are not yet loaded, show loading spinner
  if (!playlists || playlists.length === 0) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-7 h-7 text-[#3970e1] animate-spin" />
        <span className="text-xs text-[#8898aa] dark:text-slate-400">Loading playlist...</span>
      </div>
    );
  }

  if (!matched) {
    return (
      <div className="max-w-md mx-auto my-16 p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-center space-y-3 shadow-sm">
        <h3 className="text-sm font-bold text-slate-800 dark:text-white">Playlist Not Found</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Playlist ID <code className="font-mono font-bold text-[#3970e1]">{listId}</code> was not found or is no longer available.
        </p>
        <button
          type="button"
          onClick={() => navigate('/playlists')}
          className="px-4 py-2 bg-[#3970e1] hover:bg-[#2c5ec2] text-white rounded-lg text-xs font-semibold transition"
        >
          Back to Playlists
        </button>
      </div>
    );
  }

  if (typeof children === 'function') {
    return children(matched);
  }
  if (children) {
    return children;
  }
  return <Outlet context={{ playlist: matched }} />;
}

function WizardRouteWrapper({ Component, playlists, admin, defaultTab, onPlaylistsRefreshed }) {
  const context = useOutletContext();
  const playlist = context?.playlist;
  const navigate = useNavigate();

  return (
    <Component
      currentPlaylist={playlist}
      playlists={playlists}
      admin={admin}
      defaultTab={defaultTab}
      onCancel={() => navigate(playlist ? `/users/${playlist.id}` : '/playlists')}
      onComplete={() => {
        onPlaylistsRefreshed?.();
        if (playlist) navigate(`/users/${playlist.id}`);
      }}
      onUserCreated={() => {
        onPlaylistsRefreshed?.();
        if (playlist) navigate(`/users/${playlist.id}`);
      }}
      onUsersUpdated={onPlaylistsRefreshed}
      onProvidersUpdated={onPlaylistsRefreshed}
      onBrandingUpdated={onPlaylistsRefreshed}
    />
  );
}

function ResellerDashboardLayout({
  playlists,
  userCount,
  setUserCount,
  setFilterStats,
  admin,
  fetchPlaylists,
  handleExportCsv,
  userSearch,
  setUserSearch,
  patternParam1,
  setPatternParam1,
  patternParam2,
  setPatternParam2,
  patternType,
  setPatternType,
  expiryPreset,
  setExpiryPreset,
  expiryBeforeDate,
  setExpiryBeforeDate,
}) {
  const context = useOutletContext();
  const playlist = context?.playlist;
  const navigate = useNavigate();

  if (!playlist) return null;

  return (
    <>
      <ResellerDashboard
        currentPlaylist={playlist}
        playlists={playlists}
        onOpenWizard={() => navigate(`/users/${playlist.id}/new-user`)}
        onExportCsv={handleExportCsv}
        onUserCountChange={setUserCount}
        onFilterStatsChange={setFilterStats}
        admin={admin}
        onRefreshPlaylists={fetchPlaylists}
        search={userSearch}
        onSearchChange={setUserSearch}
        patternParam1={patternParam1}
        onPatternParam1Change={setPatternParam1}
        patternParam2={patternParam2}
        onPatternParam2Change={setPatternParam2}
        patternType={patternType}
        onPatternTypeChange={setPatternType}
        expiryPreset={expiryPreset}
        onExpiryPresetChange={setExpiryPreset}
        expiryBeforeDate={expiryBeforeDate}
        onExpiryBeforeDateChange={setExpiryBeforeDate}
      />
      <Outlet />
    </>
  );
}

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();

  const [admin, setAdminState] = React.useState(() => getAdmin());
  const [isAuthenticated, setIsAuthenticated] = React.useState(() => !!getToken());
  const [checkingAuth, setCheckingAuth] = React.useState(true);
  const [isSetupNeeded, setIsSetupNeeded] = React.useState(false);

  const [playlists, setPlaylists] = React.useState([]);
  const [currentPlaylist, setCurrentPlaylist] = React.useState(null);
  const [userCount, setUserCount] = React.useState(0);
  const [userSearch, setUserSearch] = React.useState('');
  const [patternParam1, setPatternParam1] = React.useState('');
  const [patternParam2, setPatternParam2] = React.useState('');
  const [patternType, setPatternType] = React.useState('');
  const [expiryPreset, setExpiryPreset] = React.useState('all');
  const [expiryBeforeDate, setExpiryBeforeDate] = React.useState('');
  const [filterStats, setFilterStats] = React.useState({ onlineCount: 0, availablePatternTypes: [] });
  const [licenseInfo, setLicenseInfo] = React.useState(null);

  const handleResetUserFilters = React.useCallback(() => {
    setUserSearch('');
    setPatternParam1('');
    setPatternParam2('');
    setPatternType('');
    setExpiryPreset('all');
    setExpiryBeforeDate('');
  }, []);

  // Sidebar Layout State (persist pinned state in localStorage)
  const [isSidebarPinned, setIsSidebarPinned] = React.useState(() => {
    return localStorage.getItem('sidebar_pinned') !== 'false';
  });
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = React.useState(false);

  const toggleSidebarPin = () => {
    setIsSidebarPinned((prev) => {
      const next = !prev;
      localStorage.setItem('sidebar_pinned', String(next));
      return next;
    });
  };

  const prevPathnameRef = React.useRef(location.pathname);
  React.useEffect(() => {
    const prev = prevPathnameRef.current;
    const curr = location.pathname;
    prevPathnameRef.current = curr;

    // Do not scroll to top when opening/closing modals or drawers within the same playlist users view
    const isSamePlaylistUsers = () => {
      const prevMatch = prev.match(/^\/users\/([^/]+)/);
      const currMatch = curr.match(/^\/users\/([^/]+)/);
      if (!prevMatch || !currMatch || prevMatch[1] !== currMatch[1]) return false;

      const fullPageSubroutes = ['new-user', 'bulk-categories', 'edit-providers', 'welcome-info', 'portal-branding'];
      const prevSub = prev.split('/')[3];
      const currSub = curr.split('/')[3];
      const isPrevFullPage = fullPageSubroutes.includes(prevSub);
      const isCurrFullPage = fullPageSubroutes.includes(currSub);

      return !isPrevFullPage && !isCurrFullPage;
    };

    if (!isSamePlaylistUsers()) {
      window.scrollTo(0, 0);
    }
  }, [location.pathname]);

  // Verify auth on mount
  React.useEffect(() => {
    const verify = async () => {
      // 1. First check if system requires initial onboarding setup
      try {
        const status = await setupApi.getStatus();
        if (status?.is_setup_needed) {
          setIsSetupNeeded(true);
          setCheckingAuth(false);
          return;
        }
      } catch (err) {
        console.warn('Initial setup status check error:', err);
      }

      const token = getToken();
      if (!token) {
        setIsAuthenticated(false);
        setCheckingAuth(false);
        return;
      }

      try {
        const user = await authApi.me();
        if (user?.token) {
          setToken(user.token);
        }
        setAdmin(user);
        setAdminState(user);
        if (user?.license_suspended !== undefined) {
          setLicenseInfo({
            license_suspended: Boolean(user.license_suspended),
            license_suspended_at: user.license_suspended_at || null,
            license_upgrade_url: user.license_upgrade_url || '',
          });
        }
        setIsAuthenticated(true);
      } catch (err) {
        console.error('Session verification failed:', err);
        removeToken();
        setIsAuthenticated(false);
      } finally {
        setCheckingAuth(false);
      }
    };
    verify();
  }, []);

  // Fetch license status from settings
  const fetchLicenseStatus = React.useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const res = await settingsApi.getSettings();
      if (res?.settings) {
        setLicenseInfo({
          license_suspended: Boolean(res.settings.license_suspended),
          license_suspended_at: res.settings.license_suspended_at || null,
          license_upgrade_url: res.settings.license_upgrade_url || '',
        });
      }
    } catch {
      // Ignore if user lacks settings access or network issue
    }
  }, [isAuthenticated]);

  React.useEffect(() => {
    fetchLicenseStatus();
  }, [fetchLicenseStatus]);

  // Fetch playlists once authenticated
  const fetchPlaylists = React.useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const data = await playlistApi.getPlaylists();
      const list = data || [];
      setPlaylists(list);

      // Restore playlist matching URL listId, or last selected, or first in list
      const urlMatch = window.location.pathname.match(/^\/users\/([^/]+)/);
      const urlId = urlMatch ? urlMatch[1] : null;
      const savedId = sessionStorage.getItem('playlistlabs_selected_playlist_id');

      setCurrentPlaylist((prev) => {
        if (urlId && list.length > 0) {
          const found = list.find((p) => String(p.id) === String(urlId));
          if (found) {
            sessionStorage.setItem('playlistlabs_selected_playlist_id', found.id);
            return found;
          }
        }
        if (prev && list.length > 0) {
          const found = list.find((p) => String(p.id) === String(prev.id));
          if (found) return found;
        }
        if (savedId && list.length > 0) {
          const found = list.find((p) => String(p.id) === String(savedId));
          if (found) return found;
        }
        if (!prev && list.length > 0) {
          sessionStorage.setItem('playlistlabs_selected_playlist_id', list[0].id);
          return list[0];
        }
        return prev;
      });
    } catch (err) {
      console.error('Failed fetching playlists:', err);
    }
  }, [isAuthenticated]);

  React.useEffect(() => {
    fetchPlaylists();
  }, [fetchPlaylists]);

  // Re-fetch playlists and license status when settings are updated
  React.useEffect(() => {
    const handleSettingsUpdated = () => {
      fetchPlaylists();
      fetchLicenseStatus();
    };
    window.addEventListener('settings-updated', handleSettingsUpdated);
    return () => {
      window.removeEventListener('settings-updated', handleSettingsUpdated);
    };
  }, [fetchPlaylists, fetchLicenseStatus]);

  const handleLoginSuccess = (adminUser) => {
    setAdminState(adminUser);
    if (adminUser?.license_suspended !== undefined) {
      setLicenseInfo({
        license_suspended: Boolean(adminUser.license_suspended),
        license_suspended_at: adminUser.license_suspended_at || null,
        license_upgrade_url: adminUser.license_upgrade_url || '',
      });
    }
    setIsAuthenticated(true);
    const savedId = sessionStorage.getItem('playlistlabs_selected_playlist_id');
    if (savedId) {
      navigate(`/users/${savedId}`);
    } else {
      navigate('/playlists');
    }
  };

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch {}
    removeToken();
    sessionStorage.removeItem('playlistlabs_selected_playlist_id');
    setIsAuthenticated(false);
    setAdminState(null);
    setCurrentPlaylist(null);
    setLicenseInfo(null);
    navigate('/playlists');
  };

  const handleSelectPlaylist = (playlist) => {
    setCurrentPlaylist(playlist);
    sessionStorage.setItem('playlistlabs_selected_playlist_id', playlist.id);
    handleResetUserFilters();
    window.scrollTo(0, 0);
    navigate(`/users/${playlist.id}`);
  };

  // Export CSV functionality
  const handleExportCsv = async () => {
    if (!currentPlaylist) return;
    try {
      const users = await userApi.getUsers(currentPlaylist.id);
      if (!users || users.length === 0) {
        alert('No users to export');
        return;
      }

      const headers = ['ID', 'Name', 'Username', 'Password', 'M3U Token', 'EPG Token', 'Expiration', 'Max Connections', 'Created At'];
      const rows = users.map((u) => [
        u.id,
        `"${(u.name || '').replace(/"/g, '""')}"`,
        `"${u.username || ''}"`,
        `"${u.password || ''}"`,
        `"${u.m3u || ''}"`,
        `"${u.epg || ''}"`,
        `"${u.expiry || ''}"`,
        u.max_connections || 1,
        `"${u.createdAt || ''}"`,
      ]);

      const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `managed_users_${currentPlaylist.name.replace(/[^a-zA-Z0-9]/g, '_')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch {
      alert('Error exporting CSV file');
    }
  };

  const handleSetupComplete = (adminUser) => {
    setIsSetupNeeded(false);
    setAdminState(adminUser);
    setIsAuthenticated(true);
    navigate('/playlists');
  };

  if (location.pathname === '/portal' || location.pathname.startsWith('/portal/')) {
    return <UserPortal />;
  }

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-[#f8f9fe] dark:bg-[#0f172a] flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-6 h-6 text-[#3970e1] animate-spin" />
        <span className="text-xs text-[#8898aa] dark:text-slate-400">Verifying session...</span>
      </div>
    );
  }

  if (isSetupNeeded) {
    return <InitialSetup onSetupComplete={handleSetupComplete} />;
  }

  if (!isAuthenticated) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-[#f8f9fe] dark:bg-[#0f172a] text-[#525f7f] dark:text-slate-300 flex antialiased font-sans transition-colors duration-200">
      <AppSidebar
        currentPlaylist={currentPlaylist}
        playlists={playlists}
        onSelectPlaylist={handleSelectPlaylist}
        userCount={userCount}
        admin={admin}
        isPinned={isSidebarPinned}
        onTogglePin={toggleSidebarPin}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        onLogout={handleLogout}
        onPlaylistsRefreshed={fetchPlaylists}
      />

      <div className="flex-1 min-w-0 flex flex-col min-h-screen">
        <Navbar
          currentPlaylist={currentPlaylist}
          userCount={userCount}
          onNewUser={() => navigate(currentPlaylist ? `/users/${currentPlaylist.id}/new-user` : '/playlists')}
          onExportCsv={handleExportCsv}
          admin={admin}
          onLogout={handleLogout}
          onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
          searchQuery={userSearch}
          onSearchChange={setUserSearch}
          patternParam1={patternParam1}
          onPatternParam1Change={setPatternParam1}
          patternParam2={patternParam2}
          onPatternParam2Change={setPatternParam2}
          patternType={patternType}
          onPatternTypeChange={setPatternType}
          availablePatternTypes={filterStats.availablePatternTypes}
          expiryPreset={expiryPreset}
          onExpiryPresetChange={setExpiryPreset}
          expiryBeforeDate={expiryBeforeDate}
          onExpiryBeforeDateChange={setExpiryBeforeDate}
          onlineCount={filterStats.onlineCount}
          onResetFilters={handleResetUserFilters}
        />

        <LicenseSuspendedBanner
          admin={admin}
          licenseInfo={licenseInfo}
          onRefresh={fetchLicenseStatus}
        />

        <BackupReminderManager admin={admin} />

      <main className="flex-1">
        {(() => {
          const defaultUsersPath = currentPlaylist
            ? `/users/${currentPlaylist.id}`
            : (playlists.length > 0 ? `/users/${playlists[0].id}` : '/playlists');

          return (
            <Routes>
              <Route path="/" element={<Navigate to={defaultUsersPath} replace />} />
              <Route
                path="/playlists"
                element={
                  <PlaylistSelect 
                    onSelectPlaylist={handleSelectPlaylist}
                    admin={admin}
                    onPlaylistsRefreshed={fetchPlaylists}
                    currentPlaylist={currentPlaylist}
                  />
                }
              />

              {/* Playlist-scoped routes */}
              <Route
                path="/users/:listId"
                element={
                  <PlaylistRouteWrapper
                    playlists={playlists}
                    currentPlaylist={currentPlaylist}
                    setCurrentPlaylist={setCurrentPlaylist}
                  />
                }
              >
                {/* Full-page wizard routes */}
                <Route
                  path="new-user"
                  element={
                    <WizardRouteWrapper
                      Component={CreateUserWizard}
                      playlists={playlists}
                      onPlaylistsRefreshed={fetchPlaylists}
                    />
                  }
                />
                <Route
                  path="bulk-categories"
                  element={
                    <WizardRouteWrapper
                      Component={ResellerBulkEditor}
                      playlists={playlists}
                      onPlaylistsRefreshed={fetchPlaylists}
                    />
                  }
                />
                <Route
                  path="edit-providers"
                  element={
                    <WizardRouteWrapper
                      Component={EditProviders}
                      playlists={playlists}
                      admin={admin}
                      onPlaylistsRefreshed={fetchPlaylists}
                    />
                  }
                />
                <Route
                  path="edit-provider"
                  element={<Navigate to="../edit-providers" replace />}
                />
                <Route
                  path="welcome-info"
                  element={
                    <WizardRouteWrapper
                      Component={WelcomeInfoWizard}
                      playlists={playlists}
                      onPlaylistsRefreshed={fetchPlaylists}
                    />
                  }
                />
                <Route
                  path="portal-branding"
                  element={
                    <WizardRouteWrapper
                      Component={PlaylistPortalBranding}
                      playlists={playlists}
                      defaultTab="playlist"
                      onPlaylistsRefreshed={fetchPlaylists}
                    />
                  }
                />

                {/* ResellerDashboard Layout - persists across index, user drawer, and modal routes */}
                <Route
                  element={
                    <ResellerDashboardLayout
                      playlists={playlists}
                      userCount={userCount}
                      setUserCount={setUserCount}
                      setFilterStats={setFilterStats}
                      admin={admin}
                      fetchPlaylists={fetchPlaylists}
                      handleExportCsv={handleExportCsv}
                      userSearch={userSearch}
                      setUserSearch={setUserSearch}
                      patternParam1={patternParam1}
                      setPatternParam1={setPatternParam1}
                      patternParam2={patternParam2}
                      setPatternParam2={setPatternParam2}
                      patternType={patternType}
                      setPatternType={setPatternType}
                      expiryPreset={expiryPreset}
                      setExpiryPreset={setExpiryPreset}
                      expiryBeforeDate={expiryBeforeDate}
                      setExpiryBeforeDate={setExpiryBeforeDate}
                    />
                  }
                >
                  <Route index element={null} />
                  <Route path="import-editor" element={null} />
                  <Route path="import" element={<Navigate to="../import-editor" replace />} />
                  <Route path="restore" element={null} />
                  <Route path="restore-users" element={<Navigate to="../restore" replace />} />
                  <Route path=":userId" element={null} />
                  <Route path=":userId/:userModal" element={null} />
                </Route>
              </Route>

              <Route
                path="/portal-branding"
                element={
                  <PlaylistPortalBranding
                    playlists={playlists}
                    currentPlaylist={currentPlaylist}
                    defaultTab="login"
                    onBrandingUpdated={fetchPlaylists}
                  />
                }
              />

              {/* Backward compatibility redirects for /dashboard and legacy /user-management */}
              <Route path="/info" element={<Navigate to={defaultUsersPath} replace />} />
              <Route path="/users" element={<Navigate to={defaultUsersPath} replace />} />
              <Route path="/dashboard" element={<Navigate to={defaultUsersPath} replace />} />
              <Route
                path="/dashboard/new-user"
                element={<Navigate to={currentPlaylist ? `/users/${currentPlaylist.id}/new-user` : defaultUsersPath} replace />}
              />
              <Route
                path="/dashboard/bulk-categories"
                element={<Navigate to={currentPlaylist ? `/users/${currentPlaylist.id}/bulk-categories` : defaultUsersPath} replace />}
              />
              <Route
                path="/dashboard/edit-providers"
                element={<Navigate to={currentPlaylist ? `/users/${currentPlaylist.id}/edit-providers` : defaultUsersPath} replace />}
              />
              <Route
                path="/dashboard/edit-provider"
                element={<Navigate to={currentPlaylist ? `/users/${currentPlaylist.id}/edit-providers` : defaultUsersPath} replace />}
              />
              <Route
                path="/dashboard/welcome-info"
                element={<Navigate to={currentPlaylist ? `/users/${currentPlaylist.id}/welcome-info` : defaultUsersPath} replace />}
              />

              <Route path="/user-management" element={<Navigate to={defaultUsersPath} replace />} />
              <Route
                path="/user-management/new-user"
                element={<Navigate to={currentPlaylist ? `/users/${currentPlaylist.id}/new-user` : defaultUsersPath} replace />}
              />
              <Route
                path="/user-management/bulk-categories"
                element={<Navigate to={currentPlaylist ? `/users/${currentPlaylist.id}/bulk-categories` : defaultUsersPath} replace />}
              />
              <Route
                path="/user-management/edit-providers"
                element={<Navigate to={currentPlaylist ? `/users/${currentPlaylist.id}/edit-providers` : defaultUsersPath} replace />}
              />
              <Route
                path="/user-management/welcome-info"
                element={<Navigate to={currentPlaylist ? `/users/${currentPlaylist.id}/welcome-info` : defaultUsersPath} replace />}
              />

              <Route
                path="/team"
                element={
                  (admin?.can_create_admins || admin?.can_create_collaborators) ? (
                    <TeamManagement playlists={playlists} currentAdmin={admin} />
                  ) : (
                    <Navigate to={defaultUsersPath} replace />
                  )
                }
              />
              <Route path="/collaborators" element={<Navigate to="/team" replace />} />
              <Route path="/subadmins" element={<Navigate to="/team" replace />} />
              <Route
                path="/tokens"
                element={
                  (admin?.role === 'admin' || admin?.can_manage_api_tokens) ? (
                    <ApiTokens currentAdmin={admin} />
                  ) : (
                    <Navigate to={defaultUsersPath} replace />
                  )
                }
              />
              <Route path="/api-tokens" element={<Navigate to="/tokens" replace />} />
              <Route
                path="/security"
                element={
                  admin?.role === 'admin' ? (
                    <SecurityManagement />
                  ) : (
                    <Navigate to={defaultUsersPath} replace />
                  )
                }
              />
              <Route
                path="/settings"
                element={
                  admin?.role === 'admin' ? (
                    <SettingsDashboard
                      playlists={playlists}
                      onPlaylistsRefreshed={fetchPlaylists}
                    />
                  ) : (
                    <Navigate to={defaultUsersPath} replace />
                  )
                }
              />
              <Route path="*" element={<Navigate to={defaultUsersPath} replace />} />
            </Routes>
          );
        })()}
      </main>
      </div>
    </div>
  );
}
