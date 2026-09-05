import {readFile, writeFile, mkdir, rename} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import bcrypt from 'bcryptjs';

const [username, password, name, branch, ...extra] = process.argv.slice(2);
if (extra.length || !username || !/^[a-zA-Z0-9_.-]{1,64}$/.test(username) || !password || password.length < 12 || Buffer.byteLength(password) > 72 || !name?.trim() || name.length > 120 || (branch !== undefined && (!branch.trim() || branch.length > 160))) {
  console.error('يلزم اسم مستخدم صالح، وكلمة مرور من 12 حرفًا على الأقل و72 بايت كحد أقصى، والاسم.');
  process.exit(1);
}
const file = new URL('../config/admins.json', import.meta.url);
try {
  await mkdir(new URL('../config/', import.meta.url), {recursive: true});
  let admins;
  try { admins = JSON.parse(await readFile(file, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') admins = []; else throw error; }
  if (!Array.isArray(admins)) throw new Error('Invalid admins file');
  const index = admins.findIndex(item => item.username === username);
  const savedBranch = branch?.trim() ?? (index >= 0 ? admins[index].branch : undefined);
  const admin = {username, name: name.trim(), passwordHash: await bcrypt.hash(password, 12), ...(typeof savedBranch === 'string' ? {branch:savedBranch} : {})};
  if (index < 0) admins.push(admin); else admins[index] = admin;
  const temporary = fileURLToPath(file) + '.tmp';
  await writeFile(temporary, JSON.stringify(admins, null, 2) + '\n', {mode: 0o600});
  await rename(temporary, file);
  console.log(`تم حفظ المستخدم: ${username}`);
} catch {
  console.error('تعذر حفظ المستخدم. تحقق من ملف المستخدمين وصلاحيات الكتابة.');
  process.exitCode = 1;
}
