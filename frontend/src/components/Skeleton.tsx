export function Skeleton({
  height = 16,
  width = "100%",
}: {
  height?: number | string;
  width?: number | string;
}) {
  return <span className="skel" style={{ height, width }} aria-hidden="true" />;
}

export function LoadingLabel({ text = "Загрузка…" }: { text?: string }) {
  return (
    <span className="sr-only" role="status">
      {text}
    </span>
  );
}
