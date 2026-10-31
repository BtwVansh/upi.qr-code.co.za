export function AuroraBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[var(--bg)]"
    >
      <div
        className="absolute left-1/2 top-[-22rem] h-[46rem] w-[46rem] -translate-x-1/2 animate-float rounded-full blur-[110px] opacity-70 dark:opacity-40"
        style={{
          background:
            "radial-gradient(circle at center, rgba(0, 113, 227, 0.22), rgba(94, 92, 230, 0.08) 48%, transparent 68%)",
        }}
      />
      <div
        className="absolute -right-40 top-[24rem] h-[34rem] w-[34rem] rounded-full blur-[120px] opacity-50 dark:opacity-25"
        style={{
          background:
            "radial-gradient(circle at center, rgba(139, 92, 246, 0.2), transparent 68%)",
          animation: "float 18s ease-in-out infinite reverse",
        }}
      />
      <div
        className="absolute -left-48 bottom-[-12rem] h-[36rem] w-[36rem] rounded-full blur-[130px] opacity-40 dark:opacity-20"
        style={{
          background:
            "radial-gradient(circle at center, rgba(48, 209, 88, 0.12), transparent 68%)",
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.035] dark:opacity-[0.06]"
        style={{
          backgroundImage:
            "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          maskImage:
            "radial-gradient(ellipse 80% 60% at 50% 0%, black, transparent 75%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 80% 60% at 50% 0%, black, transparent 75%)",
        }}
      />
    </div>
  );
}
