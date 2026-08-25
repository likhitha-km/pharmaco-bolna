import { motion } from 'framer-motion';

export function QuickReply({ options = [], onSelect }) {
  if (!options.length) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '8px 0' }}>
      {options.map((opt, i) => (
        <motion.button
          key={i}
          whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
          onClick={() => onSelect(opt)}
          style={{
            padding: '8px 16px', borderRadius: 'var(--radius-full)',
            border: '1.5px solid var(--color-primary)', background: 'var(--color-primary-light)',
            color: 'var(--color-primary)', fontSize: 13, fontFamily: 'var(--font-body)',
            fontWeight: 500, cursor: 'pointer',
          }}
          aria-label={`Quick reply: ${opt}`}
        >
          {opt}
        </motion.button>
      ))}
    </div>
  );
}
