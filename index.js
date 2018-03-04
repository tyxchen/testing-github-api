(() => {
  const $ = (ctx, sel) => (!sel ? document : ctx).querySelector(sel || ctx);
  const BASE_URL = 'https://api.github.com';

  const log = (toAdd, ...children) => {
    if (!children.length)
      $('pre').insertAdjacentText('beforeend', ' ↳ ' + toAdd + '\n');
    else {
      let dummy = document.createElement('div');
      $('pre').insertAdjacentHTML('beforeend', `<div class="log-group log-group__closed">
        <a onclick="this.parentNode.classList.toggle('log-group__closed')">${toAdd}</a>
        ${children.map(c => { 
          dummy.textContent = c;
          return dummy.outerHTML;
        }).join('-------')}
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
    const url = `${BASE_URL}/repos/${repo}/${endpoint}#${encodeURIComponent(JSON.stringify(options.params))}`;
    let headers = new Headers();
    headers.append('Accept', 'application/json');
    if (cache.hasOwnProperty(url) && cache[url].hasOwnProperty('lastModified')) {
      headers.append('If-Modified-Since', cache[url].lastModified);
    }

    let searchParams = new URLSearchParams();
    searchParams.append('access_token', token);

    if (options.params) {
      for (let s in options.params)
        searchParams.append(s, options.params[s]);
      delete options.params;
    }

    fetch(`${url.split('#')[0]}?${searchParams.toString()}`, {
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
        if (options.body)
          log(`${method}: ${url.split('#')[0]}?${searchParams.toString()}`, options.body, body);
        else
          log(`${method}: ${url.split('#')[0]}?${searchParams.toString()}`, body);
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
    doAction('GET', 'git/trees/' + branch, { params: { recursive: 1 } })
      .then(json => {
        if (!json.truncated)
          log('Results', '[\n\t' + json.tree.filter(t => t.type == 'blob').map(t => t.path).join('\n\t') + '\n]');
        else {
          let arr = [];
          getTree(branch, '', arr);
          setTimeout(() => {log('Results', '[\n\t' + arr.join('\n\t') + '\n]')}, 5000);
        }
      });
  };

  const getElem = (obj, keys) => {
    if (keys.length == 0) return obj;
    else return getElem(obj[keys[0]], keys.slice(1));
  };
  const setElem = (obj, keys, content) => {
    if (keys.length == 0) return;
    else if (keys.length == 1) return obj[keys[0]] = content;
    else return setElem(obj[keys[0]], keys.slice(1), content);
  };

  let files = {};

  const autocomplete = function(elem) {
    let datalist = $('#get-file-autocomplete'),
        value = this.value,
        pre = value.split('/').slice(0, -1);
    let things = [];
    // autocomplete
    if (datalist.dataset.query != pre.join('/')) {
      try {
        things = getElem(files, pre);
      } catch (e) {}

      let builder = [];
      for (let f in things) {
        builder.push(`<option>${pre.join('/') + (pre.length ? '/' : '')}${f + (typeof things[f] === 'string' ? '' : '/')}</option>`);
      }
      datalist.innerHTML = builder.join('');
      datalist.dataset.query = pre.join('/');
    }
  };

  $('#get-file').onclick = function() {
    if (this.nextElementSibling.classList.contains('hidden')) {
      doAction('GET', 'git/trees/' + branch, { params: { recursive: 1 } })
        .then(json => {
          for (let t of json.tree) {
            let path = t.path.split('/');
            if (t.type == 'blob') {
              setElem(files, path, t.sha);
            } else if (t.type == 'tree') {
              setElem(files, path, {});
            }
          }
        });
    }
    this.nextElementSibling.classList.toggle('hidden');
  };

  $('#get-file-path').onkeyup = autocomplete.bind($('#get-file-path'));

  $('#get-file-submit').onclick = () => {
    let value = $('#get-file-path').value,
        isSha = /^[0-9a-f]{40}$/i.test(value);

    if (!isSha) value = getElem(files, value.split('/'));

    doAction('GET', 'git/blobs/' + value)
      .then(json => {
        if (json.content)
          log(value, atob(json.content));
        else
          log('Not a file!');
      });
  };

  $('#create-commit').onclick = function() {
    this.nextElementSibling.classList.toggle('hidden');
  };

  $('#create-commit-dupl-templ').onclick = function() {
    let node = $('.commit-templ').cloneNode(true);
    node.className = 'commit-file';
    $(node, 'input').onkeyup = autocomplete.bind($(node, 'input'));
    $(node, 'button').onclick = () => { node.remove() };
    this.insertAdjacentElement('beforebegin', node);
  };

  $('#create-commit-submit').onclick = () => {
    // what
    doAction('GET', 'commits/' + branch)
      .then(json => {
        let base_tree = json.sha,
            tree = [];

        // create tree
        for (let i of document.querySelectorAll('.commit-file')) {
          let path = $(i, '.commit-templ-filename').value,
              content = $(i, 'textarea').value;

          tree.push({ path, content, mode: '100644', type: 'blob' })
        }

        doAction('POST', 'git/trees', { body: JSON.stringify({ base_tree, tree }) })
          .then(json => {
            let body = JSON.stringify({
              message: $('#commit-msg').value,
              tree: json.sha, 
              parents: [ base_tree ]
            });
            doAction('POST', 'git/commits', { body })
              .then(json => {
                doAction('PATCH', 'git/refs/heads/' + branch, {
                  body: JSON.stringify({
                    sha: json.sha
                  })
                })
                  .then(json => log(json.object.sha));
              });
          })
      });
  }
})();
