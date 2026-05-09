const YANKEES_ID = 147;

    function fmt(dateStr) {
      const [y, m, d] = dateStr.split('-').map(Number);
      return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    function fmtTime(datetime) {
      return new Date(datetime).toLocaleTimeString('en-US', {
        hour: 'numeric', minute: '2-digit', timeZoneName: 'short', timeZone: 'America/New_York'
      });
    }

    async function fetchJSON(url) {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    }

    async function getTodayGame() {
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
      const data = await fetchJSON(
        `https://statsapi.mlb.com/api/v1/schedule?sportId=1&teamId=${YANKEES_ID}&date=${today}&hydrate=probablePitcher,broadcasts,linescore,team(record)`
      );
      const dates = data.dates || [];
      if (!dates.length || !dates[0].games.length) return null;
      const game = dates[0].games[0];
      const state  = game.status.abstractGameState;
      const detail = game.status.detailedState || '';
      const isLive = state === 'Live' || detail.includes('Progress') || detail.includes('Delay');
      if (isLive) {
        try {
          const ls = await fetchJSON(`https://statsapi.mlb.com/api/v1/game/${game.gamePk}/linescore`);
          game.linescore = ls;
        } catch (e) {}
        try {
          const pb = await fetchJSON(`https://statsapi.mlb.com/api/v1/game/${game.gamePk}/playByPlay`);
          game.scoringPlays = (pb.allPlays || []).filter(p => p.about?.isScoringPlay);
        } catch (e) {}
        try {
          game.boxscore = await fetchJSON(`https://statsapi.mlb.com/api/v1/game/${game.gamePk}/boxscore`);
        } catch (e) {}
      }
      return game;
    }

    async function getLast10() {
      const end = new Date(); end.setDate(end.getDate() - 1);
      const start = new Date(); start.setDate(start.getDate() - 30);
      const data = await fetchJSON(
        `https://statsapi.mlb.com/api/v1/schedule?sportId=1&teamId=${YANKEES_ID}` +
        `&startDate=${start.toLocaleDateString('en-CA', {timeZone:'America/New_York'})}&endDate=${end.toLocaleDateString('en-CA', {timeZone:'America/New_York'})}&hydrate=linescore`
      );
      const games = [];
      for (const d of (data.dates || []).reverse()) {
        for (const g of d.games.reverse()) {
          if (g.status.abstractGameState === 'Final') {
            games.push(g);
            if (games.length === 10) return games;
          }
        }
      }
      return games;
    }

    const BROADCAST_URLS = {
      'YES':         'https://www.gothamsports.com',
      'YES Network': 'https://www.gothamsports.com',
      'MLB.TV':      'https://www.mlb.com/tv',
      'ESPN':        'https://www.espn.com/watch',
      'ESPN+':       'https://plus.espn.com',
      'ESPN2':       'https://www.espn.com/watch',
      'Fox':         'https://www.foxsports.com/live',
      'FS1':         'https://www.foxsports.com/live',
      'TBS':         'https://www.tbs.com/watchtbs',
      'Apple TV+':   'https://tv.apple.com',
      'Peacock':     'https://www.peacocktv.com',
      'Amazon':      'https://www.amazon.com/primevideo',
      'Prime Video': 'https://www.amazon.com/primevideo',
      'NBC Sports':  'https://www.nbcsports.com',
      'NESN':        'https://nesn.com',
      'MLBN':        'https://www.mlb.com/network',
      'MLB Network': 'https://www.mlb.com/network',
    };

    const RADIO_URLS = {
      'WFAN':              'https://audacy.com/wfan',
      'WFAN 660':          'https://audacy.com/wfan',
      'WFAN 101.9':        'https://audacy.com/wfan',
      'ESPN Radio':        'https://www.espn.com/radio',
      'ESPN Deportes':     'https://www.espndeportes.com/radio',
      'SiriusXM':          'https://siriusxm.com/player/channel-linear/entity/21fd583e-8f6a-b869-4f75-9e8a3f604eb0',
      'MLB Network Radio': 'https://siriusxm.com/player/channel-linear/entity/21fd583e-8f6a-b869-4f75-9e8a3f604eb0',
      'WCBS':              'https://www.iheart.com/live/wcbs-880-452/',
      'WABC':              'https://www.iheart.com/live/wabc-770-am-452/',
    };

    function abbr(name) {
      const map = {
        'New York Yankees':'NYY','Boston Red Sox':'BOS','Tampa Bay Rays':'TB',
        'Baltimore Orioles':'BAL','Toronto Blue Jays':'TOR','Houston Astros':'HOU',
        'Texas Rangers':'TEX','Seattle Mariners':'SEA','Los Angeles Angels':'LAA',
        'Oakland Athletics':'OAK','Chicago White Sox':'CWS','Cleveland Guardians':'CLE',
        'Detroit Tigers':'DET','Kansas City Royals':'KC','Minnesota Twins':'MIN',
        'New York Mets':'NYM','Philadelphia Phillies':'PHI','Atlanta Braves':'ATL',
        'Miami Marlins':'MIA','Washington Nationals':'WSH','Los Angeles Dodgers':'LAD',
        'San Francisco Giants':'SF','San Diego Padres':'SD','Colorado Rockies':'COL',
        'Arizona Diamondbacks':'ARI','Chicago Cubs':'CHC','Milwaukee Brewers':'MIL',
        'St. Louis Cardinals':'STL','Cincinnati Reds':'CIN','Pittsburgh Pirates':'PIT',
      };
      return map[name] || name.split(' ').pop().slice(0,3).toUpperCase();
    }

    function buildLiveDetail(ls, scoringPlays = [], teams = {}, boxscore = null) {
      if (!ls || !ls.offense || !ls.defense?.pitcher) return '';
      const onFirst  = !!ls.offense?.first;
      const onSecond = !!ls.offense?.second;
      const onThird  = !!ls.offense?.third;
      const balls    = ls.balls   ?? 0;
      const strikes  = ls.strikes ?? 0;
      const batter   = ls.offense?.batter?.fullName  || '—';
      const onDeck   = ls.offense?.onDeck?.fullName  || '—';
      const pitcher  = ls.defense?.pitcher?.fullName || '—';
      const pips = (count, max, cls) => Array.from({length: max}, (_,i) =>
        `<div class="count-pip ${cls}${i < count ? ' on' : ''}"></div>`).join('');
      const inns    = ls.innings || [];
      const maxInn  = Math.max(9, ls.currentInning || 9);
      const innNums = Array.from({length: maxInn}, (_, i) => i + 1);
      const cell = (side, n) => {
        const inn = inns.find(i => i.num === n);
        if (!inn) return '<td class="ls-inn"></td>';
        const runs = inn[side]?.runs;
        return `<td class="ls-inn">${runs != null ? runs : ''}</td>`;
      };
      const lsTable = `
        <div class="linescore-wrap">
          <table class="linescore-table">
            <thead><tr>
              <th class="ls-th-team"></th>
              ${innNums.map(n => `<th class="ls-th-inn">${n}</th>`).join('')}
              <th class="ls-th-rhe ls-sep">R</th><th class="ls-th-rhe">H</th><th class="ls-th-rhe">E</th>
            </tr></thead>
            <tbody>
              <tr>
                <td class="ls-team">${teams.away || ''}</td>
                ${innNums.map(n => cell('away', n)).join('')}
                <td class="ls-rhe ls-sep">${ls.teams?.away?.runs ?? ''}</td>
                <td class="ls-rhe">${ls.teams?.away?.hits ?? ''}</td>
                <td class="ls-rhe">${ls.teams?.away?.errors ?? ''}</td>
              </tr>
              <tr>
                <td class="ls-team">${teams.home || ''}</td>
                ${innNums.map(n => cell('home', n)).join('')}
                <td class="ls-rhe ls-sep">${ls.teams?.home?.runs ?? ''}</td>
                <td class="ls-rhe">${ls.teams?.home?.hits ?? ''}</td>
                <td class="ls-rhe">${ls.teams?.home?.errors ?? ''}</td>
              </tr>
            </tbody>
          </table>
        </div>`;
      const currentBatterId = ls.offense?.batter?.id;
      const extractLineup = bsTeam => {
        if (!bsTeam?.battingOrder?.length) return [];
        return bsTeam.battingOrder.map(id => {
          const p = bsTeam.players?.[`ID${id}`];
          return { id, name: p?.person?.fullName || '—', pos: p?.position?.abbreviation || '' };
        });
      };
      const awayLineup = boxscore ? extractLineup(boxscore.teams?.away) : [];
      const homeLineup = boxscore ? extractLineup(boxscore.teams?.home) : [];
      const renderLineupCol = (lineup, label) => `
        <div class="lineup-col">
          <div class="lineup-team-label">${label}</div>
          ${lineup.map((p, i) => `<div class="lineup-row${p.id === currentBatterId ? ' batting' : ''}"><span class="lineup-num">${i + 1}</span><span class="lineup-pos">${p.pos}</span><span class="lineup-name">${p.name}</span></div>`).join('')}
        </div>`;
      const lineupSection = (awayLineup.length || homeLineup.length) ? `
        <details class="lineup-details" open>
          <summary class="lineup-summary">
            <span class="live-detail-label">Lineups</span>
            <span class="live-detail-chevron">▾</span>
          </summary>
          <div class="lineup-grid">
            ${renderLineupCol(awayLineup, teams.away || 'Away')}
            ${renderLineupCol(homeLineup, teams.home || 'Home')}
          </div>
        </details>` : '';
      const scoringSection = scoringPlays.length ? `
        <div class="scoring-plays">
          <div class="meta-key" style="margin-bottom:0.35rem">Scoring Plays</div>
          ${scoringPlays.map(p => {
            const half = p.about?.isTopInning ? '▲' : '▼';
            const inn  = p.about?.ordinalNum || '';
            const rbi  = p.result?.rbi;
            const rbiStr = rbi > 0 ? ` (${rbi} RBI)` : '';
            const desc = p.matchup?.batter?.fullName ? `${p.matchup.batter.fullName} — ${p.result?.event || ''}${rbiStr}` : (p.result?.event || '');
            const away = p.result?.awayScore ?? 0;
            const home = p.result?.homeScore ?? 0;
            return `<div class="scoring-play-row"><span class="sp-inning">${half} ${inn}</span><span class="sp-desc">${desc}</span><span class="sp-score">${away}–${home}</span></div>`;
          }).join('')}
        </div>` : '';
      return `
        <details class="live-detail">
          <summary class="live-detail-summary">
            <span class="live-detail-label">Live Game</span>
            <span class="live-detail-chevron">▾</span>
          </summary>
          <div class="live-detail-body">
            <div class="live-detail-row">
              <div class="live-detail-cell">
                <div class="meta-key">Runners</div>
                <div class="base-diamond">
                  <div class="base-wrap">
                    <div class="base second${onSecond ? ' on' : ''}"></div>
                    <div class="base-row">
                      <div class="base third${onThird ? ' on' : ''}"></div>
                      <div class="base-home"></div>
                      <div class="base first${onFirst ? ' on' : ''}"></div>
                    </div>
                  </div>
                </div>
              </div>
              <div class="live-detail-cell">
                <div class="meta-key">Count</div>
                <div class="count-grid">
                  <div class="count-label">B</div><div class="count-pips">${pips(balls, 4, 'ball')}</div>
                  <div class="count-label">S</div><div class="count-pips">${pips(strikes, 3, 'strike')}</div>
                </div>
              </div>
            </div>
            <div class="live-detail-players">
              <div class="live-detail-cell"><div class="meta-key">Batter</div><div class="live-player-name">${batter}</div></div>
              <div class="live-detail-cell"><div class="meta-key">On Deck</div><div class="live-player-name">${onDeck}</div></div>
              <div class="live-detail-cell"><div class="meta-key">Pitching</div><div class="live-player-name">${pitcher}</div></div>
            </div>
            ${lsTable}
            ${scoringSection}
            ${lineupSection}
          </div>
        </details>`;
    }

    function buildGameCard(game) {
      if (!game) {
        return `<div class="card"><div class="state-box"><div class="state-text">No Yankees game scheduled today.</div></div></div>`;
      }
      const isHome   = game.teams.home.team.id === YANKEES_ID;
      const yankTeam = isHome ? game.teams.home : game.teams.away;
      const oppTeam  = isHome ? game.teams.away : game.teams.home;
      const oppName  = oppTeam.team.name;
      const oppAbbr  = abbr(oppName);
      const rec      = t => { const r = t.leagueRecord || t.team?.record?.leagueRecord; return r ? `${r.wins}–${r.losses}` : ''; };
      const yankRec  = rec(yankTeam);
      const oppRec   = rec(oppTeam);
      const state   = game.status.abstractGameState;
      const detail  = game.status.detailedState || '';
      const isLive  = state === 'Live' || detail.includes('Progress') || detail.includes('Delay');
      const isFinal = state === 'Final';
      const ls      = game.linescore || {};
      const homeRuns = ls.teams?.home?.runs ?? game.teams.home.score ?? 0;
      const awayRuns = ls.teams?.away?.runs ?? game.teams.away.score ?? 0;
      const yankRuns = isHome ? homeRuns : awayRuns;
      const oppRuns  = isHome ? awayRuns : homeRuns;
      const centerCol = (isLive || isFinal)
        ? `<div class="score-display"><div class="score-digit">${isHome ? oppRuns : yankRuns}</div><div class="score-dash">–</div><div class="score-digit">${isHome ? yankRuns : oppRuns}</div></div>`
        : `<div class="vs-text">VS</div>`;
      const statusPill = isLive
        ? `<div class="status-pill live"><div class="live-dot"></div>${ls.inningHalf === 'Bottom' ? '▼' : '▲'} ${ls.currentInningOrdinal || ''} &nbsp;·&nbsp; ${ls.outs ?? 0} out${ls.outs === 1 ? '' : 's'}</div>`
        : isFinal ? `<div class="status-pill final">Final</div>`
        : `<div class="status-pill scheduled">${fmtTime(game.gameDate)}</div>`;
      const challengeDots = n => { const remaining = n ?? 1; return Array.from({length:1},(_,i)=>`<div class="challenge-dot${i>=remaining?' used':''}"></div>`).join(''); };
      const homeRem = ls.teams?.home?.remainingChallenges;
      const awayRem = ls.teams?.away?.remainingChallenges;
      const challengeRow = isLive && (homeRem != null || awayRem != null) ? `
        <div class="challenges-row">
          <div class="challenge-team"><div class="challenge-label">${isHome ? 'NYY' : oppAbbr} Challenges</div><div class="challenge-dots">${challengeDots(isHome ? homeRem : awayRem)}</div></div>
          <div class="challenge-divider">Challenges</div>
          <div class="challenge-team"><div class="challenge-label">${isHome ? oppAbbr : 'NYY'} Challenges</div><div class="challenge-dots">${challengeDots(isHome ? awayRem : homeRem)}</div></div>
        </div>` : '';
      const allBroadcasts = game.broadcasts || [];
      const RADIO_TYPES = new Set(['AM','FM','XM','Radio']);
      const tvBroadcasts    = allBroadcasts.filter(b => b.name && !RADIO_TYPES.has(b.type));
      const radioBroadcasts = allBroadcasts.filter(b => b.name && RADIO_TYPES.has(b.type));
      const renderLinks = (list, urlMap) => list.length
        ? list.map(b => { const url = Object.entries(urlMap).find(([k])=>b.name.includes(k))?.[1]; return url ? `<a href="${url}" class="broadcast-link">${b.name}</a>` : `<span>${b.name}</span>`; }).join('<span style="color:var(--muted)"> · </span>')
        : null;
      const tvLinks = renderLinks(tvBroadcasts, BROADCAST_URLS) || 'TBD';
      const siriusLink = `<a href="https://siriusxm.com/player/channel-linear/entity/21fd583e-8f6a-b869-4f75-9e8a3f604eb0" class="broadcast-link">SiriusXM Yankees</a>`;
      const apiRadioLinks = renderLinks(radioBroadcasts, RADIO_URLS);
      const radioLinks = apiRadioLinks ? `${siriusLink}<span style="color:var(--muted)"> · </span>${apiRadioLinks}` : siriusLink;
      const venue    = game.venue?.name || '—';
      const homeAway = isHome ? 'Home' : 'Away';
      const pitcher = (p, label) => p
        ? `<div class="pitcher-cell"><div class="pitcher-team-label">${label}</div><div class="pitcher-name">${p.fullName}</div>${p.note?`<div class="pitcher-note">${p.note}</div>`:''}</div>`
        : `<div class="pitcher-cell"><div class="pitcher-team-label">${label}</div><div class="pitcher-name" style="color:var(--muted)">TBD</div></div>`;
      const yankeeTeamDiv = `<div class="team"><div class="team-abbr nyy">NYY</div><div class="team-full">New York Yankees</div><div class="team-record">${yankRec}</div></div>`;
      const oppTeamDiv = `<div class="team"><div class="team-abbr opp">${oppAbbr}</div><div class="team-full">${oppName}</div><div class="team-record">${oppRec}</div></div>`;
      const leftTeam  = isHome ? oppTeamDiv  : yankeeTeamDiv;
      const rightTeam = isHome ? yankeeTeamDiv : oppTeamDiv;
      const liveDetail = isLive ? buildLiveDetail(ls, game.scoringPlays || [], {
        away: isHome ? oppAbbr : 'NYY',
        home: isHome ? 'NYY' : oppAbbr,
      }, game.boxscore || null) : '';
      return `
        <div class="card">
          <div class="card-header"><div class="card-header-dot"></div><div class="card-label">Today's Game</div></div>
          <div class="card-body">
            <div class="matchup">${leftTeam}<div class="vs-col">${centerCol}${statusPill}</div>${rightTeam}</div>
            ${challengeRow}
            ${liveDetail}
            <div class="meta-grid">
              <div class="meta-cell"><div class="meta-key">First Pitch</div><div class="meta-val">${fmtTime(game.gameDate)}</div></div>
              <div class="meta-cell"><div class="meta-key">Venue</div><div class="meta-val">${homeAway} · ${venue}</div></div>
              <div class="meta-cell full"><div class="meta-key">Watch</div><div class="meta-val" style="display:flex;flex-wrap:wrap;gap:0.3rem 0.6rem;">${tvLinks}</div></div>
              <div class="meta-cell full"><div class="meta-key">Listen</div><div class="meta-val" style="display:flex;flex-wrap:wrap;gap:0.3rem 0.6rem;">${radioLinks}</div></div>
            </div>
          </div>
        </div>
        <div class="card">
          <div class="card-header"><div class="card-header-dot"></div><div class="card-label">Starting Pitchers</div></div>
          <div class="card-body"><div class="pitchers-grid">${pitcher(yankTeam.probablePitcher,'Yankees')}${pitcher(oppTeam.probablePitcher,oppName)}</div></div>
        </div>`;
    }

    function buildLast10Card(games) {
      if (!games.length) return `<div class="card"><div class="state-box"><div class="state-text">No recent game data.</div></div></div>`;
      let wins = 0, losses = 0;
      const rows = games.map(g => {
        const isHome = g.teams.home.team.id === YANKEES_ID;
        const yankT  = isHome ? g.teams.home : g.teams.away;
        const oppT   = isHome ? g.teams.away : g.teams.home;
        const won    = yankT.isWinner;
        const R      = won ? 'W' : 'L';
        won ? wins++ : losses++;
        return `<div class="game-row"><div class="result-pill ${R}">${R}</div><div class="game-opp">${isHome?'vs':'@'} ${oppT.team.name}</div><div class="game-score-val">${yankT.score??0}–${oppT.score??0}</div><div class="game-date-val">${fmt(g.officialDate||g.gameDate?.slice(0,10))}</div></div>`;
      });
      const pips = games.map(g => { const isHome=g.teams.home.team.id===YANKEES_ID; const won=(isHome?g.teams.home:g.teams.away).isWinner; return `<div class="streak-pip ${won?'W':'L'}"></div>`; }).join('');
      return `<div class="card"><div class="card-header"><div class="card-header-dot"></div><div class="card-label">Last 10 Games</div></div><div class="card-body"><div class="streak-bar">${pips}<span class="streak-record">${wins}–${losses}</span></div><div class="game-list">${rows.join('')}</div></div></div>`;
    }

    async function getUpcoming() {
      const start = new Date(); start.setDate(start.getDate()+1);
      const end   = new Date(); end.setDate(end.getDate()+14);
      const data  = await fetchJSON(`https://statsapi.mlb.com/api/v1/schedule?sportId=1&teamId=${YANKEES_ID}&startDate=${start.toLocaleDateString('en-CA',{timeZone:'America/New_York'})}&endDate=${end.toLocaleDateString('en-CA',{timeZone:'America/New_York'})}`);
      const games = [];
      for (const d of (data.dates||[])) for (const g of d.games) { if (g.status.abstractGameState!=='Final') { games.push(g); if(games.length===5) return games; } }
      return games;
    }

    async function getStandings() {
      const year = new Date().getFullYear();
      const data = await fetchJSON(`https://statsapi.mlb.com/api/v1/standings?leagueId=103&season=${year}&standingsTypes=regularSeason&hydrate=team`);
      const alEast = (data.records||[]).find(r=>r.division?.id===201);
      return alEast?.teamRecords||[];
    }

    function buildUpcomingCard(games) {
      if (!games.length) return '';
      const rows = games.map(g => {
        const isHome  = g.teams.home.team.id === YANKEES_ID;
        const oppTeam = isHome ? g.teams.away : g.teams.home;
        const date    = new Date(g.gameDate);
        const dateStr = date.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});
        const timeStr = date.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',timeZone:'America/New_York'});
        return `<div class="upcoming-row"><div class="upcoming-date">${dateStr}</div><div class="upcoming-ha">${isHome?'vs':'@'}</div><div class="upcoming-opp">${oppTeam.team.name}</div><div class="upcoming-time">${timeStr}</div></div>`;
      });
      return `<div class="card"><div class="card-header"><div class="card-header-dot"></div><div class="card-label">Upcoming Games</div></div><div class="card-body" style="padding:0.75rem 0.5rem"><div class="upcoming-list">${rows.join('')}</div></div></div>`;
    }

    function buildStandingsCard(teams) {
      if (!teams.length) return '';
      const sorted = [...teams].sort((a,b)=>a.divisionRank-b.divisionRank);
      const rows = sorted.map(t => {
        const isY = t.team.id===YANKEES_ID;
        const gb  = t.gamesBack==='-'?'<span class="gb-dash">—</span>':t.gamesBack;
        const pct = parseFloat(t.winningPercentage).toFixed(3).replace(/^0/,'');
        return `<tr class="${isY?'yankees-row':''}"><td>${isY?'★ ':''}${abbr(t.team.name)}</td><td>${t.wins}</td><td>${t.losses}</td><td>${pct}</td><td>${gb}</td></tr>`;
      });
      return `<div class="card"><div class="card-header"><div class="card-header-dot"></div><div class="card-label">AL East Standings</div></div><div class="card-body"><table class="standings-table"><thead><tr><th>Team</th><th>W</th><th>L</th><th>PCT</th><th>GB</th></tr></thead><tbody>${rows.join('')}</tbody></table></div></div>`;
    }

    function injectStatBar(todayGame) {
      const yankTeam = todayGame ? (todayGame.teams.home.team.id===YANKEES_ID?todayGame.teams.home:todayGame.teams.away) : null;
      const rec = yankTeam?.leagueRecord||yankTeam?.team?.record?.leagueRecord;
      if (!rec) return;
      const w=rec.wins, l=rec.losses;
      const pct=(w/(w+l||1)).toFixed(3).replace(/^0/,'');
      document.getElementById('stat-bar').innerHTML=`<div class="stat-chip"><strong>${w}–${l}</strong> Record</div><div class="stat-chip"><strong>${pct}</strong> Win %</div>`;
    }

    let refreshTimer = null;

    async function main() {
      const app = document.getElementById('app');
      const dateLabel = document.getElementById('today-label');
      if (dateLabel) dateLabel.textContent = new Date().toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric', year:'numeric' });
      try {
        const [todayGame,last10,upcoming,standings] = await Promise.all([getTodayGame(),getLast10(),getUpcoming(),getStandings()]);
        injectStatBar(todayGame);
        app.innerHTML = buildGameCard(todayGame)+buildUpcomingCard(upcoming)+buildLast10Card(last10)+buildStandingsCard(standings);
        const gState=todayGame?.status.abstractGameState;
        const gDetail=todayGame?.status.detailedState||'';
        const gameIsLive=gState==='Live'||gDetail.includes('Progress')||gDetail.includes('Delay');
        const gameIsSoon=gState==='Preview'&&todayGame?.gameDate&&(new Date(todayGame.gameDate)-Date.now())<4*60*60*1000;
        if (gameIsLive||gameIsSoon) { clearTimeout(refreshTimer); refreshTimer=setTimeout(main,gameIsLive?30000:60000); }
      } catch(err) {
        app.innerHTML=`<div class="error-box">Failed to load game data: ${err.message}<br>Check your connection and reload.</div>`;
      }
    }

    if (typeof module === 'undefined') {
      const refreshBtn = document.querySelector('.refresh-btn');
      refreshBtn.addEventListener('click', async () => {
        refreshBtn.textContent = '↻ Refreshing…';
        refreshBtn.disabled = true;
        await main();
        refreshBtn.textContent = '↻ Refresh';
        refreshBtn.disabled = false;
      });
      main();
    }

    if (typeof module !== 'undefined') {
      module.exports = { fmt, fmtTime, abbr, buildGameCard, buildLast10Card, buildUpcomingCard, buildStandingsCard, injectStatBar, buildLiveDetail, BROADCAST_URLS, RADIO_URLS, YANKEES_ID };
    }