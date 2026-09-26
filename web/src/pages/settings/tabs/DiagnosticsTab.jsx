import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Terminal,
  Download,
  RefreshCw,
  Copy,
  Check,
  Server,
  Cpu,
  Database,
  Loader2,
  AlertCircle,
  Clock,
  Layers,
  Search,
} from 'lucide-react';
import { diagnosticsApi } from '../../../api/client';
import { Button } from '../../../components/ui';

export default function DiagnosticsTab({ notify }) {
  const [systemInfo, setSystemInfo] = useState(null);
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [logs, setLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [logLimit, setLogLimit] = useState(100);
  const [searchFilter, setSearchFilter] = useState('');
  const [downloadingBundle, setDownloadingBundle] = useState(false);
  const [copied, setCopied] = useState(false);

  // Fetch System Information
  const loadSystemInfo = useCallback(async () => {
    try {
      setLoadingInfo(true);
      const data = await diagnosticsApi.getSystemInfo();
      setSystemInfo(data);
    } catch (err) {
      if (notify) notify(err.message || 'Failed to load system diagnostics', 'error');
    } finally {
      setLoadingInfo(false);
    }
  }, [notify]);

  // Fetch Runtime Logs
  const loadLogs = useCallback(async (limit = logLimit) => {
    try {
      setLoadingLogs(true);
      const data = await diagnosticsApi.getLogs(limit);
      setLogs(data?.logs || []);
    } catch (err) {
      if (notify) notify(err.message || 'Failed to fetch runtime logs', 'error');
    } finally {
      setLoadingLogs(false);
    }
  }, [logLimit, notify]);

  useEffect(() => {
    loadSystemInfo();
    loadLogs(logLimit);
  }, [loadSystemInfo, loadLogs, logLimit]);

  // Download Diagnostic Bundle
  const handleDownloadBundle = async () => {
    try {
      setDownloadingBundle(true);
      await diagnosticsApi.downloadBundle();
      if (notify) notify('Diagnostic bundle downloaded successfully!', 'success');
    } catch (err) {
      if (notify) notify(err.message || 'Failed to generate diagnostic bundle', 'error');
    } finally {
      setDownloadingBundle(false);
    }
  };

  // Copy Logs to Clipboard
  const handleCopyLogs = () => {
    if (!logs.length) return;
    const text = logs.join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    if (notify) notify('Logs copied to clipboard', 'info');
  };

  // Filter logs
  const filteredLogs = useMemo(() => {
    if (!searchFilter.trim()) return logs;
    const q = searchFilter.toLowerCase();
    return logs.filter((l) => l.toLowerCase().includes(q));
  }, [logs, searchFilter]);

  // Format uptime
  const formatUptime = (totalSeconds) => {
    if (!totalSeconds && totalSeconds !== 0) return 'N/A';
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
    if (minutes > 0) return `${minutes}m ${secs}s`;
    return `${secs}s`;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* ========================================================= */}
      {/* 1. HEADER & SYSTEM OVERVIEW                               */}
      {/* ========================================================= */}
      <div className="bg-white dark:bg-slate-900 border border-[#dee2e6] dark:border-slate-800 rounded-[0.375rem] p-5 space-y-5 shadow-argon dark:shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-[#e9ecef] dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-[0.375rem] bg-[#5e72e4]/10 dark:bg-indigo-950/60 border border-[#5e72e4]/20 dark:border-indigo-700/40 flex items-center justify-center text-[#5e72e4] dark:text-indigo-400">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm font-bold text-[#32325d] dark:text-white">System Diagnostics & Health</h2>
                {systemInfo?.log_level && (
                  <span className="text-[12px] px-2 py-0.5 rounded-[0.25rem] font-mono font-semibold bg-[#ebf2ff] dark:bg-blue-950/60 text-[#3970e1] dark:text-blue-400 border border-[#3970e1]/20 dark:border-blue-700/40 uppercase">
                    LOG_LEVEL: {systemInfo.log_level}
                  </span>
                )}
                <span className="text-[12px] px-2 py-0.5 rounded-[0.25rem] font-mono font-semibold bg-[#e8fbf8] dark:bg-emerald-950/60 text-[#2dce89] dark:text-emerald-400 border border-[#2dce89]/20 dark:border-emerald-800/40">
                  {systemInfo?.os || 'Linux'} / {systemInfo?.arch || 'amd64'}
                </span>
              </div>
              <p className="text-[13px] text-[#8898aa] dark:text-slate-400">
                Live host metrics, process memory, database pool status, and diagnostic health checks.
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={loadSystemInfo}
            disabled={loadingInfo}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingInfo ? 'animate-spin' : ''}`} />
            <span>Refresh Health</span>
          </Button>
        </div>

        {/* Live Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 bg-[#f8f9fe] dark:bg-slate-800/60 border border-[#e9ecef] dark:border-slate-800 rounded-[0.375rem]">
            <div className="flex items-center gap-1.5 text-[12px] uppercase tracking-wider text-[#8898aa] dark:text-slate-400 font-semibold">
              <Clock className="w-3.5 h-3.5 text-[#3970e1]" />
              <span>Process Uptime</span>
            </div>
            <div className="text-sm font-bold text-[#32325d] dark:text-white font-mono mt-1">
              {loadingInfo ? '...' : formatUptime(systemInfo?.uptime_seconds)}
            </div>
          </div>

          <div className="p-3 bg-[#f8f9fe] dark:bg-slate-800/60 border border-[#e9ecef] dark:border-slate-800 rounded-[0.375rem]">
            <div className="flex items-center gap-1.5 text-[12px] uppercase tracking-wider text-[#8898aa] dark:text-slate-400 font-semibold">
              <Cpu className="w-3.5 h-3.5 text-[#2dce89]" />
              <span>CPU & Runtime</span>
            </div>
            <div className="text-sm font-bold text-[#2dce89] dark:text-emerald-400 font-mono mt-1">
              {loadingInfo ? '...' : `${systemInfo?.num_cpu ?? 0} Cores (${systemInfo?.num_goroutine ?? 0} goroutines)`}
            </div>
          </div>

          <div className="p-3 bg-[#f8f9fe] dark:bg-slate-800/60 border border-[#e9ecef] dark:border-slate-800 rounded-[0.375rem]">
            <div className="flex items-center gap-1.5 text-[12px] uppercase tracking-wider text-[#8898aa] dark:text-slate-400 font-semibold">
              <Layers className="w-3.5 h-3.5 text-[#fb6340]" />
              <span>RAM Allocated</span>
            </div>
            <div className="text-sm font-bold text-[#fb6340] dark:text-amber-400 font-mono mt-1">
              {loadingInfo ? '...' : `${systemInfo?.memory?.alloc_mb ? systemInfo.memory.alloc_mb.toFixed(1) : 0} MB (Sys: ${systemInfo?.memory?.sys_mb ? systemInfo.memory.sys_mb.toFixed(1) : 0} MB)`}
            </div>
          </div>

          <div className="p-3 bg-[#f8f9fe] dark:bg-slate-800/60 border border-[#e9ecef] dark:border-slate-800 rounded-[0.375rem]">
            <div className="flex items-center gap-1.5 text-[12px] uppercase tracking-wider text-[#8898aa] dark:text-slate-400 font-semibold">
              <Database className="w-3.5 h-3.5 text-[#11cdef]" />
              <span>Database Pool</span>
            </div>
            <div className="text-sm font-bold text-[#11cdef] dark:text-cyan-400 font-mono mt-1">
              {loadingInfo ? '...' : systemInfo?.database?.connected ? `${systemInfo.database.latency_ms}ms (${systemInfo.database.open_connections} conns)` : 'Disconnected'}
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 2. DIAGNOSTIC BUNDLE DOWNLOAD (ONE-CLICK EXPORT)          */}
      {/* ========================================================= */}
      <div className="bg-white dark:bg-slate-900 border border-[#dee2e6] dark:border-slate-800 rounded-[0.375rem] p-5 space-y-4 shadow-argon dark:shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-[0.375rem] bg-[#2dce89]/10 dark:bg-emerald-950/60 border border-[#2dce89]/20 dark:border-emerald-700/40 flex items-center justify-center text-[#2dce89] dark:text-emerald-400">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#32325d] dark:text-white">Diagnostic Bundle (Support Package)</h3>
              <p className="text-[13px] text-[#8898aa] dark:text-slate-400">
                Export an anonymized <code>.zip</code> archive containing system health, database metrics, recent sync logs, and application logs.
              </p>
            </div>
          </div>

          <Button
            type="button"
            onClick={handleDownloadBundle}
            disabled={downloadingBundle}
            className="flex items-center gap-2 bg-[#2dce89] hover:bg-[#28b97b] text-white shadow-argon-sm"
          >
            {downloadingBundle ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Preparing Archive...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Download Diagnostic Bundle</span>
              </>
            )}
          </Button>
        </div>

        <div className="p-3 bg-[#e8fbf8] dark:bg-emerald-950/30 border border-[#2dce89]/20 dark:border-emerald-800/30 rounded-[0.375rem] text-xs text-[#2dce89] dark:text-emerald-300 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Automated Privacy Sanitization:</span> All database passwords, provider credentials, JWT keys, and API tokens are automatically replaced with <code>[REDACTED]</code> before the bundle is generated.
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 3. RUNTIME LOG VIEWER                                     */}
      {/* ========================================================= */}
      <div className="bg-white dark:bg-slate-900 border border-[#dee2e6] dark:border-slate-800 rounded-[0.375rem] p-5 space-y-4 shadow-argon dark:shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-[#e9ecef] dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-[0.375rem] bg-[#11cdef]/10 dark:bg-cyan-950/60 border border-[#11cdef]/20 dark:border-cyan-700/40 flex items-center justify-center text-[#11cdef] dark:text-cyan-400">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-[#32325d] dark:text-white">Live In-Memory Runtime Logs</h3>
                <span className="text-[12px] px-2 py-0.5 rounded-[0.25rem] font-mono bg-gray-100 dark:bg-slate-800 text-[#525f7f] dark:text-slate-300 font-semibold">
                  {filteredLogs.length} lines
                </span>
              </div>
              <p className="text-[13px] text-[#8898aa] dark:text-slate-400">
                Recent log messages stored in the circular memory ring buffer.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Search filter */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Filter logs..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs rounded-[0.375rem] border border-[#dee2e6] dark:border-slate-700 bg-white dark:bg-slate-800 text-[#32325d] dark:text-slate-200 focus:outline-none focus:border-[#3970e1] w-40 sm:w-56"
              />
            </div>

            {/* Limit selector */}
            <select
              value={logLimit}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                setLogLimit(val);
                loadLogs(val);
              }}
              className="py-1.5 px-2 text-xs rounded-[0.375rem] border border-[#dee2e6] dark:border-slate-700 bg-white dark:bg-slate-800 text-[#32325d] dark:text-slate-200 focus:outline-none"
            >
              <option value="50">50 lines</option>
              <option value="100">100 lines</option>
              <option value="250">250 lines</option>
              <option value="500">500 lines</option>
            </select>

            {/* Copy button */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopyLogs}
              className="flex items-center gap-1.5 text-xs"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </Button>

            {/* Refresh button */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => loadLogs(logLimit)}
              disabled={loadingLogs}
              className="flex items-center gap-1.5 text-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingLogs ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </Button>
          </div>
        </div>

        {/* Terminal Box */}
        <div className="bg-[#1e1e2f] rounded-[0.375rem] border border-slate-700 p-4 font-mono text-xs text-slate-300 max-h-[420px] overflow-y-auto space-y-1">
          {loadingLogs && logs.length === 0 ? (
            <div className="py-8 text-center text-slate-500 flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Loading runtime logs...</span>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="py-8 text-center text-slate-500">
              {searchFilter ? 'No log lines match the filter query.' : 'No runtime logs captured in memory yet.'}
            </div>
          ) : (
            filteredLogs.map((line, idx) => {
              const upper = line.toUpperCase();
              let colorClass = 'text-slate-300';
              if (upper.includes('[ERROR]') || upper.includes('[FATAL]') || upper.includes('LEVEL=ERROR')) {
                colorClass = 'text-rose-400 font-semibold';
              } else if (upper.includes('[WARN]') || upper.includes('LEVEL=WARN')) {
                colorClass = 'text-amber-300';
              } else if (upper.includes('[DEBUG]') || upper.includes('LEVEL=DEBUG')) {
                colorClass = 'text-purple-300';
              } else if (upper.includes('[INFO]') || upper.includes('LEVEL=INFO')) {
                colorClass = 'text-blue-300';
              }

              return (
                <div key={idx} className={`leading-relaxed whitespace-pre-wrap break-all ${colorClass}`}>
                  {line}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
