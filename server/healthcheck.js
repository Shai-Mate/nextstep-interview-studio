const port = Number(process.env.PORT || 8787);
try {
  const response = await fetch(`http://127.0.0.1:${port}/api/ready`, {
    signal: AbortSignal.timeout(3000),
  });
  const body = await response.json();
  if (!response.ok || body.ready !== true) process.exitCode = 1;
} catch {
  process.exitCode = 1;
}
