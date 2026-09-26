import React from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { 
  Users, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown, 
  Key, 
  Info, 
  RefreshCw, 
  Eye, 
  EyeOff,
  Trash2,
  Edit3,
  Copy,
  Check,
  Sliders,
  SlidersHorizontal,
  RotateCcw,
  X,
  GripVertical,
  Lock,
  Unlock,
  ShieldAlert
} from 'lucide-react';
import { getServerOrigin } from '../api/client';
import { resolveProtocolHost } from '../utils/streamingUrls';
import { getEffectiveUserPatterns } from '../utils/patterns';

const STORAGE_KEY = 'managed_users_grid_prefs_v2';

const DEFAULT_COLUMN_ORDER = [
  'select',
  'id',
  'user',
  'm3u',
  'provider',
  'status',
  'connections',
  'categories',
  'note',
  'created_by',
  'actions'
];

const DEFAULT_COLUMN_SIZING = {
  select: 42,
  id: 80,
  user: 240,
  m3u: 140,
  provider: 220,
  status: 155,
  connections: 90,
  categories: 180,
  note: 150,
  created_by: 130,
  actions: 200
};

const DEFAULT_COLUMN_VISIBILITY = {
  select: true,
  id: true,
  user: true,
  m3u: true,
  provider: true,
  status: true,
  connections: true,
  categories: true,
  note: false,
  created_by: false,
  actions: true
};

const COLUMN_LABELS = {
  select: 'Select all',
  id: 'User ID',
  user: 'User / Line (Name & Username)',
  m3u: 'M3U (Short Link)',
  provider: 'Source Provider',
  status: 'Status / Expiry',
  connections: 'Connections (Active / Max)',
  categories: 'Categories (Live, VOD, Series)',
  note: 'User Note',
  created_by: 'Created by',
  actions: 'Quick actions'
};

function loadInitialPrefs() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      let order = Array.isArray(parsed.columnOrder) ? [...parsed.columnOrder] : [...DEFAULT_COLUMN_ORDER];
      // Ensure newly added default columns (like 'm3u') are included in order
      for (const col of DEFAULT_COLUMN_ORDER) {
        if (!order.includes(col)) {
          const actionsIdx = order.indexOf('actions');
          if (actionsIdx !== -1) {
            order.splice(actionsIdx, 0, col);
          } else {
            order.push(col);
          }
        }
      }
      return {
        columnOrder: order,
        columnSizing: parsed.columnSizing ? { ...DEFAULT_COLUMN_SIZING, ...parsed.columnSizing } : DEFAULT_COLUMN_SIZING,
        columnVisibility: parsed.columnVisibility ? { ...DEFAULT_COLUMN_VISIBILITY, ...parsed.columnVisibility } : DEFAULT_COLUMN_VISIBILITY
      };
    }
  } catch (e) {
    // Ignore localStorage errors
  }
  return {
    columnOrder: DEFAULT_COLUMN_ORDER,
    columnSizing: DEFAULT_COLUMN_SIZING,
    columnVisibility: DEFAULT_COLUMN_VISIBILITY
  };
}

// 1-Click Copy button helper
function CopyButton({ text, label = 'Copy', className = '' }) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = (e) => {
    e.stopPropagation();
    if (!text) return;
    try {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.warn('Clipboard copy failed:', err);
    }
  };

  if (!text) return null;

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`p-0.5 text-[#8898aa] hover:text-[#3970e1] rounded transition inline-flex items-center ${className}`}
      title={copied ? 'Copied!' : `${label}: ${text}`}
    >
      {copied ? (
        <Check className="w-3 h-3 text-[#2dce89]" />
      ) : (
        <Copy className="w-3 h-3 opacity-60 hover:opacity-100" />
      )}
    </button>
  );
}

