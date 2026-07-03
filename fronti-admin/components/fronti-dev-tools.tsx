'use client';

import type { FormEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { MessageSquareText, X } from 'lucide-react';
import { useCompany } from '@/hooks/use-company';
import { frontiApi, getApiError } from '@/services/api';
import { FrontiMark } from './fronti-logo';

type Position = 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';
type Size = 'small' | 'medium' | 'large';

type AssistantMessage = {
  role: 'user' | 'fronti';
  text: string;
};

const storageKey = 'fronti.devtools.preferences';
const hideUntilKey = 'fronti.devtools.hiddenUntil';

const sizeClasses: Record<Size, string> = {
  small: 'w-80',
  medium: 'w-96',
  large: 'w-[28rem]',
};

const positionClasses: Record<Position, string> = {
  'bottom-left': 'bottom-5 left-5',
  'bottom-right': 'bottom-5 right-5',
  'top-left': 'left-5 top-5',
  'top-right': 'right-5 top-5',
};

export function FrontiDevTools() {
  const { companyId } = useCompany();
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [position, setPosition] = useState<Position>('bottom-right');
  const [size, setSize] = useState<Size>('medium');
  const [senderPhone, setSenderPhone] = useState('+584121234567');
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<AssistantMessage[]>([
    {
      role: 'fronti',
      text: 'Hola. Puedo consultar productos, stock bajo, promociones, pagos, delivery y ventas.',
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const hiddenUntil = Number(window.localStorage.getItem(hideUntilKey) ?? 0);
    if (hiddenUntil > Date.now()) {
      setHidden(true);
      return;
    }

    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return;

    const preferences = JSON.parse(raw) as Partial<{
      position: Position;
      size: Size;
    }>;

    if (preferences.position) setPosition(preferences.position);
    if (preferences.size) setSize(preferences.size);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify({ position, size }));
  }, [position, size]);

  const placement = useMemo(
    () => `${positionClasses[position]} ${sizeClasses[size]}`,
    [position, size],
  );

  async function handleSendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const cleanMessage = message.trim();
    const cleanPhone = senderPhone.trim() || '+584121234567';

    if (!companyId) {
      const warning = 'Selecciona una empresa antes de conversar con Fronti.';
      setError(warning);
      setMessages((current) => [...current, { role: 'fronti', text: warning }]);
      return;
    }

    if (!cleanMessage) return;

    const payload = {
      companyId,
      senderPhone: cleanPhone,
      message: cleanMessage,
    };

    setError('');
    setIsLoading(true);
    setMessages((current) => [...current, { role: 'user', text: cleanMessage }]);
    setMessage('');

    try {
      const reply = await frontiApi.chat(payload);
      setMessages((current) => [
        ...current,
        { role: 'fronti', text: reply.response || 'Fronti respondio sin contenido.' },
      ]);
    } catch (err) {
      const readableError = getApiError(err);
      setError(readableError);
      setMessages((current) => [
        ...current,
        { role: 'fronti', text: buildMockFrontiResponse(cleanMessage) },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  function hideForSession() {
    const oneDay = 24 * 60 * 60 * 1000;
    window.localStorage.setItem(hideUntilKey, String(Date.now() + oneDay));
    setHidden(true);
  }

  if (hidden) return null;

  return (
    <div className={`fixed z-50 ${placement}`}>
      {open ? (
        <motion.section
          initial={{ opacity: 0, y: 12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="overflow-hidden rounded-[24px] border border-line bg-surface/95 text-ink shadow-2xl shadow-black/35 backdrop-blur-xl"
        >
          <header className="flex items-center justify-between border-b border-line bg-white/[0.035] px-4 py-3">
            <div className="flex items-center gap-3">
              <FrontiMark className="h-9 w-9" />
              <div>
                <p className="text-sm font-semibold">Asistente Fronti</p>
                <p className="text-xs text-muted">Chat operativo</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="grid h-8 w-8 place-items-center rounded-xl border border-line bg-white/[0.04] text-muted transition hover:bg-white/[0.08] hover:text-ink"
              title="Ocultar"
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          <div className="grid gap-3 p-4">
            {error ? (
              <div className="rounded-2xl border border-danger/30 bg-danger/10 p-3 text-xs text-red-100">
                {error}
              </div>
            ) : null}

            <div className="grid max-h-80 gap-3 overflow-y-auto rounded-2xl border border-[#374151] bg-[#111827] p-3">
              {messages.map((item, index) => (
                <div
                  key={`${item.role}-${index}`}
                  className={`max-w-[88%] whitespace-pre-line rounded-2xl px-3 py-2 text-sm leading-5 ${
                    item.role === 'fronti'
                      ? 'justify-self-start border border-[#374151] bg-[#1F2937] text-[#F8F5F0]'
                      : 'justify-self-end bg-[#C9A227] text-[#1E1E1E]'
                  }`}
                >
                  {item.text}
                </div>
              ))}
              {isLoading ? (
                <div className="justify-self-start rounded-2xl border border-[#374151] bg-[#1F2937] px-3 py-2 text-sm text-[#F8F5F0]">
                  Fronti esta pensando...
                </div>
              ) : null}
            </div>

            <form className="grid gap-2" onSubmit={handleSendMessage}>
              <input
                value={senderPhone}
                onChange={(event) => setSenderPhone(event.target.value)}
                className="h-9 rounded-xl border border-line bg-white/[0.04] px-3 text-xs text-ink outline-none transition placeholder:text-slate-500 focus:border-brand"
                placeholder="Telefono del cliente"
              />
              <div className="flex gap-2">
                <input
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  className="h-10 min-w-0 flex-1 rounded-xl border border-line bg-white/[0.04] px-3 text-sm text-ink outline-none transition placeholder:text-slate-500 focus:border-brand"
                  placeholder="Muestrame productos con bajo stock"
                  disabled={isLoading}
                />
                <button
                  type="submit"
                  disabled={isLoading || !message.trim()}
                  className="inline-flex h-10 items-center justify-center rounded-xl bg-ink px-4 text-sm font-medium text-canvas transition hover:bg-white disabled:opacity-60"
                >
                  Enviar
                </button>
              </div>
            </form>

            <div className="flex items-center justify-between border-t border-line pt-2 text-xs text-muted">
              <button type="button" onClick={hideForSession} className="transition hover:text-ink">
                Ocultar por hoy
              </button>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setSize('small')} className="transition hover:text-ink">
                  S
                </button>
                <button type="button" onClick={() => setSize('medium')} className="transition hover:text-ink">
                  M
                </button>
                <button type="button" onClick={() => setSize('large')} className="transition hover:text-ink">
                  L
                </button>
              </div>
            </div>
          </div>
        </motion.section>
      ) : (
        <motion.button
          type="button"
          whileHover={{ y: -2, scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setOpen(true)}
          className="flex h-12 items-center gap-2 rounded-full border border-line bg-surface/95 px-4 text-sm font-semibold text-ink shadow-2xl shadow-black/25 backdrop-blur-xl transition hover:bg-white/[0.08]"
        >
          <FrontiMark className="h-7 w-7" />
          <MessageSquareText className="h-4 w-4 text-blue" />
          Asistente Fronti
        </motion.button>
      )}
    </div>
  );
}

function buildMockFrontiResponse(message: string) {
  const normalized = message
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (
    normalized.includes('stock bajo') ||
    normalized.includes('bajo stock') ||
    normalized.includes('agot') ||
    normalized.includes('inventario bajo')
  ) {
    return 'Claro. Podemos revisar productos bajos, agotados o una categoría puntual.';
  }

  if (normalized.includes('promocion') || normalized.includes('oferta')) {
    return 'Buena idea. Dime qué producto quieres mover o revisa las promociones activas.';
  }

  if (normalized.includes('delivery') || normalized.includes('envio')) {
    return 'Perfecto. Para delivery necesito una dirección o ubicación para estimar cobertura y costo.';
  }

  return 'Claro. Dime si quieres revisar productos, precios, pedidos, promociones o delivery.';
}
