export {};

async function verify() {
  // Read-only smoke check of the compiled application and its actual database.
  // Run after build/migrate; no seed or test data is written.
  const server = Bun.spawn(['bun', 'dist/main.js'], {
    env: { ...process.env, PORT: '0', NODE_ENV: 'production' },
    stdout: 'pipe', stderr: 'pipe',
  });
  let output = '';
  async function capture(stream: ReadableStream<Uint8Array>) {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      output = (output + decoder.decode(value)).slice(-16384);
    }
  }
  const stdout = capture(server.stdout);
  const stderr = capture(server.stderr);
  try {
    const deadline = Date.now() + 25000;
    let address: string | undefined;
    while (Date.now() < deadline) {
      address = output.match(/Server is running on (http:\/\/[^\s]+)/)?.[1];
      if (address) break;
      if (server.exitCode !== null) throw new Error('Compiled server exited before becoming ready');
      await Bun.sleep(100);
    }
    if (!address) throw new Error('Compiled server did not become ready within 25 seconds');
    const origin = address.replace('0.0.0.0', '127.0.0.1');
    for (const path of ['/', '/health/database', '/api/players', '/api/matches']) {
      const response = await fetch(`${origin}${path}`, { signal: AbortSignal.timeout(30000) });
      if (response.status !== 200) throw new Error(`${path} returned HTTP ${response.status}`);
      if (path === '/') {
        if (await response.text() !== 'Fantasy API is running') throw new Error('Unexpected root response');
        console.log('GET / -> 200 Fantasy API is running');
      } else if (path === '/health/database') {
        const body = await response.json() as { status?: string; database?: string };
        if (body.status !== 'ok' || body.database !== 'connected') throw new Error('Database readiness failed');
        console.log('GET /health/database -> 200 {"status":"ok","database":"connected"}');
      } else {
        const body = await response.json() as { success?: boolean; data?: unknown[] };
        if (!body.success || !Array.isArray(body.data)) throw new Error(`Unexpected response from ${path}`);
        console.log(`GET ${path} -> 200 success=true rows=${body.data.length}`);
      }
    }
    const docs = await fetch(`${origin}/api/docs`);
    if (docs.status !== 200 || !(await docs.text()).includes('Local Fantasy API Documentation')) throw new Error('Swagger UI failed');
    const spec = await fetch(`${origin}/api/docs-json`);
    const openapi = await spec.json() as { paths?: Record<string, unknown> };
    if (spec.status !== 200 || !openapi.paths?.['/api/auth/me']) throw new Error('OpenAPI document failed');
    console.log('GET /api/docs -> 200 Swagger UI');
    console.log('GET /api/docs-json -> 200 OpenAPI document');
    const leagues = await fetch(`${origin}/api/leagues`);
    if (leagues.status !== 401) throw new Error('League API accepted an anonymous request');
    console.log('GET /api/leagues (anonymous) -> 401');
    const profile = await fetch(`${origin}/api/auth/me`);
    if (profile.status !== 401) throw new Error('Profile accepted an anonymous request');
    console.log('GET /api/auth/me (anonymous) -> 401');
    const invalidLogin = await fetch(`${origin}/api/auth/login`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
    });
    if (invalidLogin.status !== 400) throw new Error('Authentication request validation failed');
    console.log('POST /api/auth/login (invalid body) -> 400');
    console.log('Compiled Nest server and PostgreSQL service: PASS (no data written)');
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Runtime verification failed');
    process.exitCode = 1;
  } finally {
    server.kill('SIGTERM');
    const exited = await Promise.race([server.exited.then(() => true), Bun.sleep(5000).then(() => false)]);
    if (!exited) server.kill('SIGKILL');
    await server.exited;
    await Promise.all([stdout, stderr]);
  }
}

void verify().catch(() => {
  console.error("Runtime verification could not start");
  process.exitCode = 1;
});
