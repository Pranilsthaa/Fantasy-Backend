import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, isNotNull, sql } from 'drizzle-orm';
import { DatabaseService } from '../../../database/database.service';
import { tournaments } from '../../../db/tournaments';

export const reportCategories = ['batting', 'bowling', 'fielding'] as const;
export type ReportCategory = typeof reportCategories[number];

const pageSize = 20;

@Injectable()
export class ReportsService {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  private get db() { return this.database.db; }

  private async published(tournamentId: string) {
    const tournament = await this.db.query.tournaments.findFirst({
      columns: { id: true, name: true, timezone: true },
      where: and(eq(tournaments.id, tournamentId), isNotNull(tournaments.schedulePublishedAt)),
    });
    if (!tournament) throw new NotFoundException('Published tournament not found');
    return tournament;
  }

  private officialMatches(tournamentId: string) {
    return sql`
      select m.id, m.match_number, m.date, m.venue, m.team1_id, m.team2_id,
             r.id as revision_id, r.revision, r.published_at,
             result.outcome, result.winner_team_id, result.summary
      from matches m
      join match_stat_revisions r on r.match_id = m.id and r.status = 'published'
      join match_results result on result.revision_id = r.id
      where m.tournament_id = ${tournamentId}
    `;
  }

  async results(tournamentId: string, page: number) {
    const tournament = await this.published(tournamentId);
    const { rows: data } = await this.db.execute(sql`
      with official as (${this.officialMatches(tournamentId)})
      select o.id as "fixtureId", o.match_number as "matchNumber", o.date, o.venue,
             o.revision, o.published_at as "publishedAt", o.outcome, o.summary,
             o.winner_team_id as "winnerTeamId",
             jsonb_build_object('id', a.id, 'name', a.name, 'code', a.code, 'logo', a.logo) as "team1",
             jsonb_build_object('id', b.id, 'name', b.name, 'code', b.code, 'logo', b.logo) as "team2",
             coalesce((
               select jsonb_agg(jsonb_build_object(
                 'number', i.number, 'battingTeamId', i.batting_team_id,
                 'runs', i.runs, 'wickets', i.wickets, 'legalBalls', i.legal_balls
               ) order by i.number)
               from cricket_innings i where i.revision_id = o.revision_id
             ), '[]'::jsonb) as innings
      from official o
      join teams a on a.id = o.team1_id
      join teams b on b.id = o.team2_id
      order by o.date desc, o.match_number desc
      limit ${pageSize} offset ${(page - 1) * pageSize}
    `);
    return { tournament, data, page, pageSize };
  }

  async standings(tournamentId: string, page: number) {
    const tournament = await this.published(tournamentId);
    const { rows: data } = await this.db.execute(sql`
      with official as (${this.officialMatches(tournamentId)}),
      lineup_sizes as (
        select p.match_id, registration.team_id, count(*) as size
        from official o
        join match_players p on p.match_id = o.id
        join tournament_players registration on registration.id = p.tournament_player_id
        where o.outcome in ('team_win', 'tie')
        group by p.match_id, registration.team_id
      ),
      team_matches as (
        select teams_in_match.team_id, o.outcome, o.winner_team_id,
               own.runs as runs_for, opponent.runs as runs_against,
               case when own.wickets >= own_lineup.size - 1 then scoring.overs * 6 else own.legal_balls end as balls_for,
               case when opponent.wickets >= opponent_lineup.size - 1 then scoring.overs * 6 else opponent.legal_balls end as balls_against
        from official o
        cross join lateral (values (o.team1_id), (o.team2_id)) teams_in_match(team_id)
        left join cricket_scoring scoring on scoring.match_id = o.id
        left join cricket_innings own on scoring.match_id is not null
          and own.revision_id = o.revision_id and own.batting_team_id = teams_in_match.team_id
          and o.outcome in ('team_win', 'tie')
        left join cricket_innings opponent on opponent.revision_id = own.revision_id
          and opponent.bowling_team_id = teams_in_match.team_id
        left join lineup_sizes own_lineup on own_lineup.match_id = o.id and own_lineup.team_id = own.batting_team_id
        left join lineup_sizes opponent_lineup on opponent_lineup.match_id = o.id and opponent_lineup.team_id = opponent.batting_team_id
      ),
      totals as (
        select t.id, t.name, t.code, t.logo,
               count(m.team_id)::int as played,
               count(*) filter (where m.winner_team_id = t.id)::int as won,
               count(*) filter (where m.outcome = 'team_win' and m.winner_team_id <> t.id)::int as lost,
               count(*) filter (where m.outcome = 'tie')::int as tied,
               count(*) filter (where m.outcome = 'no_result')::int as no_result,
               count(*) filter (where m.outcome = 'draw')::int as drawn,
               coalesce(sum(case when m.winner_team_id = t.id then 2
                                 when m.outcome in ('tie', 'no_result', 'draw') then 1 else 0 end), 0)::int as points,
               count(*) filter (where m.runs_for is not null and m.runs_against is not null)::int as nrr_matches,
               6 * sum(m.runs_for) filter (where m.runs_against is not null)::numeric /
                 nullif(sum(m.balls_for) filter (where m.balls_against is not null), 0)
               - 6 * sum(m.runs_against) filter (where m.runs_for is not null)::numeric /
                 nullif(sum(m.balls_against) filter (where m.balls_for is not null), 0) as nrr
        from tournament_teams tt
        join teams t on t.id = tt.team_id
        left join team_matches m on m.team_id = t.id
        where tt.tournament_id = ${tournamentId}
        group by t.id
      ),
      ranked as (
        select *, rank() over (order by points desc, nrr desc nulls last)::int as rank
        from totals
      )
      select rank, jsonb_build_object('id', id, 'name', name, 'code', code, 'logo', logo) as team,
             played, won, lost, tied, no_result as "noResult", drawn, points, round(nrr, 3)::float8 as "netRunRate",
             nrr_matches as "netRunRateMatches"
      from ranked order by rank, name, id
      limit ${pageSize} offset ${(page - 1) * pageSize}
    `);
    return { tournament, data, page, pageSize };
  }

