export const extras = [
  "wide",
  "no_ball",
  "bye",
  "leg_bye",
  "no_ball_bye",
  "no_ball_leg_bye",
] as const;
export const dismissals = [
  "bowled",
  "caught",
  "lbw",
  "stumped",
  "run_out",
  "hit_wicket",
  "obstructing_field",
  "hit_ball_twice",
] as const;
type Extra = (typeof extras)[number];
type Dismissal = (typeof dismissals)[number];

export type Play =
  | { kind: "innings"; teamId: string; strikerId: string; nonStrikerId: string }
  | { kind: "bowler" | "batter"; playerId: string }
  | Delivery;

export interface Delivery {
  kind: "ball";
  batRuns: number;
  extra?: Extra;
  extraRuns?: number;
  boundary?: 4 | 6;
  dismissal?: Dismissal;
  dismissedPlayerId?: string;
  fielderIds?: string[];
}

export interface LineupPlayer {
  id: string;
  name: string;
  teamId: string;
}

export const metricNames = {
  runs: "Runs",
  balls_faced: "Balls faced",
  fours: "Fours",
  sixes: "Sixes",
  dismissed: "Dismissals",
  balls_bowled: "Legal balls bowled",
  runs_conceded: "Runs conceded",
  wickets: "Bowling wickets",
  maidens: "Maiden overs",
  dots_bowled: "Dot balls bowled",
  wides: "Wide runs conceded",
  no_balls: "No-balls bowled",
  catches: "Catches",
  stumpings: "Stumpings",
  run_outs: "Run-out involvements",
} as const;

type Metrics = Record<keyof typeof metricNames, number>;
type PlayerStats = LineupPlayer & Metrics;
type RecordedBall = Delivery & {
  strikerId: string;
  nonStrikerId: string;
  bowlerId: string;
  sequence: number;
  legalBall: boolean;
  runs: number;
  over: number;
  ballInOver: number;
};
interface Innings {
  number: number;
  battingTeamId: string;
  bowlingTeamId: string;
  strikerId: string | null;
  nonStrikerId: string | null;
  bowlerId: string | null;
  previousBowlerId: string | null;
  freeHit: boolean;
  closed: boolean;
  target: number | null;
  runs: number;
  wickets: number;
  extras: number;
  legalBalls: number;
  overRunsConceded: number;
  usedBatters: string[];
  balls: RecordedBall[];
}

export class CricketInputError extends Error {}

