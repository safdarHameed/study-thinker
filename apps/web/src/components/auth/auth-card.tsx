export function AuthCard({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-center">
        <h1 className="text-3xl font-semibold tracking-[-0.04em] text-zinc-950 sm:text-[2.1rem]">
          {title}
        </h1>
        {description && <p className="mt-2.5 text-zinc-500">{description}</p>}
      </div>
      <div className="mt-8">{children}</div>
      {footer && <div className="mt-8 text-center text-sm text-zinc-500">{footer}</div>}
    </div>
  );
}
