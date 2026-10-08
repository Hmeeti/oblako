export default function OfflinePage() {
  return (
    <main className="min-h-[100dvh] grid place-items-center px-6 text-center bg-[var(--cream)]">
      <div>
        <h1 className="font-display text-3xl">Нет сети</h1>
        <p className="mt-2 text-[var(--stone)]">
          Проверьте интернет и откройте кабинет снова.
        </p>
      </div>
    </main>
  );
}
