import { ColumnDefinition } from '../types';

export const COLUMNS: ColumnDefinition[] = [
  {
    id: 'backlog',
    title: 'Backlog',
    accentColor: '#8b5cf6',
    glowColor: 'rgba(139, 92, 246, 0.4)',
    gradient: 'linear-gradient(180deg, rgba(139, 92, 246, 0.08) 0%, rgba(139, 92, 246, 0.02) 100%)',
  },
  {
    id: 'todo',
    title: 'To Do',
    accentColor: '#06b6d4',
    glowColor: 'rgba(6, 182, 212, 0.4)',
    gradient: 'linear-gradient(180deg, rgba(6, 182, 212, 0.08) 0%, rgba(6, 182, 212, 0.02) 100%)',
  },
  {
    id: 'in-progress',
    title: 'In Progress',
    accentColor: '#f59e0b',
    glowColor: 'rgba(245, 158, 11, 0.4)',
    gradient: 'linear-gradient(180deg, rgba(245, 158, 11, 0.08) 0%, rgba(245, 158, 11, 0.02) 100%)',
  },
  {
    id: 'done',
    title: 'Done',
    accentColor: '#10b981',
    glowColor: 'rgba(16, 185, 129, 0.4)',
    gradient: 'linear-gradient(180deg, rgba(16, 185, 129, 0.08) 0%, rgba(16, 185, 129, 0.02) 100%)',
  },
];
