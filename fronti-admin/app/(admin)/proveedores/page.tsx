'use client';

import { Truck, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { Button, EmptyState, Field, Input, Panel } from '@/components/ui';
import { useCompany } from '@/hooks/use-company';
import { useLocalList } from '@/hooks/use-local-list';
import type { Supplier } from '@/types';

export default function ProveedoresPage() {
  const { companyId } = useCompany();
  const suppliers = useLocalList<Supplier>(`fronti.suppliers.${companyId}`);
  const [form, setForm] = useState({ name: '', phone: '', category: '' });

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!form.name.trim()) return;
    suppliers.add(form);
    setForm({ name: '', phone: '', category: '' });
  }

  return (
    <>
      <PageHeader title="Proveedores" description="Directorio local de proveedores para compras y reposicion." />
      <div className="grid gap-5 xl:grid-cols-[380px_1fr]">
        <Panel title="Nuevo proveedor">
          <form className="grid gap-3" onSubmit={submit}>
            <Field label="Nombre"><Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field>
            <Field label="Telefono"><Input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></Field>
            <Field label="Categoria"><Input value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} /></Field>
            <Button type="submit"><Truck className="h-4 w-4" />Crear proveedor</Button>
          </form>
        </Panel>
        <Panel title="Directorio">
          {suppliers.items.length ? (
            <div className="grid gap-2">
              {suppliers.items.map((supplier) => (
                <div key={supplier.id} className="flex items-center justify-between rounded-md border border-line p-3">
                  <div>
                    <p className="text-sm font-medium">{supplier.name}</p>
                    <p className="text-xs text-muted">{supplier.phone || 'Sin telefono'} · {supplier.category || 'Sin categoria'}</p>
                  </div>
                  <Button variant="ghost" onClick={() => suppliers.remove(supplier.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
            </div>
          ) : <EmptyState title="Sin proveedores" description="Agrega proveedores frecuentes para planificar reposicion." />}
        </Panel>
      </div>
    </>
  );
}
