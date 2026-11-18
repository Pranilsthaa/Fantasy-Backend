# Cricket scoring

A published tournament fixture uses one innings per team, with 1–50 overs per
innings and a lineup of 2–11 enrolled players per side. Six legal deliveries
complete an over. The scorer records the umpire's decisions, including wides,
no-balls, byes, leg byes and dismissals. No-balls carry a free hit under the
limited-overs rules used here. See the [MCC Laws of Cricket](https://www.lords.org/getmedia/a4ef9f77-2a25-4f5b-a286-4601f08e6334/Laws-of-Cricket-2017-Code-4th-Edition-%282026%29_5.pdf)
and the [ICC limited-overs playing conditions](https://www.icc-cricket.com/about/cricket/rules-and-regulations/playing-conditions?appview=true).

Scorers, owners and league admins select lineups, set the opening batters,
choose each over's bowler, fill a vacant batting end, and enter deliveries.
After a scoring action the staff scorecard lists the current striker,
non-striker, bowler, legal-ball count, and target when chasing. It also includes
the delivery feed and derived batting, bowling and fielding totals.

In Swagger, open **Cricket scoring**. Staff routes use the following base path.

```text
/api/leagues/:leagueId/tournaments/:tournamentId/schedule/fixtures/:fixtureId/scorecard
```

| Action | Method and suffix |
| --- | --- |
| Read the current state and version | `GET` base path |
| Set lineups and overs | `PUT /lineups` |
| Start an innings | `POST /innings` |
| Select bowler or incoming batter | `PUT /bowler` or `PUT /batter` |
| Record a delivery | `POST /deliveries` |
| Undo the latest scoring action | `POST /undo` |
| Publish the official result | `POST /publish` |
| Open a correction | `POST /correction` |

1. Publish the schedule, then set each fixture's lineups using tournament
   registration IDs and choose the overs limit. An owner or admin marks the
   fixture live from the schedule API.
2. Start the innings with a batting team and two distinct openers. Select a
   bowler from the fielding team. Enter `batRuns` for each delivery, plus extras
   or dismissal details where applicable. The server supplies the one-run
   penalty for a wide or no-ball. Enter only additional extras in `extraRuns`.
3. Select an incoming batter after a wicket and a new bowler after each over.
   Start the chase when the first innings closes. Innings close automatically
   at the overs limit, all out, or when the chase reaches its target.
4. An owner or admin publishes the derived result, or explicitly publishes
   `no_result` for an abandoned match that has a scoring setup. The official
   version stores the scorecard, the result, and the player metrics together.

After lineup setup, each write takes the version from the last response.
A stale version returns 409, so clients should reload the staff scorecard before
retrying. Undo voids the latest scoring action and preserves its audit record.

Spectators can poll
`GET /api/tournaments/:tournamentId/fixtures/:fixtureId/scorecard` once scoring
is set up on a published fixture. Before publication of a result, `official`
is null. During a correction, spectators continue seeing the last official
snapshot. Staff undo and replay the affected actions, then an owner or admin
publishes a new revision. Older official revisions remain in the database.

The first release uses a fixed overs limit once lineups are set, consecutive
over restrictions, and a straight run chase. Advanced cases such as DLS,
super overs, replacement players and multi-innings matches are outside this
release.
