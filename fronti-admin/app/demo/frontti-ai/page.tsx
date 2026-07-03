'use client';

import Link from 'next/link';
import type { FormEvent, ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Bot,
  CheckCircle2,
  Loader2,
  MapPin,
  Package,
  RefreshCw,
  Send,
  ShoppingBag,
  Wifi,
} from 'lucide-react';
import { BeautyProductCard } from '@/components/demo/beauty-product-card';
import {
  BEAUTY_HUB_DEMO_PHONE,
  useBeautyHubDemo,
} from '@/hooks/use-beauty-hub-demo';
import { convertUsdToBs, formatBs, formatUsd } from '@/lib/exchange-rate';
import { formatProductPrice, toFiniteNumber } from '@/lib/product-pricing';
import {
  deliveryApi,
  deliveryZonesApi,
  frontiApi,
  getApiError,
  ordersApi,
} from '@/services/api';
import type { DeliveryEstimate, DeliveryLocationReply, Order, Product } from '@/types';

type ChatMessage = {
  id: string;
  sender: 'cliente' | 'frontti';
  text: string;
  createdAt: Date | null;
  kind?: 'text' | 'catalog' | 'delivery' | 'order';
  delivery?: DeliveryLocationReply['delivery'];
  address?: DeliveryLocationReply['address'];
};

type OrderStep =
  | 'idle'
  | 'confirm_product'
  | 'payment_method'
  | 'delivery_choice'
  | 'delivery_address'
  | 'delivery_acceptance'
  | 'final_confirmation';

type PaymentMethodChoice = 'efectivo' | 'transferencia';

const quickActions = ['catálogo', 'piel grasa', 'manchas', 'acné', 'protector solar'];
const demoPurple = '#8B5CF6';

