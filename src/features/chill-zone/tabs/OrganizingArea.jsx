import { LayoutGrid, Pin, StickyNote, ListChecks } from 'lucide-react';
import ComingSoonTab from './ComingSoonTab';

const FEATURES = [
  { icon: Pin, label: 'Pinboard' },
  { icon: StickyNote, label: 'Sticky notes' },
  { icon: ListChecks, label: 'Group tasks' },
];

export default function OrganizingArea() {
  return (
    <ComingSoonTab
      icon={LayoutGrid}
      title="Organizing Area"
      subtitle="Pinboard & group planning"
      hint="A shared pinboard for AUSTians - sticky notes, group projects and pinned announcements to keep the semester under control."
      features={FEATURES}
    />
  );
}
