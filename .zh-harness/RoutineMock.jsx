const routine = { Sunday: [ { course: 'CSE3101', name: 'Mathematical Analysis for Computer Science', type: 'Theory' }, { course: 'HUM3207', name: 'Economics and Accounting for Engineers', type: 'Theory' } ], Monday: [ { course: 'HUM3209', name: 'Industrial Law and Safety Management', type: 'Theory' } ] };
export const useRoutine = () => ({ routine });
export const RoutineProvider = ({ children }) => children;
