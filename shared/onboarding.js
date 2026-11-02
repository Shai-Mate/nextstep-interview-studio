import { wordsFromId } from './text.js';

function labelFor(item) {
  return item.label || wordsFromId(item.id);
}

export function onboardingQuestions(profile) {
  const cores = (profile.competencies || []).filter(item => item.priority === 'core').slice(0, 4);
  const focusOptions = [
    ...cores.map(item => ({ value: item.id, label: labelFor(item) })),
    { value: 'balanced', label: 'A balanced pass across this role' }
  ];
  const weakOptions = [
    ...cores.map(item => ({ value: item.id, label: labelFor(item) })),
    { value: 'unsure', label: 'Not sure yet' }
  ];
  const questions = [
    {
      id: 'focus',
      prompt: `Which part of this ${profile.title} role should we spend the most time on?`,
      options: focusOptions
    },
    {
      id: 'weak',
      prompt: 'Which part feels shakiest right now?',
      options: weakOptions
    },
    {
      id: 'experience',
      prompt: 'What best describes your background for this role?',
      options: [
        { value: 'early', label: 'Early career' },
        { value: 'experienced', label: 'I have done work like this' },
        { value: 'career-change', label: 'Changing into this kind of work' },
        { value: 'prefer-not', label: 'Prefer not to say' }
      ]
    },
    {
      id: 'stage',
      prompt: 'What kind of conversation are you preparing for?',
      options: [
        { value: 'screening', label: 'A short first conversation' },
        { value: 'skills', label: 'A skills or scenario conversation' },
        { value: 'panel', label: 'A panel' },
        { value: 'final', label: 'A final conversation' },
        { value: 'unsure', label: 'Not sure yet' }
      ]
    },
    {
      id: 'time',
      prompt: 'How much time do you have today?',
      options: [
        { value: '15', label: '15 minutes' },
        { value: '30', label: '30 minutes' },
        { value: '60', label: '60 minutes' }
      ]
    }
  ];
  const tools = (profile.namedRequiredTools || []).slice(0, 4);
  if (tools.length) {
    questions.splice(4, 0, {
      id: 'tool',
      prompt: 'The job ad names these tools. Which one should the examples assume?',
      options: tools.map(tool => ({ value: tool, label: tool }))
    });
  }
  return questions.slice(0, 6);
}