export default function ManagedUserGrid({
  users = [],
  currentPlaylist = null,
  playlists = [],
  selectedUserIds = [],
  onToggleSelectId,
  onSelectAllVisible,
  activeUserId,
  onSelectUser,
  onSelectOnlyUser,
  onClearSelection,
  onEditUser,
  onShowInfo,
  onShowCreds,
  onShowM3u,
  onForceSync,
  onDeleteUser,
  onToggleSuspension,
  syncingUserId,
  compact = false
}) {
  // Initial layout from localStorage
  const initialPrefs = React.useMemo(() => loadInitialPrefs(), []);

  const [columnOrder, setColumnOrder] = React.useState(initialPrefs.columnOrder);
  const [columnSizing, setColumnSizing] = React.useState(initialPrefs.columnSizing);
  const [columnVisibility, setColumnVisibility] = React.useState(initialPrefs.columnVisibility);
  const [sorting, setSorting] = React.useState([{ id: 'id', desc: false }]);
  const [revealedPasswords, setRevealedPasswords] = React.useState({});
  const [showColumnMenu, setShowColumnMenu] = React.useState(false);
  const columnMenuRef = React.useRef(null);

  // Drag and Drop state for columns
  const [draggedColId, setDraggedColId] = React.useState(null);
  const [dropTarget, setDropTarget] = React.useState(null); // { id: string, position: 'left' | 'right' }

  // Last clicked ID for Shift-Click range selection
  const [lastClickedId, setLastClickedId] = React.useState(null);

  // Scroll container refs for virtualization
  const tableContainerRef = React.useRef(null);
  const compactContainerRef = React.useRef(null);

  // Quick lookup set for O(1) row selection check (supports 2000+ users seamlessly)
  const selectedSet = React.useMemo(() => new Set((selectedUserIds || []).map(String)), [selectedUserIds]);

  // Status renderers
  const renderStatus = (expiry, user) => {
    if (user?.is_suspended) {
      return (
        <div className="space-y-0.5">
          <span className="inline-flex items-center gap-1.5 text-xs text-[#f5365c] dark:text-rose-400 font-bold">
            <span className="w-2 h-2 rounded-full bg-[#f5365c] animate-pulse" />
            <span>{user.is_compromised ? 'Compromised' : 'Suspended'}</span>
          </span>
          <div className="text-[13px] text-[#f5365c]/80 dark:text-rose-400/80 font-medium truncate max-w-[130px]" title={user.compromised_reason || 'Multi-IP detection'}>
            {user.compromised_reason ? user.compromised_reason.replace(/^Suspended by system:\s*/i, '') : 'Access suspended'}
          </div>
        </div>
      );
    }
    if (!expiry) {
      return (
        <div className="space-y-0.5">
          <span className="inline-flex items-center gap-1.5 text-xs text-[#8898aa] dark:text-slate-400">
            <span className="w-2 h-2 rounded-full bg-[#adb5bd] dark:bg-slate-500" />
            <span>Unlimited</span>
          </span>
        </div>
      );
    }
    const d = new Date(expiry);
    const now = new Date();
    const near = new Date();
    near.setDate(near.getDate() + 7);

    const diffDays = Math.round((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (d < now) {
      return (
        <div className="space-y-0.5">
          <span className="inline-flex items-center gap-1.5 text-xs text-[#f5365c] dark:text-rose-400 font-semibold">
            <span className="w-2 h-2 rounded-full bg-[#f5365c]" />
            <span>Expired</span>
          </span>
          <div className="text-[13px] text-[#f5365c]/80 dark:text-rose-400/80 font-medium">
            {Math.abs(diffDays)}d ago
          </div>
        </div>
      );
    }
    if (d <= near) {
      return (
        <div className="space-y-0.5">
          <span className="inline-flex items-center gap-1.5 text-xs text-[#fb6340] dark:text-amber-400 font-semibold">
            <span className="w-2 h-2 rounded-full bg-[#fb6340]" />
            <span>Expiring</span>
          </span>
          <div className="text-[13px] text-[#fb6340]/80 dark:text-amber-400/80 font-medium">
            in {diffDays}d
          </div>
        </div>
      );
    }
    return (
      <div className="space-y-0.5">
        <span className="inline-flex items-center gap-1.5 text-xs text-[#2dce89] dark:text-emerald-400 font-semibold">
          <span className="w-2 h-2 rounded-full bg-[#2dce89]" />
          <span>Active</span>
        </span>
        <div className="text-[13px] text-[#8898aa] dark:text-slate-400 font-medium">
          in {diffDays}d
        </div>
      </div>
    );
  };

  const renderStatusCompact = (expiry, user) => {
    if (user?.is_suspended) {
      return (
        <span className="inline-flex items-center gap-1 text-[13px] text-[#f5365c] dark:text-rose-400 font-bold" title={user.compromised_reason || 'Suspended'}>
          <span className="w-1.5 h-1.5 rounded-full bg-[#f5365c] animate-pulse" />
          <span>Susp.</span>
        </span>
      );
    }
    if (!expiry) {
      return (
        <span className="inline-flex items-center gap-1 text-[13px] text-[#8898aa] dark:text-slate-400">
          <span className="w-1.5 h-1.5 rounded-full bg-[#adb5bd] dark:bg-slate-500" />
          <span>Unl.</span>
        </span>
      );
    }
    const d = new Date(expiry);
    const now = new Date();
    const near = new Date();
    near.setDate(near.getDate() + 7);

    if (d < now) {
      return (
        <span className="inline-flex items-center gap-1 text-[13px] text-[#f5365c] dark:text-rose-400 font-semibold">
          <span className="w-1.5 h-1.5 rounded-full bg-[#f5365c]" />
          <span>Expired</span>
        </span>
      );
    }
    if (d <= near) {
      return (
        <span className="inline-flex items-center gap-1 text-[13px] text-[#fb6340] dark:text-amber-400 font-semibold">
          <span className="w-1.5 h-1.5 rounded-full bg-[#fb6340]" />
          <span>Expiring</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[13px] text-[#2dce89] dark:text-emerald-400 font-semibold">
        <span className="w-1.5 h-1.5 rounded-full bg-[#2dce89]" />
        <span>Active</span>
      </span>
    );
  };

  const renderConnections = (u) => {
    const active = u.active_connections || 0;
    const max = u.max_connections || 1;
    const isOver = active > max;

    if (active > 0) {
      return (
        <span 
          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full font-mono text-[12px] font-bold border transition-colors ${
            isOver
              ? 'bg-[#feecee] dark:bg-rose-950/60 text-[#f5365c] dark:text-rose-400 border-[#f5365c]/30 dark:border-rose-500/40'
              : 'bg-[#e8faf1] dark:bg-emerald-950/60 text-[#2dce89] dark:text-emerald-400 border-[#2dce89]/30 dark:border-emerald-500/40'
          }`}
          title={`${active} of ${max} devices active`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${isOver ? 'bg-[#f5365c] animate-ping' : 'bg-[#2dce89] animate-pulse'}`} />
          <span>{active}</span>
          <span className="opacity-60 text-[13px] font-normal">/{max}</span>
        </span>
      );
    }

    return (
      <span className="font-mono text-[#8898aa] dark:text-slate-400 text-xs">
        0/{max}
      </span>
    );
  };

  const renderCategoriesBadge = (u) => {
    const isChanAll = !u.channels_categories || u.channels_categories === null;
    const isVodAll = !u.vods_categories || u.vods_categories === null;
    const isSerAll = !u.series_categories || u.series_categories === null;

    const chanText = isChanAll ? 'All' : `${u.channels_categories.length}`;
    const vodText = isVodAll ? 'All' : `${u.vods_categories.length}`;
    const serText = isSerAll ? 'All' : `${u.series_categories.length}`;

    return (
      <div className="flex items-center gap-1 font-mono text-[13px] text-[#525f7f] dark:text-slate-300">
        <span className="px-1.5 py-0.5 rounded bg-[#f6f9fc] dark:bg-slate-800 border border-[#e9ecef] dark:border-slate-700" title="Live Channels">
          L: {chanText}
        </span>
        <span className="px-1.5 py-0.5 rounded bg-[#f6f9fc] dark:bg-slate-800 border border-[#e9ecef] dark:border-slate-700" title="Movies / VOD">
          V: {vodText}
        </span>
        <span className="px-1.5 py-0.5 rounded bg-[#f6f9fc] dark:bg-slate-800 border border-[#e9ecef] dark:border-slate-700" title="TV Series">
          S: {serText}
        </span>
      </div>
    );
  };

  const isAllSelected = users.length > 0 && users.every((u) => selectedSet.has(String(u.id)));
  const isSomeSelected = users.some((u) => selectedSet.has(String(u.id))) && !isAllSelected;

  // =========================================================================
  // TANSTACK TABLE DEFINITION (FULL GRID MODE)
  // =========================================================================
  const columns = React.useMemo(() => [
    {
      id: 'select',
      size: 42,
      minSize: 42,
      maxSize: 50,
      enableResizing: false,
      enableSorting: false,
      header: () => (
        <div className="text-center">
          <input
            type="checkbox"
            ref={(el) => el && (el.indeterminate = isSomeSelected)}
            checked={isAllSelected}
            onChange={() => onSelectAllVisible(users)}
            className="rounded border-[#dee2e6] dark:border-slate-700 bg-white dark:bg-slate-800 text-[#3970e1] focus:ring-0 cursor-pointer"
            title={isAllSelected ? 'Deselect all visible' : 'Select all visible'}
          />
        </div>
      ),
      cell: ({ row }) => (
        <div 
          className="text-center"
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelectId(row.original.id, e);
          }}
        >
          <input
            type="checkbox"
            checked={selectedSet.has(String(row.original.id))}
            onChange={() => {}}
            className="rounded border-[#dee2e6] dark:border-slate-700 bg-white dark:bg-slate-800 text-[#3970e1] focus:ring-0 cursor-pointer"
          />
        </div>
      )
    },
    {
      id: 'id',
      accessorFn: (row) => row.id,
      header: 'ID',
      size: 80,
      minSize: 60,
      maxSize: 160,
      enableSorting: true,
      sortingFn: (rowA, rowB) => rowA.original.id - rowB.original.id,
      cell: ({ row }) => {
        const u = row.original;
        return (
          <div className="font-mono text-[#8898aa] dark:text-slate-400 text-xs flex items-center gap-1 group/id">
            <span>#{u.id}</span>
            <CopyButton text={String(u.id)} label="ID" className="opacity-0 group-hover/id:opacity-100" />
          </div>
        );
      }
    },
    {
      id: 'user',
      accessorFn: (row) => row.name,
      header: 'User / Line',
      size: 240,
      minSize: 160,
      enableSorting: true,
      sortingFn: (rowA, rowB) => (rowA.original.name || '').localeCompare(rowB.original.name || '', undefined, { sensitivity: 'base' }),
      cell: ({ row }) => {
        const u = row.original;
        return (
          <div className="min-w-0 pr-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-semibold text-[#32325d] dark:text-slate-100 truncate" title={u.name}>
                {u.name}
              </span>
              {u.is_online && (
                <span 
                  className="text-[12px] uppercase font-extrabold px-1.5 py-0.2 rounded bg-[#e8faf1] dark:bg-emerald-950/60 text-[#2dce89] dark:text-emerald-400 border border-[#2dce89]/40 dark:border-emerald-500/40 font-mono flex-shrink-0 animate-pulse" 
                  title="Streaming right now"
                >
                  LIVE
                </span>
              )}
              {u.is_suspended && (
                <span 
                  className="text-[12px] uppercase font-extrabold px-1.5 py-0.2 rounded bg-[#fce8e6] dark:bg-rose-950/60 text-[#f5365c] dark:text-rose-400 border border-[#f5365c]/40 dark:border-rose-500/40 font-mono flex-shrink-0 animate-pulse" 
                  title={u.compromised_reason ? `Suspended: ${u.compromised_reason}` : 'Account Suspended'}
                >
                  {u.is_compromised ? 'COMPROMISED' : 'SUSPENDED'}
                </span>
              )}
              {u.note && (
                <span 
                  className="w-2 h-2 rounded-full bg-[#3970e1] dark:bg-blue-400 flex-shrink-0" 
                  title={`Note: ${u.note}`} 
                />
              )}
              {u.created_by_username && (
                <span 
                  className="text-[12px] text-[#3970e1] dark:text-blue-300 bg-[#eef2ff] dark:bg-blue-950/60 border border-[#3970e1]/30 dark:border-blue-700/40 px-1 py-0.2 rounded font-mono truncate" 
                  title={`Created by: ${u.created_by_username}`}
                >
                  by {u.created_by_username}
                </span>
              )}
            </div>
            <div className="font-mono text-[13px] text-[#8898aa] dark:text-slate-400 truncate mt-0.5 flex items-center gap-1 group/user">
              <span className="truncate">{u.username}</span>
              <CopyButton text={u.username} label="Username" className="opacity-0 group-hover/user:opacity-100 flex-shrink-0" />
            </div>
          </div>
        );
      }
    },
    {
      id: 'm3u',
      accessorFn: (row) => row.m3u || '',
      header: 'M3U',
      size: 140,
      minSize: 110,
      enableSorting: true,
      sortingFn: (rowA, rowB) => (rowA.original.m3u || '').localeCompare(rowB.original.m3u || ''),
      cell: ({ row }) => {
        const u = row.original;
        if (!u.m3u) return <span className="text-[#adb5bd] dark:text-slate-500 italic text-[13px]">-</span>;
        const origin = resolveProtocolHost({
          cname: currentPlaylist?.cname,
          cnameSSL: currentPlaylist?.cname_ssl,
        });
        const cleanToken = u.m3u.replace(/^\//, '');
        const shortUrl = `${origin}/${cleanToken}/`;
        return (
          <div className="flex items-center gap-1 font-mono text-[13px] text-[#525f7f] dark:text-slate-300 pr-1" onClick={(e) => e.stopPropagation()}>
            <span className="truncate max-w-[85px] font-semibold text-[#32325d] dark:text-slate-100" title={`Short M3U: ${shortUrl}`}>
              /{cleanToken}/
            </span>
            <CopyButton text={shortUrl} label="Short M3U" className="opacity-60 hover:opacity-100" />
            <button
              type="button"
              onClick={() => (onShowInfo || onShowM3u)?.(u)}
              className="p-1 text-[#8898aa] dark:text-slate-400 hover:text-[#3970e1] dark:hover:text-blue-400 hover:bg-[#eef2ff] dark:hover:bg-slate-700 rounded transition shrink-0"
              title="Streaming links & info"
            >
              <Info className="w-3 h-3 text-[#3970e1] dark:text-blue-400" />
            </button>
          </div>
        );
      }
    },
    {
      id: 'provider',
      header: 'Source Provider',
      size: 220,
      minSize: 150,
      enableSorting: true,
      sortingFn: (rowA, rowB) => {
        const uA = rowA.original;
        const uB = rowB.original;
        const plA = (playlists && playlists.find((p) => String(p.id) === String(uA.list_id))) || currentPlaylist;
        const plB = (playlists && playlists.find((p) => String(p.id) === String(uB.list_id))) || currentPlaylist;
        const { patterns: pListA } = getEffectiveUserPatterns(uA, plA);
        const { patterns: pListB } = getEffectiveUserPatterns(uB, plB);
        const pA = pListA[0];
        const pB = pListB[0];
        const valA = pA ? `${pA.type || ''} ${pA.param1 || pA.url || ''}` : '';
        const valB = pB ? `${pB.type || ''} ${pB.param1 || pB.url || ''}` : '';
        return valA.localeCompare(valB);
      },
      cell: ({ row }) => {
        const u = row.original;
        const pl = (playlists && playlists.find((p) => String(p.id) === String(u.list_id))) || currentPlaylist;
        const { patterns, isInherited } = getEffectiveUserPatterns(u, pl);
        const pattern = patterns.length > 0 ? patterns[0] : null;
        const isPassRevealed = !!revealedPasswords[u.id];

        if (!pattern) {
          return <span className="text-xs text-[#adb5bd] dark:text-slate-500 italic">No provider linked</span>;
        }

        return (
          <div className="space-y-1 pr-2" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[12px] font-mono uppercase px-1.5 py-0.5 rounded bg-[#eef2ff] dark:bg-blue-950/60 text-[#3970e1] dark:text-blue-300 border border-[#3970e1]/30 dark:border-blue-700/40 font-bold">
                {pattern.type || 'provider'}
              </span>
              {pattern.isInherited && (
                <span
                  className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60"
                  title="Inherited from original playlist"
                >
                  Playlist
                </span>
              )}
              {patterns.length > 1 && (
                <span
                  className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-[#525f7f] dark:text-slate-300 border border-[#dee2e6] dark:border-slate-700 cursor-help"
                  title={`${patterns.length} providers total (${patterns.filter((p) => !p.isInherited).length} custom, ${patterns.filter((p) => p.isInherited).length} inherited)`}
                >
                  +{patterns.length - 1}
                </span>
              )}
              {pattern.param1 && (
                <div className="flex items-center gap-0.5 font-mono text-[13px] text-[#32325d] dark:text-slate-100 font-semibold group/p1">
                  <span className="truncate max-w-[110px]" title={`Param 1: ${pattern.param1}`}>
                    {pattern.param1}
                  </span>
                  <CopyButton text={pattern.param1} label="Key/User" className="opacity-0 group-hover/p1:opacity-100 flex-shrink-0" />
                </div>
              )}
              {!pattern.param1 && pattern.url && (
                <div className="flex items-center gap-0.5 font-mono text-[12px] text-[#525f7f] dark:text-slate-400 group/purl">
                  <span className="truncate max-w-[120px]" title={pattern.url}>
                    {pattern.url.replace(/^https?:\/\//, '')}
                  </span>
                  <CopyButton text={pattern.url} label="URL" className="opacity-0 group-hover/purl:opacity-100 flex-shrink-0" />
                </div>
              )}
            </div>
            {pattern.param2 && (
              <div className="flex items-center gap-1 font-mono text-[13px] text-[#8898aa] dark:text-slate-400">
                <span>P:</span>
                <span className="truncate max-w-[100px]">
                  {isPassRevealed ? pattern.param2 : '••••••••'}
                </span>
                <button
                  type="button"
                  onClick={(e) => toggleRevealPassword(u.id, e)}
                  className="text-[#8898aa] dark:text-slate-400 hover:text-[#32325d] dark:hover:text-white ml-0.5 p-0.5"
                  title={isPassRevealed ? 'Hide password' : 'Show password'}
                >
                  {isPassRevealed ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                </button>
                <CopyButton text={pattern.param2} label="Password" className="opacity-60 hover:opacity-100" />
              </div>
            )}
            {pattern.param1 && pattern.url && (
              <div className="font-mono text-[11px] text-[#8898aa] dark:text-slate-400 truncate max-w-[180px]" title={pattern.url}>
                {pattern.url.replace(/^https?:\/\//, '')}
              </div>
            )}
          </div>
        );
      }
    },
    {
      id: 'status',
      accessorFn: (row) => row.expiry,
      header: 'Status / Expiry',
      size: 155,
      minSize: 110,
      enableSorting: true,
      sortingFn: (rowA, rowB) => {
        const aVal = rowA.original.expiry;
        const bVal = rowB.original.expiry;
        if (!aVal && !bVal) return 0;
        if (!aVal) return 1;
        if (!bVal) return -1;
        return new Date(aVal).getTime() - new Date(bVal).getTime();
      },
      cell: ({ row }) => renderStatus(row.original.expiry, row.original)
    },
    {
      id: 'connections',
      accessorFn: (row) => row.active_connections || 0,
      header: 'Conn.',
      size: 90,
      minSize: 75,
      maxSize: 120,
      enableSorting: true,
      sortingFn: (rowA, rowB) => (rowA.original.active_connections || 0) - (rowB.original.active_connections || 0),
      cell: ({ row }) => (
        <div className="text-center">
          {renderConnections(row.original)}
        </div>
      )
    },
    {
      id: 'categories',
      header: 'Categories',
      size: 180,
      minSize: 120,
      enableSorting: true,
      sortingFn: (rowA, rowB) => {
        const countA = (rowA.original.channels_categories?.length || 0) + (rowA.original.vods_categories?.length || 0) + (rowA.original.series_categories?.length || 0);
        const countB = (rowB.original.channels_categories?.length || 0) + (rowB.original.vods_categories?.length || 0) + (rowB.original.series_categories?.length || 0);
        return countA - countB;
      },
      cell: ({ row }) => renderCategoriesBadge(row.original)
    },
    {
      id: 'note',
      accessorFn: (row) => row.note || '',
      header: 'Note',
      size: 150,
      minSize: 100,
      enableSorting: true,
      sortingFn: (rowA, rowB) => (rowA.original.note || '').localeCompare(rowB.original.note || ''),
      cell: ({ row }) => {
        const note = row.original.note;
        if (!note) return <span className="text-[#adb5bd] dark:text-slate-500 italic text-[13px]">-</span>;
        return (
          <div className="text-[13px] text-[#525f7f] dark:text-slate-300 truncate max-w-[140px]" title={note}>
            {note}
          </div>
        );
      }
    },
    {
      id: 'created_by',
      accessorFn: (row) => row.created_by_username || '',
      header: 'Created By',
      size: 130,
      minSize: 90,
      enableSorting: true,
      sortingFn: (rowA, rowB) => (rowA.original.created_by_username || '').localeCompare(rowB.original.created_by_username || ''),
      cell: ({ row }) => {
        const creator = row.original.created_by_username;
        if (!creator) return <span className="text-[#adb5bd] dark:text-slate-500 italic text-[13px]">-</span>;
        return (
          <span className="text-[12px] font-mono text-[#3970e1] dark:text-blue-300 bg-[#eef2ff] dark:bg-blue-950/60 border border-[#3970e1]/30 dark:border-blue-700/40 px-1.5 py-0.5 rounded truncate">
            {creator}
          </span>
        );
      }
    },
    {
      id: 'actions',
      header: 'Actions',
      size: 140,
      minSize: 120,
      enableResizing: false,
      enableSorting: false,
      cell: ({ row }) => {
        const u = row.original;
        return (
          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => onShowInfo?.(u)}
              className="p-1.5 text-[#525f7f] dark:text-slate-400 hover:text-[#3970e1] dark:hover:text-blue-400 hover:bg-[#f6f9fc] dark:hover:bg-slate-700 rounded transition"
              title="Streaming links, credentials, M3U and STB portal info"
            >
              <Info className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => {
                if (onSelectOnlyUser) onSelectOnlyUser(u.id);
                onEditUser?.(u);
              }}
              className="p-1.5 text-[#3970e1] dark:text-blue-400 hover:text-[#285bc7] dark:hover:text-blue-300 hover:bg-[#eef2ff] dark:hover:bg-slate-700 rounded transition"
              title="Edit user details (open editor)"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => onForceSync?.(u)}
              disabled={syncingUserId === u.id}
              className="p-1.5 text-[#2dce89] dark:text-emerald-400 hover:text-[#26af74] dark:hover:text-emerald-300 hover:bg-[#e8faf1] dark:hover:bg-emerald-950/40 rounded transition disabled:opacity-40"
              title="Force sync provider data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncingUserId === u.id ? 'animate-spin' : ''}`} />
            </button>

            <button
              type="button"
              onClick={() => onToggleSuspension?.(u)}
              className={`p-1.5 rounded transition ${
                u.is_suspended
                  ? 'text-[#f5365c] dark:text-rose-400 hover:text-[#2dce89] dark:hover:text-emerald-300 hover:bg-[#e8f5e9] dark:hover:bg-emerald-950/40'
                  : 'text-[#525f7f] dark:text-slate-400 hover:text-[#f5365c] dark:hover:text-rose-400 hover:bg-[#feecee] dark:hover:bg-rose-950/40'
              }`}
              title={u.is_suspended ? 'Account is Suspended / Compromised. Click to reactivate.' : 'Account is Active. Click to suspend.'}
            >
              {u.is_suspended ? (
                <ShieldAlert className="w-3.5 h-3.5 text-[#f5365c] dark:text-rose-400 animate-pulse" />
              ) : (
                <Lock className="w-3.5 h-3.5" />
              )}
            </button>

            <button
              type="button"
              onClick={() => onDeleteUser?.(u)}
              className="p-1.5 text-[#f5365c] dark:text-rose-400 hover:text-[#ec0c38] dark:hover:text-rose-300 hover:bg-[#feecee] dark:hover:bg-rose-950/40 rounded transition"
              title="Delete user"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      }
    }
  ], [
    isAllSelected,
    isSomeSelected,
    users,
    selectedSet,
    revealedPasswords,
    syncingUserId,
    onSelectAllVisible,
    onToggleSelectId,
    onSelectOnlyUser,
    onShowInfo,
    onShowM3u,
    onEditUser,
    onShowCreds,
    onForceSync,
    onDeleteUser,
    onToggleSuspension,
    currentPlaylist,
    playlists
  ]);

  // Table instance
  const table = useReactTable({
    data: users,
    columns,
    state: {
      columnOrder,
      columnSizing,
      columnVisibility,
      sorting
    },
    enableColumnResizing: true,
    columnResizeMode: 'onChange',
    onColumnOrderChange: setColumnOrder,
    onColumnSizingChange: setColumnSizing,
    onColumnVisibilityChange: setColumnVisibility,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel()
  });

  const { rows } = table.getRowModel();
  const isResizingAnyColumn = !!table.getState().columnSizingInfo?.isResizingColumn;

  // Persist column preferences on change (debounced and only when NOT actively dragging a resize border)
  React.useEffect(() => {
    if (isResizingAnyColumn) return;

    const timer = setTimeout(() => {
      try {
        const prefs = {
          columnOrder,
          columnSizing,
          columnVisibility,
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
      } catch (e) {
        // Ignore localStorage write error
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [columnOrder, columnSizing, columnVisibility, isResizingAnyColumn]);

  // Close column menu on click outside
  React.useEffect(() => {
    if (!showColumnMenu) return;
    const handleClickOutside = (e) => {
      if (columnMenuRef.current && !columnMenuRef.current.contains(e.target)) {
        setShowColumnMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showColumnMenu]);

  // Global Escape key listener to clear multi-selection
  React.useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && selectedUserIds.length > 0) {
        onClearSelection ? onClearSelection() : onToggleSelectId?.(null, null, []);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedUserIds, onClearSelection, onToggleSelectId]);

  const toggleRevealPassword = (id, e) => {
    e.stopPropagation();
    setRevealedPasswords((prev) => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const handleResetLayout = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {}
    setColumnOrder(DEFAULT_COLUMN_ORDER);
    setColumnSizing(DEFAULT_COLUMN_SIZING);
    setColumnVisibility(DEFAULT_COLUMN_VISIBILITY);
  };

  // Dedicated sort toggle handler: None -> Asc -> Desc -> Reset
  const handleSortToggle = (colId) => {
    if (isResizingAnyColumn) return;
    setSorting((prev) => {
      const current = prev.find((s) => s.id === colId);
      if (!current) {
        return [{ id: colId, desc: false }];
      }
      if (!current.desc) {
        return [{ id: colId, desc: true }];
      }
      return []; // Reset sort
    });
  };

  const renderSortIndicator = (field) => {
    const current = sorting.find((s) => s.id === field);
    if (!current) {
      return <ArrowUpDown className="w-3 h-3 text-[#adb5bd] opacity-40 group-hover:opacity-100" />;
    }
    return current.desc ? (
      <ArrowDown className="w-3.5 h-3.5 text-[#3970e1] stroke-[2.5]" />
    ) : (
      <ArrowUp className="w-3.5 h-3.5 text-[#3970e1] stroke-[2.5]" />
    );
  };

  // Reset scroll position if dataset shrinks below current scrollTop
  React.useEffect(() => {
    if (tableContainerRef.current && rows.length > 0) {
      if (tableContainerRef.current.scrollTop > rows.length * 52) {
        tableContainerRef.current.scrollTop = 0;
      }
    }
  }, [rows.length]);

  // Virtualizer for high performance with 2000+ users in Full Grid view
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 52,
    overscan: 12
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const paddingTop = virtualRows.length > 0 ? virtualRows[0]?.start || 0 : 0;
  const paddingBottom = virtualRows.length > 0 
    ? rowVirtualizer.getTotalSize() - (virtualRows[virtualRows.length - 1]?.end || 0)
    : 0;

  // Drag and drop column handlers
  const handleDragStart = (e, colId) => {
    if (isResizingAnyColumn) {
      e.preventDefault();
      return;
    }
    if (colId === 'select' || colId === 'actions') return;
    e.stopPropagation();
    e.dataTransfer.setData('text/plain', colId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedColId(colId);
  };

  const handleDragOver = (e, colId) => {
    if (!draggedColId || isResizingAnyColumn) return;
    if (draggedColId === colId) return;
    if (colId === 'select' || colId === 'actions') return;

    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const rect = e.currentTarget.getBoundingClientRect();
    const midX = rect.left + rect.width / 2;
    const position = e.clientX < midX ? 'left' : 'right';

    if (!dropTarget || dropTarget.id !== colId || dropTarget.position !== position) {
      setDropTarget({ id: colId, position });
    }
  };

  const handleDrop = (e, targetColId) => {
    e.preventDefault();
    if (!draggedColId || isResizingAnyColumn || draggedColId === targetColId) {
      setDraggedColId(null);
      setDropTarget(null);
      return;
    }
    if (targetColId === 'select' || targetColId === 'actions') {
      setDraggedColId(null);
      setDropTarget(null);
      return;
    }

    setColumnOrder((prevOrder) => {
      const current = [...prevOrder];
      const fromIndex = current.indexOf(draggedColId);
      if (fromIndex === -1) return prevOrder;

      current.splice(fromIndex, 1);
      let toIndex = current.indexOf(targetColId);
      if (toIndex === -1) return prevOrder;

      if (dropTarget?.position === 'right') {
        toIndex += 1;
      }

      current.splice(toIndex, 0, draggedColId);
      return current;
    });

    setDraggedColId(null);
    setDropTarget(null);
  };

  const handleDragEnd = () => {
    setDraggedColId(null);
    setDropTarget(null);
  };

  // Row click dispatcher (automatic checkbox selection & multi-selection handling)
  const handleRowClick = (u, e, rowIndex) => {
    // 1. If user is selecting text to copy, don't trigger row selection
    const selection = window.getSelection();
    if (selection && selection.toString().trim().length > 0) {
      return;
    }

    // 2. Ctrl / Cmd + click: toggle row selection in bulk
    if (e.ctrlKey || e.metaKey) {
      onToggleSelectId(u.id, e);
      setLastClickedId(u.id);
      if (onSelectUser) onSelectUser(u);
      return;
    }

    // 3. Shift + click: range selection between lastClickedId and current row
    if (e.shiftKey && lastClickedId != null) {
      const lastIndex = rows.findIndex((r) => r.original.id === lastClickedId);
      if (lastIndex !== -1 && rowIndex !== -1) {
        const start = Math.min(lastIndex, rowIndex);
        const end = Math.max(lastIndex, rowIndex);
        const rangeIds = rows.slice(start, end + 1).map((r) => r.original.id);
        onToggleSelectId(u.id, e, rangeIds);
        if (onSelectUser) onSelectUser(u);
        return;
      }
    }

    // 4. Normal click outside checkbox:
    // Selects ONLY this clicked row and unchecks all other rows
    setLastClickedId(u.id);
    if (onSelectOnlyUser) {
      onSelectOnlyUser(u.id);
    } else {
      onToggleSelectId(u.id, e, [u.id]);
    }
    if (onSelectUser) onSelectUser(u);
  };

  const handleRowDoubleClick = (u) => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim().length > 0) return;
    if (onSelectOnlyUser) {
      onSelectOnlyUser(u.id);
    }
    onEditUser(u);
  };

  // =========================================================================
  // COMPACT VIEW (used specifically for Split View Left Column)
  // Perfectly fits in a ~380-450px column without ANY horizontal scrollbar!
  // Also virtualized with @tanstack/react-virtual for 2000 users!
  // =========================================================================
  const compactVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => compactContainerRef.current,
    estimateSize: () => 48,
    overscan: 10
  });

  if (compact) {
    const compactItems = compactVirtualizer.getVirtualItems();
    const compactPadTop = compactItems.length > 0 ? compactItems[0]?.start || 0 : 0;
    const compactPadBottom = compactItems.length > 0 
      ? compactVirtualizer.getTotalSize() - (compactItems[compactItems.length - 1]?.end || 0)
      : 0;

    return (
      <div className="bg-white dark:bg-slate-900 rounded-lg border border-[#e9ecef] dark:border-slate-800 shadow-argon overflow-hidden">
        <div ref={compactContainerRef} className="max-h-[calc(100vh-240px)] overflow-y-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[#f6f9fc] dark:bg-slate-800 border-b border-[#e9ecef] dark:border-slate-700 text-[12px] uppercase text-[#8898aa] dark:text-slate-400 font-bold tracking-wider sticky top-0 z-10 select-none">
              <tr>
                <th className="p-2.5 w-8 text-center">
                  <input
                    type="checkbox"
                    ref={(el) => el && (el.indeterminate = isSomeSelected)}
                    checked={isAllSelected}
                    onChange={() => onSelectAllVisible(users)}
                    className="rounded border-[#dee2e6] dark:border-slate-700 text-[#3970e1] focus:ring-0 cursor-pointer"
                  />
                </th>
                <th 
                  onClick={() => handleSortToggle('id')}
                  className="p-2.5 cursor-pointer group select-none w-12 hover:bg-[#eef2ff] dark:hover:bg-slate-700"
                  title="User ID (Click to sort)"
                >
                  <div className="flex items-center gap-0.5">
                    <span>#</span>
                    {renderSortIndicator('id')}
                  </div>
                </th>
                <th 
                  onClick={() => handleSortToggle('user')}
                  className="p-2.5 cursor-pointer group select-none hover:bg-[#eef2ff] dark:hover:bg-slate-700"
                  title="User / Line (Click to sort)"
                >
                  <div className="flex items-center gap-1">
                    <span>User</span>
                    {renderSortIndicator('user')}
                  </div>
                </th>
                <th 
                  onClick={() => handleSortToggle('status')}
                  className="p-2.5 w-24 text-right pr-3 cursor-pointer group select-none hover:bg-[#eef2ff] dark:hover:bg-slate-700"
                  title="Status / Expiry (Click to sort)"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Status</span>
                    {renderSortIndicator('status')}
                  </div>
                </th>
                <th 
                  onClick={() => handleSortToggle('connections')}
                  className="p-2.5 w-12 text-center cursor-pointer group select-none hover:bg-[#eef2ff] dark:hover:bg-slate-700"
                  title="Connections (Click to sort)"
                >
                  <div className="flex items-center justify-center gap-0.5">
                    <span>C.</span>
                    {renderSortIndicator('connections')}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e9ecef] dark:divide-slate-800">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-xs text-[#8898aa] dark:text-slate-400">
                    No users found
                  </td>
                </tr>
              ) : (
                <>
                  {compactPadTop > 0 && (
                    <tr>
                      <td style={{ height: `${compactPadTop}px` }} colSpan={5} />
                    </tr>
                  )}
                  {compactItems.map((virtualRow) => {
                    const row = rows[virtualRow.index];
                    const u = row.original;
                    const isSelected = selectedSet.has(String(u.id));
                    const isActive = activeUserId != null && String(activeUserId) === String(u.id);

                    return (
                      <tr
                        key={u.id}
                        onClick={(e) => handleRowClick(u, e, virtualRow.index)}
                        onDoubleClick={() => handleRowDoubleClick(u)}
                        className={`cursor-pointer transition-colors duration-100 ${
                          isActive
                            ? 'bg-[#eef2ff] dark:bg-blue-950/50 text-[#32325d] dark:text-blue-300 border-l-4 !border-l-[#3970e1] font-semibold'
                            : isSelected
                            ? 'bg-[#f8f9fe] dark:bg-slate-800/80 text-[#525f7f] dark:text-slate-200 border-l-4 !border-l-[#adb5bd] dark:!border-l-slate-600'
                            : 'hover:bg-[#f6f9fc] dark:hover:bg-slate-800/50 text-[#525f7f] dark:text-slate-300 border-l-4 !border-l-[#e9ecef] dark:!border-l-slate-800'
                        }`}
                      >
                        <td 
                          className="p-2.5 text-center"
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleSelectId(u.id, e);
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            className="rounded border-[#dee2e6] dark:border-slate-700 bg-white dark:bg-slate-800 text-[#3970e1] focus:ring-0 cursor-pointer"
                          />
                        </td>
                        <td className="p-2.5 font-mono text-[13px] text-[#8898aa] dark:text-slate-400">
                          {u.id}
                        </td>
                        <td className="p-2.5 min-w-0">
                          <div className="truncate font-semibold text-[#32325d] dark:text-slate-100 max-w-[140px] flex items-center gap-1.5">
                            <span className="truncate">{u.name}</span>
                            {u.is_online && (
                              <span 
                                className="text-[12px] uppercase font-extrabold px-1 py-0.2 rounded bg-[#e8faf1] dark:bg-emerald-950/60 text-[#2dce89] dark:text-emerald-400 border border-[#2dce89]/40 dark:border-emerald-500/40 font-mono flex-shrink-0 animate-pulse" 
                                title="Streaming now"
                              >
                                LIVE
                              </span>
                            )}
                            {u.is_suspended && (
                              <span 
                                className="text-[12px] uppercase font-extrabold px-1 py-0.2 rounded bg-[#fce8e6] dark:bg-rose-950/60 text-[#f5365c] dark:text-rose-400 border border-[#f5365c]/40 dark:border-rose-500/40 font-mono flex-shrink-0 animate-pulse" 
                                title={u.compromised_reason ? `Suspended: ${u.compromised_reason}` : 'Account Suspended'}
                              >
                                {u.is_compromised ? 'COMP' : 'SUSP'}
                              </span>
                            )}
                            {u.created_by_username && (
                              <span 
                                className="text-[12px] text-[#3970e1] dark:text-blue-300 bg-[#eef2ff] dark:bg-blue-950/60 border border-[#3970e1]/30 dark:border-blue-700/40 px-1 rounded font-mono flex-shrink-0" 
                                title={`Created by: ${u.created_by_username}`}
                              >
                                {u.created_by_username}
                              </span>
                            )}
                          </div>
                          <div className="truncate font-mono text-[13px] text-[#8898aa] dark:text-slate-400 max-w-[140px]">
                            {u.username}
                          </div>
                        </td>
                        <td className="p-2.5 text-right pr-3 whitespace-nowrap">
                          {renderStatusCompact(u.expiry, u)}
                        </td>
                        <td className="p-2.5 text-center">
                          {renderConnections(u)}
                        </td>
                      </tr>
                    );
                  })}
                  {compactPadBottom > 0 && (
                    <tr>
                      <td style={{ height: `${compactPadBottom}px` }} colSpan={5} />
                    </tr>
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // =========================================================================
  // FULL GRID VIEW (TanStack Table + Virtualization for 2000 users)
  // Clean Argon table with subtle shadows, movable & resizable columns
  // =========================================================================
  const visibleLeafColumns = table.getVisibleLeafColumns();
  const toggleableColumns = [
    { id: 'id', label: 'ID' },
    { id: 'user', label: 'User / Line' },
    { id: 'provider', label: 'Source Provider' },
    { id: 'status', label: 'Status / Expiry' },
    { id: 'connections', label: 'Connections' },
    { id: 'categories', label: 'Categories' },
    { id: 'note', label: 'User Note' },
    { id: 'created_by', label: 'Created By' }
  ];

  return (
    <div className="space-y-2">
      {/* Global transparent overlay to maintain cursor:col-resize while dragging */}
      {isResizingAnyColumn && (
        <div className="fixed inset-0 z-50 cursor-col-resize select-none pointer-events-none" />
      )}

      {/* Top Grid Toolbar: Column Customizer & Active Selection Status */}
      <div className="flex items-center justify-between px-1 text-xs gap-3 flex-wrap">
        <div className="flex items-center gap-3 text-[#8898aa] dark:text-slate-400 flex-wrap">
          {selectedUserIds.length > 0 ? (
            <div className="flex items-center gap-2">
              <span className="text-xs px-2.5 py-0.5 rounded bg-[#eef2ff] dark:bg-blue-950/60 border border-[#3970e1]/30 dark:border-blue-700/40 text-[#3970e1] dark:text-blue-400 font-bold">
                {selectedUserIds.length} selected
              </span>
              <button
                type="button"
                onClick={() => onClearSelection ? onClearSelection() : onToggleSelectId?.(null, null, [])}
                className="text-[12px] text-[#8898aa] dark:text-slate-400 hover:text-[#f5365c] dark:hover:text-rose-400 font-semibold flex items-center gap-1 transition px-1.5 py-0.5 rounded hover:bg-[#feecee] dark:hover:bg-rose-950/50"
                title="Deselect all (Esc)"
              >
                <X className="w-3 h-3" />
                <span>Deselect all</span>
              </button>
            </div>
          ) : (
            <span className="text-[13px]">
              Tip: <strong>Click</strong> row to select • <strong>Double-click</strong> to edit • <strong>Header</strong> to sort • <strong>Borders</strong> to resize
            </span>
          )}
        </div>

        {/* Columns Settings Dropdown */}
        <div className="relative" ref={columnMenuRef}>
          <button
            type="button"
            onClick={() => setShowColumnMenu((prev) => !prev)}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-white hover:bg-[#f6f9fc] text-[#525f7f] border border-[#dee2e6] dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700 hover:border-[#3970e1]/40 rounded text-xs font-semibold transition active:scale-95 shadow-sm"
            title="Configure visible columns and layout"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-[#3970e1] dark:text-blue-400" />
            <span>Columns</span>
          </button>

          {showColumnMenu && (
            <div className="absolute right-0 mt-1 w-64 bg-white dark:bg-slate-900 border border-[#dee2e6] dark:border-slate-800 rounded-lg shadow-xl z-40 p-3 text-xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-[#e9ecef] dark:border-slate-800">
                <span className="font-bold text-[#32325d] dark:text-white">Column Visibility</span>
                <button
                  type="button"
                  onClick={() => setShowColumnMenu(false)}
                  className="text-[#8898aa] hover:text-[#32325d] dark:hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {toggleableColumns.map((col) => {
                  const isVisible = columnVisibility[col.id] !== false;
                  return (
                    <label
                      key={col.id}
                      className="flex items-center gap-2 px-1.5 py-1 hover:bg-[#f6f9fc] dark:hover:bg-slate-800 rounded cursor-pointer select-none"
                    >
                      <input
                        type="checkbox"
                        checked={isVisible}
                        onChange={(e) => {
                          setColumnVisibility((prev) => ({
                            ...prev,
                            [col.id]: e.target.checked
                          }));
                        }}
                        className="rounded border-[#dee2e6] dark:border-slate-700 text-[#3970e1] focus:ring-0"
                      />
                      <span className="text-[#525f7f] dark:text-slate-300 font-medium">{col.label}</span>
                    </label>
                  );
                })}
              </div>

              <div className="pt-2 border-t border-[#e9ecef] dark:border-slate-800 flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleResetLayout}
                  className="flex items-center gap-1 text-[13px] text-[#fb6340] hover:text-[#d33a18] font-semibold transition"
                  title="Reset column widths, order, and visibility to defaults"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset to defaults</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowColumnMenu(false)}
                  className="px-2.5 py-1 bg-[#3970e1] hover:bg-[#285bc7] text-white rounded font-semibold text-[12px] transition"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white dark:bg-slate-900 rounded-lg border border-[#e9ecef] dark:border-slate-800 shadow-argon overflow-hidden">
        <div 
          ref={tableContainerRef} 
          className="w-full overflow-auto max-h-[calc(100vh-270px)] min-h-[300px]"
        >
          <table 
            style={{ 
              width: `${table.getTotalSize()}px`, 
              minWidth: '100%',
              tableLayout: 'fixed'
            }} 
            className="text-left text-xs border-collapse"
          >
            {/* Explicit Colgroup for pixel-perfect column sizing */}
            <colgroup>
              {visibleLeafColumns.map((col) => (
                <col key={col.id} style={{ width: `${col.getSize()}px` }} />
              ))}
            </colgroup>

            {/* Table Header with Reordering & Resizing */}
            <thead className="bg-[#f6f9fc] dark:bg-slate-800 border-b border-[#e9ecef] dark:border-slate-700 text-[12px] uppercase text-[#8898aa] dark:text-slate-400 font-bold tracking-wider sticky top-0 z-20 shadow-sm select-none">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    const colId = header.column.id;
                    const canSort = header.column.getCanSort();
                    const isDraggable = colId !== 'select' && colId !== 'actions';
                    const isBeingDragged = draggedColId === colId;
                    const isTargetLeft = dropTarget?.id === colId && dropTarget?.position === 'left';
                    const isTargetRight = dropTarget?.id === colId && dropTarget?.position === 'right';

                    const columnName = COLUMN_LABELS[colId] || (typeof header.column.columnDef.header === 'string' ? header.column.columnDef.header : colId);

                    return (
                      <th
                        key={header.id}
                        style={{ width: `${header.getSize()}px` }}
                        onDragOver={(e) => handleDragOver(e, colId)}
                        onDrop={(e) => handleDrop(e, colId)}
                        title={columnName}
                        className={`relative py-2.5 px-3 transition-colors ${
                          isBeingDragged ? 'opacity-40 bg-[#eef2ff] dark:bg-blue-950/40' : ''
                        } ${
                          isTargetLeft ? 'border-l-4 border-[#3970e1] bg-[#eef2ff] dark:bg-blue-950/40' : ''
                        } ${
                          isTargetRight ? 'border-r-4 border-[#3970e1] bg-[#eef2ff] dark:bg-blue-950/40' : ''
                        }`}
                      >
                        <div className="flex items-center gap-1 min-w-0">
                          {/* Drag Handle (Only active when NOT resizing) */}
                          {isDraggable && (
                            <div
                              draggable={!isResizingAnyColumn}
                              onDragStart={(e) => handleDragStart(e, colId)}
                              onDragEnd={handleDragEnd}
                              className="cursor-grab active:cursor-grabbing p-0.5 text-[#adb5bd] hover:text-[#3970e1] dark:hover:text-blue-400 hover:bg-[#eef2ff] dark:hover:bg-slate-700 rounded transition opacity-35 hover:opacity-100 flex-shrink-0"
                              title={`Drag to reorder: ${columnName}`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <GripVertical className="w-3.5 h-3.5" />
                            </div>
                          )}

                          {/* Clickable Header Area for Instant Sorting */}
                          <div 
                            className={`flex items-center gap-1.5 min-w-0 flex-1 py-0.5 group ${
                              canSort ? 'cursor-pointer hover:text-[#3970e1] dark:hover:text-blue-400' : ''
                            }`}
                            onClick={() => {
                              if (canSort) {
                                handleSortToggle(colId);
                              }
                            }}
                            title={canSort ? `${columnName} (Click to sort)` : columnName}
                          >
                            <div className="truncate flex-1 font-bold">
                              {flexRender(header.column.columnDef.header, header.getContext())}
                            </div>

                            {canSort && (
                              <div className="flex-shrink-0">
                                {renderSortIndicator(colId)}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Interactive Column Resize Handle (Wide 18px hit area, centered on border, isolated events) */}
                        {header.column.getCanResize() && (
                          <div
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              const handler = header.getResizeHandler();
                              handler(e);
                            }}
                            onTouchStart={(e) => {
                              e.stopPropagation();
                              const handler = header.getResizeHandler();
                              handler(e);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            onDoubleClick={(e) => {
                              e.stopPropagation();
                              header.column.resetSize();
                            }}
                            className={`absolute -right-[9px] top-0 h-full w-[18px] cursor-col-resize select-none touch-none z-30 flex items-center justify-center group/resizer ${
                              header.column.getIsResizing() ? 'z-40' : ''
                            }`}
                            title="Drag to resize (double-click to reset)"
                          >
                            <div 
                              className={`w-[2px] transition-colors rounded-full ${
                                header.column.getIsResizing() 
                                  ? 'bg-[#3970e1] h-full' 
                                  : 'h-4 bg-[#adb5bd]/40 group-hover/resizer:bg-[#3970e1] group-hover/resizer:h-full'
                              }`} 
                            />
                          </div>
                        )}
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>

            {/* Virtualized Table Body */}
            <tbody className="divide-y divide-[#e9ecef] dark:divide-slate-800">
              {rows.length === 0 ? (
                <tr>
                  <td 
                    colSpan={visibleLeafColumns.length} 
                    className="py-16 text-center text-xs text-[#8898aa] dark:text-slate-400 space-y-2"
                  >
                    <Users className="w-8 h-8 mx-auto text-[#adb5bd] dark:text-slate-500 stroke-[1.5]" />
                    <p>No managed users match the specified criteria</p>
                  </td>
                </tr>
              ) : (
                <>
                  {/* Top Virtual Spacer */}
                  {paddingTop > 0 && (
                    <tr>
                      <td style={{ height: `${paddingTop}px` }} colSpan={visibleLeafColumns.length} />
                    </tr>
                  )}

                  {/* Rendered Virtual Rows */}
                  {virtualRows.map((virtualRow) => {
                    const row = rows[virtualRow.index];
                    const u = row.original;
                    const isSelected = selectedSet.has(String(u.id));
                    const isActive = activeUserId != null && String(activeUserId) === String(u.id);

                    return (
                      <tr
                        key={u.id}
                        onClick={(e) => handleRowClick(u, e, virtualRow.index)}
                        onDoubleClick={() => handleRowDoubleClick(u)}
                        className={`cursor-pointer transition-colors duration-100 ${
                          isActive
                            ? 'bg-[#eef2ff] dark:bg-blue-950/50 text-[#32325d] dark:text-blue-300 border-l-4 !border-l-[#3970e1] font-semibold'
                            : isSelected
                            ? 'bg-[#f8f9fe] dark:bg-slate-800/80 text-[#525f7f] dark:text-slate-200 border-l-4 !border-l-[#adb5bd] dark:!border-l-slate-600'
                            : 'hover:bg-[#f6f9fc] dark:hover:bg-slate-800/50 text-[#525f7f] dark:text-slate-300 border-l-4 !border-l-[#e9ecef] dark:!border-l-slate-800'
                        }`}
                      >
                        {row.getVisibleCells().map((cell) => (
                          <td
                            key={cell.id}
                            style={{ width: `${cell.column.getSize()}px` }}
                            className="py-3 px-3 overflow-hidden text-ellipsis align-middle"
                          >
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
                      </tr>
                    );
                  })}

                  {/* Bottom Virtual Spacer */}
                  {paddingBottom > 0 && (
                    <tr>
                      <td style={{ height: `${paddingBottom}px` }} colSpan={visibleLeafColumns.length} />
                    </tr>
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
