import { execSync } from 'node:child_process';

console.log('=== Deploying Weesize ===');
console.log('1. Running tests...');
execSync('npm run test', { stdio: 'inherit' });

console.log('2. Building production bundle & prerendering...');
execSync('npm run build', { stdio: 'inherit' });

console.log('3. Pushing to origin main...');
try {
  execSync('git push origin main', { stdio: 'inherit' });
  console.log('Pushed to GitHub main branch. Production build will deploy automatically.');
} catch (error) {
  console.log('Git push status:');
  console.error(error instanceof Error ? error.message : String(error));
}

console.log('=== Deploy step completed ===');
