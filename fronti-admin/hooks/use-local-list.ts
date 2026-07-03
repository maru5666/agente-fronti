'use client';

import { useEffect, useState } from 'react';

export function useLocalList<T extends { id: string }>(key: string) {
  const [items, setItems] = useState<T[]>([]);

  useEffect(() => {
    const raw = window.localStorage.getItem(key);
    setItems(raw ? JSON.parse(raw) : []);
  }, [key]);

  function save(nextItems: T[]) {
    setItems(nextItems);
    window.localStorage.setItem(key, JSON.stringify(nextItems));
  }

  function add(item: Omit<T, 'id'>) {
    save([{ ...item, id: crypto.randomUUID() } as T, ...items]);
  }

  function remove(id: string) {
    save(items.filter((item) => item.id !== id));
  }

  return { items, add, remove };
}
