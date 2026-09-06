import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Command } from "../../../types.ts";

export interface CommandMenuState {
  activeIndex: number;
  close: () => void;
  filteredCommands: Command[];
  inputRef: React.RefObject<HTMLInputElement | null>;
  isOpen: boolean;
  open: () => void;
  query: string;
  setQuery: (query: string) => void;
}

export function useCommandMenu(commands: Command[]): CommandMenuState {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const open = useCallback((): void => {
    setQuery("");
    setActiveIndex(0);
    setIsOpen(true);
  }, []);

  const close = useCallback((): void => {
    setIsOpen(false);
  }, []);

  const runnableCommands = useMemo(
    () =>
      commands.map((command) => ({
        ...command,
        run: (): void => {
          if (command.disabled) {
            return;
          }

          close();
          command.run();
        },
      })),
    [close, commands],
  );

  const filteredCommands = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return runnableCommands.filter(
      (command) =>
        !normalizedQuery ||
        `${command.label} ${command.detail}`
          .toLowerCase()
          .includes(normalizedQuery),
    );
  }, [query, runnableCommands]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isOpen]);

  useEffect(() => {
    const handleGlobalKeyDown = (event: KeyboardEvent): void => {
      const isCommandShortcut =
        (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";

      if (isCommandShortcut) {
        event.preventDefault();
        if (isOpen) {
          close();
        } else {
          open();
        }
        return;
      }

      if (!isOpen) {
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        close();
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((index) =>
          Math.min(index + 1, Math.max(filteredCommands.length - 1, 0)),
        );
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((index) => Math.max(index - 1, 0));
      } else if (event.key === "Enter") {
        event.preventDefault();
        const activeCommand = filteredCommands[activeIndex];
        if (activeCommand && !activeCommand.disabled) {
          activeCommand.run();
        }
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [activeIndex, close, filteredCommands, isOpen, open]);

  return {
    activeIndex,
    close,
    filteredCommands,
    inputRef,
    isOpen,
    open,
    query,
    setQuery,
  };
}
