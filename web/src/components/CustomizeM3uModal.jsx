import React from 'react';
import { X, Copy, Check, Sliders, ExternalLink, Sparkles } from 'lucide-react';
import { getServerOrigin } from '../api/client';
import { resolveProtocolHost } from '../utils/streamingUrls';
import { Modal, Button, Alert } from './ui';

export default function CustomizeM3uModal({ user, playlist = null, onClose }) {
  const [excludeChannels, setExcludeChannels] = React.useState(false);
  const [excludeVods, setExcludeVods] = React.useState(false);
  const [excludeSeries, setExcludeSeries] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const origin = resolveProtocolHost({
    cname: playlist?.cname || user?.cname,
    cnameSSL: playlist?.cname_ssl || user?.cname_ssl,
  });
  const token = (user?.m3u || '').replace(/^\//, '');

  const customUrl = React.useMemo(() => {
    if (!token) return '';
    const params = new URLSearchParams();
    if (excludeChannels) params.set('channels', 'false');
    if (excludeVods) params.set('movies', 'false');
    if (excludeSeries) params.set('series', 'false');
    const qs = params.toString();
    const basePath = `${origin}/${token}/`;
    return qs ? `${basePath}?${qs}` : basePath;
  }, [origin, token, excludeChannels, excludeVods, excludeSeries]);

  const handleCopy = () => {
    if (!customUrl) return;
    navigator.clipboard.writeText(customUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const applyPreset = (preset) => {
    switch (preset) {
      case 'live_only':
        setExcludeChannels(false);
        setExcludeVods(true);
        setExcludeSeries(true);
        break;
      case 'vod_only':
        setExcludeChannels(true);
        setExcludeVods(false);
        setExcludeSeries(true);
        break;
      case 'series_only':
        setExcludeChannels(true);
        setExcludeVods(true);
        setExcludeSeries(false);
        break;
      case 'all':
      default:
        setExcludeChannels(false);
        setExcludeVods(false);
        setExcludeSeries(false);
        break;
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose} size="lg">
      <Modal.Header
        icon={<Sliders className="w-4 h-4" />}
        title="Customize M3U Link"
        subtitle={
          <div className="flex items-center gap-2 text-xs text-[#8898aa] dark:text-slate-400 mt-0.5">
            <span>User: <strong className="text-[#32325d] dark:text-slate-200">{user?.name || user?.username}</strong></span>
            {token && (
              <span className="font-mono text-[12px] text-[#3970e1] dark:text-blue-400 bg-[#eef2ff] dark:bg-blue-950/60 px-1.5 py-0.2 rounded border border-[#3970e1]/30 dark:border-blue-700/40">
                /{token}/
              </span>
            )}
          </div>
        }
        onClose={onClose}
      />

      <Modal.Body className="space-y-4">
            {/* Presets */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-[#525f7f] dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#3970e1] dark:text-blue-400" />
                  Quick Presets
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                <button
                  type="button"
                  onClick={() => applyPreset('all')}
                  className={`px-2.5 py-1.5 rounded text-xs font-medium border transition ${
                    !excludeChannels && !excludeVods && !excludeSeries
                      ? 'bg-[#3970e1] text-white border-[#3970e1]'
                      : 'bg-white dark:bg-slate-800 hover:bg-[#f6f9fc] dark:hover:bg-slate-700 text-[#525f7f] dark:text-slate-300 border-[#dee2e6] dark:border-slate-700'
                  }`}
                >
                  All Content
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('live_only')}
                  className={`px-2.5 py-1.5 rounded text-xs font-medium border transition ${
                    !excludeChannels && excludeVods && excludeSeries
                      ? 'bg-[#3970e1] text-white border-[#3970e1]'
                      : 'bg-white dark:bg-slate-800 hover:bg-[#f6f9fc] dark:hover:bg-slate-700 text-[#525f7f] dark:text-slate-300 border-[#dee2e6] dark:border-slate-700'
                  }`}
                >
                  Live Only
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('vod_only')}
                  className={`px-2.5 py-1.5 rounded text-xs font-medium border transition ${
                    excludeChannels && !excludeVods && excludeSeries
                      ? 'bg-[#3970e1] text-white border-[#3970e1]'
                      : 'bg-white dark:bg-slate-800 hover:bg-[#f6f9fc] dark:hover:bg-slate-700 text-[#525f7f] dark:text-slate-300 border-[#dee2e6] dark:border-slate-700'
                  }`}
                >
                  Movies Only
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('series_only')}
                  className={`px-2.5 py-1.5 rounded text-xs font-medium border transition ${
                    excludeChannels && excludeVods && !excludeSeries
                      ? 'bg-[#3970e1] text-white border-[#3970e1]'
                      : 'bg-white dark:bg-slate-800 hover:bg-[#f6f9fc] dark:hover:bg-slate-700 text-[#525f7f] dark:text-slate-300 border-[#dee2e6] dark:border-slate-700'
                  }`}
                >
                  Series Only
                </button>
              </div>
            </div>

            {/* Checkboxes */}
            <div className="space-y-2.5 bg-[#f8f9fe] dark:bg-slate-800/60 border border-[#dee2e6] dark:border-slate-800 rounded-lg p-3.5">
              <span className="text-[12px] font-bold text-[#8898aa] dark:text-slate-400 uppercase tracking-wider block mb-1">
                Filter Stream Types (Exclusions)
              </span>
              <label className="flex items-center gap-2.5 cursor-pointer text-xs font-semibold text-[#525f7f] dark:text-slate-300 hover:text-[#32325d] dark:hover:text-white transition select-none">
                <input
                  type="checkbox"
                  checked={excludeChannels}
                  onChange={(e) => setExcludeChannels(e.target.checked)}
                  className="rounded border-[#dee2e6] dark:border-slate-600 dark:bg-slate-700 text-[#3970e1] focus:ring-0 cursor-pointer"
                />
                <span>Exclude Live Channels <span className="font-mono text-[12px] text-[#8898aa] dark:text-slate-400 font-normal">(channels=false)</span></span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer text-xs font-semibold text-[#525f7f] dark:text-slate-300 hover:text-[#32325d] dark:hover:text-white transition select-none">
                <input
                  type="checkbox"
                  checked={excludeVods}
                  onChange={(e) => setExcludeVods(e.target.checked)}
                  className="rounded border-[#dee2e6] dark:border-slate-600 dark:bg-slate-700 text-[#3970e1] focus:ring-0 cursor-pointer"
                />
                <span>Exclude Movies / VOD <span className="font-mono text-[12px] text-[#8898aa] dark:text-slate-400 font-normal">(movies=false)</span></span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer text-xs font-semibold text-[#525f7f] dark:text-slate-300 hover:text-[#32325d] dark:hover:text-white transition select-none">
                <input
                  type="checkbox"
                  checked={excludeSeries}
                  onChange={(e) => setExcludeSeries(e.target.checked)}
                  className="rounded border-[#dee2e6] dark:border-slate-600 dark:bg-slate-700 text-[#3970e1] focus:ring-0 cursor-pointer"
                />
                <span>Exclude TV Series <span className="font-mono text-[12px] text-[#8898aa] dark:text-slate-400 font-normal">(series=false)</span></span>
              </label>
            </div>

            {/* Generated Short URL */}
            <div>
              <label className="block text-xs font-bold text-[#525f7f] dark:text-slate-300 uppercase tracking-wider mb-1">
                Short M3U URL
              </label>
              {token ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={customUrl}
                    className="flex-1 px-3 py-2 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded text-xs font-mono text-[#32325d] dark:text-slate-200 focus:outline-none shadow-sm"
                  />
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="px-3 py-2 bg-white dark:bg-slate-800 hover:bg-[#f6f9fc] dark:hover:bg-slate-700 text-[#525f7f] dark:text-slate-300 border border-[#dee2e6] dark:border-slate-700 rounded text-xs font-semibold flex items-center gap-1.5 transition active:scale-[0.98] shadow-sm shrink-0"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-[#2dce89]" /> : <Copy className="w-3.5 h-3.5 text-[#8898aa] dark:text-slate-400" />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                  <a
                    href={customUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 bg-white dark:bg-slate-800 hover:bg-[#f6f9fc] dark:hover:bg-slate-700 text-[#525f7f] dark:text-slate-300 hover:text-[#3970e1] dark:hover:text-blue-400 border border-[#dee2e6] dark:border-slate-700 rounded text-xs transition shadow-sm shrink-0 flex items-center justify-center"
                    title="Open / Download M3U playlist in new tab"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              ) : (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded text-xs text-amber-800 dark:text-amber-300">
                  No short M3U token assigned to this user.
                </div>
              )}
            </div>

      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
