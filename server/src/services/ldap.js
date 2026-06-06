const ldap = require('ldapjs');

function ldapAuthenticate(username, password, settings) {
  return new Promise((resolve, reject) => {
    const url = 'ldap://' + settings.ldap_server + ':' + (settings.ldap_port || '389');
    const client = ldap.createClient({ url, connectTimeout: 5000 });

    let settled = false;

    client.on('connectError', () => {
      if (!settled) { settled = true; client.destroy(); reject(new Error('无法连接域控服务器')); }
    });

    client.on('error', (err) => {
      if (!settled) { settled = true; client.destroy(); reject(new Error('域控连接异常: ' + (err.message || ''))); }
    });

    client.on('connectTimeout', () => {
      if (!settled) { settled = true; client.destroy(); reject(new Error('域控服务器连接超时')); }
    });

    let dn;
    if (settings.ldap_domain) {
      dn = username + '@' + settings.ldap_domain;
    } else {
      dn = 'CN=' + username + ',' + settings.ldap_base_dn;
    }

    client.bind(dn, password, (err) => {
      if (settled) return;
      settled = true;
      client.destroy();
      if (err) {
        const msg = err.message || '';
        if (msg.includes('invalidCredentials') || msg.includes('Invalid Credentials')) {
          reject(new Error('域控用户名或密码错误'));
        } else {
          reject(new Error('域控认证失败: ' + (msg || '未知错误')));
        }
      } else {
        resolve();
      }
    });
  });
}

function ldapTestConnection(settings) {
  return new Promise((resolve) => {
    const steps = [];
    const url = 'ldap://' + settings.ldap_server + ':' + (settings.ldap_port || '389');
    const client = ldap.createClient({ url, connectTimeout: 5000 });
    let settled = false;

    function finish(result) {
      if (settled) return;
      settled = true;
      try { client.destroy(); } catch (_) {}
      resolve(result);
    }

    const step1Start = Date.now();
    let step1Done = false;

    client.on('connectError', () => {
      if (!step1Done) {
        step1Done = true;
        steps.push({ step: 1, name: 'TCP 连接', status: 'fail', message: '无法连接域控服务器，请检查服务器地址和端口', elapsed: Date.now() - step1Start });
      }
      finish({ success: false, steps, message: '连接失败', elapsed: Date.now() - step1Start });
    });

    client.on('connectTimeout', () => {
      if (!step1Done) {
        step1Done = true;
        steps.push({ step: 1, name: 'TCP 连接', status: 'fail', message: '连接超时，请检查网络和防火墙设置', elapsed: Date.now() - step1Start });
      }
      finish({ success: false, steps, message: '连接超时', elapsed: Date.now() - step1Start });
    });

    client.on('error', (err) => {
      if (!step1Done) {
        step1Done = true;
        steps.push({ step: 1, name: 'TCP 连接', status: 'fail', message: '连接异常: ' + (err.message || '未知错误'), elapsed: Date.now() - step1Start });
      }
    });

    setTimeout(() => {
      if (step1Done) return;
      step1Done = true;
      steps.push({ step: 1, name: 'TCP 连接', status: 'pass', message: '成功连接至 ' + url, elapsed: Date.now() - step1Start });

      const step2Start = Date.now();
      let dn;
      if (settings.ldap_domain) {
        dn = settings.ldap_admin_user + '@' + settings.ldap_domain;
      } else {
        dn = 'CN=' + settings.ldap_admin_user + ',' + settings.ldap_base_dn;
      }

      client.bind(dn, settings.ldap_admin_password, (err) => {
        if (err) {
          const msg = err.message || '';
          let errMsg = '认证失败';
          if (msg.includes('invalidCredentials') || msg.includes('Invalid Credentials')) {
            errMsg = '管理员账号或密码错误';
          } else {
            errMsg = '绑定失败: ' + (msg || '未知错误');
          }
          steps.push({ step: 2, name: '管理员绑定认证', status: 'fail', message: errMsg, elapsed: Date.now() - step2Start });
          finish({ success: false, steps, message: '认证失败', elapsed: Date.now() - step1Start });
          return;
        }
        steps.push({ step: 2, name: '管理员绑定认证', status: 'pass', message: '认证成功 (DN: ' + dn + ')', elapsed: Date.now() - step2Start });

        const step3Start = Date.now();
        const searchBase = settings.ldap_base_dn || (settings.ldap_domain ? settings.ldap_domain.split('.').map(p => 'DC=' + p).join(',') : '');

        if (!searchBase) {
          steps.push({ step: 3, name: '目录搜索', status: 'skip', message: '未配置 Base DN，跳过搜索测试', elapsed: 0 });
          finish({ success: true, steps, message: '连接和认证成功（已跳过搜索测试）', elapsed: Date.now() - step1Start });
          return;
        }

        const opts = {
          filter: '(objectClass=user)',
          scope: 'sub',
          sizeLimit: 10,
          timeLimit: 5
        };

        let searchFailed = false;
        client.search(searchBase, opts, (searchErr, res) => {
          if (searchErr) {
            if (searchFailed) return;
            searchFailed = true;
            steps.push({ step: 3, name: '目录搜索', status: 'fail', message: '搜索失败: ' + (searchErr.message || '未知错误'), elapsed: Date.now() - step3Start });
            finish({ success: true, steps, message: '连接和认证成功，但搜索失败', elapsed: Date.now() - step1Start });
            return;
          }

          let userCount = 0;
          res.on('searchEntry', () => { userCount++; });
          res.on('error', (e) => {
            if (searchFailed) return;
            searchFailed = true;
            steps.push({ step: 3, name: '目录搜索', status: 'fail', message: '搜索出错: ' + (e.message || ''), elapsed: Date.now() - step3Start });
            finish({ success: true, steps, message: '连接和认证成功，但搜索出错', elapsed: Date.now() - step1Start });
          });
          res.on('end', () => {
            if (searchFailed) return;
            searchFailed = true;
            steps.push({ step: 3, name: '目录搜索', status: 'pass', message: '搜索成功，发现 ' + userCount + ' 个用户对象', elapsed: Date.now() - step3Start });
            finish({ success: true, steps, message: '全部验证通过', elapsed: Date.now() - step1Start });
          });
        });
      });
    }, 100);
  });
}

module.exports = { ldapAuthenticate, ldapTestConnection };
