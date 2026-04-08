const {
  fmt,
  fmtTime,
  abbr,
  buildGameCard,
  buildLast10Card,
  buildUpcomingCard,
  buildStandingsCard,
  injectStatBar,
  buildLiveDetail,
  BROADCAST_URLS,
  RADIO_URLS,
  YANKEES_ID,
} = require('./app');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGame(overrides = {}) {
  return {
    gamePk: 12345,
    gameDate: '2024-04-08T23:05:00Z',
    venue: { name: 'Yankee Stadium' },
    status: { abstractGameState: 'Preview', detailedState: 'Scheduled' },
    teams: {
      home: {
        team: { id: YANKEES_ID, name: 'New York Yankees' },
        score: 0,
        isWinner: false,
        leagueRecord: { wins: 5, losses: 3 },
      },
      away: {
        team: { id: 111, name: 'Boston Red Sox' },
        score: 0,
        isWinner: false,
        leagueRecord: { wins: 4, losses: 4 },
      },
    },
    broadcasts: [],
    linescore: {},
    ...overrides,
  };
}

function makeFinishedGame(yankWin, date = '2024-04-01') {
  return {
    officialDate: date,
    status: { abstractGameState: 'Final' },
    teams: {
      home: {
        team: { id: YANKEES_ID, name: 'New York Yankees' },
        score: yankWin ? 5 : 2,
        isWinner: yankWin,
      },
      away: {
        team: { id: 111, name: 'Boston Red Sox' },
        score: yankWin ? 2 : 5,
        isWinner: !yankWin,
      },
    },
  };
}

function makeTeamRecord(id, name, wins, losses, rank, gamesBack, winPct) {
  return { team: { id, name }, wins, losses, divisionRank: rank, gamesBack, winningPercentage: winPct };
}

// ---------------------------------------------------------------------------
// fmt
// ---------------------------------------------------------------------------

describe('fmt', () => {
  test('formats a standard date', () => {
    expect(fmt('2024-04-08')).toBe('Apr 8');
  });

  test('formats first of month without leading zero', () => {
    expect(fmt('2024-12-01')).toBe('Dec 1');
  });

  test('treats date as local — avoids UTC off-by-one at night', () => {
    // If parsed as UTC, '2024-03-31' at midnight UTC could shift to Mar 30 in ET.
    // fmt() builds the Date from parts so it always returns the written calendar date.
    expect(fmt('2024-03-31')).toBe('Mar 31');
  });

  test('handles January', () => {
    expect(fmt('2024-01-15')).toBe('Jan 15');
  });
});

// ---------------------------------------------------------------------------
// fmtTime
// ---------------------------------------------------------------------------