export function scorecard(
  teamIds: readonly [string, string],
  players: LineupPlayer[],
  overs: number,
  events: { sequence: number; play: Play }[],
) {
  const innings: Innings[] = [];
  const zeros = Object.fromEntries(
    Object.keys(metricNames).map((key) => [key, 0]),
  ) as Metrics;
  const stats = new Map(
    players.map((player): [string, PlayerStats] => [
      player.id,
      { ...player, ...zeros },
    ]),
  );
  const getPlayer = (id: string, teamId: string) => {
    const player = stats.get(id);
    if (!player || player.teamId !== teamId)
      throw new CricketInputError("Player is not in the selected team lineup");
    return player;
  };

  for (const { sequence, play } of events) {
    const current = innings.at(-1);
    if (play.kind === "innings") {
      if (
        current &&
        (!current.closed ||
          innings.length === 2 ||
          current.battingTeamId === play.teamId)
      ) {
        throw new CricketInputError(
          "Finish the first innings before the other team bats",
        );
      }
      const opponent = teamIds.find((id) => id !== play.teamId);
      if (!teamIds.includes(play.teamId) || !opponent)
        throw new CricketInputError("Batting team is not in this fixture");
      getPlayer(play.strikerId, play.teamId);
      getPlayer(play.nonStrikerId, play.teamId);
      if (play.strikerId === play.nonStrikerId)
        throw new CricketInputError("Select two different opening batters");
      innings.push({
        number: innings.length + 1,
        battingTeamId: play.teamId,
        bowlingTeamId: opponent,
        strikerId: play.strikerId,
        nonStrikerId: play.nonStrikerId,
        bowlerId: null,
        previousBowlerId: null,
        freeHit: false,
        closed: false,
        target: current ? current.runs + 1 : null,
        runs: 0,
        wickets: 0,
        extras: 0,
        legalBalls: 0,
        overRunsConceded: 0,
        usedBatters: [play.strikerId, play.nonStrikerId],
        balls: [],
      });
      continue;
    }
    if (!current || current.closed)
      throw new CricketInputError("Start an innings before recording play");
    if (play.kind === "bowler") {
      getPlayer(play.playerId, current.bowlingTeamId);
      if (current.bowlerId || current.previousBowlerId === play.playerId) {
        throw new CricketInputError(
          "Select a different bowler at the start of the next over",
        );
      }
      current.bowlerId = play.playerId;
      continue;
    }
    if (play.kind === "batter") {
      getPlayer(play.playerId, current.battingTeamId);
      if (
        (current.strikerId && current.nonStrikerId) ||
        current.usedBatters.includes(play.playerId)
      ) {
        throw new CricketInputError("Select an unused batter after a wicket");
      }
      if (!current.strikerId) current.strikerId = play.playerId;
      else current.nonStrikerId = play.playerId;
      current.usedBatters.push(play.playerId);
      continue;
    }
    if (play.kind !== "ball")
      throw new CricketInputError("Unknown scoring action");
    const { strikerId, nonStrikerId, bowlerId } = current;
    if (!strikerId || !nonStrikerId || !bowlerId)
      throw new CricketInputError(
        "Select both batters and the bowler before scoring a delivery",
      );
    const striker = getPlayer(strikerId, current.battingTeamId);
    const bowler = getPlayer(bowlerId, current.bowlingTeamId);
    const wide = play.extra === "wide";
    const noBall = play.extra?.startsWith("no_ball") ?? false;
    const bye = play.extra?.endsWith("bye") ?? false;
    const extraRuns = play.extraRuns ?? 0;
    const legalBall = !wide && !noBall;
    if ((wide || bye) && play.batRuns)
      throw new CricketInputError(
        "Wides and byes cannot include runs off the bat",
      );
    if ((!play.extra || play.extra === "no_ball") && extraRuns)
      throw new CricketInputError(
        "Select an extras category for additional extra runs",
      );
    if (bye && !extraRuns)
      throw new CricketInputError("Enter the number of byes or leg byes");
    if (play.boundary && play.boundary !== play.batRuns)
      throw new CricketInputError("Boundary must match runs off the bat");
    const dismissed = play.dismissedPlayerId;
    const fielders = play.fielderIds ?? [];
    if (!play.dismissal && (dismissed || fielders.length))
      throw new CricketInputError("Select a dismissal type for the wicket");
    if (play.dismissal) {
      const kind = play.dismissal;
      const uncredited =
        kind === "run_out" ||
        kind === "obstructing_field" ||
        kind === "hit_ball_twice";
      if (
        !dismissed ||
        (dismissed !== strikerId && !(uncredited && dismissed === nonStrikerId))
      ) {
        throw new CricketInputError(
          "Select an active batter eligible for this dismissal",
        );
      }
      if ((noBall || current.freeHit) && !uncredited)
        throw new CricketInputError(
          "That dismissal is unavailable on a no-ball or free hit",
        );
      if (
        wide &&
        !["run_out", "stumped", "hit_wicket", "obstructing_field"].includes(
          kind,
        )
      )
        throw new CricketInputError("That dismissal is unavailable on a wide");
      if (!uncredited && (play.batRuns || extraRuns))
        throw new CricketInputError(
          "That dismissal cannot score additional runs",
        );
      if (
        kind === "caught" || kind === "stumped"
          ? fielders.length !== 1
          : kind !== "run_out" && fielders.length > 0
      ) {
        throw new CricketInputError(
          "Check fielders for the selected dismissal",
        );
      }
      if (new Set(fielders).size !== fielders.length)
        throw new CricketInputError("Fielders must be distinct");
      getPlayer(dismissed, current.battingTeamId).dismissed++;
      if (!uncredited) bowler.wickets++;
      for (const id of fielders) {
        const fielder = getPlayer(id, current.bowlingTeamId);
        if (kind === "caught") fielder.catches++;
        if (kind === "stumped") fielder.stumpings++;
        if (kind === "run_out") fielder.run_outs++;
      }
      current.wickets++;
    }

    const penalty = wide || noBall ? 1 : 0;
    const runs = play.batRuns + extraRuns + penalty;
    const conceded = play.batRuns + penalty + (wide ? extraRuns : 0);
    current.balls.push({
      ...play,
      sequence,
      strikerId,
      nonStrikerId,
      bowlerId,
      legalBall,
      runs,
      over: Math.floor(current.legalBalls / 6),
      ballInOver: (current.legalBalls % 6) + 1,
    });
    current.runs += runs;
    current.extras += extraRuns + penalty;
    striker.runs += play.batRuns;
    if (!wide) striker.balls_faced++;
    if (play.boundary === 4) striker.fours++;
    if (play.boundary === 6) striker.sixes++;
    bowler.runs_conceded += conceded;
    if (wide) bowler.wides += penalty + extraRuns;
    if (noBall) bowler.no_balls++;
    current.overRunsConceded += conceded;
    current.freeHit = noBall || (wide && current.freeHit);

    // The penalty does not count as a run between the wickets.
    if ((play.batRuns + extraRuns) % 2 === 1) {
      [current.strikerId, current.nonStrikerId] = [
        current.nonStrikerId,
        current.strikerId,
      ];
    }
    if (dismissed === current.strikerId) current.strikerId = null;
    if (dismissed === current.nonStrikerId) current.nonStrikerId = null;
    if (legalBall) {
      bowler.balls_bowled++;
      if (runs === 0) bowler.dots_bowled++;
      current.legalBalls++;
      if (current.legalBalls % 6 === 0) {
        if (!current.overRunsConceded) bowler.maidens++;
        current.overRunsConceded = 0;
        [current.strikerId, current.nonStrikerId] = [
          current.nonStrikerId,
          current.strikerId,
        ];
        current.previousBowlerId = current.bowlerId;
        current.bowlerId = null;
      }
    }
    const batterCount = players.filter(
      (player) => player.teamId === current.battingTeamId,
    ).length;
    current.closed =
      current.legalBalls === overs * 6 ||
      current.wickets === batterCount - 1 ||
      (current.target !== null && current.runs >= current.target);
  }

  return { innings, players: [...stats.values()] };
}

export function completedResult(innings: Innings[]) {
  const [first, chase] = innings;
  if (!first?.closed || !chase?.closed) return null;
  if (first.runs === chase.runs)
    return { outcome: "tie" as const, winnerTeamId: null };
  return {
    outcome: "team_win" as const,
    winnerTeamId:
      first.runs > chase.runs ? first.battingTeamId : chase.battingTeamId,
  };
}
