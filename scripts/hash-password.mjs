#!/usr/bin/env node
/**
 * Gera o hash scrypt da senha de produção (AUTH_PASSWORD_HASH).
 *
 *   node scripts/hash-password.mjs            → pede a senha no terminal (sem eco) e imprime SOMENTE o hash
 *   printf '%s' "$SENHA" | node scripts/hash-password.mjs --stdin   → lê da entrada padrão (uso não interativo)
 *
 * A senha nunca é gravada em arquivo nem aceita como argumento de linha de comando (apareceria no histórico/ps).
 * Copie a linha impressa para o .env de produção:  AUTH_PASSWORD_HASH=scrypt:16384:8:1:<salt>:<hash>
 * (o formato usa ":" — não contém "$", então o docker compose não tenta interpolar).
 */
import crypto from 'node:crypto';
import readline from 'node:readline';

const N = 16384, R = 8, P = 1, KEYLEN = 64;

function hash(password) {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(password, salt, KEYLEN, { N, r: R, p: P });
  return `scrypt:${N}:${R}:${P}:${salt.toString('base64')}:${key.toString('base64')}`;
}

async function readHidden(prompt) {
  if (!process.stdin.isTTY) throw new Error('Sem terminal interativo: use --stdin.');
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    process.stdout.write(prompt);
    rl._writeToOutput = () => {}; // não ecoa o que é digitado
    rl.question('', (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
  });
}

async function readStdin() {
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  return Buffer.concat(chunks).toString('utf8').replace(/\r?\n$/, '');
}

try {
  let password;
  if (process.argv.includes('--stdin')) password = await readStdin();
  else {
    password = await readHidden('Nova senha: ');
    const again = await readHidden('Repita a senha: ');
    if (password !== again) throw new Error('As senhas não conferem.');
  }
  if (password.length < 10) throw new Error('Use pelo menos 10 caracteres.');
  console.log(hash(password));
} catch (err) {
  console.error(`Erro: ${err.message}`);
  process.exit(1);
}