describe('fmtTime', () => {
  test('returns a non-empty string', () => {
    const result = fmtTime('2024-04-08T23:05:00Z');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  test('uses America/New_York timezone (includes ET, EDT, or EST label)', () => {
    const result = fmtTime('2024-04-08T23:05:00Z');
    expect(result).toMatch(/E[DS]T/);
  });

  test('formats 2024-04-08T23:05:00Z as 7:05 PM EDT', () => {
    // 23:05 UTC = 19:05 EDT (UTC-4, summer)
    const result = fmtTime('2024-04-08T23:05:00Z');
    expect(result).toMatch(/7:05/);
    expect(result).toMatch(/PM/);
  });

  test('handles winter EST offset correctly', () => {
    // 2024-01-15T00:05:00Z = 7:05 PM EST (UTC-5, winter)
    const result = fmtTime('2024-01-15T00:05:00Z');
    expect(result).toMatch(/7:05/);
    expect(result).toMatch(/EST/);
  });
});

// ---------------------------------------------------------------------------
// abbr — all 30 MLB teams + fallback
// ---------------------------------------------------------------------------

describe('abbr', () => {
  const TEAMS = [
    ['New York Yankees',      'NYY'],
    ['Boston Red Sox',        'BOS'],
    ['Tampa Bay Rays',        'TB'],
    ['Baltimore Orioles',     'BAL'],
    ['Toronto Blue Jays',     'TOR'],
    ['Houston Astros',        'HOU'],
    ['Texas Rangers',         'TEX'],
    ['Seattle Mariners',      'SEA'],
    ['Los Angeles Angels',    'LAA'],
    ['Oakland Athletics',     'OAK'],
    ['Chicago White Sox',     'CWS'],
    ['Cleveland Guardians',   'CLE'],
    ['Detroit Tigers',        'DET'],
    ['Kansas City Royals',    'KC'],
    ['Minnesota Twins',       'MIN'],
    ['New York Mets',         'NYM'],
    ['Philadelphia Phillies', 'PHI'],
    ['Atlanta Braves',        'ATL'],
    ['Miami Marlins',         'MIA'],
    ['Washington Nationals',  'WSH'],
    ['Los Angeles Dodgers',   'LAD'],
    ['San Francisco Giants',  'SF'],
    ['San Diego Padres',      'SD'],
    ['Colorado Rockies',      'COL'],
    ['Arizona Diamondbacks',  'ARI'],
    ['Chicago Cubs',          'CHC'],
    ['Milwaukee Brewers',     'MIL'],
    ['St. Louis Cardinals',   'STL'],
    ['Cincinnati Reds',       'CIN'],
    ['Pittsburgh Pirates',    'PIT'],
  ];

  test.each(TEAMS)('abbr("%s") === "%s"', (name, expected) => {
    expect(abbr(name)).toBe(expected);
  });

  test('falls back to last word sliced to 3 chars uppercased for unknown teams', () => {
    expect(abbr('Someplace Unknowns')).toBe('UNK');
  });

  test('fallback works for single-word name', () => {
    expect(abbr('Renegades')).toBe('REN');
  });
});

// ---------------------------------------------------------------------------
// buildGameCard
// ---------------------------------------------------------------------------

describe('buildGameCard', () => {
  test('returns no-game card when game is null', () => {
    const html = buildGameCard(null);
    expect(html).toContain('No Yankees game scheduled today');
  });

  test('shows VS text for a scheduled (Preview) game', () => {
    const html = buildGameCard(makeGame());
    expect(html).toContain('VS');
  });

  test('away team on left, Yankees (home) on right for home game', () => {
    const html = buildGameCard(makeGame());
    // BOS is away (left), NYY is home (right)
    expect(html.indexOf('BOS')).toBeLessThan(html.indexOf('NYY'));
  });

  test('Yankees on left for away game', () => {
    const game = makeGame({
      teams: {
        home: { team: { id: 111, name: 'Boston Red Sox' }, score: 0, isWinner: false, leagueRecord: { wins: 4, losses: 4 } },
        away: { team: { id: YANKEES_ID, name: 'New York Yankees' }, score: 0, isWinner: false, leagueRecord: { wins: 5, losses: 3 } },
      },
    });
    const html = buildGameCard(game);
    expect(html.indexOf('NYY')).toBeLessThan(html.indexOf('BOS'));
  });

  test('shows Final pill for finished game', () => {
    const game = makeGame({ status: { abstractGameState: 'Final', detailedState: 'Final' } });
    const html = buildGameCard(game);
    expect(html).toContain('Final');
    expect(html).not.toContain('>VS<');
  });

  test('shows live status pill when abstractGameState is Live', () => {
    const game = makeGame({
      status: { abstractGameState: 'Live', detailedState: 'In Progress' },
      linescore: { teams: { home: { runs: 3 }, away: { runs: 1 } }, currentInningOrdinal: '5th', inningHalf: 'Top', outs: 2 },
    });
    const html = buildGameCard(game);
    expect(html).toContain('live');
    expect(html).toContain('5th');
  });

  test('detects live state when detailedState contains "Progress"', () => {
    const game = makeGame({
      status: { abstractGameState: 'Live', detailedState: 'In Progress' },
      linescore: { teams: { home: { runs: 2 }, away: { runs: 0 } }, currentInningOrdinal: '3rd', inningHalf: 'Bottom', outs: 1 },
    });
    expect(buildGameCard(game)).toContain('status-pill live');
  });

  test('detects live state when detailedState contains "Delay"', () => {
    const game = makeGame({
      status: { abstractGameState: 'Live', detailedState: 'Rain Delay' },
      linescore: { teams: { home: { runs: 1 }, away: { runs: 1 } }, currentInningOrdinal: '7th', inningHalf: 'Top', outs: 0 },
    });
    expect(buildGameCard(game)).toContain('status-pill live');
  });

  describe('score fallback chain', () => {
    test('uses linescore runs when available', () => {
      const game = makeGame({
        status: { abstractGameState: 'Final', detailedState: 'Final' },
        linescore: { teams: { home: { runs: 7 }, away: { runs: 3 } } },
        teams: {
          home: { team: { id: YANKEES_ID, name: 'New York Yankees' }, score: 99, isWinner: true, leagueRecord: { wins: 6, losses: 3 } },
          away: { team: { id: 111, name: 'Boston Red Sox' }, score: 99, isWinner: false, leagueRecord: { wins: 4, losses: 5 } },
        },
      });
      const html = buildGameCard(game);
      // Scores from linescore (7 and 3) should appear; 99 should not appear as a score
      expect(html).toContain('>7<');
      expect(html).toContain('>3<');
    });

    test('falls back to team.score when linescore has no runs', () => {
      const game = makeGame({
        status: { abstractGameState: 'Final', detailedState: 'Final' },
        linescore: {},
        teams: {
          home: { team: { id: YANKEES_ID, name: 'New York Yankees' }, score: 5, isWinner: true, leagueRecord: { wins: 6, losses: 3 } },
          away: { team: { id: 111, name: 'Boston Red Sox' }, score: 2, isWinner: false, leagueRecord: { wins: 4, losses: 5 } },
        },
      });
      const html = buildGameCard(game);
      expect(html).toContain('>5<');
      expect(html).toContain('>2<');
    });

    test('falls back to 0 when neither linescore nor team.score is set', () => {
      const game = makeGame({
        status: { abstractGameState: 'Final', detailedState: 'Final' },
        linescore: {},
        teams: {
          home: { team: { id: YANKEES_ID, name: 'New York Yankees' }, isWinner: true, leagueRecord: { wins: 6, losses: 3 } },
          away: { team: { id: 111, name: 'Boston Red Sox' }, isWinner: false, leagueRecord: { wins: 4, losses: 5 } },
        },
      });
      const html = buildGameCard(game);
      expect(html).toContain('>0<');
    });
  });

  describe('record extraction', () => {
    test('uses leagueRecord directly on team entry', () => {
      const game = makeGame({
        teams: {
          home: { team: { id: YANKEES_ID, name: 'New York Yankees' }, leagueRecord: { wins: 8, losses: 2 }, score: 0 },
          away: { team: { id: 111, name: 'Boston Red Sox' }, leagueRecord: { wins: 4, losses: 6 }, score: 0 },
        },
      });
      const html = buildGameCard(game);
      expect(html).toContain('8\u20132');
      expect(html).toContain('4\u20136');
    });

    test('falls back to team.record.leagueRecord', () => {
      const game = makeGame({
        teams: {
          home: {
            team: { id: YANKEES_ID, name: 'New York Yankees', record: { leagueRecord: { wins: 10, losses: 5 } } },
            score: 0,
          },
          away: {
            team: { id: 111, name: 'Boston Red Sox', record: { leagueRecord: { wins: 3, losses: 7 } } },
            score: 0,
          },
        },
      });
      const html = buildGameCard(game);
      expect(html).toContain('10\u20135');
      expect(html).toContain('3\u20137');
    });
  });

  test('shows TBD for missing pitchers', () => {
    const html = buildGameCard(makeGame());
    expect(html).toContain('TBD');
  });

  test('shows pitcher name when provided', () => {
    const game = makeGame();
    game.teams.home.probablePitcher = { fullName: 'Gerrit Cole', note: 'P, 1-0, 2.45 ERA' };
    game.teams.away.probablePitcher = { fullName: 'Nathan Eovaldi' };
    const html = buildGameCard(game);
    expect(html).toContain('Gerrit Cole');
    expect(html).toContain('Nathan Eovaldi');
  });

  test('filters TV and radio broadcasts into separate sections', () => {
    const game = makeGame({
      broadcasts: [
        { name: 'YES', type: 'TV' },
        { name: 'WFAN 660', type: 'AM' },
        { name: 'ESPN', type: 'TV' },
      ],
    });
    const html = buildGameCard(game);
    expect(html).toContain('YES');
    expect(html).toContain('WFAN 660');
    expect(html).toContain('ESPN');
  });

  test('always shows SiriusXM radio link regardless of broadcast data', () => {
    const html = buildGameCard(makeGame({ broadcasts: [] }));
    expect(html).toContain('SiriusXM');
  });

  test('shows venue name', () => {
    const html = buildGameCard(makeGame({ venue: { name: 'Fenway Park' } }));
    expect(html).toContain('Fenway Park');
  });
});

// ---------------------------------------------------------------------------
// buildLast10Card
// ---------------------------------------------------------------------------

describe('buildLast10Card', () => {
  test('returns no-data card for empty array', () => {
    const html = buildLast10Card([]);
    expect(html).toContain('No recent game data');
  });

  test('correctly counts wins and losses', () => {
    const games = [
      makeFinishedGame(true),
      makeFinishedGame(true),
      makeFinishedGame(false),
      makeFinishedGame(true),
    ];
    const html = buildLast10Card(games);
    expect(html).toContain('3\u20131');
  });

  test('renders one pip per game', () => {
    const games = Array.from({ length: 5 }, (_, i) => makeFinishedGame(i % 2 === 0));
    const html = buildLast10Card(games);
    const pipCount = (html.match(/streak-pip/g) || []).length;
    expect(pipCount).toBe(5);
  });

  test('marks win pips as W and loss pips as L', () => {
    const games = [makeFinishedGame(true), makeFinishedGame(false)];
    const html = buildLast10Card(games);
    expect(html).toContain('streak-pip W');
    expect(html).toContain('streak-pip L');
  });

  test('shows correct score in each game row', () => {
    const games = [makeFinishedGame(true, '2024-04-05')];
    const html = buildLast10Card(games);
    // Yankees won 5-2
    expect(html).toContain('5\u20132');
  });

  test('handles all wins (10-0)', () => {
    const games = Array.from({ length: 10 }, () => makeFinishedGame(true));
    const html = buildLast10Card(games);
    expect(html).toContain('10\u20130');
  });

  test('handles all losses (0-10)', () => {
    const games = Array.from({ length: 10 }, () => makeFinishedGame(false));
    const html = buildLast10Card(games);
    expect(html).toContain('0\u201310');
  });
});

// ---------------------------------------------------------------------------
// buildStandingsCard
// ---------------------------------------------------------------------------

describe('buildStandingsCard', () => {
  test('returns empty string for empty array', () => {
    expect(buildStandingsCard([])).toBe('');
  });

  test('sorts teams by divisionRank ascending', () => {
    const teams = [
      makeTeamRecord(111,       'Boston Red Sox',     4, 6, 3, '3.0', '.400'),
      makeTeamRecord(YANKEES_ID,'New York Yankees',   8, 2, 1, '-',   '.800'),
      makeTeamRecord(141,       'Toronto Blue Jays',  6, 4, 2, '2.0', '.600'),
    ];
    const html = buildStandingsCard(teams);
    const posNYY = html.indexOf('NYY');
    const posTOR = html.indexOf('TOR');
    const posBOS = html.indexOf('BOS');
    expect(posNYY).toBeLessThan(posTOR);
    expect(posTOR).toBeLessThan(posBOS);
  });

  test('adds yankees-row class and star to Yankees row', () => {
    const teams = [
      makeTeamRecord(YANKEES_ID, 'New York Yankees', 8, 2, 1, '-',   '.800'),
      makeTeamRecord(111,        'Boston Red Sox',   4, 6, 2, '4.0', '.400'),
    ];
    const html = buildStandingsCard(teams);
    expect(html).toContain('yankees-row');
    expect(html).toContain('\u2605');
  });

  test('replaces "-" games back with em dash', () => {
    const teams = [makeTeamRecord(YANKEES_ID, 'New York Yankees', 8, 2, 1, '-', '.800')];
    const html = buildStandingsCard(teams);
    expect(html).toContain('\u2014');
    expect(html).not.toContain('">-<');
  });

  test('formats winning percentage without leading zero', () => {
    const teams = [makeTeamRecord(YANKEES_ID, 'New York Yankees', 8, 2, 1, '-', '.800')];
    const html = buildStandingsCard(teams);
    expect(html).toContain('.800');
    expect(html).not.toContain('0.800');
  });

  test('shows W, L, and GB columns', () => {
    const teams = [makeTeamRecord(111, 'Boston Red Sox', 4, 6, 1, '3.0', '.400')];
    const html = buildStandingsCard(teams);
    expect(html).toContain('>4<');
    expect(html).toContain('>6<');
    expect(html).toContain('3.0');
  });
});

// ---------------------------------------------------------------------------
// buildUpcomingCard
// ---------------------------------------------------------------------------

function makeUpcomingGame(isHome = true) {
  return {
    gameDate: '2024-04-10T23:05:00Z',
    status: { abstractGameState: 'Preview' },
    teams: {
      home: { team: { id: isHome ? YANKEES_ID : 111, name: isHome ? 'New York Yankees' : 'Boston Red Sox' } },
      away: { team: { id: isHome ? 111 : YANKEES_ID, name: isHome ? 'Boston Red Sox' : 'New York Yankees' } },
    },
  };
}

describe('buildUpcomingCard', () => {
  test('returns empty string for empty array', () => {
    expect(buildUpcomingCard([])).toBe('');
  });

  test('shows "vs" for home games', () => {
    const html = buildUpcomingCard([makeUpcomingGame(true)]);
    expect(html).toContain('vs');
  });

  test('shows "@" for away games', () => {
    const html = buildUpcomingCard([makeUpcomingGame(false)]);
    expect(html).toContain('@');
  });

  test('renders one row per game', () => {
    const games = [makeUpcomingGame(true), makeUpcomingGame(false), makeUpcomingGame(true)];
    const html = buildUpcomingCard(games);
    const rowCount = (html.match(/upcoming-row/g) || []).length;
    expect(rowCount).toBe(3);
  });

  test('includes opponent name', () => {
    const html = buildUpcomingCard([makeUpcomingGame(true)]);
    expect(html).toContain('Boston Red Sox');
  });
});

// ---------------------------------------------------------------------------
// injectStatBar
// ---------------------------------------------------------------------------

describe('injectStatBar', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="stat-bar"></div>';
  });

  test('does nothing when game is null', () => {
    injectStatBar(null);
    expect(document.getElementById('stat-bar').innerHTML).toBe('');
  });

  test('injects record from leagueRecord on team entry', () => {
    const game = makeGame({
      teams: {
        home: { team: { id: YANKEES_ID, name: 'New York Yankees' }, leagueRecord: { wins: 7, losses: 3 }, score: 0 },
        away: { team: { id: 111, name: 'Boston Red Sox' }, leagueRecord: { wins: 5, losses: 5 }, score: 0 },
      },
    });
    injectStatBar(game);
    expect(document.getElementById('stat-bar').innerHTML).toContain('7\u20133');
  });

  test('injects record from team.record.leagueRecord as fallback', () => {
    const game = {
      teams: {
        home: {
          team: { id: YANKEES_ID, name: 'New York Yankees', record: { leagueRecord: { wins: 12, losses: 5 } } },
          score: 0,
        },
        away: { team: { id: 111, name: 'Boston Red Sox' }, score: 0 },
      },
      status: { abstractGameState: 'Preview', detailedState: 'Scheduled' },
      gameDate: '2024-04-08T23:05:00Z',
      venue: { name: 'Yankee Stadium' },
      broadcasts: [],
      linescore: {},
    };
    injectStatBar(game);
    expect(document.getElementById('stat-bar').innerHTML).toContain('12\u20135');
  });

  test('does not throw on 0-0 record (no division by zero)', () => {
    const game = makeGame({
      teams: {
        home: { team: { id: YANKEES_ID, name: 'New York Yankees' }, leagueRecord: { wins: 0, losses: 0 }, score: 0 },
        away: { team: { id: 111, name: 'Boston Red Sox' }, leagueRecord: { wins: 0, losses: 0 }, score: 0 },
      },
    });
    expect(() => injectStatBar(game)).not.toThrow();
  });

  test('calculates win percentage correctly', () => {
    const game = makeGame({
      teams: {
        home: { team: { id: YANKEES_ID, name: 'New York Yankees' }, leagueRecord: { wins: 6, losses: 4 }, score: 0 },
        away: { team: { id: 111, name: 'Boston Red Sox' }, leagueRecord: { wins: 4, losses: 6 }, score: 0 },
      },
    });
    injectStatBar(game);
    expect(document.getElementById('stat-bar').innerHTML).toContain('.600');
  });

  test('win percentage omits leading zero', () => {
    const game = makeGame({
      teams: {
        home: { team: { id: YANKEES_ID, name: 'New York Yankees' }, leagueRecord: { wins: 1, losses: 1 }, score: 0 },
        away: { team: { id: 111, name: 'Boston Red Sox' }, leagueRecord: { wins: 1, losses: 1 }, score: 0 },
      },
    });
    injectStatBar(game);
    const inner = document.getElementById('stat-bar').innerHTML;
    expect(inner).toContain('.500');
    expect(inner).not.toContain('0.500');
  });
});

