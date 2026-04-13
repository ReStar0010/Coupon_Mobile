export default function WebConsumerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center">
      <div className="w-full max-w-sm flex-1 flex flex-col">
        {children}
      </div>
    </div>
  );
}
