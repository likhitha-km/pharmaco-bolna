import clsx from 'clsx';

export function Badge({ variant = 'primary', size = 'md', icon, children, className }) {
  return (
    <span
      className={clsx('badge', `badge-${variant}`, size === 'sm' && 'badge-sm', className)}
      style={{ fontSize: size === 'sm' ? 11 : 12 }}
    >
      {icon && <span style={{ display: 'flex', alignItems: 'center' }}>{icon}</span>}
      {children}
    </span>
  );
}
