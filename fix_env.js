const { execSync } = require('child_process');
const url = "https://sbippgvtlkevulhcpfpj.supabase.co";
const key = "sb_publishable_0Q6bR3NfPmy9QjDYzV7xaw__VanG7D_";

console.log("Removing old URL...");
try { execSync('npx vercel env rm NEXT_PUBLIC_SUPABASE_URL production -y', { stdio: 'inherit' }); } catch (e) { }
console.log("Adding new URL...");
execSync('npx vercel env add NEXT_PUBLIC_SUPABASE_URL production', { input: url, encoding: 'utf8' });

console.log("Removing old anon key...");
try { execSync('npx vercel env rm NEXT_PUBLIC_SUPABASE_ANON_KEY production -y', { stdio: 'inherit' }); } catch (e) { }
console.log("Adding new anon key...");
execSync('npx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production', { input: key, encoding: 'utf8' });

console.log("Done updating Vercel env variables!");
