import type { AccessibilityFlag } from '../lib/schema-types';

const LABELS: Record<AccessibilityFlag, string> = {
  'wheelchair-accessible': 'Wheelchair',
  'stroller-friendly': 'Stroller',
  'audio-described': 'Audio described',
  'sign-language': 'Sign language',
  'relaxed-performance': 'Relaxed',
};

export function AccessibilityChip({ flag }: { flag: AccessibilityFlag }) {
  const label = LABELS[flag];
  if (!label) return null;
  return (
    <span className="inline-flex items-center rounded border border-sky-200 bg-sky-50 px-1.5 py-0.5 text-[10px] font-medium text-sky-900">
      {label}
    </span>
  );
}
