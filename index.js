(() => {
  const $ = (ctx, sel) => (!sel ? document : ctx).querySelector(sel || ctx);
  const BASE_URL = 'https://api.github.com';

  const log = (toAdd, children=null) => {
    if (children == null)
      $('pre').insertAdjacentText('beforeend', ' ↳ ' + toAdd + '\n');
    else {
      let dummy = document.createElement('div');
      dummy.textContent = children;
      $('pre').insertAdjacentHTML('beforeend', `<div class="log-group log-group__closed">
        <a onclick="this.parentNode.classList.toggle('log-group__closed')">${toAdd}</a>
        ${dummy.outerHTML}
      </div>`);
    }
  };

  document.querySelectorAll('form').forEach(f => {
    f.onsubmit = () => false;
  });

  let token = null;
  let repo = null;

  $('#token-submit').onclick = () => {
    let passedToken = $('#token').value;

    fetch(BASE_URL + '?access_token=' + passedToken, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      },
      mode: 'cors'
    })
      .then(resp => {
        if (resp.ok) token = passedToken;
        else log('Bad token!')
        return resp.text();
      })
      .then(body => {
        log('GET: ' + BASE_URL + '?access_token=!!!!', body);
      });
    repo = $('#repo').value;
  };

  const doAction = (method, endpoint, options = {}) => new Promise((res, rej) => {
    fetch(`${BASE_URL}/repos/${repo}/${endpoint}?access_token=${token}`, {
      method,
      headers: {
        'Accept': 'application/json'
      },
      mode: 'cors',
      ...options
    })
      .then(resp => {
        if (!resp.ok) rej(log('Bad request!'))
        return resp.text()
      })
      .then(body => {
        log(`${method}: ${BASE_URL}/repos/${repo}/${endpoint}`, body);
        res(JSON.parse(body));
      });
  });

  $('#get-commit').onclick = () => {
    log('\nGetting latest commit\n');
    doAction('GET', 'commits/master')
      .then(json => {
        log(json.sha)
      });
  };

  const getTree = (sha, path, arr) => {
    doAction('GET', 'git/trees/' + sha)
      .then(json => {
        for (let t of json.tree) {
          if (t.type == 'tree')
            getTree(t.sha, path + '/' + t.path, arr);
          else
            arr.push(path + '/' + t.path);
        }
      });
  }

  $('#get-tree').onclick = () => {
    log('\nGetting tree\n');
    let arr = [];
    getTree('master', '', arr);
    setTimeout(() => {log('Results', '[\n\t' + arr.join('\n\t') + '\n]')}, 5000);
  };
})();
