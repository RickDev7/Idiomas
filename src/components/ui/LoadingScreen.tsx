import mascotImg from '@/assets/mascot/deutsch-turbo-mascot.png';

export function LoadingScreen({ label = 'Carregando…' }: { label?: string }) {
  return (
    <div className="flex flex-col h-full max-w-md mx-auto items-center justify-center gap-5 dt-page px-6">
      <div className="relative">
        <span
          className="absolute inset-[-20%] rounded-full animate-pulse-ring"
          style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.35), transparent 70%)' }}
          aria-hidden
        />
        <img
          src={mascotImg}
          alt=""
          className="relative w-20 h-20 rounded-full object-cover border border-white/10"
          style={{ boxShadow: '0 0 28px rgba(139,92,246,0.45)' }}
          draggable={false}
        />
      </div>
      <p className="text-[14px] font-semibold text-[#CBD5E1]">{label}</p>
    </div>
  );
}
