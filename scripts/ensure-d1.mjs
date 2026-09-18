import { execSync } from 'child_process';
import fs from 'fs';

async function main() {
  console.log('🔍 正在检查 Cloudflare D1 数据库配置...');
  const wranglerFile = 'wrangler.toml';
  if (!fs.existsSync(wranglerFile)) {
    console.error('❌ 未找到 wrangler.toml 配置文件');
    return;
  }

  let content = fs.readFileSync(wranglerFile, 'utf8');
  const idMatch = content.match(/database_id\s*=\s*["']([^"']+)["']/);
  const currentId = idMatch ? idMatch[1] : '';
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(currentId);

  if (isUuid) {
    console.log(`✅ wrangler.toml 中已配置合法的 D1 database_id: ${currentId}`);
    return;
  }

  if (!process.env.CLOUDFLARE_API_TOKEN) {
    console.log('ℹ️ 未检测到 CLOUDFLARE_API_TOKEN，跳过 D1 自动化检测。');
    return;
  }

  console.log(`⚠️ 检测到当前 database_id 未配置或为占位符 ("${currentId}")`);
  console.log('🚀 正在尝试从您的 Cloudflare 账户自动查询或创建 D1 数据库 (okx_trading_db)...');

  let d1Id = '';

  // 1. 尝试从已有列表查询
  try {
    const listOutput = execSync('npx wrangler d1 list --json', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 30000,
      env: { ...process.env, CI: 'true' }
    });
    const d1List = JSON.parse(listOutput);
    const existing = Array.isArray(d1List) ? d1List.find(db => db.name === 'okx_trading_db') : null;
    if (existing && (existing.uuid || existing.id)) {
      d1Id = existing.uuid || existing.id;
      console.log(`✅ 在您的 Cloudflare 账户中检索到已存在的 D1 数据库: ${d1Id}`);
    }
  } catch (e) {
    // 静默忽略，继续尝试创建
  }

  // 2. 如果不存在，自动创建新的 D1 数据库
  if (!d1Id) {
    try {
      console.log('📦 正在自动执行: npx wrangler d1 create okx_trading_db ...');
      const createOutput = execSync('npx wrangler d1 create okx_trading_db', {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 30000,
        env: { ...process.env, CI: 'true' }
      });
      const match = createOutput.match(/database_id\s*=\s*["']([^"']+)["']/);
      if (match) {
        d1Id = match[1];
        console.log(`🎉 成功为您在 Cloudflare 自动创建 D1 数据库！UUID: ${d1Id}`);
      }
    } catch (e) {
      // 若因名称已存在报错，尝试查询 info
      try {
        const infoOutput = execSync('npx wrangler d1 info okx_trading_db --json', {
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'pipe'],
          timeout: 30000,
          env: { ...process.env, CI: 'true' }
        });
        const info = JSON.parse(infoOutput);
        d1Id = info.uuid || info.id || '';
      } catch (err) {
        console.error('自动处理 D1 提示:', e?.message || e);
      }
    }
  }

  // 3. 将真实生成的 UUID 自动写回 wrangler.toml
  if (d1Id) {
    content = content.replace(/database_id\s*=\s*["'][^"']+["']/, `database_id = "${d1Id}"`);
    fs.writeFileSync(wranglerFile, content, 'utf8');
    console.log(`✨ 已成功将真实的 D1 数据库 UUID [${d1Id}] 自动写入 wrangler.toml！`);
  } else {
    console.error('::error::无法自动获取或创建 D1 数据库 UUID，请手动在 Cloudflare 控制台创建并填入 wrangler.toml');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('D1 配置执行异常:', err);
  process.exit(1);
});
