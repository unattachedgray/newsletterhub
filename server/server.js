const http = require('http');
const path = require('path');
const fs = require('fs');
const { randomUUID, pbkdf2Sync } = require('crypto');

const DATA_PATH = path.join(__dirname, 'data', 'db.json');
const PUBLIC_DIR = path.join(__dirname, '..', 'client');
const TOKEN_EXPIRY_MS = 1000 * 60 * 60 * 24 * 7;

function ensureDataFile() {
  if (!fs.existsSync(DATA_PATH)) {
    fs.mkdirSync(path.dirname(DATA_PATH), { recursive: true });
    fs.writeFileSync(
      DATA_PATH,
      JSON.stringify({ users: [], sources: [], feeds: [], sessions: {} }, null, 2)
    );
  }
}

function readData() {
  ensureDataFile();
  return JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
}

function writeData(data) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
}

function hashPassword(password) {
  const salt = randomUUID().replace(/-/g, '');
  const hash = pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, originalHash] = stored.split(':');
  const hash = pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return hash === originalHash;
}

function createSession(userId) {
  const data = readData();
  const token = randomUUID();
  data.sessions[token] = { userId, createdAt: Date.now() };
  writeData(data);
  return token;
}

function destroySession(token) {
  const data = readData();
  if (data.sessions[token]) {
    delete data.sessions[token];
    writeData(data);
  }
}

function getUserFromRequest(req) {
  const auth = req.headers['authorization'];
  if (!auth || !auth.startsWith('Bearer ')) return null;
  const token = auth.slice(7);
  const data = readData();
  const session = data.sessions[token];
  if (!session) return null;
  if (Date.now() - session.createdAt > TOKEN_EXPIRY_MS) {
    delete data.sessions[token];
    writeData(data);
    return null;
  }
  const user = data.users.find((u) => u.id === session.userId);
  if (!user) return null;
  return { user, token };
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  });
  res.end(JSON.stringify(payload));
}

function sendText(res, status, text) {
  res.writeHead(status, {
    'Content-Type': 'text/plain',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  });
  res.end(text);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function serveStaticFile(req, res, pathname) {
  let filePath = path.join(PUBLIC_DIR, pathname);
  if (filePath.endsWith('/')) {
    filePath = path.join(filePath, 'index.html');
  }
  if (!filePath.startsWith(PUBLIC_DIR)) {
    sendText(res, 403, 'Forbidden');
    return true;
  }
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = {
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'text/javascript',
      '.json': 'application/json',
      '.png': 'image/png',
      '.svg': 'image/svg+xml',
    }[ext] || 'application/octet-stream';
    const content = fs.readFileSync(filePath);
    res.writeHead(200, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    });
    res.end(content);
    return true;
  }
  return false;
}

function generateArticles(feed, sources) {
  const keywords = feed.keywords
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);
  const topics = keywords.length ? keywords : ['innovation'];
  const sourceNames = sources.length
    ? sources.map((s) => s.name)
    : ['Independent Research'];
  const articles = [];
  for (let i = 0; i < 5; i += 1) {
    const topic = topics[i % topics.length];
    const source = sourceNames[i % sourceNames.length];
    articles.push({
      title: `${feed.name}: ${topic} insight #${i + 1}`,
      summary: `A concise overview of how ${topic} is shaping the ${feed.name} landscape with key takeaways sourced from ${source}.`,
      link: `https://example.com/${feed.id}/${i + 1}`,
      source,
    });
  }
  return articles;
}

