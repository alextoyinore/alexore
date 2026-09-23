const http = require('http');
const app = require('./src/server');

const server = http.createServer(app);

server.listen(0, async () => {
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`Test server running at ${baseUrl}`);

  let cookie = '';

  async function request(path, options = {}) {
    const url = `${baseUrl}${path}`;
    const headers = options.headers || {};
    if (cookie) {
      headers['Cookie'] = cookie;
    }
    const res = await fetch(url, {
      ...options,
      headers,
      redirect: 'manual'
    });
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) {
      cookie = setCookie.split(';')[0];
    }
    return {
      status: res.status,
      headers: res.headers,
      text: await res.text()
    };
  }

  try {
    console.log('\n--- Testing Public Routes ---');
    const rHome = await request('/');
    console.log(`GET / : ${rHome.status} (length: ${rHome.text.length})`);
    if (rHome.status !== 200) throw new Error('Home failed');

    const rWriting = await request('/writing');
    console.log(`GET /writing : ${rWriting.status}`);
    if (rWriting.status !== 200) throw new Error('/writing failed');

    const rStore = await request('/store');
    console.log(`GET /store : ${rStore.status} (contains "Digital Store": ${rStore.text.includes('Digital') || rStore.text.includes('Store')})`);
    if (rStore.status !== 200) throw new Error('/store failed');

    const rAbout = await request('/about');
    console.log(`GET /about : ${rAbout.status}`);
    if (rAbout.status !== 200) throw new Error('/about failed');

    const rLogin = await request('/auth/login');
    console.log(`GET /auth/login : ${rLogin.status}`);
    if (rLogin.status !== 200) throw new Error('/auth/login failed');

    console.log('\n--- Testing Auth & Admin Access Control ---');
    const rAdminNoAuth = await request('/admin');
    console.log(`GET /admin without auth : ${rAdminNoAuth.status} (redirect to login)`);
    if (rAdminNoAuth.status !== 302) throw new Error('/admin should redirect when not logged in');

    // Login
    const rDoLogin = await request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        username: 'admin',
        password: process.env.ADMIN_PASSWORD || 'alexore2026!'
      })
    });
    console.log(`POST /auth/login : ${rDoLogin.status} (redirected to ${rDoLogin.headers.get('location')})`);
    if (rDoLogin.status !== 302) throw new Error('Login failed');

    console.log('\n--- Testing Admin Routes With Auth ---');
    const rAdminDash = await request('/admin');
    console.log(`GET /admin : ${rAdminDash.status}`);
    if (rAdminDash.status !== 200) throw new Error('/admin failed');

    const rAdminPosts = await request('/admin/posts');
    console.log(`GET /admin/posts : ${rAdminPosts.status}`);
    if (rAdminPosts.status !== 200) throw new Error('/admin/posts failed');

    const rAdminNewPost = await request('/admin/new');
    console.log(`GET /admin/new : ${rAdminNewPost.status}`);
    if (rAdminNewPost.status !== 200) throw new Error('/admin/new failed');

    const rAdminProducts = await request('/admin/products');
    console.log(`GET /admin/products : ${rAdminProducts.status}`);
    if (rAdminProducts.status !== 200) throw new Error('/admin/products failed');

    const rAdminNewProd = await request('/admin/products/new');
    console.log(`GET /admin/products/new : ${rAdminNewProd.status}`);
    if (rAdminNewProd.status !== 200) throw new Error('/admin/products/new failed');

    // Test creating a product
    console.log('\n--- Testing Product Creation ---');
    const rCreateProd = await request('/admin/products/new', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        title: 'Solopreneur OS Template',
        slug: 'solopreneur-os-template',
        creator_name: 'Alex Ore',
        category: 'Templates',
        price: '29',
        original_price: '49',
        currency: 'USD',
        external_store_name: 'Selar',
        external_store_url: 'https://selar.co/sample-product',
        badge: 'Best Seller',
        status: 'published',
        featured: 'on',
        tagline: 'Complete Notion workspace for solo creators.',
        description: 'Organize your entire content pipeline, digital products, and revenue in one system.'
      })
    });
    console.log(`POST /admin/products/new : ${rCreateProd.status} (redirected to: ${rCreateProd.headers.get('location')})`);

    // Verify product on store page
    const rStoreAfter = await request('/store');
    console.log(`GET /store after create : ${rStoreAfter.status} (contains "Solopreneur OS Template": ${rStoreAfter.text.includes('Solopreneur OS Template')})`);

    // Verify product detail page
    const rProdDetail = await request('/store/solopreneur-os-template');
    console.log(`GET /store/solopreneur-os-template : ${rProdDetail.status} (contains "Selar": ${rProdDetail.text.includes('Selar')})`);

    // Verify product buy redirect and click tracking
    const rProdBuy = await request('/store/solopreneur-os-template/buy');
    console.log(`GET /store/solopreneur-os-template/buy : ${rProdBuy.status} (redirects to: ${rProdBuy.headers.get('location')})`);

    console.log('\n--- Testing Remaining Admin Pages ---');
    const pages = [
      '/admin/comments',
      '/admin/subscribers',
      '/admin/send-email',
      '/admin/topics',
      '/admin/about',
      '/admin/legal',
      '/admin/legal/terms/edit',
      '/admin/resources',
      '/admin/settings'
    ];

    for (const p of pages) {
      const res = await request(p);
      console.log(`GET ${p} : ${res.status}`);
      if (res.status !== 200) throw new Error(`Failed on ${p}`);
    }

    console.log('\n✅ ALL TEST PASSED SUCCESSFULLY!');
  } catch (err) {
    console.error('\n❌ TEST FAILED:', err);
    process.exitCode = 1;
  } finally {
    server.close();
  }
});
