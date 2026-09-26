import React from 'react';
import { Calendar as CalendarIcon, Clock, ChevronLeft, ChevronRight, X, Infinity } from 'lucide-react';

export default function CalendarPicker({ 
  value, 
  onChange, 
  label = "Expiration Date", 
  inline = false,
  align = "left" 
}) {
  const [isOpen, setIsOpen] = React.useState(false);
  const containerRef = React.useRef(null);

  // Parse current value
  const dateValue = React.useMemo(() => {
    if (!value) return null;
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }, [value]);

  // Calendar view state (year, month)
  const [viewDate, setViewDate] = React.useState(() => dateValue || new Date());

  React.useEffect(() => {
    if (dateValue) {
      setViewDate(new Date(dateValue));
    }
  }, [value]);

  // Close on outside click if in popup mode
  React.useEffect(() => {
    if (inline) return;
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, inline]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = (new Date(year, month, 1).getDay() + 6) % 7; // Monday = 0

  const handlePrevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const handleNextMonth = () => setViewDate(new Date(year, month + 1, 1));

  // Weekday names localized to browser language (Monday to Sunday)
  const weekDays = React.useMemo(() => {
    const days = [];
    const base = new Date(2026, 8, 21); // Monday Sep 21 2026
    for (let i = 0; i < 7; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      days.push(d.toLocaleDateString(undefined, { weekday: 'short' }));
    }
    return days;
  }, []);

  const handleSelectDay = (day) => {
    const newDate = dateValue ? new Date(dateValue) : new Date();
    newDate.setFullYear(year);
    newDate.setMonth(month);
    newDate.setDate(day);
    onChange(newDate.toISOString());
  };

  const handleTimeChange = (hours, minutes) => {
    const newDate = dateValue ? new Date(dateValue) : new Date();
    newDate.setHours(hours);
    newDate.setMinutes(minutes);
    onChange(newDate.toISOString());
  };

  const applyPreset = (months) => {
    if (months === 0) {
      onChange(null);
      return;
    }
    const d = new Date();
    d.setMonth(d.getMonth() + months);
    d.setHours(23, 59, 0, 0);
    setViewDate(new Date(d));
    onChange(d.toISOString());
  };

  const formatDateDisplay = (date) => {
    if (!date) return 'No expiration (Unlimited)';
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderCalendarBody = () => (
    <div className="space-y-3">
      {/* Quick Presets */}
      <div className="flex flex-wrap items-center justify-between gap-1 pb-2.5 border-b border-[#e9ecef] dark:border-slate-800 text-[13px]">
        <div className="flex items-center gap-1 flex-wrap">
          <button
            type="button"
            onClick={() => applyPreset(1)}
            className="px-2.5 py-1 bg-white dark:bg-slate-800 hover:bg-[#f6f9fc] dark:hover:bg-slate-700 text-[#525f7f] dark:text-slate-200 border border-[#dee2e6] dark:border-slate-700 rounded font-semibold transition active:scale-[0.98] shadow-sm"
          >
            +1M
          </button>
          <button
            type="button"
            onClick={() => applyPreset(3)}
            className="px-2.5 py-1 bg-white dark:bg-slate-800 hover:bg-[#f6f9fc] dark:hover:bg-slate-700 text-[#525f7f] dark:text-slate-200 border border-[#dee2e6] dark:border-slate-700 rounded font-semibold transition active:scale-[0.98] shadow-sm"
          >
            +3M
          </button>
          <button
            type="button"
            onClick={() => applyPreset(6)}
            className="px-2.5 py-1 bg-white dark:bg-slate-800 hover:bg-[#f6f9fc] dark:hover:bg-slate-700 text-[#525f7f] dark:text-slate-200 border border-[#dee2e6] dark:border-slate-700 rounded font-semibold transition active:scale-[0.98] shadow-sm"
          >
            +6M
          </button>
          <button
            type="button"
            onClick={() => applyPreset(12)}
            className="px-2.5 py-1 bg-[#eef2ff] dark:bg-blue-950/60 text-[#3970e1] dark:text-blue-400 border border-[#3970e1]/30 dark:border-blue-700/40 hover:bg-[#3970e1] hover:text-white rounded font-semibold transition active:scale-[0.98]"
          >
            +1 Year
          </button>
        </div>
        <button
          type="button"
          onClick={() => applyPreset(0)}
          className={`px-2.5 py-1 rounded font-semibold transition flex items-center gap-1 active:scale-[0.98] ${
            !dateValue 
              ? 'bg-[#e8faf1] dark:bg-emerald-950/50 text-[#2dce89] dark:text-emerald-400 border border-[#2dce89]/40 dark:border-emerald-700/40' 
              : 'bg-white dark:bg-slate-800 hover:bg-[#f6f9fc] dark:hover:bg-slate-700 text-[#8898aa] dark:text-slate-400 hover:text-[#525f7f] dark:hover:text-slate-200 border border-[#dee2e6] dark:border-slate-700'
          }`}
          title="Set user with unlimited expiration"
        >
          <Infinity className="w-3 h-3" />
          <span>Unlimited</span>
        </button>
      </div>

      {/* Month / Year header */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={handlePrevMonth}
          className="p-1 hover:bg-[#f6f9fc] dark:hover:bg-slate-800 text-[#8898aa] dark:text-slate-400 hover:text-[#32325d] dark:hover:text-white rounded transition"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-xs sm:text-sm font-bold text-[#32325d] dark:text-white capitalize">
          {viewDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
        </span>
        <button
          type="button"
          onClick={handleNextMonth}
          className="p-1 hover:bg-[#f6f9fc] dark:hover:bg-slate-800 text-[#8898aa] dark:text-slate-400 hover:text-[#32325d] dark:hover:text-white rounded transition"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Days of week */}
      <div className="grid grid-cols-7 gap-1 text-center text-[12px] font-bold text-[#8898aa] dark:text-slate-400 uppercase">
        {weekDays.map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 gap-1 text-xs">
        {Array.from({ length: firstDayIndex }).map((_, i) => (
          <div key={`empty-${i}`} />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const isSelected =
            dateValue &&
            dateValue.getDate() === day &&
            dateValue.getMonth() === month &&
            dateValue.getFullYear() === year;

          const isToday =
            new Date().getDate() === day &&
            new Date().getMonth() === month &&
            new Date().getFullYear() === year;

          return (
            <button
              key={`day-${day}`}
              type="button"
              onClick={() => handleSelectDay(day)}
              className={`h-7 sm:h-8 rounded flex items-center justify-center font-semibold transition active:scale-[0.98] ${
                isSelected
                  ? 'bg-[#3970e1] text-white shadow-argon-btn'
                  : isToday
                  ? 'border border-[#3970e1] dark:border-blue-500 text-[#3970e1] dark:text-blue-400 hover:bg-[#eef2ff] dark:hover:bg-blue-950/40'
                  : 'text-[#525f7f] dark:text-slate-300 hover:bg-[#f6f9fc] dark:hover:bg-slate-800'
              }`}
            >
              {day}
            </button>
          );
        })}
      </div>

      {/* Time Picker */}
      <div className="flex items-center justify-between pt-2 border-t border-[#e9ecef] dark:border-slate-800 text-xs text-[#525f7f] dark:text-slate-300">
        <div className="flex items-center gap-1.5 font-medium">
          <Clock className="w-3.5 h-3.5 text-[#3970e1] dark:text-blue-400" />
          <span>Time:</span>
        </div>
        <div className="flex items-center gap-1 font-semibold">
          <input
            type="number"
            min="0"
            max="23"
            disabled={!dateValue}
            value={dateValue ? dateValue.getHours() : 0}
            onChange={(e) => handleTimeChange(Math.max(0, Math.min(23, Number(e.target.value))), dateValue ? dateValue.getMinutes() : 0)}
            className="w-12 px-1.5 py-0.5 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded text-center text-[#32325d] dark:text-white font-mono text-xs focus:outline-none focus:border-[#3970e1] disabled:opacity-40"
          />
          <span>:</span>
          <input
            type="number"
            min="0"
            max="59"
            disabled={!dateValue}
            value={dateValue ? dateValue.getMinutes() : 0}
            onChange={(e) => handleTimeChange(dateValue ? dateValue.getHours() : 0, Math.max(0, Math.min(59, Number(e.target.value))))}
            className="w-12 px-1.5 py-0.5 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded text-center text-[#32325d] dark:text-white font-mono text-xs focus:outline-none focus:border-[#3970e1] disabled:opacity-40"
          />
        </div>
      </div>
    </div>
  );

  // Inline mode renders directly in-flow
  if (inline) {
    return (
      <div className="space-y-2">
        {label && (
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-[#525f7f] dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5 leading-4">
              <CalendarIcon className="w-3.5 h-3.5 text-[#3970e1] dark:text-blue-400" />
              <span>{label}</span>
            </label>
            <span className={`text-xs font-mono font-semibold leading-4 ${dateValue ? 'text-[#32325d] dark:text-white' : 'text-[#2dce89] dark:text-emerald-400'}`}>
              {formatDateDisplay(dateValue)}
            </span>
          </div>
        )}
        <div className="bg-white dark:bg-slate-900 border border-[#dee2e6] dark:border-slate-800 rounded-lg p-3.5 sm:p-4 shadow-sm">
          {renderCalendarBody()}
        </div>
      </div>
    );
  }

  // Popup mode
  return (
    <div className="relative" ref={containerRef}>
      {label && <label className="block text-xs font-bold text-[#525f7f] dark:text-slate-300 uppercase tracking-wider mb-1 leading-4">{label}</label>}

      <div className="flex items-stretch gap-2">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex-1 flex items-center justify-between px-3 py-2 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 hover:border-[#cad1d7] dark:hover:border-slate-600 rounded text-xs text-[#32325d] dark:text-slate-100 focus:outline-none focus:border-[#3970e1] focus:ring-1 focus:ring-[#3970e1]/30 transition shadow-sm active:scale-[0.98]"
        >
          <div className="flex items-center gap-2 truncate">
            <CalendarIcon className="w-3.5 h-3.5 text-[#3970e1] dark:text-blue-400 flex-shrink-0" />
            <span className={dateValue ? 'text-[#32325d] dark:text-slate-100 font-mono font-semibold' : 'text-[#8898aa] dark:text-slate-400'}>
              {formatDateDisplay(dateValue)}
            </span>
          </div>
          <span className="text-[13px] text-[#3970e1] dark:text-blue-400 font-semibold ml-2">{isOpen ? 'Done' : 'Edit'}</span>
        </button>

        {dateValue && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="px-2.5 flex items-center justify-center bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 hover:bg-[#feecee] dark:hover:bg-red-950/40 hover:border-[#f5365c]/30 text-[#8898aa] dark:text-slate-400 hover:text-[#f5365c] dark:hover:text-red-400 rounded transition shadow-sm active:scale-[0.98]"
            title="Clear expiration"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {isOpen && (
        <div className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} mt-1.5 w-72 sm:w-80 max-w-[calc(100vw-2rem)] bg-white dark:bg-slate-900 border border-[#dee2e6] dark:border-slate-800 rounded-lg shadow-argon-dropdown dark:shadow-2xl p-3.5 z-[100] animate-in fade-in zoom-in-95 duration-100`}>
          {renderCalendarBody()}
        </div>
      )}
    </div>
  );
}