// ---------------------------------------------------------------------------
// BROADCAST_URLS / RADIO_URLS — URL map integrity
// ---------------------------------------------------------------------------

describe('BROADCAST_URLS', () => {
  test('contains YES and YES Network entries', () => {
    expect(BROADCAST_URLS['YES']).toBeDefined();
    expect(BROADCAST_URLS['YES Network']).toBeDefined();
  });

  test('all values are valid https URLs', () => {
    for (const [key, url] of Object.entries(BROADCAST_URLS)) {
      expect(url).toMatch(/^https?:\/\//, `${key} URL is invalid: ${url}`);
    }
  });

  test('contains expected streaming services', () => {
    expect(BROADCAST_URLS['ESPN']).toBeDefined();
    expect(BROADCAST_URLS['MLB.TV']).toBeDefined();
    expect(BROADCAST_URLS['Apple TV+']).toBeDefined();
  });
});

describe('RADIO_URLS', () => {
  test('contains WFAN entries', () => {
    expect(RADIO_URLS['WFAN']).toBeDefined();
    expect(RADIO_URLS['WFAN 660']).toBeDefined();
    expect(RADIO_URLS['WFAN 101.9']).toBeDefined();
  });

  test('all values are valid https URLs', () => {
    for (const [key, url] of Object.entries(RADIO_URLS)) {
      expect(url).toMatch(/^https?:\/\//, `${key} URL is invalid: ${url}`);
    }
  });

  test('contains SiriusXM entry', () => {
    expect(RADIO_URLS['SiriusXM']).toBeDefined();
    expect(RADIO_URLS['MLB Network Radio']).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// buildLiveDetail
// ---------------------------------------------------------------------------

function makeLinescore(overrides = {}) {
  return {
    balls: 2,
    strikes: 1,
    outs: 1,
    offense: {
      batter:  { fullName: 'Aaron Judge' },
      onDeck:  { fullName: 'Juan Soto' },
      first:   { id: 1 },
      second:  undefined,
      third:   undefined,
    },
    defense: {
      pitcher: { fullName: 'Gerrit Cole' },
    },
    teams: {
      home: { hits: 5, errors: 0 },
      away: { hits: 3, errors: 1 },
    },
    ...overrides,
  };
}

describe('buildLiveDetail', () => {
  test('returns empty string when ls is null', () => {
    expect(buildLiveDetail(null)).toBe('');
  });

  test('returns empty string when ls is empty object', () => {
    expect(buildLiveDetail({})).toBe('');
  });

  test('returns empty string when offense is missing', () => {
    expect(buildLiveDetail({ defense: { pitcher: { fullName: 'X' } } })).toBe('');
  });

  test('returns empty string when defense.pitcher is missing', () => {
    expect(buildLiveDetail({ offense: { batter: { fullName: 'X' } } })).toBe('');
  });

  test('returns non-empty HTML string for valid linescore', () => {
    const html = buildLiveDetail(makeLinescore());
    expect(typeof html).toBe('string');
    expect(html.length).toBeGreaterThan(0);
  });

  test('uses <details> and <summary> elements', () => {
    const html = buildLiveDetail(makeLinescore());
    expect(html).toContain('<details');
    expect(html).toContain('<summary');
  });

  test('shows batter name', () => {
    const html = buildLiveDetail(makeLinescore());
    expect(html).toContain('Aaron Judge');
  });

  test('shows on-deck name', () => {
    const html = buildLiveDetail(makeLinescore());
    expect(html).toContain('Juan Soto');
  });

  test('shows pitcher name', () => {
    const html = buildLiveDetail(makeLinescore());
    expect(html).toContain('Gerrit Cole');
  });

  test('shows correct number of ball pips (max 4)', () => {
    const html = buildLiveDetail(makeLinescore({ balls: 3 }));
    const ballPips = (html.match(/count-pip ball/g) || []).length;
    expect(ballPips).toBe(4);
  });

  test('marks correct number of filled ball pips', () => {
    const html = buildLiveDetail(makeLinescore({ balls: 3 }));
    const filledBalls = (html.match(/count-pip ball on/g) || []).length;
    expect(filledBalls).toBe(3);
  });

  test('shows correct number of strike pips (max 3)', () => {
    const html = buildLiveDetail(makeLinescore({ strikes: 2 }));
    const strikePips = (html.match(/count-pip strike/g) || []).length;
    expect(strikePips).toBe(3);
  });

  test('marks correct number of filled strike pips', () => {
    const html = buildLiveDetail(makeLinescore({ strikes: 2 }));
    const filledStrikes = (html.match(/count-pip strike on/g) || []).length;
    expect(filledStrikes).toBe(2);
  });

  test('first base square has "on" class when runner on first', () => {
    const html = buildLiveDetail(makeLinescore({ offense: {
      batter:  { fullName: 'A' },
      onDeck:  { fullName: 'B' },
      first:   { id: 99 },
      second:  undefined,
      third:   undefined,
    }}));
    expect(html).toContain('base first on');
  });

  test('first base square does NOT have "on" class when base is empty', () => {
    const ls = makeLinescore();
    ls.offense.first = undefined;
    const html = buildLiveDetail(ls);
    expect(html).not.toContain('base first on');
    expect(html).toContain('base first');
  });

  test('second base square has "on" class when runner on second', () => {
    const ls = makeLinescore();
    ls.offense.second = { id: 7 };
    const html = buildLiveDetail(ls);
    expect(html).toContain('base second on');
  });

  test('third base square has "on" class when runner on third', () => {
    const ls = makeLinescore();
    ls.offense.third = { id: 5 };
    const html = buildLiveDetail(ls);
    expect(html).toContain('base third on');
  });

  test('bases loaded: all three base squares have "on" class', () => {
    const ls = makeLinescore({
      offense: {
        batter:  { fullName: 'A' },
        onDeck:  { fullName: 'B' },
        first:   { id: 1 },
        second:  { id: 2 },
        third:   { id: 3 },
      },
    });
    const html = buildLiveDetail(ls);
    expect(html).toContain('base first on');
    expect(html).toContain('base second on');
    expect(html).toContain('base third on');
  });

  test('bases empty: no base square has "on" class', () => {
    const ls = makeLinescore({
      offense: {
        batter:  { fullName: 'A' },
        onDeck:  { fullName: 'B' },
        first:   undefined,
        second:  undefined,
        third:   undefined,
      },
    });
    const html = buildLiveDetail(ls);
    expect(html).not.toContain('base first on');
    expect(html).not.toContain('base second on');
    expect(html).not.toContain('base third on');
  });

  test('falls back to em dash for missing batter name', () => {
    const ls = makeLinescore();
    ls.offense.batter = undefined;
    const html = buildLiveDetail(ls);
    expect(html).toContain('\u2014');
  });

  test('count 0-0 produces no filled pips', () => {
    const html = buildLiveDetail(makeLinescore({ balls: 0, strikes: 0 }));
    expect(html).not.toContain('pip ball on');
    expect(html).not.toContain('pip strike on');
  });

  test('full count 3-2 marks 3 balls and 2 strikes as filled', () => {
    const html = buildLiveDetail(makeLinescore({ balls: 3, strikes: 2 }));
    expect((html.match(/count-pip ball on/g) || []).length).toBe(3);
    expect((html.match(/count-pip strike on/g) || []).length).toBe(2);
  });
});
