#!/usr/bin/env node
/**
 * City Link Phase 2 — API functional QA (PDF §23–32, §34–35)
 * Run: node scripts/phase2_qa.js
 */
const BASE = process.env.API_BASE || 'http://127.0.0.1:4000';

let passed = 0;
let failed = 0;
const gaps = [];

async function req(method, path, { token, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { status: res.status, json };
}

function assert(name, cond, detail = '') {
  if (cond) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function noteGap(msg) {
  gaps.push(msg);
}

async function main() {
  console.log(`\nPhase 2 QA against ${BASE}\n`);

  // Health
  {
    const { status, json } = await req('GET', '/health');
    assert('GET /health', status === 200 && json?.ok === true);
  }

  // Public catalog (§23)
  let home;
  {
    const r = await req('GET', '/home');
    home = r.json;
    assert('GET /home', r.status === 200);
    assert('Home LIVE NOW', Array.isArray(home.liveNow) && home.liveNow.length >= 1);
    assert('Home UPCOMING', Array.isArray(home.upcoming) && home.upcoming.length >= 1);
    assert('Home COMPLETED', Array.isArray(home.completed) && home.completed.length >= 1);
    assert('Home NEWS', Array.isArray(home.latestNews) && home.latestNews.length >= 1);
    assert('Home TOURNAMENTS', Array.isArray(home.tournaments) && home.tournaments.length >= 1);
    assert(
      'Test data: live+upcoming+completed',
      home.liveNow.some((m) => m.status === 'live') &&
        home.upcoming.some((m) => m.status === 'upcoming') &&
        home.completed.some((m) => m.status === 'completed'),
    );
    assert(
      'Invalid YouTube test case present',
      home.completed.some((m) => m.youtubeId === 'not-a-real-id' || m.youtubeVideoId === 'not-a-real-id'),
    );
  }

  {
    const r = await req('GET', '/live');
    assert('GET /live', r.status === 200 && Array.isArray(r.json.live));
    assert('Live has upcoming section', Array.isArray(r.json.upcoming));
  }

  {
    const r = await req('GET', '/matches?limit=50');
    assert('GET /matches', r.status === 200 && Array.isArray(r.json.data));
  }

  let matchId = home.liveNow[0]?.id;
  let tournamentId = home.tournaments[0]?.id;
  let newsId = home.latestNews[0]?.id;
  let photoMatchId = home.completed.find((m) => (m.photos?.length || 0) > 0)?.id || matchId;

  {
    const r = await req('GET', `/matches/${matchId}`);
    assert('GET /matches/:id', r.status === 200 && r.json.match?.id === matchId);
    assert('Match has tournament + teams', !!r.json.match.tournamentName && !!r.json.match.teamA);
  }

  {
    const r = await req('GET', `/matches/${photoMatchId}/photos`);
    assert('GET /matches/:id/photos', r.status === 200 && Array.isArray(r.json.photos));
    assert('Photos for match exist', r.json.photos.length >= 1);
  }

  {
    const r = await req('GET', '/tournaments');
    assert('GET /tournaments', r.status === 200 && r.json.tournaments?.length >= 1);
  }

  {
    const r = await req('GET', `/tournaments/${tournamentId}`);
    assert('GET /tournaments/:id', r.status === 200 && r.json.tournament?.id === tournamentId);
    assert('Tournament includes published matches', Array.isArray(r.json.matches));
  }

  {
    const r = await req('GET', '/news');
    assert('GET /news', r.status === 200 && Array.isArray(r.json.data));
  }

  {
    const r = await req('GET', `/news/${newsId}`);
    assert('GET /news/:id', r.status === 200 && r.json.news?.id === newsId);
  }

  // Auth (§8, §31)
  const stamp = Date.now();
  const signupEmail = `qa_${stamp}@citylink.app`;
  let userToken;

  {
    const r = await req('POST', '/auth/signup', {
      body: {
        name: 'QA User',
        email: signupEmail,
        password: 'password',
        confirmPassword: 'password',
      },
    });
    assert('Sign Up', r.status === 201 && !!r.json.token);
    userToken = r.json.token;
  }

  {
    const r = await req('POST', '/auth/login', {
      body: { email: 'demo@citylink.app', password: 'password' },
    });
    assert('Login demo user', r.status === 200 && !!r.json.token);
    userToken = r.json.token;
  }

  {
    const r = await req('POST', '/auth/login', {
      body: { email: 'demo@citylink.app', password: 'wrong-password' },
    });
    assert('Login rejects bad password', r.status === 401);
  }

  {
    const r = await req('GET', '/auth/me', { token: userToken });
    assert('Session /auth/me', r.status === 200 && r.json.user?.email === 'demo@citylink.app');
  }

  {
    const r = await req('GET', '/profile', { token: userToken });
    assert('GET /profile', r.status === 200 && !!r.json.user);
  }

  {
    const r = await req('GET', '/watch-history', { token: userToken });
    assert('GET /watch-history (auth)', r.status === 200 && Array.isArray(r.json.data));
  }

  {
    const r = await req('GET', '/watch-history');
    assert('GET /watch-history requires auth', r.status === 401);
  }

  {
    const r = await req('POST', '/watch-history', {
      token: userToken,
      body: {
        contentType: 'match',
        contentId: matchId,
        title: 'QA Watch',
        thumbnailUrl: 'https://example.com/t.jpg',
      },
    });
    assert('POST /watch-history', r.status === 201 && r.json.item?.contentId === matchId);
  }

  {
    const r = await req('GET', '/watch-history', { token: userToken });
    assert(
      'Watch history contains posted item',
      r.json.data?.some((i) => i.contentId === matchId),
    );
  }

  // Password recovery (§8)
  {
    const r = await req('POST', '/auth/password-recovery', {
      body: { email: 'demo@citylink.app' },
    });
    assert('Password recovery starts', r.status === 200);
    assert('Dev reset token exposed', typeof r.json.resetToken === 'string');
    const token = r.json.resetToken;
    const r2 = await req('POST', '/auth/password-reset', {
      body: {
        token,
        password: 'password',
        confirmPassword: 'password',
      },
    });
    assert('Password reset works', r2.status === 200);
  }

  // Published visibility (§26)
  {
    const adminLogin = await req('POST', '/auth/login', {
      body: { email: 'admin@citylink.app', password: 'admin123' },
    });
    assert('Admin login', adminLogin.status === 200 && !!adminLogin.json.token);
    const adminToken = adminLogin.json.token;

    // Non-admin blocked from admin API
    const denied = await req('POST', '/admin/tournaments', {
      token: userToken,
      body: {
        name: 'Should Fail',
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 86400000).toISOString(),
      },
    });
    assert('Admin API denies USER role', denied.status === 403);

    // Create unpublished match via admin
    const t = home.tournaments[0];
    const created = await req('POST', '/admin/matches', {
      token: adminToken,
      body: {
        tournamentId: t.id,
        teamA: 'Hidden A',
        teamB: 'Hidden B',
        startAt: new Date().toISOString(),
        status: 'LIVE',
        published: false,
        youtubeVideoId: 'M7lc1UVf-VE',
      },
    });
    assert('Admin can create match', created.status === 201);
    const hiddenId = created.json.match?.id;

    const home2 = await req('GET', '/home');
    assert(
      'Unpublished match not on Home',
      !home2.json.liveNow?.some((m) => m.id === hiddenId) &&
        !home2.json.featured?.some((m) => m.id === hiddenId),
    );

    // E2E status change LIVE ? COMPLETED (§30)
    const liveMatch = home.liveNow[0];
    const statusChange = await req('PATCH', `/admin/matches/${liveMatch.id}`, {
      token: adminToken,
      body: { status: 'COMPLETED' },
    });
    assert('Admin can change match status', statusChange.status === 200);

    const homeAfter = await req('GET', '/home');
    assert(
      'After COMPLETED: not in LIVE NOW',
      !homeAfter.json.liveNow?.some((m) => m.id === liveMatch.id),
    );
    assert(
      'After COMPLETED: appears in completed',
      homeAfter.json.completed?.some((m) => m.id === liveMatch.id),
    );

    // Restore LIVE for continued demos
    await req('PATCH', `/admin/matches/${liveMatch.id}`, {
      token: adminToken,
      body: { status: 'LIVE' },
    });
  }

  // Logout
  {
    const r = await req('POST', '/auth/logout', { token: userToken });
    assert('Logout', r.status === 200);
  }

  // Account deletion for signup user
  {
    const login = await req('POST', '/auth/login', {
      body: { email: signupEmail, password: 'password' },
    });
    const token = login.json.token;
    const del = await req('DELETE', '/auth/me', { token });
    assert('Account deletion', del.status === 200);
    const again = await req('POST', '/auth/login', {
      body: { email: signupEmail, password: 'password' },
    });
    assert('Deleted account cannot login', again.status === 401);
  }

  // Known Phase 2 gaps (product/process, not API)
  noteGap('Android/iOS device matrix QA (§33) not run in this session (Flutter web + API verified).');
  noteGap('Final client branding / official YouTube channel / store accounts (§36) not supplied — test content used.');
  noteGap('Password recovery uses in-app/dev token (email provider not configured).');
  noteGap('Social engagement layer remains local mock (Phase 1 social PDF); Phase 2 core content is API-backed.');

  console.log(`\nResult: ${passed} passed, ${failed} failed`);
  if (gaps.length) {
    console.log('\nKnown gaps / notes:');
    for (const g of gaps) console.log(`  - ${g}`);
  }
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
