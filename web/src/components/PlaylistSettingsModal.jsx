import React, { useState, useEffect } from 'react';
import {
  Settings,
  Activity,
  ShieldCheck,
  Globe,
  Lock,
  Clock,
  ExternalLink,
} from 'lucide-react';
import { playlistApi } from '../api/client';
import { Modal, Button, Alert } from './ui';

export default function PlaylistSettingsModal({
  isOpen,
  playlist,
  onClose,
  onSaved,
}) {
  const [settingsForm, setSettingsForm] = useState({
    allow_tracking: false,
    limit_max_connections: false,
    max_connections: 1,
    cname: '',
    enforce_cname: false,
    cname_ssl: false,
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState(false);
  const [settingsError, setSettingsError] = useState('');

  useEffect(() => {
    if (playlist) {
      const rawCname = playlist.cname || '';
      const cleanCname = rawCname
        .split(/[\s,;]+/)
        .map((s) => s.replace(/^https?:\/\//i, '').replace(/\/+$/, '').trim())
        .filter(Boolean)
        .join(', ');

      setSettingsForm({
        allow_tracking: Boolean(playlist.allow_tracking),
        limit_max_connections: Boolean(playlist.limit_max_connections),
        max_connections: playlist.max_connections || 1,
        cname: cleanCname,
        enforce_cname: Boolean(playlist.enforce_cname),
        cname_ssl: Boolean(playlist.cname_ssl),
      });
      setSettingsSuccess(false);
      setSettingsError('');
    }
  }, [playlist, isOpen]);

  if (!isOpen || !playlist) return null;

  const handleSavePlaylistSettings = async (e) => {
    e?.preventDefault();
    setSavingSettings(true);
    setSettingsError('');
    try {
      const cleanCname = (settingsForm.cname || '')
        .split(/[\s,;]+/)
        .map((s) => s.replace(/^https?:\/\//i, '').replace(/\/+$/, '').trim())
        .filter(Boolean)
        .join(', ');

      const updated = await playlistApi.updatePlaylistSettings(playlist.id, {
        allow_tracking: settingsForm.allow_tracking,
        limit_max_connections: settingsForm.limit_max_connections,
        max_connections: parseInt(settingsForm.max_connections, 10) || 1,
        cname: cleanCname,
        enforce_cname: settingsForm.enforce_cname,
        cname_ssl: settingsForm.cname_ssl,
      });

      const fullUpdated = {
        ...playlist,
        ...updated,
        cname: cleanCname,
        enforce_cname: settingsForm.enforce_cname,
        cname_ssl: settingsForm.cname_ssl,
      };

      setSettingsSuccess(true);
      try {
        window.dispatchEvent(new CustomEvent('settings-updated'));
      } catch { }
      onSaved?.(fullUpdated);
      setTimeout(() => {
        setSettingsSuccess(false);
        onClose?.();
      }, 700);
    } catch (err) {
      setSettingsError(err.message || 'Failed updating playlist settings');
    } finally {
      setSavingSettings(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (!savingSettings) {
          onClose?.();
        }
      }}
      size="lg"
    >
      <Modal.Header
        icon={<Settings className="w-5 h-5" />}
        title="Playlist Settings"
        subtitle={`${playlist.name} (ID: ${playlist.id})`}
        onClose={() => {
          if (!savingSettings) {
            onClose?.();
          }
        }}
      />

      <form onSubmit={handleSavePlaylistSettings}>
        <Modal.Body className="space-y-4">
          {/* Toggle 1: allow_tracking */}
          <div className="flex items-start justify-between gap-4 p-3.5 bg-white dark:bg-slate-800/80 border border-[#dee2e6] dark:border-slate-700 rounded-lg hover:border-[#3970e1]/40 transition">
            <div className="space-y-1">
              <label htmlFor="modal_allow_tracking" className="text-xs font-bold text-[#32325d] dark:text-white cursor-pointer flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-[#2dce89]" />
                <span>Real-time Connection Tracking</span>
              </label>
              <p className="text-[13px] text-[#8898aa] dark:text-slate-400 leading-relaxed">
                Tracks client IP, player User-Agent, active stream and timestamps. Enables LIVE monitoring and online status in the dashboard.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer flex-shrink-0 mt-0.5">
              <input
                type="checkbox"
                id="modal_allow_tracking"
                className="sr-only peer"
                checked={settingsForm.allow_tracking}
                onChange={(e) => setSettingsForm({ ...settingsForm, allow_tracking: e.target.checked })}
              />
              <div className="w-10 h-5 bg-[#dee2e6] dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-5 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#2dce89]"></div>
            </label>
          </div>

          {/* Toggle 2: limit_max_connections */}
          <div className="flex items-start justify-between gap-4 p-3.5 bg-white dark:bg-slate-800/80 border border-[#dee2e6] dark:border-slate-700 rounded-lg hover:border-[#3970e1]/40 transition">
            <div className="space-y-1">
              <label htmlFor="modal_limit_max_connections" className="text-xs font-bold text-[#32325d] dark:text-white cursor-pointer flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-[#5e72e4]" />
                <span>Enforce Max Connections</span>
              </label>
              <p className="text-[13px] text-[#8898aa] dark:text-slate-400 leading-relaxed">
                Enforces concurrent device limit on stream redirects. Returns HTTP 403 Forbidden when limit is reached. Channel zapping on the same device is permitted.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer flex-shrink-0 mt-0.5">
              <input
                type="checkbox"
                id="modal_limit_max_connections"
                className="sr-only peer"
                checked={settingsForm.limit_max_connections}
                onChange={(e) => setSettingsForm({ ...settingsForm, limit_max_connections: e.target.checked })}
              />
              <div className="w-10 h-5 bg-[#dee2e6] dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-5 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#5e72e4]"></div>
            </label>
          </div>

          {/* Input: Custom CNAME Domain */}
          <div className="p-3.5 bg-white dark:bg-slate-800/80 border border-[#dee2e6] dark:border-slate-700 rounded-lg space-y-2 hover:border-[#3970e1]/40 transition">
            <div className="space-y-1">
              <label htmlFor="modal_cname" className="text-xs font-bold text-[#32325d] dark:text-white flex items-center gap-1.5 cursor-pointer">
                <Globe className="w-3.5 h-3.5 text-[#11cdef]" />
                <span>Custom CNAME Domain(s)</span>
              </label>
              <p className="text-[13px] text-[#8898aa] dark:text-slate-400 leading-relaxed">
                Custom domain(s) for this playlist separated by commas (e.g. <code>domainA.com, domainB.com:8000</code>). Non-standard ports (such as <code>:8000</code>) are supported; if omitted, links automatically adapt to the server's port. The first domain is used as the primary for link generation.
              </p>
            </div>
            <input
              type="text"
              id="modal_cname"
              placeholder="e.g. domainA.com, domainB.com:8000"
              value={settingsForm.cname}
              onChange={(e) => {
                const clean = e.target.value.replace(/^https?:\/\//i, '');
                setSettingsForm({ ...settingsForm, cname: clean });
              }}
              className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded-lg text-xs font-mono text-[#495057] dark:text-slate-100 focus:outline-none focus:border-[#3970e1]"
            />
          </div>

          {/* Toggle: Enable SSL (HTTPS) */}
          <div className="flex items-start justify-between gap-4 p-3.5 bg-white dark:bg-slate-800/80 border border-[#dee2e6] dark:border-slate-700 rounded-lg hover:border-[#3970e1]/40 transition">
            <div className="space-y-1">
              <label htmlFor="modal_cname_ssl" className="text-xs font-bold text-[#32325d] dark:text-white cursor-pointer flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-[#2dce89]" />
                <span>Enable SSL (HTTPS)</span>
              </label>
              <p className="text-[13px] text-[#8898aa] dark:text-slate-400 leading-relaxed">
                Automatically provision Let’s Encrypt SSL certificates for these domains and serve streaming links over HTTPS.
              </p>
              <div className="p-2 bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded text-[11px] text-amber-800 dark:text-amber-300">
                <strong>Compatibility:</strong> STB (MAG) and Web Player remain HTTP by default for maximum device compatibility. Enabling this switches links to HTTPS. Ensure DNS records point to this server before enabling to avoid Let's Encrypt rate limits.
              </div>
              <div className="flex items-center gap-1.5 pt-1 text-[11px] text-[#525f7f] dark:text-slate-400">
                <ExternalLink className="w-3.5 h-3.5 text-[#3970e1] shrink-0" />
                <span>
                  Manage automatic SSL certificate issuance in {' '}
                  <a
                    href="/settings?tab=security"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-bold text-[#3970e1] hover:underline"
                  >
                    Settings &gt; Security
                  </a>
                </span>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer flex-shrink-0 mt-0.5">
              <input
                type="checkbox"
                id="modal_cname_ssl"
                className="sr-only peer"
                checked={settingsForm.cname_ssl}
                onChange={(e) => setSettingsForm({ ...settingsForm, cname_ssl: e.target.checked })}
              />
              <div className="w-10 h-5 bg-[#dee2e6] dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-5 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#2dce89]"></div>
            </label>
          </div>

          {/* Toggle: Enforce CNAME Domain */}
          <div className="flex items-start justify-between gap-4 p-3.5 bg-white dark:bg-slate-800/80 border border-[#dee2e6] dark:border-slate-700 rounded-lg hover:border-[#3970e1]/40 transition">
            <div className="space-y-1">
              <label htmlFor="modal_enforce_cname" className="text-xs font-bold text-[#32325d] dark:text-white cursor-pointer flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-[#f5365c]" />
                <span>Enforce CNAME Domain</span>
              </label>
              <p className="text-[13px] text-[#8898aa] dark:text-slate-400 leading-relaxed">
                Strictly restrict access to this playlist’s CNAME domain. Users of this playlist cannot connect via other domains or direct server IPs, and users from other playlists cannot log in through this domain.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer flex-shrink-0 mt-0.5">
              <input
                type="checkbox"
                id="modal_enforce_cname"
                className="sr-only peer"
                checked={settingsForm.enforce_cname}
                onChange={(e) => setSettingsForm({ ...settingsForm, enforce_cname: e.target.checked })}
              />
              <div className="w-10 h-5 bg-[#dee2e6] dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-5 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#f5365c]"></div>
            </label>
          </div>

          {/* Input: max_connections */}
          <div className="p-3.5 bg-[#f8f9fe] dark:bg-slate-800/60 border border-[#dee2e6] dark:border-slate-700 rounded-lg space-y-1.5">
            <label className="text-xs font-semibold text-[#32325d] dark:text-white flex items-center justify-between">
              <span>Default Max Connections:</span>
              <span className="text-[#3970e1] dark:text-blue-400 font-mono font-bold">{settingsForm.max_connections} device(s)</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                max="100"
                value={settingsForm.max_connections}
                onChange={(e) => setSettingsForm({ ...settingsForm, max_connections: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                className="w-24 px-3 py-1.5 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded-lg text-xs font-mono text-[#495057] dark:text-slate-100 focus:outline-none focus:border-[#3970e1]"
              />
              <span className="text-[13px] text-[#8898aa] dark:text-slate-400">
                Allowed simultaneous devices if not overridden on individual user account.
              </span>
            </div>
          </div>

          {/* Note on global timeout */}
          <div className="flex items-center gap-2 px-3 py-2 bg-[#f8f9fe] dark:bg-slate-800/60 border border-[#e9ecef] dark:border-slate-800 rounded-lg text-[13px] text-[#525f7f] dark:text-slate-300">
            <Clock className="w-3.5 h-3.5 flex-shrink-0 text-[#11cdef]" />
            <span>Session inactivity timeout before sessions expire is managed globally in <strong>Settings</strong>.</span>
          </div>

          {settingsError && <Alert variant="error">{settingsError}</Alert>}
        </Modal.Body>

        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={savingSettings}
          >
            Cancel
          </Button>

          <Button
            type="submit"
            variant="primary"
            loading={savingSettings}
          >
            {settingsSuccess ? 'Saved!' : 'Save Settings'}
          </Button>
        </Modal.Footer>
      </form>
    </Modal>
  );
}
