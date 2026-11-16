"use client";

import { useId, useRef, useState } from "react";
import { ChevronDown, Search, X } from "lucide-react";

interface RoomOption {
  id: string;
  roomNumber: string;
  floor: string;
}

interface RoomComboboxProps {
  rooms: RoomOption[];
  selectedRoom: RoomOption | null;
  onSelect: (id: string) => void;
}

function roomLabel(room: RoomOption) {
  const floor = room.floor.toLowerCase().includes("floor") ? room.floor : `Floor ${room.floor}`;
  return `${room.roomNumber} (${floor})`;
}

export default function RoomCombobox({ rooms, selectedRoom, onSelect }: RoomComboboxProps) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const matches = rooms.filter((room) =>
    room.roomNumber.toLowerCase().includes(query.trim().toLowerCase())
  );
  const activeRoom = matches[activeIndex];

  const chooseRoom = (room: RoomOption) => {
    onSelect(room.id);
    setQuery("");
    setOpen(false);
    setActiveIndex(-1);
  };

  const moveActive = (index: number) => {
    setActiveIndex(index);
    if (matches[index]) {
      document.getElementById(`${listId}-${matches[index].id}`)?.scrollIntoView({ block: "nearest" });
    }
  };

  return (
    <div
      className="relative"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setOpen(false);
          setActiveIndex(-1);
        }
      }}
    >
      <Search aria-hidden="true" className="w-4 h-4 text-slate-400 absolute left-3 top-3.5 pointer-events-none" />
      <input
        ref={inputRef}
        id="room-select-dropdown"
        type="text"
        role="combobox"
        aria-label="Select your room"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && activeRoom ? `${listId}-${activeRoom.id}` : undefined}
        autoComplete="off"
        placeholder="Select your room"
        value={selectedRoom ? roomLabel(selectedRoom) : query}
        onFocus={(event) => {
          setOpen(true);
          setActiveIndex(-1);
          if (selectedRoom) event.currentTarget.select();
        }}
        onClick={() => setOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value);
          onSelect("");
          setOpen(true);
          setActiveIndex(-1);
        }}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing) return;
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
            if (matches.length === 0) return;
            const next = event.key === "ArrowDown"
              ? Math.min(activeIndex + 1, matches.length - 1)
              : activeIndex < 0 ? matches.length - 1 : Math.max(activeIndex - 1, 0);
            moveActive(next);
          } else if (event.key === "Enter" && open) {
            event.preventDefault();
            const room = activeRoom ?? matches[0];
            if (room) chooseRoom(room);
          } else if (event.key === "Escape") {
            setOpen(false);
            setActiveIndex(-1);
          }
        }}
        className="w-full bg-white border border-slate-300 rounded-md pl-9 pr-11 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
      />
      {selectedRoom || query ? (
        <button
          type="button"
          aria-label="Clear room selection"
          onClick={() => {
            onSelect("");
            setQuery("");
            setActiveIndex(-1);
            setOpen(true);
            inputRef.current?.focus();
          }}
          className="absolute right-0 top-0 w-11 h-11 flex items-center justify-center text-slate-500 hover:text-slate-900"
        >
          <X className="w-4 h-4" />
        </button>
      ) : (
        <ChevronDown aria-hidden="true" className="absolute right-3 top-3.5 w-4 h-4 text-slate-400 pointer-events-none" />
      )}
      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Available rooms"
          onMouseDown={(event) => event.preventDefault()}
          className="absolute z-30 mt-1 w-full max-h-56 overflow-y-auto rounded-md border border-slate-200 bg-white py-1 shadow-sm"
        >
          {matches.length === 0 ? (
            <li role="presentation" className="px-3 py-3 text-sm text-slate-500">No matching rooms</li>
          ) : matches.map((room, index) => (
            <li
              key={room.id}
              id={`${listId}-${room.id}`}
              role="option"
              aria-selected={selectedRoom?.id === room.id}
              onClick={() => chooseRoom(room)}
              className={`cursor-pointer px-3 py-2.5 text-sm hover:bg-blue-50 ${
                activeIndex === index || selectedRoom?.id === room.id ? "bg-blue-50 text-blue-800" : "text-slate-800"
              }`}
            >
              {roomLabel(room)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