  async players(tournamentId: string, category: ReportCategory, page: number) {
    const tournament = await this.published(tournamentId);
    const sort = {
      batting: sql`runs desc`,
      bowling: sql`wickets desc, economy asc nulls last`,
      fielding: sql`dismissals_involved desc`,
    }[category];
    const activity = {
      batting: sql`runs > 0 or balls_faced > 0 or dismissed > 0`,
      bowling: sql`legal_balls_bowled > 0 or runs_conceded > 0 or wickets > 0`,
      fielding: sql`dismissals_involved > 0`,
    }[category];

    const { rows: data } = await this.db.execute(sql`
      with official as (${this.officialMatches(tournamentId)}),
      appearances as (
        select p.tournament_player_id, count(*)::int as matches
        from official o join match_players p on p.match_id = o.id
        group by p.tournament_player_id
      ),
      metric_totals as (
        select stats.tournament_player_id, d.key, sum(stats.value)::float8 as value
        from official o join player_match_stats stats on stats.revision_id = o.revision_id
        join stat_definitions d on d.id = stats.stat_definition_id
        where d.sport = 'cricket'
        group by stats.tournament_player_id, d.key
      ),
      totals as (
        select a.tournament_player_id, a.matches, coalesce(jsonb_object_agg(m.key, m.value)
          filter (where m.key is not null), '{}'::jsonb) as metrics
        from appearances a left join metric_totals m on m.tournament_player_id = a.tournament_player_id
        group by a.tournament_player_id, a.matches
      ),
      counts as (
        select *,
               coalesce((metrics->>'runs')::numeric, 0) as runs,
               coalesce((metrics->>'balls_faced')::numeric, 0) as balls_faced,
               coalesce((metrics->>'dismissed')::numeric, 0) as dismissed,
               coalesce((metrics->>'balls_bowled')::numeric, 0) as legal_balls_bowled,
               coalesce((metrics->>'runs_conceded')::numeric, 0) as runs_conceded,
               coalesce((metrics->>'wickets')::numeric, 0) as wickets,
               coalesce((metrics->>'catches')::numeric, 0)
                 + coalesce((metrics->>'stumpings')::numeric, 0)
                 + coalesce((metrics->>'run_outs')::numeric, 0) as dismissals_involved
        from totals
      ),
      rates as (
        select *, runs / nullif(dismissed, 0) as average,
                  runs * 100 / nullif(balls_faced, 0) as strike_rate,
                  runs_conceded * 6 / nullif(legal_balls_bowled, 0) as economy
        from counts
      ),
      ranked as (
        select *, rank() over (order by ${sort})::int as rank
        from rates where ${activity}
      )
      select r.rank, tp.player_id as "playerId", r.tournament_player_id as "registrationId",
             p.name, r.matches, r.metrics, r.dismissals_involved::float8 as "dismissalsInvolved",
             round(r.average, 2)::float8 as "battingAverage",
             round(r.strike_rate, 2)::float8 as "strikeRate", round(r.economy, 2)::float8 as economy,
             jsonb_build_object('id', t.id, 'name', t.name, 'code', t.code, 'logo', t.logo) as team
      from ranked r
      join tournament_players tp on tp.id = r.tournament_player_id
      join players p on p.id = tp.player_id
      join teams t on t.id = tp.team_id
      order by r.rank, p.name, r.tournament_player_id
      limit ${pageSize} offset ${(page - 1) * pageSize}
    `);
    return { tournament, category, data, page, pageSize };
  }
}
