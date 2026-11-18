import { describe, expect, it } from 'bun:test';
import { completedResult, scorecard, type Play } from '../src/module/leagues/scoring/cricket';

const teams = ['home', 'away'] as const;
const players = [
  { id: 'a', name: 'A', teamId: 'home' },
  { id: 'b', name: 'B', teamId: 'home' },
  { id: 'c', name: 'C', teamId: 'home' },
  { id: 'x', name: 'X', teamId: 'away' },
  { id: 'y', name: 'Y', teamId: 'away' },
];
const score = (plays: Play[], overs = 2) =>
  scorecard(teams, players, overs, plays.map((play, index) => ({ sequence: index + 1, play })));

const opening: Play[] = [
  { kind: 'innings', teamId: 'home', strikerId: 'a', nonStrikerId: 'b' },
  { kind: 'bowler', playerId: 'x' },
];
const dot = { kind: 'ball', batRuns: 0 } as const;

describe('Limited-overs scoring', () => {
  it('rotates strike and asks for a different bowler after six legal balls', () => {
    const firstOver: Play[] = [
      ...opening, ...Array(5).fill(dot), { kind: 'ball', extra: 'wide', batRuns: 0 }, dot,
    ];
    expect(score(firstOver).innings[0]).toMatchObject({
      runs: 1, legalBalls: 6, bowlerId: null, strikerId: 'b', nonStrikerId: 'a',
    });
    expect(() => score([...firstOver, { kind: 'bowler', playerId: 'x' }])).toThrow('different bowler');
    const card = score([...firstOver, { kind: 'bowler', playerId: 'y' }, dot]);
    expect(card.innings[0]?.balls.at(-1)).toMatchObject({ bowlerId: 'y', strikerId: 'b', over: 1, ballInOver: 1 });
  });

  it('replaces a run-out non-striker without crediting it to the bowler', () => {
    const plays: Play[] = [
      ...opening,
      { kind: 'ball', batRuns: 1, dismissal: 'run_out', dismissedPlayerId: 'b', fielderIds: ['x', 'y'] },
    ];
    expect(score(plays).innings[0]).toMatchObject({ strikerId: null, nonStrikerId: 'a', wickets: 1 });
    expect(() => score([...plays, dot])).toThrow('both batters');
    const card = score([...plays, { kind: 'batter', playerId: 'c' }, dot]);
    expect(card.innings[0]).toMatchObject({ strikerId: 'c', nonStrikerId: 'a' });
    expect(card.players.find((player) => player.id === 'x')).toMatchObject({ wickets: 0, run_outs: 1 });
  });

  it('records a tie when both sides use their overs and finish level', () => {
    const card = score([
      ...opening, ...Array(6).fill(dot),
      { kind: 'innings', teamId: 'away', strikerId: 'x', nonStrikerId: 'y' },
      { kind: 'bowler', playerId: 'a' }, ...Array(6).fill(dot),
    ], 1);
    expect(completedResult(card.innings)).toEqual({ outcome: 'tie', winnerTeamId: null });
    expect(card.players.find((player) => player.id === 'x')).toMatchObject({ balls_bowled: 6, maidens: 1 });
  });
});
