// Browser regressions for radio groups, locked grading and the Anki review flow.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const {execFileSync} = require('node:child_process');
const {chromium, webkit, devices} = require('playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(root, '_site');

async function main() {
  let server;
  let base = process.env.TEST_BASE_URL;
  if (!base) {
    execFileSync('python3', ['scripts/build.py'], {cwd:root, stdio:'inherit'});
    const mime = {'.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.svg':'image/svg+xml'};
    server = http.createServer((request,response) => {
      const pathname = decodeURIComponent(new URL(request.url,'http://localhost').pathname);
      const relative = pathname.replace(/^\/lukes-english\//,'');
      const file = path.resolve(output, relative || 'index.html');
      if (!file.startsWith(output+path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
        response.writeHead(404);response.end();return;
      }
      response.writeHead(200, {'Content-Type':mime[path.extname(file)] || 'application/octet-stream'});
      fs.createReadStream(file).pipe(response);
    });
    await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
    base = `http://127.0.0.1:${server.address().port}/lukes-english/`;
  }
  const engines = process.env.TEST_ENGINES ? process.env.TEST_ENGINES.split(',') : ['chromium','webkit'];
  try {
    for (const engine of engines) {
      const launch = {headless:true};
      if (engine === 'chromium' && process.env.TEST_CHROME_PATH) launch.executablePath = process.env.TEST_CHROME_PATH;
      const browser = await ({chromium,webkit}[engine]).launch(launch);
      try {
        const context = await browser.newContext({...devices['iPhone 13'],colorScheme:'dark'});
        if (engine === 'chromium') await context.grantPermissions(['clipboard-read','clipboard-write']);
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror',error=>errors.push(error.message));
        page.on('response',response=>{if(response.status()>=400)errors.push(`${response.status()} ${response.url()}`)});
        const catalog = await (await context.request.get(base+'assets/catalog.json')).json();
        const tests = catalog.groups.flatMap(group=>group.resources).filter(resource=>resource.ankiReview);
        assert.equal(tests.length,11);
        await page.goto(base+'?v='+catalog.build);
        await page.locator('.group-card').first().waitFor();
        assert((await page.locator('.resource-link[href*="study.html"]').first().getAttribute('href')).includes('v='+catalog.build));
        for (const test of tests.filter(test=>!process.env.TEST_PATH_FILTER || test.path.includes(process.env.TEST_PATH_FILTER))) {
          const rawURL = base+test.path.split('/').map(encodeURIComponent).join('/')+'?v='+catalog.build;
          await page.goto(rawURL);
          await page.locator('#anki-review').waitFor({state:'visible'});
          assert((await page.locator('script[src*="review.js"]').getAttribute('src')).endsWith('v='+catalog.build));
          assert(await page.locator('#anki-copy').isVisible(),'Copy action must be discoverable before grading');
          assert(await page.locator('#anki-copy').isDisabled());
          const data = await page.evaluate(()=>Q);
          const groups = data.flatMap((question,index)=>(question.sides||[question]).map((part,side)=>({
            name:question.sides?`q${index}s${side}`:`q${index}`, index, side, part
          })));
          const names = await page.locator('input[type=radio]').evaluateAll(inputs=>inputs.map(input=>input.name));
          assert.equal(new Set(names).size,groups.length,'Radio names must be unique per question/half');
          for(const group of groups) assert.equal(names.filter(name=>name===group.name).length,group.part.o.length);
          const baseline = test.path.includes('Homework');
          if (baseline) {
            // The exact adjacent repeated answer reported on iPhone.
            await page.locator('#q6 .answer-option').filter({hasText:'(nothing)'}).tap();
            await page.locator('#q7 .answer-option').filter({hasText:'(nothing)'}).tap();
            assert(await page.locator('input[name=q6][value="3"]').isChecked());
            assert(await page.locator('input[name=q7][value="0"]').isChecked());
          } else {
            const first = groups.find(group=>group.index===0);
            const second = groups.find(group=>group.index===1);
            let firstPick=(first.part.a+1)%first.part.o.length;
            let secondPick=second.part.o.indexOf(first.part.o[firstPick]);
            if(secondPick<0)secondPick=0;
            await page.locator(`input[name="${first.name}"][value="${firstPick}"]`).locator('..').tap();
            await page.locator(`input[name="${second.name}"][value="${secondPick}"]`).locator('..').tap();
            assert(await page.locator(`input[name="${first.name}"][value="${firstPick}"]`).isChecked(),'Next answer cleared the previous question');
          }
          // Fill the remaining groups and verify all recorded choices survive grading.
          const before = await page.evaluate(()=>{
            Q.forEach((question,index)=>(question.sides||[question]).forEach((part,side)=>{
              const name=question.sides?`q${index}s${side}`:`q${index}`;
              if(!document.querySelector(`input[name="${name}"]:checked`)) document.querySelector(`input[name="${name}"][value="${part.a}"]`).click();
            }));
            return [...document.querySelectorAll('input[type=radio]:checked')].map(input=>({name:input.name,value:input.value}));
          });
          await page.locator('#submit').tap();
          assert.deepEqual(await choices(page),before,'Grading changed selected radios');
          const expected = data.filter((question,index)=>(question.sides||[question]).every((part,side)=>{
            const name=question.sides?`q${index}s${side}`:`q${index}`;
            return Number(before.find(input=>input.name===name).value)===part.a;
          })).length;
          assert.match(await page.locator('#score').textContent(),new RegExp(`${expected}\\s*/\\s*20`));
          assert.equal(await page.locator('input[type=radio]:enabled').count(),0,'Graded answers must stay locked');
          assert.equal(await page.locator('.anki-include').count(),20);
          assert.equal(await page.locator('.anki-include:checked').count(),20-expected);
          if (baseline) {
            assert.equal(expected,19);
            assert.match(await page.locator('#q6 .note').textContent(),/Správná odpověď: a/);
            assert.match(await page.locator('#q7 .note').textContent(),/Správná odpověď: \(nothing\)/);
            // Tap another label after submission: neither the choice nor the review can disappear.
            const label=page.locator('#q6 .answer-option').nth(2);
            await label.scrollIntoViewIfNeeded();
            const box=await label.boundingBox();
            await page.touchscreen.tap(box.x+box.width/2,box.y+box.height/2);
            assert.deepEqual(await choices(page),before);
            assert.equal(await page.locator('.anki-include').count(),20);
          }
          const wrong = await page.locator('.anki-include:checked').first().getAttribute('data-anki-question');
          const right = await page.locator('.anki-include:not(:checked)').first().getAttribute('data-anki-question');
          await page.locator(`.anki-include[data-anki-question="${right}"]`).locator('..').tap();
          const selected = await page.locator('.anki-include:checked').evaluateAll(inputs=>inputs.map(input=>Number(input.dataset.ankiQuestion)+1).sort((a,b)=>a-b));
          assert(selected.includes(Number(wrong)+1));
          // Copy creates the current prompt directly, without a separate Generate click.
          await page.locator('#anki-copy').tap();
          assert(await page.locator('#anki-prompt').isVisible());
          const prompt = await page.locator('#anki-prompt').inputValue();
          const exported=JSON.parse(prompt.slice(prompt.indexOf('[\n')));
          assert.deepEqual(exported.map(question=>question.číslo_otázky),selected);
          if(engine==='chromium') assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),prompt);
          assert.deepEqual(await choices(page),before,'Review checkbox changed quiz answers');
          if(process.env.TEST_SCREENSHOTS && baseline) {
            await page.locator('#q6').screenshot({path:path.join(process.env.TEST_SCREENSHOTS,`${engine}-question.png`)});
            await page.locator('#anki-review').screenshot({path:path.join(process.env.TEST_SCREENSHOTS,`${engine}-review.png`)});
          }
          await page.locator('#reset').tap();
          assert.equal(await page.locator('input[type=radio]:checked').count(),0);
          assert.equal(await page.locator('input[type=radio]:disabled').count(),0);
          assert.equal(await page.locator('.anki-include').count(),0);
          assert(await page.locator('#anki-copy').isDisabled());
          assert.equal(await page.locator('.wrongpick,.wrong,.correct').count(),0,'Retake kept stale answer colors');
          if (baseline) {
            await page.evaluate(()=>Q.forEach((question,index)=>document.querySelector(`input[name="q${index}"][value="${question.a}"]`).click()));
            await page.locator('#submit').tap();
            assert.match(await page.locator('#score').textContent(),/20\s*\/\s*20/);
            assert.equal(await page.locator('.wrongpick').count(),0);
            assert.equal(await page.locator('.anki-include:checked').count(),0);
          }
          console.log(`PASS ${engine}: ${test.path}`);
        }
        // Sentence exercises export manually selected material without inventing user mistakes.
        const lessonOne = catalog.groups.find(group=>group.id==='lessons/2026-11-02');
        const exercise = lessonOne.resources.find(resource=>resource.path.endsWith('Homework - 3 Exercise.html'));
        await page.goto(base+exercise.path.split('/').map(encodeURIComponent).join('/')+'?v='+catalog.build);
        const cards = page.locator('[data-anki-exercise] .it');
        assert.equal(await cards.count(),53);
        assert.equal(await page.locator('.anki-include').count(),53);
        assert.equal(await page.locator('.anki-include:checked').count(),0);
        assert(await page.locator('#anki-copy').isDisabled());
        for (let index=0;index<53;index++) assert(!(await cards.nth(index).locator('.k').isVisible()));
        for (const index of [0,24,49,52]) {
          const card=cards.nth(index);
          await card.locator('summary').tap();
          assert(await card.locator('.k').isVisible());
          await card.locator('summary').tap();
          assert(!(await card.locator('.k').isVisible()));
          await card.locator('.anki-question-choice').tap();
        }
        await cards.nth(0).locator('summary').tap();
        assert.equal(await page.locator('.anki-include:checked').count(),4,'Reveal must preserve selection');
        await page.locator('#anki-copy').tap();
        const exercisePrompt = await page.locator('#anki-prompt').inputValue();
        const exerciseData = JSON.parse(exercisePrompt.slice(exercisePrompt.indexOf('[\n')));
        assert.deepEqual(exerciseData.map(item=>item.číslo_otázky),[1,25,50,'L3']);
        assert.equal(exerciseData[0].zadání,'Kolik času ti to zabere?');
        assert.equal(exerciseData[0].správná_věta,'How much time will it take you?');
        assert.deepEqual(exerciseData[0].jazykový_cíl,['Kolik času']);
        assert.equal(exerciseData[3].správná_věta,'She checks his English, he checks her Scala.');
        assert(exerciseData.every(item=>item.výsledek.includes('vlastní odpověď ani její hodnocení nejsou zaznamenány')));
        assert(exercisePrompt.includes('nikoli doklad mé chyby'));
        assert.equal(new Set(exerciseData.map(item=>item.identifikátor_dokladu)).size,4);
        if(engine==='chromium') assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),exercisePrompt);
        // Generated prompts track deselection and preserve identifiers for remaining entries.
        await cards.nth(24).locator('.anki-question-choice').tap();
        const updated = await page.locator('#anki-prompt').inputValue();
        const updatedData = JSON.parse(updated.slice(updated.indexOf('[\n')));
        assert.deepEqual(updatedData.map(item=>item.číslo_otázky),[1,50,'L3']);
        assert.equal(updatedData[0].identifikátor_dokladu,exerciseData[0].identifikátor_dokladu);
        await page.locator('#anki-mistakes').tap();
        assert.equal(await page.locator('.anki-include:checked').count(),53);
        await page.locator('#anki-clear').tap();
        assert.equal(await page.locator('.anki-include:checked').count(),0);
        assert(await page.locator('#anki-copy').isDisabled());
        assert(!(await page.locator('#anki-output').isVisible()));
        assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
        await page.goto(base+'study.html?file='+encodeURIComponent(exercise.path)+'&v='+catalog.build);
        await page.frameLocator('iframe').locator('.anki-question-choice').first().tap();
        await page.frameLocator('iframe').locator('#anki-copy').tap();
        assert((await page.frameLocator('iframe').locator('#anki-prompt').inputValue()).includes('How much time'));
        console.log(`PASS ${engine}: sentence answer reveals, manual Anki selection, prompt updates, copying and iframe`);
        // Check the same feature in the library's iframe and follow its test-to-test links.
        const conditional=tests.find(test=>test.path.includes('conditionals'));
        await page.goto(base+'study.html?file='+encodeURIComponent(conditional.path)+'&v='+catalog.build);
        await page.frameLocator('iframe').locator('#anki-review').waitFor({state:'visible'});
        await page.frameLocator('iframe').getByRole('link',{name:'Test 2',exact:true}).tap();
        await page.waitForFunction(()=>document.getElementById('resource-title').textContent==='Test 2');
        assert(await page.locator('#resource-picker').isVisible());
        assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
        assert.deepEqual(errors,[]);
        await context.close();
      } finally { await browser.close(); }
    }
  } finally { if(server) await new Promise(resolve=>server.close(resolve)); }
}
async function choices(page){return page.locator('input[type=radio]:checked').evaluateAll(inputs=>inputs.map(input=>({name:input.name,value:input.value})));}
main().catch(error=>{console.error(error);process.exitCode=1});
