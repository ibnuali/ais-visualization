import type { ChangeEvent, MouseEvent, RefObject } from "react";
import type { Command } from "../../../types.ts";
import Icon from "./Icon.tsx";

interface CommandMenuProps {
  activeIndex: number;
  commands: Command[];
  inputRef: RefObject<HTMLInputElement | null>;
  onClose: () => void;
  onQueryChange: (query: string) => void;
  query: string;
}

export default function CommandMenu({
  activeIndex,
  commands,
  inputRef,
  onClose,
  onQueryChange,
  query,
}: CommandMenuProps) {
  const handleQueryChange = (event: ChangeEvent<HTMLInputElement>): void => {
    onQueryChange(event.target.value);
  };

  const handleOverlayMouseDown = (event: MouseEvent<HTMLDivElement>): void => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      aria-hidden="false"
      className="command-overlay"
      onMouseDown={handleOverlayMouseDown}
      role="presentation"
    >
      <div
        aria-labelledby="command-menu-title"
        aria-modal="true"
        className="command-menu"
        role="dialog"
      >
        <div className="command-search">
          <Icon name="locate" size={17} />
          <input
            ref={inputRef}
            aria-label="Search commands"
            onChange={handleQueryChange}
            placeholder="Search commands"
            value={query}
          />
          <button
            aria-label="Close command menu"
            className="command-close"
            onClick={onClose}
            type="button"
          >
            <Icon name="close" size={16} />
          </button>
        </div>
        <div className="command-menu__heading">
          <span id="command-menu-title">Command menu</span>
          <kbd>esc</kbd>
        </div>
        <div
          className="command-list"
          role="listbox"
          aria-label="Available commands"
        >
          {commands.map((command, index) => (
            <button
              aria-disabled={command.disabled}
              aria-selected={index === activeIndex}
              className={`command-item ${index === activeIndex ? "is-active" : ""}`}
              disabled={command.disabled}
              key={command.id}
              onClick={command.run}
              role="option"
              type="button"
            >
              <span className="command-item__icon">
                <Icon name={command.icon} size={16} />
              </span>
              <span className="command-item__copy">
                <strong>{command.label}</strong>
                <span>{command.detail}</span>
              </span>
              {index === activeIndex && <Icon name="arrow" size={15} />}
            </button>
          ))}
          {commands.length === 0 && (
            <p className="command-empty">No commands match “{query}”.</p>
          )}
        </div>
      </div>
    </div>
  );
}
