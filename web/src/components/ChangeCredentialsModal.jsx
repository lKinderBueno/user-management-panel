import React from 'react';
import { X, Dices, Key, User, Radio, Tv, Check, AlertCircle, Loader2 } from 'lucide-react';
import { userApi } from '../api/client';
import { Modal, Button, Alert } from './ui';

const sanitizeToken = (val) => {
  let clean = String(val || '').trim();
  if (clean.includes('://')) {
    clean = clean.split('://')[1];
    const slashIdx = clean.indexOf('/');
    clean = slashIdx !== -1 ? clean.slice(slashIdx + 1) : '';
  }
  if (clean.includes('?')) {
    clean = clean.split('?')[0];
  }
  clean = clean.replace(/^\/+|\/+$/g, '');
  clean = clean.replace(/\.(m3u|xml|xml\.gz)$/i, '');
  return clean.trim();
};

export default function ChangeCredentialsModal({ user, onClose, onSaved, onSuccess }) {
  const [username, setUsername] = React.useState(user.username || '');
  const [password, setPassword] = React.useState(user.password || '');
  const [m3u, setM3u] = React.useState(user.m3u || '');
  const [epg, setEpg] = React.useState(user.epg || '');

  const [usernameStatus, setUsernameStatus] = React.useState({ checking: false, available: true, message: 'Current' });
  const [m3uStatus, setM3uStatus] = React.useState({ checking: false, available: true, message: 'Current' });
  const [epgStatus, setEpgStatus] = React.useState({ checking: false, available: true, message: 'Current' });
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');

  // Check username uniqueness on debounced change
  React.useEffect(() => {
    if (!username.trim()) {
      setUsernameStatus({ checking: false, available: false, message: 'Username is required' });
      return;
    }
    if (username === user.username) {
      setUsernameStatus({ checking: false, available: true, message: 'Current' });
      return;
    }

    setUsernameStatus({ checking: true, available: false, message: 'Checking...' });
    const timer = setTimeout(async () => {
      try {
        const res = await userApi.checkUsername(username, user.list_id, user.id);
        if (res.available) {
          setUsernameStatus({ checking: false, available: true, message: 'Available' });
        } else {
          setUsernameStatus({ checking: false, available: false, message: 'Already taken' });
        }
      } catch {
        setUsernameStatus({ checking: false, available: false, message: 'Verification error' });
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [username, user.username, user.list_id, user.id]);

  // Check Short M3U URL uniqueness on debounced change
  React.useEffect(() => {
    const clean = sanitizeToken(m3u);
    if (!clean) {
      setM3uStatus({ checking: false, available: false, message: 'Short M3U URL is required' });
      return;
    }
    const cleanSibling = sanitizeToken(epg);
    if (cleanSibling && clean === cleanSibling) {
      setM3uStatus({ checking: false, available: false, message: 'Cannot match Short EPG URL' });
      return;
    }
    if (clean === user.m3u) {
      setM3uStatus({ checking: false, available: true, message: 'Current' });
      return;
    }

    setM3uStatus({ checking: true, available: false, message: 'Checking...' });
    const timer = setTimeout(async () => {
      try {
        const res = await userApi.checkShortUrl(clean, 'm3u', user.list_id, user.id, cleanSibling);
        if (res.available) {
          setM3uStatus({ checking: false, available: true, message: res.message || 'Available' });
        } else {
          setM3uStatus({ checking: false, available: false, message: res.message || 'Already taken' });
        }
      } catch {
        setM3uStatus({ checking: false, available: false, message: 'Verification error' });
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [m3u, epg, user.list_id, user.id, user.m3u]);

  // Check Short EPG URL uniqueness on debounced change
  React.useEffect(() => {
    const clean = sanitizeToken(epg);
    if (!clean) {
      setEpgStatus({ checking: false, available: false, message: 'Short EPG URL is required' });
      return;
    }
    const cleanSibling = sanitizeToken(m3u);
    if (cleanSibling && clean === cleanSibling) {
      setEpgStatus({ checking: false, available: false, message: 'Cannot match Short M3U URL' });
      return;
    }
    if (clean === user.epg) {
      setEpgStatus({ checking: false, available: true, message: 'Current' });
      return;
    }

    setEpgStatus({ checking: true, available: false, message: 'Checking...' });
    const timer = setTimeout(async () => {
      try {
        const res = await userApi.checkShortUrl(clean, 'epg', user.list_id, user.id, cleanSibling);
        if (res.available) {
          setEpgStatus({ checking: false, available: true, message: res.message || 'Available' });
        } else {
          setEpgStatus({ checking: false, available: false, message: res.message || 'Already taken' });
        }
      } catch {
        setEpgStatus({ checking: false, available: false, message: 'Verification error' });
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [epg, m3u, user.list_id, user.id, user.epg]);

  const handleGenerate = async (type) => {
    try {
      const res = await userApi.generateRandom(type);
      if (type === 'username') setUsername(res.value);
      if (type === 'password') setPassword(res.value);
      if (type === 'm3u') setM3u(res.value);
      if (type === 'epg') setEpg(res.value);
    } catch {
      setError('Error generating random token');
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!usernameStatus.available || !m3uStatus.available || !epgStatus.available) return;
    if (usernameStatus.checking || m3uStatus.checking || epgStatus.checking) return;
    setSaving(true);
    setError('');

    try {
      const cleanM3u = sanitizeToken(m3u);
      const cleanEpg = sanitizeToken(epg);
      const updated = await userApi.updateCredentials(user.list_id, user.id, {
        username: username.trim(),
        password: password.trim(),
        m3u: cleanM3u,
        epg: cleanEpg,
      });
      if (onSaved) onSaved(updated);
      if (onSuccess) onSuccess(updated);
      onClose?.();
    } catch (err) {
      setError(err.message || 'Error saving credentials');
    } finally {
      setSaving(false);
    }
  };

  const isFormValid =
    username.trim().length >= 3 &&
    password.trim().length >= 3 &&
    sanitizeToken(m3u).length >= 3 &&
    sanitizeToken(epg).length >= 3 &&
    usernameStatus.available &&
    m3uStatus.available &&
    epgStatus.available &&
    !usernameStatus.checking &&
    !m3uStatus.checking &&
    !epgStatus.checking;

  return (
    <Modal isOpen={true} onClose={onClose} size="md">
      <Modal.Header
        icon={<Key className="w-4 h-4" />}
        title="Credentials & Tokens"
        subtitle={`User: ${user.name}`}
        onClose={onClose}
      />

      <form onSubmit={handleSave}>
        <Modal.Body className="space-y-4">
          {error && <Alert variant="error">{error}</Alert>}

          {/* Username */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-[#525f7f] dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-[#3970e1]" />
                <span>Username</span>
              </label>
              <div className="flex items-center gap-1 text-[13px] font-semibold">
                {usernameStatus.checking ? (
                  <span className="text-[#8898aa] dark:text-slate-400 flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> Checking...
                  </span>
                ) : usernameStatus.available ? (
                  <span className="text-[#2dce89] flex items-center gap-0.5">
                    <Check className="w-3 h-3" /> {usernameStatus.message}
                  </span>
                ) : (
                  <span className="text-[#f5365c] flex items-center gap-0.5">
                    <AlertCircle className="w-3 h-3" /> {usernameStatus.message}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="flex-1 px-3 py-2 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded text-xs font-mono text-[#32325d] dark:text-slate-100 focus:outline-none focus:border-[#3970e1] shadow-sm transition"
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

          {/* Password */}
          <div>
            <label className="block text-xs font-bold text-[#525f7f] dark:text-slate-300 uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-[#3970e1]" />
              <span>Password</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="flex-1 px-3 py-2 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded text-xs font-mono text-[#32325d] dark:text-slate-100 focus:outline-none focus:border-[#3970e1] shadow-sm transition"
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

          {/* Short M3U URL Token */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-[#525f7f] dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-[#3970e1]" />
                <span>Short M3U URL Token</span>
              </label>
              <div className="flex items-center gap-1 text-[13px] font-semibold">
                {m3uStatus.checking ? (
                  <span className="text-[#8898aa] dark:text-slate-400 flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> Checking...
                  </span>
                ) : m3uStatus.available ? (
                  <span className="text-[#2dce89] flex items-center gap-0.5">
                    <Check className="w-3 h-3" /> {m3uStatus.message}
                  </span>
                ) : (
                  <span className="text-[#f5365c] flex items-center gap-0.5" title={m3uStatus.message}>
                    <AlertCircle className="w-3 h-3" /> {m3uStatus.message}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                required
                value={m3u}
                onChange={(e) => setM3u(e.target.value)}
                placeholder="Token or full URL"
                className={`flex-1 px-3 py-2 bg-white dark:bg-slate-800 border rounded text-xs font-mono text-[#32325d] dark:text-slate-100 focus:outline-none focus:border-[#3970e1] shadow-sm transition ${!m3uStatus.available && !m3uStatus.checking
                  ? 'border-red-500'
                  : 'border-[#dee2e6] dark:border-slate-700'
                  }`}
              />
              <button
                type="button"
                onClick={() => handleGenerate('m3u')}
                className="p-2 bg-white dark:bg-slate-800 hover:bg-[#f6f9fc] dark:hover:bg-slate-700 text-[#525f7f] dark:text-slate-300 border border-[#dee2e6] dark:border-slate-700 rounded transition active:scale-[0.98] shadow-sm"
                title="Generate random Short M3U token"
              >
                <Dices className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Short EPG URL Token */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-[#525f7f] dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Tv className="w-3.5 h-3.5 text-[#3970e1]" />
                <span>Short EPG URL Token</span>
              </label>
              <div className="flex items-center gap-1 text-[13px] font-semibold">
                {epgStatus.checking ? (
                  <span className="text-[#8898aa] dark:text-slate-400 flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> Checking...
                  </span>
                ) : epgStatus.available ? (
                  <span className="text-[#2dce89] flex items-center gap-0.5">
                    <Check className="w-3 h-3" /> {epgStatus.message}
                  </span>
                ) : (
                  <span className="text-[#f5365c] flex items-center gap-0.5" title={epgStatus.message}>
                    <AlertCircle className="w-3 h-3" /> {epgStatus.message}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                required
                value={epg}
                onChange={(e) => setEpg(e.target.value)}
                placeholder="Token or full URL"
                className={`flex-1 px-3 py-2 bg-white dark:bg-slate-800 border rounded text-xs font-mono text-[#32325d] dark:text-slate-100 focus:outline-none focus:border-[#3970e1] shadow-sm transition ${!epgStatus.available && !epgStatus.checking
                  ? 'border-red-500'
                  : 'border-[#dee2e6] dark:border-slate-700'
                  }`}
              />
              <button
                type="button"
                onClick={() => handleGenerate('epg')}
                className="p-2 bg-white dark:bg-slate-800 hover:bg-[#f6f9fc] dark:hover:bg-slate-700 text-[#525f7f] dark:text-slate-300 border border-[#dee2e6] dark:border-slate-700 rounded transition active:scale-[0.98] shadow-sm"
                title="Generate random Short EPG token"
              >
                <Dices className="w-4 h-4" />
              </button>
            </div>
          </div>

        </Modal.Body>

        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="success"
            loading={saving}
            disabled={!isFormValid || saving}
          >
            Save
          </Button>
        </Modal.Footer>
      </form>
    </Modal>
  );
}
