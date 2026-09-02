import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, ChevronDown, Check } from 'lucide-react';
import { cn } from '../lib/utils';

interface DatePickerProps {
  label: string;
  value: Date | null;
  onChange: (date: Date) => void;
  align?: 'left' | 'right';
}

export function DatePicker({ label, value, onChange, align = 'left' }: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(value ? value.getMonth() : new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(value ? value.getFullYear() : new Date().getFullYear());
  const [showMonthDropdown, setShowMonthDropdown] = useState(false);
  const [showYearDropdown, setShowYearDropdown] = useState(false);
  const [maxYear, setMaxYear] = useState(Math.max(new Date().getFullYear() + 10, 2036));
  
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setShowMonthDropdown(false);
        setShowYearDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (value) {
      setCurrentMonth(value.getMonth());
      setCurrentYear(value.getFullYear());
    }
  }, [value]);

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(prev => prev - 1);
    } else {
      setCurrentMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(prev => prev + 1);
    } else {
      setCurrentMonth(prev => prev + 1);
    }
  };

  const handleYearScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop <= clientHeight + 10) {
      setMaxYear(prev => {
        const expectedMax = currentYear + 10;
        if (prev > expectedMax && prev - expectedMax > 50) return prev;
        return prev + 10;
      });
    }
  };

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
  const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();
  
  const prevMonthDays = Array.from({ length: firstDayOfMonth }, (_, i) => daysInPrevMonth - firstDayOfMonth + i + 1);
  const currentMonthDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const nextMonthDays = Array.from({ length: 42 - (prevMonthDays.length + currentMonthDays.length) }, (_, i) => i + 1);

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const calendarMonthName = monthNames[currentMonth].substring(0, 3);

  const formattedValue = value 
    ? `${monthNames[value.getMonth()].substring(0, 3)} ${value.getDate()}, ${value.getFullYear()}`
    : 'Select date';

  return (
    <div className="relative" ref={containerRef}>
      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 ml-0.5">{label}</label>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full flex items-center justify-between px-3.5 py-2.5 bg-[var(--dash-bg)] border rounded-xl transition-all duration-200 cursor-pointer text-xs md:text-sm font-semibold",
          isOpen ? "border-indigo-500 shadow-[0_0_0_2px_rgba(99,102,241,0.15)]" : "border-[var(--dash-border)] hover:border-slate-600",
          !value ? "text-slate-500" : "text-white"
        )}
      >
        <span className="truncate">{formattedValue}</span>
        <CalendarIcon size={15} className={isOpen ? "text-indigo-400 shrink-0 ml-2" : "text-slate-400 shrink-0 ml-2"} />
      </button>

      {isOpen && (
        <div 
          className={cn(
            "absolute top-full mt-2 w-[285px] sm:w-[310px] bg-[var(--dash-card)] border border-[var(--dash-border)]/90 rounded-2xl shadow-2xl z-[150] p-4 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200",
            align === 'right' ? "right-0 sm:left-auto" : "left-0 sm:right-auto"
          )}
          style={{ maxWidth: 'calc(100vw - 32px)' }}
        >
          <div className="flex items-center justify-between mb-3.5">
            <button 
              onClick={handlePrevMonth} 
              className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="flex gap-1.5">
              <div className="relative">
                <button 
                  onClick={() => { setShowMonthDropdown(!showMonthDropdown); setShowYearDropdown(false); }} 
                  className="flex items-center gap-1 px-2.5 py-1 hover:bg-white/10 rounded-lg text-xs font-bold text-white transition-colors cursor-pointer border border-white/5"
                >
                  {calendarMonthName} <ChevronDown size={13} className="text-slate-400" />
                </button>
                {showMonthDropdown && (
                  <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 w-32 bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-xl shadow-2xl z-50 py-1.5 max-h-48 overflow-y-auto custom-scrollbar">
                    {monthNames.map((m, i) => (
                      <button 
                        key={m} 
                        onClick={() => { setCurrentMonth(i); setShowMonthDropdown(false); }} 
                        className={cn(
                          "w-full text-left px-3 py-1.5 text-xs hover:bg-white/10 flex justify-between items-center transition-colors cursor-pointer",
                          currentMonth === i ? "text-indigo-400 font-bold bg-indigo-500/10" : "text-slate-300"
                        )}
                      >
                        <span>{m.substring(0, 3)}</span>
                        {currentMonth === i && <Check size={13} className="text-indigo-400" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="relative">
                <button 
                  onClick={() => { setShowYearDropdown(!showYearDropdown); setShowMonthDropdown(false); }} 
                  className="flex items-center gap-1 px-2.5 py-1 hover:bg-white/10 rounded-lg text-xs font-bold text-white transition-colors cursor-pointer border border-white/5"
                >
                  {currentYear} <ChevronDown size={13} className="text-slate-400" />
                </button>
                {showYearDropdown && (
                  <div 
                    className="absolute top-full left-1/2 -translate-x-1/2 mt-1 w-24 bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-xl shadow-2xl z-50 py-1.5 max-h-48 overflow-y-auto custom-scrollbar"
                    onScroll={handleYearScroll}
                  >
                    {Array.from({ length: maxYear - 2020 + 1 }, (_, i) => 2020 + i).map(y => (
                      <button 
                        key={y} 
                        onClick={() => { setCurrentYear(y); setShowYearDropdown(false); }} 
                        className={cn(
                          "w-full text-left px-3 py-1.5 text-xs hover:bg-white/10 flex justify-between items-center transition-colors cursor-pointer",
                          currentYear === y ? "text-indigo-400 font-bold bg-indigo-500/10" : "text-slate-300"
                        )}
                      >
                        <span>{y}</span>
                        {currentYear === y && <Check size={13} className="text-indigo-400" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <button 
              onClick={handleNextMonth} 
              className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <ChevronRight size={18} />
            </button>
          </div>
          
          <div className="grid grid-cols-7 gap-1 text-center mb-2">
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d, i) => (
              <div key={i} className="text-[10px] font-bold text-slate-400 py-0.5 uppercase tracking-wider">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1 text-center">
            {prevMonthDays.map(d => <div key={`prev-${d}`} className="py-1 text-xs text-slate-600/40 select-none">{d}</div>)}
            {currentMonthDays.map(d => {
              const isSelected = value?.getDate() === d && value?.getMonth() === currentMonth && value?.getFullYear() === currentYear;
              const isToday = new Date().getDate() === d && new Date().getMonth() === currentMonth && new Date().getFullYear() === currentYear;
              
              return (
                <button
                  key={`curr-${d}`}
                  type="button"
                  onClick={() => {
                    onChange(new Date(currentYear, currentMonth, d));
                    setIsOpen(false);
                  }}
                  className={cn(
                    "mx-auto w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center text-xs rounded-xl transition-all duration-150 cursor-pointer",
                    isSelected 
                      ? "bg-indigo-600 text-white font-bold shadow-md shadow-indigo-500/30 scale-105" 
                      : isToday
                        ? "bg-indigo-500/10 text-indigo-400 font-bold border border-indigo-500/30 hover:bg-indigo-500/20"
                        : "text-slate-300 hover:bg-white/10 hover:text-white"
                  )}
                >
                  {d}
                </button>
              );
            })}
            {nextMonthDays.map(d => <div key={`next-${d}`} className="py-1 text-xs text-slate-600/40 select-none">{d}</div>)}
          </div>
        </div>
      )}
    </div>
  );
}
