export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
      <main className="flex flex-col items-center gap-4 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          LocalScope Agent
        </h1>
        <p className="max-w-md text-lg text-zinc-600 dark:text-zinc-400">
          地方自治体の議会会議録を構造化し、人間とAIの双方が読解可能にする市政インテリジェンス基盤
        </p>
      </main>
    </div>
  );
}
