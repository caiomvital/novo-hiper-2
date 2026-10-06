// Falha cedo e com mensagem clara se o backend isolado de desenvolvimento não estiver no ar.
export default async function globalSetup() {
  const target = process.env.DEV_API_TARGET ?? 'http://127.0.0.1:4317';
  if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(target)) {
    throw new Error(`DEV_API_TARGET deve ser local (recebido: ${target}). Os testes nunca devem usar produção.`);
  }
  try {
    const res = await fetch(`${target}/api/health`);
    if (!res.ok) throw new Error(`status ${res.status}`);
  } catch (err) {
    throw new Error(
      `Backend de desenvolvimento indisponível em ${target} (${String(err)}). ` +
        'Suba o container novo-hiper-dev-api (ver dev-start.sh) antes de rodar os testes E2E.'
    );
  }
}
