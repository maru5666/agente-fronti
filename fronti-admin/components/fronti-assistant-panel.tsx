'use client';

import { motion } from 'framer-motion';
import { Bot, Box, ClipboardList, X } from 'lucide-react';
import type { FormEvent } from 'react';
import { useState } from 'react';
import { frontiApi } from '@/services/api';
import { FrontiMark } from './fronti-logo';

type AssistantMessage = {
  role: 'user' | 'fronti';
  text: string;
};

export function FrontiAssistantPanel({
  companyId,
  onClose,
}: {
  companyId?: string | null;
  onClose: () => void;
}) {
  const [senderPhone, setSenderPhone] = useState('+584121234567');
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<AssistantMessage[]>([
    {
      role: 'fronti',
      text: 'Estoy listo para consultar productos, stock bajo, promociones, pedidos, pagos y delivery.',
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const events = [
    'Inventario actualizado',
    'Pedidos listos para revisar',
    'Promociones disponibles',
  ];

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
        { role: 'fronti', text: reply.response || 'Fronti respondió sin contenido.' },
      ]);
    } catch (err) {
      console.error('Fronti Assistant:', err);
      const fallback = buildMockFrontiResponse(cleanMessage);
      setMessages((current) => [...current, { role: 'fronti', text: fallback }]);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.aside
        initial={{ x: 420 }}
        animate={{ x: 0 }}
        exit={{ x: 420 }}
        transition={{ type: 'spring', damping: 30, stiffness: 260 }}
        className="absolute right-0 top-0 h-full w-full max-w-md border-l border-line bg-surface p-5 shadow-2xl shadow-black/50"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FrontiMark className="h-12 w-12" />
            <div>
              <p className="font-semibold text-ink">Fronti AI</p>
              <p className="text-xs text-muted">Copiloto operativo</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-2xl border border-line bg-white/[0.04] text-muted transition hover:bg-white/[0.08] hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-6 grid gap-4">
          <div className="glass-panel rounded-[20px] p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Bot className="h-4 w-4 text-blue" />
              Chat con Fronti
            </div>
            {error ? (
              <div className="mb-3 rounded-2xl border border-danger/30 bg-danger/10 p-3 text-xs text-red-100">
                {error}
              </div>
            ) : null}
            <div className="grid max-h-72 gap-3 overflow-y-auto rounded-2xl border border-[#374151] bg-[#111827] p-3">
              {messages.map((item, index) => (
                <div
                  key={`${item.role}-${index}`}
                  className={`max-w-[86%] whitespace-pre-line rounded-2xl px-3 py-2 text-sm leading-5 ${
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
                  Fronti está pensando...
                </div>
              ) : null}
            </div>
            <form className="mt-3 grid gap-2" onSubmit={handleSendMessage}>
              <input
                value={senderPhone}
                onChange={(event) => setSenderPhone(event.target.value)}
                className="h-9 rounded-xl border border-line bg-white/[0.04] px-3 text-xs text-ink outline-none transition placeholder:text-slate-500 focus:border-brand"
                placeholder="Teléfono del cliente"
              />
              <div className="flex gap-2">
                <input
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  className="h-10 min-w-0 flex-1 rounded-xl border border-line bg-white/[0.04] px-3 text-sm text-ink outline-none transition placeholder:text-slate-500 focus:border-brand"
                  placeholder="Muéstrame los productos con bajo stock"
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
          </div>

          <div className="glass-panel rounded-[20px] p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <ClipboardList className="h-4 w-4 text-success" />
              Resumen operativo
            </div>
            <div className="grid gap-2 text-sm">
              <StatusLine label="Inventario" value="Actualizado" tone="success" />
              <StatusLine label="Pedidos" value="Activo" tone="success" />
              <StatusLine label="Atención" value="En preparación" tone="warning" />
            </div>
          </div>

          <div className="glass-panel rounded-[20px] p-4">
            <p className="mb-3 text-sm font-semibold">Sugerencias inteligentes</p>
            <div className="grid gap-2 text-sm text-slate-300">
              <p>Las ventas aumentaron 12%.</p>
              <p>El aceite se agotará en 2 días.</p>
              <p>Se recomienda activar una promoción.</p>
            </div>
          </div>

          <div className="glass-panel rounded-[20px] p-4">
            <p className="mb-3 text-sm font-semibold">Eventos recientes</p>
            <div className="grid gap-2">
              {events.map((event) => (
                <div key={event} className="flex items-center gap-2 text-sm text-slate-300">
                  <Box className="h-3.5 w-3.5 text-blue" />
                  {event}
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.aside>
    </motion.div>
  );
}

function buildMockFrontiResponse(message: string) {
  const normalized = message
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (
    normalized.includes('stock bajo') ||
    normalized.includes('agot') ||
    normalized.includes('inventario bajo')
  ) {
    return 'Claro. Para ayudarte bien con inventario, revisa los productos con menor disponibilidad o dime una categoría específica.';
  }

  if (normalized.includes('promocion') || normalized.includes('oferta')) {
    return 'Buena idea. Puedes revisar las promociones activas o decirme qué producto quieres impulsar.';
  }

  if (normalized.includes('delivery') || normalized.includes('envio')) {
    return 'Perfecto. Para delivery necesito una dirección o ubicación para estimar cobertura y costo.';
  }

  return 'Claro. Dime si quieres revisar productos, precios, pedidos, promociones o delivery.';
}

function StatusLine({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'success' | 'warning';
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-line bg-white/[0.035] px-3 py-2">
      <span className="text-muted">{label}</span>
      <span className={tone === 'success' ? 'text-success' : 'text-warning'}>{value}</span>
    </div>
  );
}
