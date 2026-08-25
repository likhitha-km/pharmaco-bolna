export function Skeleton({ width = '100%', height = 16, radius = 8, style }) {
  return (
    <div
      style={{
        width, height, borderRadius: radius,
        background: 'linear-gradient(90deg, #F3F4F6 25%, #E5E7EB 50%, #F3F4F6 75%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.5s infinite',
        ...style,
      }}
    />
  );
}

// Add shimmer to global styles if not already
if (typeof document !== 'undefined') {
  const style = document.getElementById('pharmaco-shimmer');
  if (!style) {
    const s = document.createElement('style');
    s.id = 'pharmaco-shimmer';
    s.textContent = `@keyframes shimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }`;
    document.head.appendChild(s);
  }
}
