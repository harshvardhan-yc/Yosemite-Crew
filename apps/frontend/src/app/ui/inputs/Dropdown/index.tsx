import React, { useEffect, useId, useRef, useState } from 'react';
import { FaCaretDown } from 'react-icons/fa6';
import { IoIosWarning } from 'react-icons/io';

type Option = {
  key: string;
  label: string;
};

type DropdownProps = {
  placeholder: string;
  options: Option[];
  defaultOption?: string;
  onSelect: (option: Option) => void;
  error?: string;
};

const Dropdown = ({ placeholder, options, defaultOption, onSelect, error }: DropdownProps) => {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Option | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const activeOptionId =
    activeIndex >= 0 && activeIndex < options.length
      ? `${listboxId}-option-${options[activeIndex].key}`
      : undefined;

  useEffect(() => {
    if (!defaultOption) return;
    const found = options.find((option) => option.key === defaultOption);
    if (found) setSelected(found);
  }, [defaultOption, options]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (!open || options.length === 0) {
      setActiveIndex(-1);
      return;
    }
    setActiveIndex((current) => {
      if (current >= 0 && current < options.length) return current;
      const selectedIndex = options.findIndex((option) => option.key === selected?.key);
      return selectedIndex >= 0 ? selectedIndex : 0;
    });
  }, [open, options, selected?.key]);

  useEffect(() => {
    if (!open || !activeOptionId) return;
    document.getElementById(activeOptionId)?.scrollIntoView({ block: 'nearest' });
  }, [activeOptionId, open]);

  const selectOption = (option: Option) => {
    setSelected(option);
    onSelect(option);
    setOpen(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    const optionCount = options.length;
    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (optionCount === 0) return;
      if (!open) {
        setOpen(true);
        return;
      }
      setActiveIndex((current) => (current + 1 >= optionCount ? 0 : current + 1));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (optionCount === 0) return;
      if (!open) {
        setOpen(true);
        return;
      }
      setActiveIndex((current) => (current <= 0 ? optionCount - 1 : current - 1));
      return;
    }
    if (event.key === 'Home' && open && optionCount > 0) {
      event.preventDefault();
      setActiveIndex(0);
      return;
    }
    if (event.key === 'End' && open && optionCount > 0) {
      event.preventDefault();
      setActiveIndex(optionCount - 1);
      return;
    }
    if (event.key !== 'Enter' && event.key !== ' ') return;
    if (!open) {
      event.preventDefault();
      setOpen(true);
      return;
    }
    if (activeIndex < 0 || activeIndex >= optionCount) return;
    event.preventDefault();
    selectOption(options[activeIndex]);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        className={`w-full flex items-center justify-between gap-2 px-6 py-[10px] min-w-[120px] ${error && 'border-input-border-error!'} ${open ? 'border border-b-0 border-input-border-active! rounded-t-2xl!' : 'border border-input-border-default! rounded-2xl!'}`}
        onClick={() => setOpen((e) => !e)}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
      >
        {selected ? (
          <div className="text-black-text text-body-4 truncate max-w-[200px]">{selected.label}</div>
        ) : (
          <div className="text-black-text text-body-4 truncate max-w-[200px]">{placeholder}</div>
        )}
        <FaCaretDown size={20} className={`text-black-text transition-transform cursor-pointer`} />
      </button>
      {open && (
        <div
          id={listboxId}
          role="listbox"
          className="border-input-text-placeholder-active max-h-50 overflow-y-auto scrollbar-hidden z-99 absolute top-full left-0 rounded-b-2xl border-l border-r border-b border-t bg-white flex flex-col items-center w-full px-3 py-2.5"
        >
          {options.map((option, i) => (
            <button
              type="button"
              key={option.key + i}
              id={`${listboxId}-option-${option.key}`}
              role="option"
              aria-selected={selected?.key === option.key}
              className={`px-[1.25rem] py-[0.75rem] text-body-4 hover:bg-card-hover rounded-2xl! text-text-secondary! hover:text-text-primary! w-full ${
                activeOptionId === `${listboxId}-option-${option.key}`
                  ? 'bg-card-hover text-text-primary!'
                  : ''
              }`}
              onMouseEnter={() => setActiveIndex(i)}
              onClick={() => selectOption(option)}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
      {error && (
        <div
          className={`
            mt-1.5 flex items-center gap-1 px-4
            text-caption-2 text-text-error
            `}
        >
          <IoIosWarning className="text-text-error" size={14} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};

export default Dropdown;
