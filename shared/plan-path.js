/* Deterministic path from a checked catalog. Answers change depth, order, and practice. */

import { wordsFromId } from './text.js';

const LIMITS = { '15': 2, '30': 4, '60': 8 };

function roleMapFrom(profile) {
  if (!profile?.competencies) return [];
  return profile.competencies.map(item => ({
    competencyId: item.id,
    priority: item.priority,
    evidence: item.evidence,
    objective: item.learningObjective,
    label: item.label || wordsFromId(item.id)
  }));
}

function rank(lesson, answers) {
  const focus = answers.focus || 'balanced';
  const weak = answers.weak || 'unsure';
  if (focus !== 'balanced' && lesson.competencyId === focus && lesson.kind === 'core') return 0;
  if (lesson.kind === 'transfer') return 1;
  if (weak !== 'unsure' && lesson.competencyId === weak && lesson.kind === 'core') return 2;
  if (lesson.kind === 'stage') return 5;
  return 3;
}

export function applyAnswers(catalog, answers = {}, profile = null) {
  const focus = answers.focus || 'balanced';
  const weak = answers.weak || 'unsure';
  const experience = answers.experience || 'prefer-not';
  const stage = answers.stage || 'unsure';
  const time = LIMITS[answers.time] ? answers.time : '30';
  const limit = LIMITS[time];
  const pool = catalog.lessons.filter(lesson => {
    if (lesson.kind === 'transfer') return experience === 'career-change';
    if (lesson.kind === 'stage') {
      if (time === '15') return false;
      if (stage === 'unsure') return lesson.stage === 'screening';
      return lesson.stage === stage || (stage === 'panel' || stage === 'final' ? lesson.stage === 'final' : false);
    }
    return true;
  });
  const ordered = [...pool].sort((a, b) => rank(a, { focus, weak }) - rank(b, { focus, weak }) || catalog.lessons.indexOf(a) - catalog.lessons.indexOf(b));
  const lessons = [];
  for (const lesson of ordered) {
    if (lessons.length >= limit) break;
    const deep = focus !== 'balanced' && lesson.competencyId === focus && lesson.kind === 'core';
    lessons.push({
      ...lesson,
      body: deep ? lesson.deepBody : lesson.body,
      minutes: deep ? Math.min(lesson.minutes + 4, 25) : lesson.minutes,
      depth: deep ? 'deep' : 'standard'
    });
  }
  const lessonCompetencies = new Set(lessons.map(lesson => lesson.competencyId));
  const stageOk = scenario => {
    if (!scenario.stageFit || scenario.stageFit.includes('any')) return true;
    if (stage === 'unsure') return true;
    if (stage === 'panel' || stage === 'final') return scenario.stageFit.includes(stage) || scenario.stageFit.includes('final') || scenario.stageFit.includes('panel');
    return scenario.stageFit.includes(stage);
  };
  let scenarios = catalog.scenarios.filter(scenario => stageOk(scenario) && (lessonCompetencies.has(scenario.competencyId) || scenario.competencyId === weak));
  if (weak !== 'unsure') {
    const weakScenario = catalog.scenarios.find(scenario => scenario.competencyId === weak);
    if (weakScenario && !scenarios.some(scenario => scenario.id === weakScenario.id)) scenarios = [weakScenario, ...scenarios];
  }
  if (focus !== 'balanced') {
    scenarios = [...scenarios].sort((a, b) => (a.competencyId === focus ? 0 : 1) - (b.competencyId === focus ? 0 : 1));
  }
  scenarios = scenarios.slice(0, 3);
  const quizPool = [...catalog.quiz].sort((a, b) => {
    const score = item => (item.competencyId === focus ? 0 : item.competencyId === weak ? 1 : lessonCompetencies.has(item.competencyId) ? 2 : 3);
    return score(a) - score(b);
  });
  const quiz = [];
  for (const item of quizPool) {
    if (quiz.length >= 4) break;
    if (quiz.length < 3 || lessonCompetencies.has(item.competencyId) || item.competencyId === focus || item.competencyId === weak) quiz.push(item);
  }
  return {
    schema: 'nextstep.plan.v1',
    lessons,
    quiz: quiz.slice(0, 4),
    scenarios,
    assumedTool: answers.tool || null,
    answers: { focus, weak, experience, stage, time, tool: answers.tool || null },
    roleMap: roleMapFrom(profile)
  };
}

export function basisLabel(lesson) {
  return lesson.generalGuidance
    ? 'General practice guidance. This is not a rule from the job ad.'
    : 'From the job ad.';
}
