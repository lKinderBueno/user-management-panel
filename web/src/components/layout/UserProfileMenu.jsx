import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User,
  ShieldCheck,
  ShieldAlert,
  Settings,
  LogOut,
  ChevronDown
} from 'lucide-react';

export default function UserProfileMenu({ admin, onLogout }) {
  const navigate = useNavigate();
  const [open, setOpen] = React.useState(false);
  const menuRef = React.useRef(null);

  React.useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const handleNav = (path) => {
    setOpen(false);
    navigate(path);
  };

  const username = admin?.username || 'admin';
  const role = admin?.role === 'admin' ? 'Administrator' : 'Collaborator';
  const initial = username.charAt(0).toUpperCase();

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 p-1.5 rounded-full hover:bg-white/10 transition active:scale-95 group text-white select-none"
        aria-label="User profile menu"
      >
        <div className="w-8 h-8 shrink-0 aspect-square rounded-full bg-white/20 border border-white/40 flex items-center justify-center font-bold text-xs shadow-sm">
          {initial}
        </div>
        <div className="hidden sm:flex flex-col text-left leading-tight">
          <span className="text-[13px] font-bold text-white group-hover:text-white/90 truncate max-w-[120px]">
            {username}
          </span>
          <span className="text-[12px] text-white/80 font-medium">
            {role}
          </span>
        </div>
        <ChevronDown className="w-3.5 h-3.5 text-white/80 group-hover:text-white transition-transform duration-150" />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-900 border border-[#dee2e6] dark:border-slate-800 rounded-2xl shadow-argon-dropdown py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100 text-[#32325d] dark:text-slate-200">
          {/* User Info Header */}
          <div className="px-4 py-2.5 border-b border-[#e9ecef] dark:border-slate-800">
            <p className="text-[13px] font-bold text-[#32325d] dark:text-white truncate">{username}</p>
            <span className="inline-block mt-0.5 text-[12px] font-semibold px-2 py-0.5 rounded-full bg-[#eef2ff] dark:bg-blue-950/60 text-[#3970e1] dark:text-blue-400 border border-transparent dark:border-blue-800/40">
              {role}
            </span>
          </div>

          {/* Quick Links */}
          <div className="py-1">
            {(admin?.can_create_admins || admin?.can_create_collaborators) && (
              <button
                type="button"
                onClick={() => handleNav('/team')}
                className="w-full text-left px-4 py-2 text-[13px] flex items-center gap-2.5 text-[#525f7f] dark:text-slate-300 hover:text-[#3970e1] dark:hover:text-blue-400 hover:bg-[#f6f9fc] dark:hover:bg-slate-800 transition"
              >
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <span>Team Management</span>
              </button>
            )}

            {admin?.role === 'admin' && (
              <>
                <button
                  type="button"
                  onClick={() => handleNav('/security')}
                  className="w-full text-left px-4 py-2 text-[13px] flex items-center gap-2.5 text-[#525f7f] dark:text-slate-300 hover:text-[#3970e1] dark:hover:text-blue-400 hover:bg-[#f6f9fc] dark:hover:bg-slate-800 transition"
                >
                  <ShieldAlert className="w-4 h-4 text-rose-500" />
                  <span>Security & Bans</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleNav('/settings')}
                  className="w-full text-left px-4 py-2 text-[13px] flex items-center gap-2.5 text-[#525f7f] dark:text-slate-300 hover:text-[#3970e1] dark:hover:text-blue-400 hover:bg-[#f6f9fc] dark:hover:bg-slate-800 transition"
                >
                  <Settings className="w-4 h-4 text-[#3970e1] dark:text-blue-400" />
                  <span>System Settings</span>
                </button>
              </>
            )}
          </div>

          {/* Sign Out */}
          <div className="pt-1 border-t border-[#e9ecef] dark:border-slate-800">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onLogout?.();
              }}
              className="w-full text-left px-4 py-2 text-[13px] flex items-center gap-2.5 text-[#f5365c] dark:text-rose-400 hover:bg-[#feecee] dark:hover:bg-rose-950/40 transition font-semibold"
            >
              <LogOut className="w-4 h-4 text-[#f5365c] dark:text-rose-400" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
