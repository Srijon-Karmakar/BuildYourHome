// Build the Android app with Gradle (ADR-037). Usage: node scripts/apk.mjs [gradle task, default assembleDebug]
// Gradle 8 cannot run on Java 25 (a common JAVA_HOME), so use Android Studio's bundled JDK 21 when it is there.
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';

const task = process.argv[2] ?? 'assembleDebug';
const env = { ...process.env };
const studioJdk = [
  process.env.STUDIO_JDK,
  'C:\\Program Files\\Android\\Android Studio\\jbr',
  '/Applications/Android Studio.app/Contents/jbr/Contents/Home',
  '/opt/android-studio/jbr',
].find((p) => p && existsSync(join(p, 'bin')));
if (studioJdk) env.JAVA_HOME = studioJdk;
console.log(`Gradle ${task} with JAVA_HOME=${env.JAVA_HOME ?? '(system)'}`);

const dir = resolve('android');
const win = process.platform === 'win32';
const gradlew = join(dir, win ? 'gradlew.bat' : 'gradlew');
const r = spawnSync(win ? `"${gradlew}"` : gradlew, [task, '--console=plain'], { cwd: dir, env, stdio: 'inherit', shell: win });
process.exit(r.status ?? 1);