const server = http.createServer(async (req, res) => {
  const { method } = req;
  const urlObj = new URL(req.url, `http://${req.headers.host}`);
  const pathname = urlObj.pathname;

  if (method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    });
    res.end();
    return;
  }

  if (pathname.startsWith('/api/')) {
    try {
      if (pathname === '/api/register' && method === 'POST') {
        const body = await parseBody(req);
        const { email, password, name } = body;
        if (!email || !password || !name) {
          sendJson(res, 400, { message: 'Name, email, and password are required.' });
          return;
        }
        const data = readData();
        if (data.users.some((u) => u.email === email)) {
          sendJson(res, 409, { message: 'Email already registered.' });
          return;
        }
        const user = {
          id: randomUUID(),
          email,
          name,
          avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`,
          passwordHash: hashPassword(password),
        };
        data.users.push(user);
        writeData(data);
        const token = createSession(user.id);
        sendJson(res, 201, { token, user: { id: user.id, email, name, avatarUrl: user.avatarUrl } });
        return;
      }

      if (pathname === '/api/login' && method === 'POST') {
        const body = await parseBody(req);
        const { email, password } = body;
        if (!email || !password) {
          sendJson(res, 400, { message: 'Email and password are required.' });
          return;
        }
        const data = readData();
        const user = data.users.find((u) => u.email === email);
        if (!user || !verifyPassword(password, user.passwordHash)) {
          sendJson(res, 401, { message: 'Invalid credentials.' });
          return;
        }
        const token = createSession(user.id);
        sendJson(res, 200, { token, user: { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl } });
        return;
      }

      if (pathname === '/api/logout' && method === 'POST') {
        const auth = getUserFromRequest(req);
        if (!auth) {
          sendJson(res, 401, { message: 'Unauthorized' });
          return;
        }
        destroySession(auth.token);
        sendJson(res, 200, { message: 'Logged out' });
        return;
      }

      if (pathname === '/api/sources' && method === 'GET') {
        const auth = getUserFromRequest(req);
        if (!auth) {
          sendJson(res, 401, { message: 'Unauthorized' });
          return;
        }
        const data = readData();
        const sources = data.sources.filter((s) => s.userId === auth.user.id);
        sendJson(res, 200, { sources });
        return;
      }

      if (pathname === '/api/sources' && method === 'POST') {
        const auth = getUserFromRequest(req);
        if (!auth) {
          sendJson(res, 401, { message: 'Unauthorized' });
          return;
        }
        const body = await parseBody(req);
        const { name, emailAddress } = body;
        if (!name || !emailAddress) {
          sendJson(res, 400, { message: 'Name and email address are required.' });
          return;
        }
        const data = readData();
        const source = { id: randomUUID(), userId: auth.user.id, name, emailAddress };
        data.sources.push(source);
        writeData(data);
        sendJson(res, 201, { source });
        return;
      }

      if (pathname === '/api/feeds' && method === 'GET') {
        const auth = getUserFromRequest(req);
        if (!auth) {
          sendJson(res, 401, { message: 'Unauthorized' });
          return;
        }
        const data = readData();
        const feeds = data.feeds
          .filter((f) => f.userId === auth.user.id)
          .map((feed) => ({ ...feed }));
        sendJson(res, 200, { feeds });
        return;
      }

      if (pathname === '/api/feeds' && method === 'POST') {
        const auth = getUserFromRequest(req);
        if (!auth) {
          sendJson(res, 401, { message: 'Unauthorized' });
          return;
        }
        const body = await parseBody(req);
        const { name, keywords, sourceIds } = body;
        if (!name || !keywords || !Array.isArray(sourceIds) || sourceIds.length === 0) {
          sendJson(res, 400, { message: 'Name, keywords, and at least one source are required.' });
          return;
        }
        const data = readData();
        const ownedSourceIds = data.sources
          .filter((s) => s.userId === auth.user.id)
          .map((s) => s.id);
        const invalid = sourceIds.some((id) => !ownedSourceIds.includes(id));
        if (invalid) {
          sendJson(res, 403, { message: 'One or more sources are invalid.' });
          return;
        }
        const feed = { id: randomUUID(), userId: auth.user.id, name, keywords, sourceIds };
        data.feeds.push(feed);
        writeData(data);
        sendJson(res, 201, { feed });
        return;
      }

      if (pathname.startsWith('/api/feeds/') && method === 'PUT') {
        const auth = getUserFromRequest(req);
        if (!auth) {
          sendJson(res, 401, { message: 'Unauthorized' });
          return;
        }
        const feedId = pathname.split('/')[3];
        const body = await parseBody(req);
        const { name, keywords, sourceIds } = body;
        const data = readData();
        const feed = data.feeds.find((f) => f.id === feedId && f.userId === auth.user.id);
        if (!feed) {
          sendJson(res, 404, { message: 'Feed not found.' });
          return;
        }
        if (name) feed.name = name;
        if (keywords) feed.keywords = keywords;
        if (Array.isArray(sourceIds) && sourceIds.length) feed.sourceIds = sourceIds;
        writeData(data);
        sendJson(res, 200, { feed });
        return;
      }

      if (pathname.startsWith('/api/feeds/') && method === 'DELETE') {
        const auth = getUserFromRequest(req);
        if (!auth) {
          sendJson(res, 401, { message: 'Unauthorized' });
          return;
        }
        const feedId = pathname.split('/')[3];
        const data = readData();
        const feedIndex = data.feeds.findIndex((f) => f.id === feedId && f.userId === auth.user.id);
        if (feedIndex === -1) {
          sendJson(res, 404, { message: 'Feed not found.' });
          return;
        }
        data.feeds.splice(feedIndex, 1);
        writeData(data);
        sendJson(res, 200, { message: 'Feed deleted' });
        return;
      }

      if (pathname.startsWith('/api/feeds/') && pathname.endsWith('/articles') && method === 'GET') {
        const auth = getUserFromRequest(req);
        if (!auth) {
          sendJson(res, 401, { message: 'Unauthorized' });
          return;
        }
        const feedId = pathname.split('/')[3];
        const data = readData();
        const feed = data.feeds.find((f) => f.id === feedId && f.userId === auth.user.id);
        if (!feed) {
          sendJson(res, 404, { message: 'Feed not found.' });
          return;
        }
        const sources = data.sources.filter((s) => feed.sourceIds.includes(s.id));
        const articles = generateArticles(feed, sources);
        sendJson(res, 200, { articles });
        return;
      }

      if (pathname === '/api/scan-email' && method === 'POST') {
        const auth = getUserFromRequest(req);
        if (!auth) {
          sendJson(res, 401, { message: 'Unauthorized' });
          return;
        }
        const suggestions = [
          { name: 'AI Weekly', emailAddress: 'updates@aiweekly.co' },
          { name: 'Startup Digest', emailAddress: 'digest@startup.com' },
          { name: 'Morning Finance', emailAddress: 'newsletter@finance.io' },
        ];
        sendJson(res, 200, { suggestions });
        return;
      }

      sendJson(res, 404, { message: 'Not found' });
    } catch (error) {
      console.error(error);
      sendJson(res, 500, { message: 'Server error', error: error.message });
    }
    return;
  }

  const served = serveStaticFile(req, res, pathname === '/' ? '/index.html' : pathname);
  if (!served) {
    const fallbackPath = path.join(PUBLIC_DIR, 'index.html');
    if (fs.existsSync(fallbackPath)) {
      const content = fs.readFileSync(fallbackPath);
      res.writeHead(200, {
        'Content-Type': 'text/html',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      });
      res.end(content);
    } else {
      sendText(res, 404, 'Not found');
    }
  }
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Newsletter Hub API running on port ${PORT}`);
});
