const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require(process.env.QA_PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const evidence = [];
const key = '1234'; // Test fixture only; the production PIN is entered by its owner.

async function openPage(browser, filename, width = 360) {
    const page = await browser.newPage({viewport: {width, height: 800}});
    await page.route('**/*', route => route.abort());
    page.on('dialog', dialog => dialog.dismiss());
    await page.setContent(fs.readFileSync(path.join(root, filename), 'utf8'));
    return page;
}

(async () => {
    const browser = await chromium.launch({headless: true});
    try {
        for (const width of [360, 390]) {
            const page = await openPage(browser, 'admin.html', width);
            await page.evaluate(token => {
                window.qaRequests = [];
                window.fetch = async (url, options) => {
                    window.qaRequests.push({url, method: options.method, body: options.body.toString()});
                    return {ok: true, text: async () => JSON.stringify({result: 'success', data: [{
                        timestamp: '2026-10-07 13:29:00', inviter: '송재용', inviterPhone: '1086123392',
                        invitee: '김철수', inviteePhone: '01012345678', day: '10.14(수)',
                        time: '오후 2부 (6:00 말씀 이후)', church: '기쁜소식부산대연교회', note: '쉼표, 줄바꿈\n둘째 줄'
                    }]})};
                };
                document.getElementById('pwInput').value = token;
            }, key);
            await page.evaluate(() => checkAuth());
            assert.equal(await page.locator('#authModal').isVisible(), false);
            const request = await page.evaluate(() => window.qaRequests[0]);
            assert.equal(request.method, 'POST');
            assert.equal(new URLSearchParams(request.body).get('admin_token'), key);
            assert.equal(request.url.includes(key), false);
            assert.deepEqual(await page.locator('[href^="tel:"]').evaluateAll(nodes => nodes.map(n => n.getAttribute('href'))), ['tel:01086123392']);
            assert.equal(await page.locator('.note-box').innerText().then(text => text.includes('\n둘째 줄')), true);
            assert.equal(await page.locator('.church-line').innerText(), '소속 교회: 기쁜소식부산대연교회');
            await page.locator('#searchInput').fill('부산대연');
            assert.equal(await page.locator('.applicant-card').count(), 1);
            await page.locator('#searchInput').fill('010-8612');
            assert.equal(await page.locator('.applicant-card').count(), 1);
            await page.locator('#searchInput').fill('');
            await page.evaluate(() => {
                allApplicants[0].inviter = '가'.repeat(80);
                allApplicants[0].invitee = '나'.repeat(80);
                allApplicants[0].church = '교'.repeat(100);
                filterData();
            });
            const dimensions = await page.evaluate(() => ({scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth}));
            assert.equal(dimensions.scroll, dimensions.client);
            await page.evaluate(() => {
                const payload = '<img src=x onerror="window.qaXss=1">';
                allApplicants[0].inviter = payload;
                allApplicants[0].invitee = payload;
                allApplicants[0].note = payload;
                allApplicants[0].church = payload;
                allApplicants[0].day = payload;
                allApplicants[0].time = payload;
                allApplicants[0].timestamp = payload;
                filterData();
            });
            assert.equal(await page.locator('.applicant-card img').count(), 0);
            assert.equal(await page.evaluate(() => window.qaXss === 1), false);
            // Logout while a previous response is still pending must not restore personal data.
            await page.evaluate(() => {
                window.fetch = () => new Promise(resolve => {window.qaResolve = resolve;});
                window.qaPending = fetchData();
                logout();
                window.qaResolve({ok: true, text: async () => JSON.stringify({result: 'success', data: [{inviter: '늦은 응답'}]})});
            });
            await page.evaluate(() => window.qaPending);
            assert.equal(await page.locator('.applicant-card').count(), 0);
            assert.equal(await page.locator('#authModal').isVisible(), true);
            evidence.push({width, contact: 'inviter only', longNameOverflow: false, xss: false, staleResponseAfterLogout: 'blocked'});
            await page.close();
        }

        for (const filename of ['index.html', 'counseling-apply.html']) {
            for (const scenario of ['success', '500', 'HTML', 'network', 'timeout', 'invalid-phone']) {
                const page = await openPage(browser, filename);
                await page.evaluate(mode => {
                    window.qaPosts = 0;
                    window.fetch = async (_url, options) => {
                        window.qaPosts++;
                        window.qaChurch = options.body.get('church');
                        if (mode === 'network') throw new TypeError('Network unavailable');
                        if (mode === 'timeout') {
                            return new Promise((_, reject) => options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError'))));
                        }
                        return {ok: mode !== '500', text: async () => mode === 'HTML' ? '<html>error</html>' : JSON.stringify({result: 'success'})};
                    };
                    if (mode === 'timeout') {
                        const original = window.setTimeout;
                        window.setTimeout = (callback, ms) => original(callback, ms === 20000 ? 10 : ms);
                    }
                    document.getElementById('church').value = '  기쁜소식부산대연교회  ';
                    document.getElementById('inviter').value = '송재용';
                    document.getElementById('invitee').value = '김철수';
                    document.getElementById('day').value = 'wed';
                    document.getElementById('time').value = 'am';
                    if (mode === 'invalid-phone') document.getElementById('inviter_phone').value = '010-8612-3392 / 010-1234-5678';
                    document.getElementById('counselingForm').requestSubmit();
                }, scenario);
                await page.waitForFunction(() => !document.getElementById('submitBtn').disabled);
                assert.equal(await page.locator('#statusMessage').isVisible(), true);
                const successful = scenario === 'success';
                assert.equal(await page.locator('#inviter').inputValue(), successful ? '' : '송재용');
                assert.equal(await page.locator('#church').inputValue(), successful ? '' : '  기쁜소식부산대연교회  ');
                if (scenario !== 'invalid-phone') assert.equal(await page.evaluate(() => window.qaChurch), '기쁜소식부산대연교회');
                assert.equal(await page.locator('#statusMessage').getAttribute('class'), successful ? 'status-message success' : 'status-message error');
                assert.equal(await page.evaluate(() => window.qaPosts), scenario === 'invalid-phone' ? 0 : 1);
                evidence.push({filename, scenario, bannerVisible: true, inputPreservedOnError: !successful});
                await page.close();
            }
        }
        console.log(JSON.stringify(evidence, null, 2));
        if (process.env.QA_EVIDENCE_PATH) fs.writeFileSync(process.env.QA_EVIDENCE_PATH, JSON.stringify(evidence, null, 2));
    } finally {
        await browser.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
