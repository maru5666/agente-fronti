export function PageHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="mb-5">
      <h1 className="text-2xl font-semibold tracking-normal text-ink">{title}</h1>
      <p className="mt-1 text-sm text-muted">{description}</p>
    </div>
  );
}
