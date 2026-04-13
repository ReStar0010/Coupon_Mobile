export default function WebConsumerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg-grey dark:bg-zinc-950 flex flex-col items-center">
      <div className="w-full max-w-sm flex-1 flex flex-col">
        {children}
      </div>
    </div>
  );
}
