const cp = require('child_process');
const p = cp.spawn('node', ['dist/server.cjs'], {
  env: { ...process.env, process: 'production' },
  stdio: 'inherit'
});
setTimeout(() => {
  fetch('http://localhost:3000/')
    .then(r => r.text())
    .then(t => console.log('STATUS OK, length:', t.length))
    .catch(console.error)
    .finally(() => p.kill());
}, 2000);
