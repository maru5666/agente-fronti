'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Layers3, Trash2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { PageHeader } from '@/components/page-header';
import { Button, EmptyState, Field, Input, Panel } from '@/components/ui';
import { useCompany } from '@/hooks/use-company';
import { useLocalList } from '@/hooks/use-local-list';
import { useResource } from '@/hooks/use-resource';
import { categorySchema } from '@/lib/validations';
import { productsApi } from '@/services/api';
import type { Category } from '@/types';

type CategoryForm = z.infer<typeof categorySchema>;

export default function CategoriasPage() {
  const { companyId } = useCompany();
  const local = useLocalList<Category>(`fronti.categories.${companyId}`);
  const { data: products } = useResource(
    () => (companyId ? productsApi.list(companyId) : Promise.resolve([])),
    [companyId],
  );
  const form = useForm<CategoryForm>({
    resolver: zodResolver(categorySchema),
  });
  const productCategories = Array.from(
    new Set((products ?? []).map((product) => product.category).filter(Boolean)),
  ) as string[];

  function submit(values: CategoryForm) {
    local.add(values);
    form.reset();
  }

  return (
    <>
      <PageHeader title="Categorias" description="Organiza el catalogo por lineas comerciales." />
      <div className="grid gap-5 xl:grid-cols-[380px_1fr]">
        <Panel title="Nueva categoria">
          <form className="grid gap-3" onSubmit={form.handleSubmit(submit)}>
            <Field label="Nombre" error={form.formState.errors.name?.message}>
              <Input {...form.register('name')} />
            </Field>
            <Field label="Descripcion">
              <Input {...form.register('description')} />
            </Field>
            <Button type="submit">
              <Layers3 className="h-4 w-4" />
              Crear categoria
            </Button>
          </form>
        </Panel>
        <Panel title="Categorias registradas">
          {local.items.length || productCategories.length ? (
            <div className="grid gap-2">
              {[...local.items.map((item) => item.name), ...productCategories].map((name) => (
                <div key={name} className="flex items-center justify-between rounded-md border border-line p-3">
                  <span className="text-sm font-medium">{name}</span>
                  {local.items.find((item) => item.name === name) ? (
                    <Button variant="ghost" onClick={() => local.remove(local.items.find((item) => item.name === name)!.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="Sin categorias" description="Agrega categorias o asigna una categoria al crear productos." />
          )}
        </Panel>
      </div>
    </>
  );
}
