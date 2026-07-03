'use client';

import { Clock, Home, MapPin, PenLine, Route, Send, Truck } from 'lucide-react';
import type { FormEvent, KeyboardEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { ErrorState, Panel } from '@/components/ui';
import { useCompany } from '@/hooks/use-company';
import { frontiApi, getApiError } from '@/services/api';
import type { DeliveryLocationReply } from '@/types';

type Message = {
  role: 'user' | 'fronti';
  text: string;
  locationCard?: DeliveryLocationReply;
};

type FrontiChatPayload = {
  companyId: string;
  senderPhone: string;
  message?: string;
  type?: string;
  customerPhone?: string;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  timestamp?: number;
};

const FRONTI_CONNECTION_ERROR = 'No pude conectarme con el servidor. Intenta nuevamente.';

export default function ChatFrontiPage() {
  const { companyId } = useCompany();
  const [senderPhone, setSenderPhone] = useState('+584121234567');
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'fronti',
      text: 'Listo para probar respuestas con inventario, pagos, delivery y promociones.',
    },
  ]);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [awaitingDeliveryAddress, setAwaitingDeliveryAddress] = useState(false);
  const [showDeliveryActions, setShowDeliveryActions] = useState(false);
  const [showSavedAddressAction, setShowSavedAddressAction] = useState(false);
  const [lastFailedPayload, setLastFailedPayload] = useState<FrontiChatPayload | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  async function postToFronti(payload: FrontiChatPayload) {
    if (process.env.NODE_ENV !== 'production') {
      console.log('Enviando a Fronti:', payload);
    }

    try {
      const response = await frontiApi.chat(payload);

      if (process.env.NODE_ENV !== 'production') {
        console.log('Respuesta de Fronti:', response);
      }

      setLastFailedPayload(null);
      return response;
    } catch (err) {
      const friendlyMessage = getApiError(err);

      if (process.env.NODE_ENV !== 'production') {
        console.error('Error en Fronti chat:', err);
      }

      setLastFailedPayload(payload);

      if (
        friendlyMessage.toLowerCase().includes('conect') ||
        friendlyMessage.toLowerCase().includes('conex')
      ) {
        throw new Error(FRONTI_CONNECTION_ERROR);
      }

      throw new Error(friendlyMessage);
    }
  }

  async function handleSendMessage(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();

    const cleanMessage = message.trim();
    const cleanPhone = senderPhone.trim() || '+584121234567';

    if (!companyId) {
      setError('Selecciona o registra una empresa antes de probar Fronti.');
      return;
    }

    if (!cleanMessage) return;

    const payload: FrontiChatPayload = {
      companyId,
      senderPhone: cleanPhone,
      message: cleanMessage,
      type: awaitingDeliveryAddress ? 'delivery_address' : undefined,
    };

    setError('');
    setIsLoading(true);
    setMessages((current) => [...current, { role: 'user', text: cleanMessage }]);
    setMessage('');

    try {
      const response = await postToFronti(payload);
      updateQuickActions(response.response);
      setAwaitingDeliveryAddress(false);
      setMessages((current) => [
        ...current,
        { role: 'fronti', text: response.response || 'Fronti respondió sin contenido.' },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : FRONTI_CONNECTION_ERROR);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleRetry() {
    if (!lastFailedPayload) return;

    setError('');
    setIsLoading(true);

    try {
      const response = await postToFronti(lastFailedPayload);
      updateQuickActions(response.response);
      setAwaitingDeliveryAddress(false);
      setMessages((current) => [
        ...current,
        { role: 'fronti', text: response.response || 'Fronti respondió sin contenido.' },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : FRONTI_CONNECTION_ERROR);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleShareLocation() {
    if (!companyId) {
      setError('Selecciona o registra una empresa antes de probar Fronti.');
      return;
    }

    if (!navigator.geolocation) {
      setError('Tu navegador no soporta geolocalización.');
      return;
    }

    setError('');
    setIsLoading(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const cleanPhone = senderPhone.trim() || '+584121234567';
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;
        const accuracy = position.coords.accuracy;

        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
          setError('No pude acceder a tu ubicación. Intenta nuevamente o escribe tu dirección.');
          setIsLoading(false);
          return;
        }

        if (process.env.NODE_ENV !== 'production') {
          console.log('GPS enviado:', latitude, longitude, accuracy);
        }

        const payload: FrontiChatPayload = {
          companyId,
          senderPhone: cleanPhone,
          customerPhone: cleanPhone,
          latitude,
          longitude,
          accuracy,
          timestamp: position.timestamp,
          type: 'location',
        };

        setMessages((current) => [...current, { role: 'user', text: 'Ubicación compartida.' }]);

        try {
          const response = await postToFronti(payload);
          updateQuickActions(response.response);
          setAwaitingDeliveryAddress(false);
          setMessages((current) => [
            ...current,
            {
              role: 'fronti',
              text: response.response || 'Ubicación recibida correctamente.',
            },
          ]);
        } catch (err) {
          setError(err instanceof Error ? err.message : FRONTI_CONNECTION_ERROR);
        } finally {
          setIsLoading(false);
        }
      },
      (geoError) => {
        if (process.env.NODE_ENV !== 'production') {
          console.error('Error en geolocalización:', geoError);
        }

        setError('No se pudo obtener tu ubicación. Puedes escribir la dirección manualmente.');
        setIsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 12000 },
    );
  }

  function handleWriteAddress() {
    setAwaitingDeliveryAddress(true);
    setShowDeliveryActions(false);
    setError('');
    setMessages((current) => [
      ...current,
      { role: 'fronti', text: 'Perfecto. Escribe tu dirección y la verifico para el delivery.' },
    ]);
  }

  async function handleUseSavedAddress() {
    if (!companyId) {
      setError('Selecciona o registra una empresa antes de probar Fronti.');
      return;
    }

    const payload: FrontiChatPayload = {
      companyId,
      senderPhone: senderPhone.trim() || '+584121234567',
      type: 'saved_address',
      message: 'Usar dirección guardada',
    };

    setError('');
    setIsLoading(true);
    setMessages((current) => [...current, { role: 'user', text: 'Usar dirección guardada.' }]);

    try {
      const response = await postToFronti(payload);
      updateQuickActions(response.response);
      setMessages((current) => [
        ...current,
        { role: 'fronti', text: response.response || 'Estoy verificando tu dirección guardada.' },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : FRONTI_CONNECTION_ERROR);
    } finally {
      setIsLoading(false);
    }
  }

  function updateQuickActions(response?: string) {
    const normalized = (response ?? '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    setShowDeliveryActions(
      normalized.includes('ubicacion actual') ||
        normalized.includes('escribir tu direccion') ||
        normalized.includes('compartir tu ubicacion') ||
        normalized.includes('enviame tu ubicacion'),
    );
    setShowSavedAddressAction(normalized.includes('direccion guardada'));
  }

  function handleMessageKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void handleSendMessage();
    }
  }

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-5">
      <PageHeader title="Chat de prueba con Fronti" description="Prueba conversaciones de ventas, pedidos, inventario y delivery." />
      <Panel>
        <div className="grid gap-4">
          {error ? (
            <div className="grid gap-2">
              <ErrorState message={error} />
              {lastFailedPayload ? (
                <button
                  type="button"
                  onClick={handleRetry}
                  disabled={isLoading}
                  className="w-fit rounded-xl border border-[#C9A227]/40 bg-[#C9A227]/10 px-4 py-2 text-sm font-medium text-[#F8F5F0] transition hover:bg-[#C9A227]/20 disabled:opacity-60"
                >
                  Reintentar
                </button>
              ) : null}
            </div>
          ) : null}

          <section className="overflow-hidden rounded-[24px] border border-[#374151] bg-[#111827] shadow-2xl shadow-black/30">
            <header className="flex items-center justify-between border-b border-[#374151] px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-[#F8F5F0]">Simulación de WhatsApp</p>
                <p className="text-xs text-gray-400">Fronti responde usando los datos de la empresa seleccionada.</p>
              </div>
              <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-medium text-emerald-300">
                En línea
              </span>
            </header>

            <div className="grid h-[520px] min-h-[360px] gap-3 overflow-y-auto p-4">
              {messages.map((item, index) => (
                <div
                  key={`${item.role}-${index}`}
                  className={`max-w-[82%] whitespace-pre-line px-4 py-2 text-sm leading-6 shadow-sm ${
                    item.role === 'fronti'
                      ? 'justify-self-start rounded-[18px] border border-[#374151] bg-[#1F2937] text-[#F8F5F0]'
                      : 'justify-self-end rounded-[18px] bg-[#C9A227] text-[#1E1E1E]'
                  }`}
                >
                  {item.text}
                  {item.locationCard ? <LocationCard data={item.locationCard} /> : null}
                </div>
              ))}
              {isLoading ? (
                <div className="justify-self-start rounded-[18px] border border-[#374151] bg-[#1F2937] px-4 py-2 text-sm text-[#F8F5F0] shadow-sm">
                  Fronti está escribiendo...
                </div>
              ) : null}
              <div ref={messagesEndRef} />
            </div>
          </section>

          {(showDeliveryActions || showSavedAddressAction) ? (
            <div className="flex flex-wrap gap-2 rounded-2xl border border-[#374151] bg-[#111827] p-3">
              {showSavedAddressAction ? (
                <button
                  type="button"
                  onClick={handleUseSavedAddress}
                  disabled={isLoading}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#374151] bg-[#1F2937] px-4 text-sm font-medium text-[#F8F5F0] transition hover:bg-[#273244] disabled:opacity-60"
                >
                  <Home className="h-4 w-4" />
                  Usar dirección guardada
                </button>
              ) : null}
              <button
                type="button"
                onClick={handleShareLocation}
                disabled={isLoading}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#374151] bg-[#1F2937] px-4 text-sm font-medium text-[#F8F5F0] transition hover:bg-[#273244] disabled:opacity-60"
              >
                <MapPin className="h-4 w-4" />
                Enviar ubicación
              </button>
              <button
                type="button"
                onClick={handleWriteAddress}
                disabled={isLoading}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#C9A227] px-4 text-sm font-medium text-[#1E1E1E] transition hover:bg-[#A9871F] disabled:opacity-60"
              >
                <PenLine className="h-4 w-4" />
                {showSavedAddressAction ? 'Enviar otra dirección' : 'Escribir dirección'}
              </button>
            </div>
          ) : null}

          <form className="grid gap-3 rounded-2xl border border-[#374151] bg-[#111827] p-3" onSubmit={handleSendMessage}>
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium text-gray-200">Teléfono del cliente</span>
              <input
                value={senderPhone}
                onChange={(event) => setSenderPhone(event.target.value)}
                placeholder="+584121234567"
                className="h-10 rounded-xl border border-[#374151] bg-[#1F2937] px-3 text-sm text-[#F8F5F0] outline-none transition placeholder:text-gray-400 focus:border-[#C9A227]"
              />
            </label>

            <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-end">
              <label className="grid min-w-0 gap-1.5 text-sm">
                <span className="font-medium text-gray-200">Mensaje</span>
                <input
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  onKeyDown={handleMessageKeyDown}
                  placeholder={awaitingDeliveryAddress ? 'Escribe tu dirección de delivery' : 'Muéstrame los productos con bajo stock'}
                  disabled={isLoading}
                  className="h-10 rounded-xl border border-[#374151] bg-[#1F2937] px-3 text-sm text-[#F8F5F0] outline-none transition placeholder:text-gray-400 focus:border-[#C9A227]"
                />
              </label>

              <button
                type="button"
                onClick={handleShareLocation}
                disabled={isLoading}
                className="inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-[#374151] bg-[#1F2937] px-4 text-sm font-medium text-[#F8F5F0] transition hover:bg-[#273244] disabled:opacity-60"
              >
                <MapPin className="h-4 w-4" />
                Enviar ubicación
              </button>

              <button
                type="submit"
                disabled={isLoading || !message.trim()}
                className="inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-[#C9A227] px-5 text-sm font-medium text-[#1E1E1E] transition hover:bg-[#A9871F] disabled:opacity-60"
              >
                <Send className="h-4 w-4" />
                Enviar
              </button>
            </div>
          </form>
        </div>
      </Panel>
    </div>
  );
}

function LocationCard({ data }: { data: DeliveryLocationReply }) {
  const delivery = data.delivery;
  const durationMinutes = delivery?.durationMin ?? delivery?.durationMinutes ?? null;
  const costUsd = delivery?.costUsd ?? delivery?.deliveryFeeUsd ?? null;

  return (
    <div className="mt-3 rounded-2xl border border-[#374151] bg-[#111827] p-3 text-[#F8F5F0]">
      <div className="flex items-start gap-2">
        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#C9A227]" />
        <div className="min-w-0">
          <p className="text-xs font-semibold text-[#F8F5F0]">Dirección detectada</p>
          <p className="mt-1 text-xs leading-5 text-gray-300">
            {data.address.formattedAddress}
          </p>
        </div>
      </div>

      {delivery ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <LocationMetric
            icon={Route}
            label="Distancia"
            value={formatLocationDistance(delivery.distanceKm)}
          />
          <LocationMetric
            icon={Clock}
            label="Tiempo"
            value={formatLocationMinutes(durationMinutes)}
          />
          <LocationMetric
            icon={Truck}
            label="Costo"
            value={formatLocationUsd(costUsd)}
          />
        </div>
      ) : null}
    </div>
  );
}

function formatLocationDistance(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? `${value.toFixed(1)} km` : 'No disponible';
}

function formatLocationMinutes(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? `${Math.round(value)} min` : 'No disponible';
}

function formatLocationUsd(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? `$${value.toFixed(2)}` : 'Pendiente';
}

function LocationMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Route;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-[#374151] bg-[#1F2937] px-3 py-2">
      <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
        <Icon className="h-3.5 w-3.5 text-[#C9A227]" />
        {label}
      </div>
      <p className="mt-1 text-xs font-semibold text-[#F8F5F0]">{value}</p>
    </div>
  );
}
