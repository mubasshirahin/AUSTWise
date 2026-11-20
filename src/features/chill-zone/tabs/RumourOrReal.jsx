import { MessageCircleQuestion, ThumbsUp, ThumbsDown, Flame } from 'lucide-react';
import ComingSoonTab from './ComingSoonTab';

const FEATURES = [
  { icon: ThumbsUp, label: 'Community votes' },
  { icon: ThumbsDown, label: 'Bust it' },
  { icon: Flame, label: 'Hot rumours' },
];

export default function RumourOrReal() {
  return (
    <ComingSoonTab
      icon={MessageCircleQuestion}
      title="Rumour or Real?"
      subtitle="Fact or fiction"
      hint="Campus buzzing with a rumour? Drop it here and the community votes fact or fiction. Verified claims get a badge; busted ones get roasted."
      features={FEATURES}
    />
  );
}
