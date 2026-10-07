import { constants, generateKeyPairSync, privateDecrypt } from 'node:crypto';
import { test, expect } from '../strict-fixtures.mjs';

// 使用合成账号和隔离 API 响应验证真实前端，RSA 请求仍由页面加密并在夹具中解密。
async function setup(page, resetAccount, rejectUpdate = false) {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const key = Buffer.from(publicKey.export({ type: 'spki', format: 'pem' })).toString('base64');
  const updates = [];
  await page.routeWebSocket('**/*', () => {});
  await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ body: '', contentType: 'text/css' }));
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const path = new URL(route.request().url()).pathname;
    let json = { items: [], total: 0 };
    let status = 200;
    if (path === '/api/login/key') json = { key };
    else if (path === '/api/login') json = { token: 'synthetic-token', user: 'admin', reset_account: resetAccount };
    else if (path.startsWith('/api/metadatas/')) json = { ext: path.endsWith('app_tour_completed') ? 'true' : 'false' };
    else if (path === '/api/app/version/check') json = { current_version: 'test' };
    else if (path === '/api/users') {
      const encrypted = route.request().postDataJSON().data;
      updates.push(JSON.parse(privateDecrypt({ key: privateKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, Buffer.from(encrypted, 'base64')).toString()));
      status = rejectUpdate ? 400 : 200;
      json = rejectUpdate ? { reason: 'ErrServer', msg: '保存配置失败' } : { msg: '凭据更新成功' };
    }
    await route.fulfill({ status, json });
  });
  return updates;
}

// 按登录页面的稳定字段提交默认凭据，验证服务端响应驱动的跳转。
async function login(page, guard) {
  await guard.step('打开登录页', () => page.goto('/web/'));
  await guard.step('输入用户名', () => page.locator('#login_username').fill('admin'));
  await guard.step('输入密码', () => page.locator('#login_password').fill('admin'));
  await guard.step('提交登录', () => page.getByRole('button', { name: '登 录', exact: true }).click());
  await guard.step('先进入桌面', () => expect(page).toHaveURL(/\/web\/desktop$/));
}

test('默认凭据进入桌面后修改账号密码', async ({ page, networkGuard }) => {
  const updates = await setup(page, true);
  await login(page, networkGuard);
  const dialog = page.getByRole('dialog', { name: '修改默认账号和密码' });
  await networkGuard.step('显示新弹窗', () => expect(dialog).toBeVisible());
  await networkGuard.step('仅有三个输入框', () => expect(dialog.locator('input')).toHaveCount(3));
  await networkGuard.step('输入新用户名', () => dialog.getByLabel('用户名', { exact: true }).fill('operator'));
  await networkGuard.step('输入新密码', () => dialog.getByLabel('密码', { exact: true }).fill('synthetic-password'));
  await networkGuard.step('确认新密码', () => dialog.getByLabel('再次输入密码', { exact: true }).fill('synthetic-password'));
  await networkGuard.step('提交凭据', () => dialog.getByRole('button', { name: '保存并重新登录' }).click());
  await networkGuard.step('返回登录页', () => expect(page).toHaveURL(/\/web\/?$/));
  await networkGuard.step('校验解密后的实际请求', () => expect(updates).toEqual([{ username: 'operator', password: 'synthetic-password', old_password: 'admin' }]));
  await networkGuard.step('清理旧登录态', () => expect(page.evaluate(() => localStorage.getItem('GOWVP_TOKEN'))).resolves.toBeNull());
});

test('普通账号响应不弹出修改框', async ({ page, networkGuard }) => {
  await setup(page, false);
  await login(page, networkGuard);
  await networkGuard.step('普通登录不显示修改框', () => expect(page.getByRole('dialog', { name: '修改默认账号和密码' })).toHaveCount(0));
});

test('密码不一致与默认凭据不得提交且弹窗不能跳过', async ({ page, networkGuard }) => {
  const updates = await setup(page, true);
  await login(page, networkGuard);
  const dialog = page.getByRole('dialog', { name: '修改默认账号和密码' });
  await networkGuard.step('显示修改框', () => expect(dialog).toBeVisible());
  await networkGuard.step('输入密码', () => dialog.getByLabel('密码', { exact: true }).fill('first'));
  await networkGuard.step('输入不同确认密码', () => dialog.getByLabel('再次输入密码', { exact: true }).fill('second'));
  await networkGuard.step('尝试提交不一致密码', () => dialog.getByRole('button', { name: '保存并重新登录' }).click());
  await networkGuard.step('提示密码不一致', () => expect(dialog.getByRole('alert')).toHaveText('两次输入的密码不一致'));
  await networkGuard.step('输入默认密码', () => dialog.getByLabel('密码', { exact: true }).fill('admin'));
  await networkGuard.step('确认默认密码', () => dialog.getByLabel('再次输入密码', { exact: true }).fill('admin'));
  await networkGuard.step('尝试保留默认凭据', () => dialog.getByRole('button', { name: '保存并重新登录' }).click());
  await networkGuard.step('提示修改默认凭据', () => expect(dialog.getByRole('alert')).toHaveText('请修改默认用户名或密码'));
  await networkGuard.step('未发送修改请求', () => expect(updates).toEqual([]));
  await networkGuard.step('按 Escape', () => page.keyboard.press('Escape'));
  await networkGuard.step('弹窗仍然打开', () => expect(dialog).toBeVisible());
  await networkGuard.step('刷新桌面', () => page.reload());
  await networkGuard.step('刷新后继续要求修改', () => expect(dialog).toBeVisible());
});

test('保存失败保留弹窗和输入', async ({ page, networkGuard }) => {
  networkGuard.setRules({ expected: [{ id: 'users.save-rejected', statuses: [400], match: request => new URL(request.url()).pathname === '/api/users' }] });
  await setup(page, true, true);
  await login(page, networkGuard);
  const dialog = page.getByRole('dialog', { name: '修改默认账号和密码' });
  await networkGuard.step('输入新用户名', () => dialog.getByLabel('用户名', { exact: true }).fill('operator'));
  await networkGuard.step('输入新密码', () => dialog.getByLabel('密码', { exact: true }).fill('synthetic-password'));
  await networkGuard.step('确认新密码', () => dialog.getByLabel('再次输入密码', { exact: true }).fill('synthetic-password'));
  await networkGuard.step('提交失败请求', () => dialog.getByRole('button', { name: '保存并重新登录' }).click());
  await networkGuard.step('显示保存错误', () => expect(dialog.getByRole('alert')).toHaveText('保存配置失败'));
  await networkGuard.step('仍在桌面', () => expect(page).toHaveURL(/\/web\/desktop$/));
  await networkGuard.step('保留输入', () => expect(dialog.getByLabel('用户名', { exact: true })).toHaveValue('operator'));
});