export default function DemoFronttiAiPage() {
  const {
    company,
    products,
    promotions,
    bcvRate,
    isLoading,
    error,
    reload,
  } = useBeautyHubDemo();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: cryptoId(),
      sender: 'frontti',
      text: '¡Hola! 😊 Soy Frontti de Beauty Hub. ¿Qué estás buscando hoy para tu piel?',
      createdAt: null,
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showCatalog, setShowCatalog] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [paymentCurrency, setPaymentCurrency] = useState<'USD' | 'VES' | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodChoice | null>(null);
  const [orderStep, setOrderStep] = useState<OrderStep>('idle');
  const [deliveryQuote, setDeliveryQuote] = useState<DeliveryLocationReply | null>(null);
  const [latestOrder, setLatestOrder] = useState<Order | null>(null);
  const [lastFailedAction, setLastFailedAction] = useState<(() => Promise<void>) | null>(null);
  const [visibleError, setVisibleError] = useState<string | null>(null);
  const [headerTime, setHeaderTime] = useState('');
  const [customerName] = useState('Cliente demo');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const proofInputRef = useRef<HTMLInputElement | null>(null);

  const bcvUsdRate = useMemo(() => getBcvUsdRate(bcvRate?.usdRate, bcvRate?.formattedRate), [bcvRate]);
  const featuredProducts = useMemo(() => products.slice(0, 6), [products]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, isTyping, showCatalog]);

  useEffect(() => {
    setHeaderTime(new Date().toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' }));
    const params = new URLSearchParams(window.location.search);
    const initialMessage = params.get('mensaje');
    if (initialMessage) {
      setInput(initialMessage);
    }
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await sendText(input);
  }

  async function sendText(rawText: string) {
    const message = rawText.trim();
    if (!message || !company) return;

    setInput('');
    setVisibleError(null);
    addUserMessage(message);

    if (await handleDemoFlow(message)) {
      return;
    }

    if (isCatalogIntent(message)) {
      setShowCatalog(true);
      addFronttiMessage('Claro, te muestro el catálogo real de Beauty Hub. Puedes elegir un producto y lo aparto para tu pedido.');
      return;
    }

    const run = async () => {
      setIsTyping(true);
      try {
        const reply = await frontiApi.chat({
          companyId: company.id,
          senderPhone: BEAUTY_HUB_DEMO_PHONE,
          customerPhone: BEAUTY_HUB_DEMO_PHONE,
          message,
        });

        addFronttiMessage(reply.response);
        setLastFailedAction(null);
      } catch (chatError) {
        if (process.env.NODE_ENV !== 'production') {
          console.error('[Demo Frontti] Error en chat:', chatError);
        }
        setVisibleError(getApiError(chatError) || 'No pude conectarme con el servidor. Intenta nuevamente.');
        setLastFailedAction(() => run);
      } finally {
        setIsTyping(false);
      }
    };

    await run();
  }

  async function handleDemoFlow(message: string) {
    const normalized = normalize(message);

    if (orderStep === 'delivery_address' || isManualAddress(normalized)) {
      await handleManualAddress(message);
      return true;
    }

    if (orderStep === 'delivery_acceptance') {
      if (isAffirmative(normalized)) {
        addFronttiMessage(composeFinalTotalMessage());
        setOrderStep('final_confirmation');
        return true;
      }

      if (isNegative(normalized)) {
        setDeliveryQuote(null);
        setOrderStep('delivery_choice');
        addFronttiMessage('Sin problema. ¿Prefieres escribir otra dirección o retirar en tienda?');
        return true;
      }
    }

    if (orderStep === 'final_confirmation' && isAffirmative(normalized)) {
      if (selectedProduct) {
        await createDemoOrder(selectedProduct);
      }
      return true;
    }

    if (orderStep === 'confirm_product') {
      if (isAffirmative(normalized)) {
        setOrderStep('payment_method');
        addFronttiMessage('Perfecto. ¿Pagarás en efectivo o por transferencia?');
        return true;
      }

      if (isNegative(normalized)) {
        setSelectedProduct(null);
        setOrderStep('idle');
        addFronttiMessage('Está bien. Puedo mostrarte otras opciones del catálogo si quieres.');
        return true;
      }
    }

    if (orderStep === 'payment_method') {
      const payment = detectPaymentMethod(normalized);
      if (payment) {
        setPaymentMethod(payment);
        setPaymentCurrency(detectCurrency(normalized));

        if (payment === 'efectivo') {
          addFronttiMessage('Perfecto, pagarías en efectivo cuando el delivery llegue al destino. ¿Quieres delivery o retiro en tienda?');
        } else {
          addFronttiMessage('Perfecto, envíame el comprobante o referencia de pago para enviarlo a verificación. ¿Quieres delivery o retiro en tienda?');
        }

        setOrderStep('delivery_choice');
        return true;
      }
    }

    if (orderStep === 'delivery_choice') {
      if (/delivery|envio|enviar|domicilio|direccion|ubicacion/.test(normalized)) {
        setOrderStep('delivery_address');
        addFronttiMessage('Listo. Puedes compartir tu ubicación actual o escribir la dirección de entrega.');
        return true;
      }

      if (/retiro|tienda|buscar|paso/.test(normalized)) {
        setDeliveryQuote(null);
        addFronttiMessage(composeFinalTotalMessage());
        setOrderStep('final_confirmation');
        return true;
      }
    }

    const matchedProduct = findProductMatch(message, products, selectedProduct);
    if (matchedProduct) {
      showProductConfirmation(matchedProduct);
      return true;
    }

    return false;
  }

  function showProductConfirmation(product: Product) {
    setSelectedProduct(product);
    setShowCatalog(false);
    setOrderStep('confirm_product');
    const price = formatProductPrice(product, bcvUsdRate);
    addFronttiMessage(
      [
        `Encontré este producto en el catálogo: ${product.name}.`,
        product.brand?.name ? `Marca: ${product.brand.name}.` : null,
        `Precio: ${price.formattedUsd} / Bs: ${price.formattedBs}.`,
        `Stock: ${product.stock} unidades.`,
        '¿Confirmas que quieres agregar este producto al pedido?',
      ]
        .filter(Boolean)
        .join('\n'),
    );
  }

  async function createDemoOrder(product: Product) {
    if (!company) return;

    const run = async () => {
      setIsTyping(true);
      try {
        const order = await ordersApi.create({
          companyId: company.id,
          customerName,
          customerPhone: BEAUTY_HUB_DEMO_PHONE,
          customerAddress: deliveryQuote?.address?.formattedAddress,
          customerLatitude: deliveryQuote?.address?.latitude,
          customerLongitude: deliveryQuote?.address?.longitude,
          status: 'pendiente_confirmacion_operador',
          items: [{ productId: product.id, quantity: 1 }],
        });

        setLatestOrder(order);
        setOrderStep('idle');
        const paymentLine =
          paymentMethod === 'transferencia'
            ? 'Cuando tengas el comprobante, envíamelo por aquí para mandarlo a verificación.'
            : paymentMethod === 'efectivo'
              ? 'Pagarías en efectivo cuando el delivery llegue al destino.'
              : 'El método de pago queda pendiente de confirmar.';

        addFronttiMessage(
          `Listo. Creé tu pedido de demostración con ${product.name}.\n${paymentLine}`,
          'order',
        );
        setLastFailedAction(null);
      } catch (orderError) {
        if (process.env.NODE_ENV !== 'production') {
          console.error('[Demo Frontti] Error creando pedido:', orderError);
        }
        setVisibleError('No pude crear el pedido. Revisa el producto seleccionado e intenta nuevamente.');
        setLastFailedAction(() => run);
      } finally {
        setIsTyping(false);
      }
    };

    await run();
  }

  async function handleShareLocation() {
    if (!company) return;
    setVisibleError(null);

    if (!('geolocation' in navigator)) {
      setVisibleError('Tu navegador no permite compartir ubicación. Escribe tu dirección y la verifico.');
      return;
    }

    const run = async () => {
      setIsTyping(true);
      try {
        const position = await getCurrentPosition();
        const { latitude, longitude, accuracy } = position.coords;

        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
          setVisibleError('No pude obtener coordenadas válidas. Intenta nuevamente o escribe tu dirección.');
          return;
        }

        if (process.env.NODE_ENV !== 'production') {
          console.log('GPS enviado:', latitude, longitude, accuracy);
        }

        addUserMessage('Ubicación compartida desde el dispositivo.');

        const reply = await deliveryApi.sendLocation({
          companyId: company.id,
          customerPhone: BEAUTY_HUB_DEMO_PHONE,
          type: 'location',
          latitude,
          longitude,
          accuracy,
          timestamp: position.timestamp,
        });

        const pricedReply = applyDemoDeliveryPricing(reply);
        setDeliveryQuote(pricedReply);
        setOrderStep('delivery_acceptance');
        addFronttiMessage(composeDeliveryMessage(pricedReply), 'delivery', pricedReply);
        setLastFailedAction(null);
      } catch (locationError) {
        if (process.env.NODE_ENV !== 'production') {
          console.error('[Demo Frontti] Error compartiendo ubicación:', locationError);
        }
        setVisibleError(
          isGeolocationError(locationError)
            ? 'No pude acceder a tu ubicación. Intenta nuevamente o escribe tu dirección.'
            : 'No pude procesar la ubicación. Intenta nuevamente.',
        );
        setLastFailedAction(() => run);
      } finally {
        setIsTyping(false);
      }
    };

    await run();
  }

  async function handleManualAddress(address: string) {
    if (!company) return;

    const run = async () => {
      setIsTyping(true);
      try {
        const estimate = await deliveryZonesApi.estimate({
          companyId: company.id,
          address,
          orderSubtotalUsd: getProductUsd(selectedProduct) ?? 0,
        });
        const reply = estimateToDeliveryReply(estimate);
        const pricedReply = applyDemoDeliveryPricing(reply);
        setDeliveryQuote(pricedReply);
        setOrderStep('delivery_acceptance');
        addFronttiMessage(composeDeliveryMessage(pricedReply), 'delivery', pricedReply);
        setLastFailedAction(null);
      } catch (addressError) {
        if (process.env.NODE_ENV !== 'production') {
          console.error('[Demo Frontti] Error calculando dirección manual:', addressError);
        }
        setVisibleError('No pude calcular esa dirección. Intenta con una referencia más específica.');
        setLastFailedAction(() => run);
      } finally {
        setIsTyping(false);
      }
    };

    await run();
  }

  function handleSelectProduct(product: Product) {
    addUserMessage(`Me interesa ${product.name}`);
    showProductConfirmation(product);
  }

  async function handlePaymentProof(file: File | null) {
    if (!file || !company) return;

    if (!latestOrder) {
      addFronttiMessage('Primero confirmemos un pedido y luego reviso tu comprobante.');
      return;
    }

    const run = async () => {
      setIsTyping(true);
      try {
        const result = await ordersApi.submitPaymentProof({
          companyId: company.id,
          customerPhone: BEAUTY_HUB_DEMO_PHONE,
          orderId: latestOrder.id,
          reference: `Comprobante demo: ${file.name}`,
        });

        addUserMessage(`Comprobante enviado: ${file.name}`);
        addFronttiMessage(result.response);
        setLastFailedAction(null);
      } catch (proofError) {
        if (process.env.NODE_ENV !== 'production') {
          console.error('[Demo Frontti] Error enviando comprobante:', proofError);
        }
        setVisibleError('No pude enviar el comprobante. Intenta nuevamente.');
        setLastFailedAction(() => run);
      } finally {
        setIsTyping(false);
        if (proofInputRef.current) {
          proofInputRef.current.value = '';
        }
      }
    };

    await run();
  }

  function applyDemoDeliveryPricing(reply: DeliveryLocationReply): DeliveryLocationReply {
    const distanceKm = reply.delivery?.distanceKm;
    const costUsd = typeof distanceKm === 'number' && Number.isFinite(distanceKm)
      ? roundMoney(distanceKm * 1)
      : null;
    const costBs = costUsd !== null ? convertUsdToBs(costUsd, bcvUsdRate) : null;

    return {
      ...reply,
      delivery: reply.delivery
        ? {
            ...reply.delivery,
            costUsd,
            deliveryFeeUsd: costUsd,
            costBs,
          }
        : null,
    };
  }

  function estimateToDeliveryReply(estimate: DeliveryEstimate): DeliveryLocationReply {
    const costUsd = typeof estimate.distanceKm === 'number' && Number.isFinite(estimate.distanceKm)
      ? roundMoney(estimate.distanceKm * 1)
      : null;
    const costBs = costUsd !== null ? convertUsdToBs(costUsd, bcvUsdRate) : null;

    return {
      response: estimate.message,
      address: {
        formattedAddress: estimate.destinationAddress,
        latitude: estimate.destinationLatitude,
        longitude: estimate.destinationLongitude,
      },
      delivery: {
        originName: 'Beauty Hub',
        destinationAddress: estimate.destinationAddress,
        status: estimate.available ? 'calculated' : 'out_of_coverage',
        source: estimate.source,
        zoneName: estimate.zoneName,
        distanceKm: estimate.distanceKm,
        durationMin: estimate.durationMinutes,
        costUsd,
        costBs,
        deliveryFeeUsd: costUsd,
        googleMapsLink: estimate.googleMapsLink,
        usedLocalFallback: estimate.usedLocalFallback,
      },
    };
  }

  function composeDeliveryMessage(reply: DeliveryLocationReply) {
    const address = reply.address?.formattedAddress || reply.delivery?.destinationAddress || 'Dirección en revisión';
    const distance = formatKm(reply.delivery?.distanceKm);
    const time = formatMinutes(reply.delivery?.durationMin ?? reply.delivery?.durationMinutes);
    const costUsd = formatUsdSafe(reply.delivery?.costUsd ?? reply.delivery?.deliveryFeeUsd);
    const costBs = formatBs(reply.delivery?.costBs ?? null);

    return [
      'Perfecto, ya tengo la dirección.',
      `Dirección detectada: ${address}`,
      `Distancia: ${distance}`,
      `Tiempo: ${time}`,
      `Costo delivery: ${costUsd} / ${costBs}`,
      '¿Aceptas este delivery?',
    ].join('\n');
  }

  function composeFinalTotalMessage() {
    const productUsd = getProductUsd(selectedProduct) ?? 0;
    const productBs = convertUsdToBs(productUsd, bcvUsdRate);
    const deliveryUsd = deliveryQuote?.delivery?.costUsd ?? 0;
    const deliveryBs = convertUsdToBs(deliveryUsd, bcvUsdRate);
    const totalUsd = roundMoney(productUsd + deliveryUsd);
    const totalBs = productBs !== null && deliveryBs !== null ? roundMoney(productBs + deliveryBs) : null;

    return [
      'Perfecto. Este sería el total final:',
      `Producto: ${formatUsd(productUsd)} / ${formatBs(productBs)}`,
      deliveryUsd > 0 ? `Delivery: ${formatUsd(deliveryUsd)} / ${formatBs(deliveryBs)}` : 'Delivery: Retiro en tienda',
      `Total: ${formatUsd(totalUsd)} / ${formatBs(totalBs)}`,
      '¿Confirmo tu pedido?',
    ].join('\n');
  }

  function addUserMessage(text: string) {
    setMessages((current) => [
      ...current,
      { id: cryptoId(), sender: 'cliente', text, createdAt: new Date() },
    ]);
  }

  function addFronttiMessage(
    text: string,
    kind: ChatMessage['kind'] = 'text',
    deliveryReply?: DeliveryLocationReply,
  ) {
    setMessages((current) => [
      ...current,
      {
        id: cryptoId(),
        sender: 'frontti',
        text,
        createdAt: new Date(),
        kind,
        delivery: deliveryReply?.delivery,
        address: deliveryReply?.address,
      },
    ]);
  }

  return (
    <main className="min-h-screen bg-[#070B14] px-3 py-4 text-white sm:px-5 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-7xl flex-col overflow-hidden rounded-[32px] border border-white/10 bg-[#0B1220] shadow-2xl shadow-black/30">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-[#111827] px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href="/demo"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/[0.04] text-slate-200 transition hover:bg-white/[0.08]"
              aria-label="Volver a la demo"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#8B5CF6] text-white shadow-lg shadow-purple-950/40">
              <Bot className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-base font-semibold sm:text-lg">Frontti AI · Beauty Hub</h1>
              <p className="flex items-center gap-1.5 text-xs text-emerald-300">
                <Wifi className="h-3.5 w-3.5" />
                En línea
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>{headerTime || '--:--'}</span>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="flex min-h-[640px] min-w-0 flex-col bg-[radial-gradient(circle_at_top,rgba(139,92,246,0.16),transparent_30%),#111827]">
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
              <div className="mx-auto grid max-w-3xl gap-3">
                {isLoading ? <SystemNotice text="Cargando Beauty Hub..." /> : null}
                {error ? (
                  <div className="rounded-2xl border border-purple-300/25 bg-purple-500/10 p-4 text-sm text-purple-50">
                    <p>{error}</p>
                    <button
                      type="button"
                      onClick={() => void reload()}
                      className="mt-3 inline-flex items-center gap-2 rounded-xl bg-[#8B5CF6] px-3 py-2 text-xs font-bold text-white"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Reintentar carga
                    </button>
                  </div>
                ) : null}

                {messages.map((message) => (
                  <ChatBubble key={message.id} message={message} />
                ))}

                {showCatalog ? (
                  <div className="grid gap-3 rounded-[28px] border border-white/10 bg-[#0B1220]/90 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-white">Catálogo Beauty Hub</p>
                        <p className="text-xs text-slate-400">Elige un producto para apartarlo.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowCatalog(false)}
                        className="text-xs text-slate-400 hover:text-white"
                      >
                        Cerrar
                      </button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {featuredProducts.map((product) => (
                        <BeautyProductCard
                          key={product.id}
                          product={product}
                          promotions={promotions}
                          exchangeRate={bcvUsdRate}
                          onSelect={handleSelectProduct}
                          compact
                        />
                      ))}
                    </div>
                  </div>
                ) : null}

                {isTyping ? (
                  <div className="flex justify-start">
                    <div className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-[#1F2937] px-4 py-3 text-sm text-[#F8F5F0]">
                      <Loader2 className="h-4 w-4 animate-spin text-[#A78BFA]" />
                      Frontti está escribiendo...
                    </div>
                  </div>
                ) : null}

                <div ref={messagesEndRef} />
              </div>
            </div>

            <div className="border-t border-white/10 bg-[#0B1220] p-4 sm:p-5">
              <div className="mx-auto grid max-w-3xl gap-3">
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {quickActions.map((action) => (
                    <button
                      key={action}
                      type="button"
                      onClick={() => void sendText(action)}
                      disabled={!company || isTyping}
                      className="shrink-0 rounded-full border border-white/10 bg-white/[0.055] px-3 py-1.5 text-sm text-slate-200 transition hover:border-purple-400/50 disabled:opacity-50"
                    >
                      {action}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => void handleShareLocation()}
                    disabled={!company || isTyping}
                    className="shrink-0 rounded-full border border-purple-400/35 bg-purple-500/15 px-3 py-1.5 text-sm font-semibold text-purple-50 transition hover:bg-purple-500/25 disabled:opacity-50"
                  >
                    Enviar ubicación
                  </button>
                  <button
                    type="button"
                    onClick={() => proofInputRef.current?.click()}
                    disabled={!company || isTyping}
                    className="shrink-0 rounded-full border border-white/10 bg-white/[0.055] px-3 py-1.5 text-sm text-slate-200 transition hover:border-purple-400/50 disabled:opacity-50"
                  >
                    Enviar comprobante
                  </button>
                  <input
                    ref={proofInputRef}
                    type="file"
                    accept="image/*,.pdf"
                    className="hidden"
                    onChange={(event) => void handlePaymentProof(event.target.files?.[0] ?? null)}
                  />
                </div>

                {visibleError ? (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-purple-300/25 bg-purple-500/10 p-3 text-sm text-purple-50">
                    <span>{visibleError}</span>
                    {lastFailedAction ? (
                      <button
                        type="button"
                        onClick={() => void lastFailedAction()}
                        className="inline-flex items-center gap-2 rounded-xl bg-[#8B5CF6] px-3 py-2 text-xs font-bold text-white"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        Reintentar
                      </button>
                    ) : null}
                  </div>
                ) : null}

                <form onSubmit={handleSubmit} className="flex gap-2">
                  <input
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    placeholder="Escribe tu mensaje..."
                    disabled={!company || isTyping}
                    className="h-12 min-w-0 flex-1 rounded-2xl border border-white/10 bg-white/[0.055] px-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-purple-400/70 disabled:opacity-60"
                  />
                  <button
                    type="submit"
                    disabled={!input.trim() || !company || isTyping}
                    style={{ backgroundColor: demoPurple }}
                    className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-bold text-white shadow-lg shadow-purple-950/30 transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Send className="h-4 w-4" />
                    <span className="hidden sm:inline">Enviar</span>
                  </button>
                </form>
              </div>
            </div>
          </section>

          <aside className="hidden min-h-0 border-l border-white/10 bg-[#0B1220] p-5 lg:block">
            <div className="sticky top-5 grid gap-4">
              <PanelCard
                icon={<ShoppingBag className="h-5 w-5" />}
                title="Pedido actual"
                body={
                  selectedProduct
                    ? `${selectedProduct.name} · ${paymentMethod ? `Pago: ${paymentMethod}${paymentCurrency ? ` · ${paymentCurrency}` : ''}` : 'pago por confirmar'}`
                    : 'Selecciona un producto del catálogo para iniciar un pedido.'
                }
              />
              <PanelCard
                icon={<Package className="h-5 w-5" />}
                title="Inventario conectado"
                body={`${products.length} productos disponibles para recomendaciones reales.`}
              />
              <PanelCard
                icon={<MapPin className="h-5 w-5" />}
                title="Delivery"
                body="La ubicación se calcula desde Beauty Hub y se procesa en el backend."
              />
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

function ChatBubble({ message }: { message: ChatMessage }) {
  const isCustomer = message.sender === 'cliente';

  return (
    <div className={`flex ${isCustomer ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[88%] rounded-[22px] px-4 py-3 shadow-lg sm:max-w-[72%] ${
          isCustomer
            ? 'bg-[#8B5CF6] text-white shadow-purple-950/20'
            : 'border border-white/10 bg-[#1F2937] text-[#F8F5F0] shadow-black/20'
        }`}
      >
        <p className="whitespace-pre-line text-sm leading-6">{message.text}</p>
        {message.kind === 'delivery' ? <DeliveryCard message={message} /> : null}
        {message.kind === 'order' ? (
          <div className="mt-3 inline-flex items-center gap-2 rounded-xl border border-emerald-300/25 bg-emerald-300/10 px-3 py-2 text-xs text-emerald-100">
            <CheckCircle2 className="h-4 w-4" />
            Pedido registrado en Beauty Hub
          </div>
        ) : null}
        {message.createdAt ? (
          <p className={`mt-2 text-[11px] ${isCustomer ? 'text-white/70' : 'text-slate-400'}`}>
            {message.createdAt.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function DeliveryCard({ message }: { message: ChatMessage }) {
  const delivery = message.delivery;

  return (
    <div className="mt-3 grid gap-2 rounded-2xl border border-white/10 bg-[#0B1220]/80 p-3 text-xs text-slate-200">
      <div>
        <p className="text-slate-500">Dirección detectada</p>
        <p className="mt-1 font-medium text-white">
          {message.address?.formattedAddress || delivery?.destinationAddress || 'Dirección en revisión'}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <MiniStat label="Distancia" value={formatKm(delivery?.distanceKm)} />
        <MiniStat label="Tiempo" value={formatMinutes(delivery?.durationMin ?? delivery?.durationMinutes)} />
        <MiniStat label="Costo USD" value={formatUsdSafe(delivery?.costUsd ?? delivery?.deliveryFeeUsd)} />
        <MiniStat label="Costo Bs" value={formatBs(delivery?.costBs ?? null)} />
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-2">
      <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-1 font-semibold text-white">{value}</p>
    </div>
  );
}

function PanelCard({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-white/[0.045] p-4">
      <div className="mb-3 grid h-10 w-10 place-items-center rounded-2xl bg-purple-500/15 text-purple-300">
        {icon}
      </div>
      <p className="font-semibold text-white">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-400">{body}</p>
    </div>
  );
}

function SystemNotice({ text }: { text: string }) {
  return (
    <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.055] px-3 py-1.5 text-xs text-slate-300">
      <Loader2 className="h-3.5 w-3.5 animate-spin" />
      {text}
    </div>
  );
}

function findProductMatch(message: string, products: Product[], selectedProduct: Product | null) {
  const normalized = normalize(message);
  if (/ese producto|ese|esa/.test(normalized) && selectedProduct) return selectedProduct;
  if (!/(quiero|comprar|tienes|hay|producto|jabon|limpiador|arencia|marca|precio|cuesta)/.test(normalized)) return null;

  const expandedQuery = expandProductQuery(normalized);
  const queryTokens = expandedQuery.split(/\s+/).filter((token) => token.length > 2);

  let best: { product: Product; score: number } | null = null;
  for (const product of products) {
    const brand = normalize(product.brand?.name ?? '');
    const name = normalize(product.name);
    const category = normalize(product.category ?? '');
    const description = normalize(product.description ?? '');
    const tags = normalize(getProductTags(product).join(' '));
    const haystack = `${brand} ${name} ${category} ${description} ${tags}`;
    let score = 0;

    if (brand && expandedQuery.includes(brand)) score += 45;
    if (name && expandedQuery.includes(name)) score += 50;
    for (const token of queryTokens) {
      if (brand.includes(token)) score += 18;
      if (name.includes(token)) score += 12;
      if (category.includes(token)) score += 8;
      if (description.includes(token)) score += 4;
      if (tags.includes(token)) score += 4;
      if (haystack.includes(token)) score += 2;
    }

    if (!best || score > best.score) {
      best = { product, score };
    }
  }

  return best && best.score >= 12 ? best.product : null;
}

function expandProductQuery(value: string) {
  return value
    .replace(/\bjabon\b/g, 'jabon limpiador cleanser cleansing')
    .replace(/\bjabón\b/g, 'jabon limpiador cleanser cleansing')
    .replace(/\barencia\b/g, 'arencia rice mochi cleanser limpiador');
}

function getProductTags(product: Product) {
  return Array.isArray((product as Product & { tags?: string[] }).tags)
    ? ((product as Product & { tags?: string[] }).tags ?? [])
    : [];
}

function getCurrentPosition() {
  return new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 12000,
      maximumAge: 30000,
    });
  });
}

function isGeolocationError(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error;
}

function isCatalogIntent(message: string) {
  const normalized = normalize(message);
  return /(catalogo|productos|opciones|que tienen|que venden|muestrame|muéstrame)/.test(normalized);
}

function isManualAddress(normalized: string) {
  return /^(pueblo nuevo|la concordia|barrio obrero|barrio sucre|la castellana|pirineos|tariba|palmira)$/.test(normalized)
    || /\b(calle|carrera|avenida|av|barrio|sector|urbanizacion|urbanización|concordia|pueblo nuevo)\b/.test(normalized);
}

function detectPaymentMethod(normalized: string): PaymentMethodChoice | null {
  if (/efectivo|cash/.test(normalized)) return 'efectivo';
  if (/transferencia|referencia|pago movil|pago móvil|comprobante/.test(normalized)) return 'transferencia';
  return null;
}

function detectCurrency(normalized: string): 'USD' | 'VES' {
  return /bolivar|bolivares|bs|pago movil|pago móvil/.test(normalized) ? 'VES' : 'USD';
}

function isAffirmative(normalized: string) {
  return /^(si|sí|s\?|confirmo|confirmar|dale|ok|de acuerdo|acepto|aceptar|claro)$/.test(normalized);
}

function isNegative(normalized: string) {
  return /^(no|cancelar|cambiar|mejor no)$/.test(normalized);
}

function getProductUsd(product: Product | null) {
  return toFiniteNumber(product?.priceUsd);
}

function getBcvUsdRate(value: number | string | null | undefined, formattedRate?: string | null) {
  return toFiniteNumber(value) ?? toFiniteNumber(formattedRate ?? undefined);
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim();
}

function formatKm(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? `${value.toFixed(1)} km` : 'No disponible';
}

function formatMinutes(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? `${Math.round(value)} min` : 'No disponible';
}

function formatUsdSafe(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? formatUsd(value) : 'Pendiente';
}

function roundMoney(value: number) {
  return Number(value.toFixed(2));
}

function cryptoId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
