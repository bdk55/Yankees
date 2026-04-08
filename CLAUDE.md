# Yankees Game Info App

## What This Is
A mobile-first web app showing NY Yankees game info, deployed on GitHub Pages. Saved as a home screen app on the user's iPhone.

**Live URL:** https://bdk55.github.io/Yankees/

## Repository
- **GitHub:** `bdk55/Yankees` (was `bdk55/Claude` at session creation — see Git Push section below)
- **Deployed branch:** `gh-pages`
- **Dev branch:** `claude/yankees-game-info-app-zXMV8`

## File Structure (gh-pages branch)
```
index.html   — minimal HTML shell (~1KB), links to style.css and app.js
style.css    — full Yankees-themed CSS (~14KB)
app.js       — all JavaScript (~18KB)
```

## What the App Shows
1. **Today's Game** — matchup (away left, home right), live score + inning/outs, game time (ET), venue, TV links, radio links
2. **Starting Pitchers** — both teams, TBD if not announced
3. **Upcoming Games** — next 5 games with day of week, date, home/away, opponent, time ET
4. **Last 10 Games** — W/L streak bar + results with score and date
5. **AL East Standings** — division table with W/L/PCT/GB, Yankees highlighted with ★
6. **Header** — season record chips (W–L, Win %), date, refresh button

## Data Source
MLB Stats API — free, no auth required.
- **Team ID:** 147 (Yankees)
- **Division ID:** 201 (AL East)
- Key endpoints:
  - `/api/v1/schedule?sportId=1&teamId=147&date=YYYY-MM-DD&hydrate=probablePitcher,broadcasts,linescore,team(record)`
  - `/api/v1/game/{gamePk}/linescore` — fetched separately for live games (more reliable than hydrated linescore)
  - `/api/v1/standings?leagueId=103&season=YYYY&standingsTypes=regularSeason&hydrate=team`

## Design
- **Colors:** Navy `#0C2340`, white `#FFFFFF`, silver `#a8b8c8`, muted `#5c7080`
- **Fonts:** Oswald (headers/numbers) + Inter (body) via Google Fonts
- **No gold** — not in Yankees color palette
- Pinstripe background pattern in header
- Cards with dark navy background (`#0e1e36`), subtle borders

## Key Implementation Details

### Timezone
All times forced to `America/New_York`. Today's date uses:
```js
new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
```
(avoids UTC date bug at night)

### Home/Away Order
Away team always on left, home team always on right — matches sports convention.

### Live Score
For live games, fetches `/game/{gamePk}/linescore` directly rather than relying on schedule API hydration. Falls back to `game.teams.home.score` if linescore fails.

`isLive` check:
```js
state === 'Live' || detail.includes('Progress') || detail.includes('Delay')
```

### Broadcasts
- Radio types filtered by: `new Set(['AM','FM','XM','Radio'])`
- SiriusXM Yankees always shown (direct channel link): `https://siriusxm.com/player/channel-linear/entity/21fd583e-8f6a-b869-4f75-9e8a3f604eb0`
- YES Network links to `https://www.gothamapp.com` — **NOTE: user says this is wrong, should link to "Gotham Sports" app, not "Gotham App". Correct URL still needed.**

### Auto-refresh
- 30s interval when game is live
- 60s interval when game starts within 4 hours

### Challenge Tracker
Shows remaining manager challenges as dots during live games (data from `linescore.teams.home/away.remainingChallenges`).

## Git Push Situation
The local git proxy (`127.0.0.1:36003`) is authorized only for `bdk55/Claude`. The repo was renamed to `bdk55/Yankees`, which breaks git push (GitHub doesn't redirect POST/push operations).

**Workaround options:**
1. Use MCP `push_files` tool — uses GitHub API directly, bypasses proxy entirely. Use `owner="bdk55"`, `repo="Yankees"`, `branch="gh-pages"`.
2. Temporarily rename repo back to `Claude` on GitHub, push via git, rename back to `Yankees`.
3. Start a new Claude Code session — the new session proxy will be authorized for `Yankees`.

## Pending / Known Issues
- **Gotham Sports URL:** The YES Network broadcast link currently points to `https://www.gothamapp.com` (wrong app). Need the correct deep link or URL for the Gotham Sports app. User confirmed `gothamapp.com` is incorrect.
