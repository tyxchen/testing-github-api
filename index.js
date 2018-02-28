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
  let branch = null;

  $('#token-submit').onclick = () => {
    let passedToken = $('#token').value;

    fetch(BASE_URL + '/rate_limit?access_token=' + passedToken, {
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
        log('GET: ' + BASE_URL + '/rate_limit?access_token=!!!!', body);
        if (token) {
          document.querySelectorAll('button').forEach(b => b.disabled = false);
        }
      });
    repo = $('#repo').value;
    branch = $('#branch').value;
  };

  let cache = {};

  const doAction = (method, endpoint, options = {}) => new Promise((res, rej) => {
    const url = `${BASE_URL}/repos/${repo}/${endpoint}`;
    let headers = new Headers();
    headers.append('Accept', 'application/json');
    if (cache.hasOwnProperty(url) && cache[url].hasOwnProperty('lastModified')) {
      console.dir(cache[url]);
      headers.append('If-Modified-Since', cache[url].lastModified);
    }
    fetch(`${url}?access_token=${token}`, {
      method,
      headers,
      mode: 'cors',
      ...options
    })
      .then(resp => {
        if (300 <= resp.status && resp.status < 400) {
          log('Returning from cache')
          return Promise.resolve(cache[url].json);
        } else if (resp.ok) {
          return resp.text().then(text => {
            let thing = { json: text };
            if (resp.headers.has('Last-Modified'))
              thing.lastModified = resp.headers.get('Last-Modified')
            cache[url] = thing;
            return Promise.resolve(text);
          });
        } else {
          rej(log('Bad request!'))
        }
        return resp.text()
      })
      .then(body => {
        log(`${method}: ${BASE_URL}/repos/${repo}/${endpoint}`, body);
        res(JSON.parse(body));
      });
  });

  $('#get-commit').onclick = () => {
    log('\nGetting latest commit\n');
    doAction('GET', 'commits/' + branch)
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
    getTree(branch, '', arr);
    setTimeout(() => {log('Results', '[\n\t' + arr.join('\n\t') + '\n]')}, 5000);
  };

  $('#create-commit').onclick = function() {
    this.nextElementSibling.classList.toggle('hidden');
  };

  $('#create-commit-dupl-templ').onclick = function() {
    let node = $('.commit-templ').cloneNode(true);
    node.className = 'commit-file';
    $(node, 'button').onclick = () => { node.remove() };
    this.insertAdjacentElement('beforebegin', node);
  };

  $('#create-commit-submit').onclick = () => {
    // what
  }
})();
