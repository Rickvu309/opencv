export function EmptyState({
  title,
  action,
}: {
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <p className="text-[18px] leading-[1.6]">{title}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
