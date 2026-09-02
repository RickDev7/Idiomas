export function LoadingScreen({ label = 'Carregando…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 dt-page animate-fade-soft">
      <div className="relative w-16 h-16" role="status" aria-label={label}>
        <div
          className="absolute inset-0 rounded-full animate-orb-breathe"
          style={{
            background: 'linear-gradient(145deg, #00F2FE 0%, #8B5CF6 100%)',
          }}
        />
        <div
          className="absolute inset-2 rounded-full flex items-center justify-center text-[11px] font-bold text-[#00F2FE]"
          style={{ background: '#050816' }}
        >
          DT
        </div>
      </div>
      <p className="text-[13px] text-[#64748B]">{label}</p>
    </div>
  );
}
