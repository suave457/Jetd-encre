import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { canShowQuizBalanceEquation } from '../src/features/games/quizEngine.js';

test('an unchanged profile balance keeps the original equation, including the daily bonus',()=>{
  assert.equal(canShowQuizBalanceEquation(20,100,120),true);
  assert.equal(canShowQuizBalanceEquation(20,50+20,90),true);
  assert.equal(canShowQuizBalanceEquation(0,0,0),true);
});
test('concurrent or inconsistent totals do not display a false arithmetic equation',()=>{
  assert.equal(canShowQuizBalanceEquation(20,100,140),false);
  assert.equal(canShowQuizBalanceEquation(20,100,100),false);
  for(const value of [NaN,Infinity,-1,'20',null])assert.equal(canShowQuizBalanceEquation(value,100,120),false);
});
test('the shared result keeps the actual confirmed total in both visual and accessible fallbacks',()=>{
  const source=readFileSync(new URL('../src/features/games/CultureQuiz.jsx',import.meta.url),'utf8');
  assert.match(source,/showBalanceEquation && <>/);
  assert.match(source,/XP du profil · total actuel/);
  assert.match(source,/Profil : total actuel de \$\{profileXpTotal\}/);
  assert.match(source,/<strong>\{profileXpTotal\.toLocaleString\("fr-FR"\)\}<\/strong>/);
});
