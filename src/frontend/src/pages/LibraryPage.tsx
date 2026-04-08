export function LibraryPage() {
  return (
    <div className="p-8">
      <div className="mb-6">
        <h2 className="font-display text-2xl font-semibold text-[var(--color-text-heading)]">
          Library
        </h2>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Browse and organize your images
        </p>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {Array.from({ length: 24 }).map((_, i) => (
          <div
            key={i}
            className="aspect-square rounded-[var(--radius-comfortable)] bg-[var(--color-bg-secondary)] dark:bg-[var(--color-border)] animate-pulse"
            style={{ animationDelay: `${i * 50}ms` }}
          />
        ))}
      </div>
    </div>
  );
}
