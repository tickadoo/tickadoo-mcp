export function CardEmpty({ intentSummary }: { intentSummary?: string }) {
  return (
    <main className="flex min-h-[220px] items-center justify-center bg-[#f8faf8] p-5 text-center">
      <section className="max-w-sm">
        <h1 className="text-lg font-semibold text-[#172018]">No matches found</h1>
        {intentSummary ? <p className="mt-2 text-sm text-[#4b5c4d]">{intentSummary}</p> : null}
        <p className="mt-3 text-sm text-[#617063]">Try widening the date, city, or audience filters and search again.</p>
      </section>
    </main>
  );
}
