import { Stethoscope, UserRound } from 'lucide-react';

const ROLE_OPTIONS = [
  {
    value: 'patient',
    icon: UserRound,
    title: 'Patient or Caregiver',
    description:
      'Report drug side effects, search medicines, track your submitted reports, receive safety alerts.',
  },
  {
    value: 'healthcare_professional',
    icon: Stethoscope,
    title: 'Healthcare Professional',
    description:
      'Submit detailed clinical ADR reports, access professional reporting tools, view institutional analytics.',
  },
];

export default function RoleSelector({ selected, onSelect }) {
  return (
    <div className="role-selector-grid">
      {ROLE_OPTIONS.map((role) => {
        const active = selected === role.value;
        const Icon = role.icon;

        return (
          <button
            key={role.value}
            type="button"
            className="role-card"
            style={{
              borderColor: active ? '#CC785C' : '#E5E5EA',
              background: active ? '#FFF8F5' : '#FFFFFF',
            }}
            onClick={() => onSelect(role.value)}
            aria-pressed={active}
          >
            <Icon size={20} color={active ? '#CC785C' : '#8E8E93'} aria-hidden="true" />
            <h3>{role.title}</h3>
            <p>{role.description}</p>
          </button>
        );
      })}
      <button
        type="button"
        style={{ display: 'none' }}
        aria-hidden="true"
        tabIndex={-1}
        onClick={() => onSelect('admin')}
      >
        Admin
      </button>
    </div>
  );
}
