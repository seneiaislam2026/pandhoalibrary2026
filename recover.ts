import { execSync } from 'child_process';
try {
  execSync('git checkout src/pages/dashboard/AdminSettings.tsx');
  console.log('Restored!');
} catch (e) {
  console.error(e);
}
