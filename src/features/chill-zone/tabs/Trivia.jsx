import { Brain, Trophy, Clock, BookOpen } from 'lucide-react';
import ComingSoonTab from './ComingSoonTab';

const FEATURES = [
  { icon: Trophy, label: 'Leaderboard' },
  { icon: Clock, label: 'Timed rounds' },
  { icon: BookOpen, label: 'CSE & general' },
];

export default function Trivia() {
  return (
    <ComingSoonTab
      icon={Brain}
      title="Trivia"
      subtitle="Test your brain"
      hint="Quick-fire quizzes on AUST history, CSE concepts and general knowledge. Climb the leaderboard and prove you're the campus brainiac."
      features={FEATURES}
    />
  );
}
