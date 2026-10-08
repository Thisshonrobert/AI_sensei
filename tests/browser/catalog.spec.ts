import { test, expect } from '@playwright/test';

test('reference navigation, item provenance, source return, keyboard and mobile wrapping', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'A little Japanese, every day.' })).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  for (const kind of ['Vocabulary', 'Kanji', 'Grammar']) {
    await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: kind, exact: true }).click();
    await expect(page.getByRole('heading', { name: kind, exact: true })).toBeVisible();
    const item = page.locator('[data-item-link]').first();
    await expect(item).toBeVisible();
    await item.click();
    await expect(page).toHaveURL(new RegExp(`/${kind.toLowerCase()}/[0-9a-f-]+$`));
    const firstUrl=page.url();
    const navigation=page.getByRole('navigation',{name:'Entry navigation'});
    await expect(navigation.getByRole('button',{name:'Previous entry',exact:true})).toBeDisabled();
    const next=navigation.getByRole('link',{name:'Next entry',exact:true});
    const nextHref=await next.getAttribute('href');
    await next.focus();await page.keyboard.press('Enter');
    await expect(page).toHaveURL(new URL(nextHref!,firstUrl).href);
    await page.reload();
    await page.getByRole('navigation',{name:'Entry navigation'}).getByRole('link',{name:'Previous entry',exact:true}).click();
    await expect(page).toHaveURL(firstUrl);
    await page.setViewportSize({width:375,height:812});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:`.local/detail-${kind.toLowerCase()}-mobile.png`,fullPage:true});
    await page.setViewportSize({width:1280,height:800});
    const evidence=page.locator('.source-disclosure');
    await expect(evidence).not.toHaveAttribute('open');
    await evidence.locator('summary').first().click();
    const record=evidence.locator('.inline-evidence').filter({hasText:'Accepted without PDF comparison'}).first();
    await record.locator('summary').first().click();
    await expect(record.locator('[data-evidence-record]').first()).toBeVisible();
    await expect(record.getByText('Accepted without PDF comparison', { exact: true }).first()).toBeVisible();
    const citationLink = record.locator('[data-source-link]').first();
    const citationUrl = await citationLink.getAttribute('href');
    await citationLink.click();
    await expect(page.getByRole('heading', { name: 'Source records' })).toBeVisible();
    await expect(page.locator('[data-item-link]').first()).toBeVisible();
    expect(new URL(page.url()).searchParams.get('record')).toBe(new URL(citationUrl!, 'http://127.0.0.1:3000').searchParams.get('record'));
    await expect(page.locator('.source-record')).toHaveCount(1);
    await page.reload();await expect(page.locator('.source-record')).toHaveCount(1);
    await page.setViewportSize({ width: 375, height: 812 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
    await page.setViewportSize({ width: 1280, height: 800 });
  }
  await page.goto('/kanji');await page.locator('[data-item-link]').first().click();
  await page.locator('.source-disclosure > summary').click();
  const dictionaryEvidence=page.locator('.source-disclosure .inline-evidence').filter({hasText:'Dictionary · curated'}).first();
  await dictionaryEvidence.locator('summary').first().click();
  await expect(page.getByText('Dictionary · curated', { exact: true }).first()).toBeVisible();
  await page.goto('/grammar');await page.locator('[data-item-link]').first().click();
  await expect(page.getByText('Generated', { exact: true }).first()).toBeVisible();
  const grammarSource = (await page.locator('[data-source-link]').first().getAttribute('href'))!.split('?')[0];
  await page.goto(grammarSource);
  await expect(page.getByRole('navigation', { name: 'Pagination' })).toBeVisible();
  const unresolvedQuestion = page.locator('[data-question-deferral]').first();
  for (let i = 0; i < 10 && await unresolvedQuestion.count() === 0; i++) {
    const next = page.getByRole('link', { name: 'Next →', exact: true });
    if (await next.count() === 0) break;
    await next.click();
    await expect(page.getByRole('navigation', { name: 'Pagination' })).toContainText(`Page ${i + 2}`);
  }
  await expect(unresolvedQuestion).toBeVisible();
  await expect(unresolvedQuestion).toContainText('Grammar connections intentionally deferred');
  await expect(page.locator('[data-source-answer-text]').first()).not.toBeEmpty();
  await expect(page.getByText('Reference only · connections deferred', { exact: true }).first()).toBeVisible();
  await page.goto('/grammar?query=__no_such_pattern__');
  await expect(page.getByText('No matching entries.')).toBeVisible();
  await page.goto('/grammar?query=one&query=two');
  await expect(page.getByRole('heading', { name: 'Grammar', exact: true })).toBeVisible();
  await page.goto('/vocabulary/not-a-uuid');
  await expect(page.getByRole('heading', { name: 'Entry not found' })).toBeVisible();
  const response = await page.request.get('/private-data/imports/review-20261005/grammar-dry-run.json');
  expect(response.status()).toBe(404);
});

test('accepted supplemental meanings and name readings visibly identify AI assistance', async ({page}) => {
  test.setTimeout(120_000);
  for (const kind of ['kanji','grammar']) {
    await page.goto(`/${kind}`);
    const links=await page.locator('[data-item-link]').evaluateAll(elements=>elements.map(element=>element.getAttribute('href')!));
    let found=false;
    for (const href of links) {
      await page.goto(href);
      if (await page.locator('[data-ai-addition]').count()) {
        await expect(page.locator('[data-ai-addition]').first()).toHaveText('Added by AI');
        await expect(page.locator('[data-content-id] [data-ai-limitations]')).toHaveCount(0);
        found=true;break;
      }
    }
    expect(found).toBeTruthy();
  }
});

test('all grammar points show their generated English explanation prominently', async ({page}) => {
  await page.goto('/grammar');
  await expect(page.locator('[data-item-link]')).toHaveCount(10);
  const links = await page.locator('[data-item-link]').evaluateAll(elements => elements.map(element => element.getAttribute('href')!));
  for (const href of links) {
    await page.goto(href);
    const explanation = page.locator('[data-english-explanation]');
    await expect(explanation).toBeVisible();
    await expect(explanation.getByText('English explanation', {exact:true})).toBeVisible();
    await expect(explanation.getByText('Generated', {exact:true})).toBeVisible();
    await expect(explanation.locator('[data-explanation-text]')).toBeVisible();
    expect((await explanation.locator('[data-explanation-text]').textContent())!.trim().length).toBeGreaterThan(40);
    await expect(page.getByText('Book English explanation', {exact:true})).toHaveCount(0);
  }
});

test('all kanji show complete local mnemonics and unique words with readings, without per-word evidence', async ({page}) => {
  test.setTimeout(300_000);
  await page.goto('/kanji');
  await expect(page.locator('[data-item-link]')).toHaveCount(38);
  const links = await page.locator('[data-item-link]').evaluateAll(elements => elements.map(element => element.getAttribute('href')!));
  for (const href of links) {
    await page.goto(href);
    const reference = page.locator('.content-block > [data-wanikani-reference]');
    await expect(reference).toBeVisible();
    await expect(reference.getByText('Radical combination', {exact:true})).toBeVisible();
    await expect(reference.getByText('Meaning mnemonic', {exact:true})).toBeVisible();
    expect((await reference.locator('.mnemonic').textContent())!.length).toBeGreaterThan(100);
    await expect(reference.getByRole('link', {name:'WaniKani',exact:true})).toHaveAttribute('href', /^https:\/\/www\.wanikani\.com\/kanji\//);
    await expect(page.getByText('Only an excerpt is stored; the rest is unavailable locally.')).toHaveCount(0);
    const words=page.locator('.content-block').filter({has:page.locator(':scope > .sentence')});
    const written=await words.locator(':scope > .sentence').allTextContents();
    expect(new Set(written).size).toBe(written.length);
    for(const word of await words.all()) await expect(word.locator(':scope > .reading')).not.toBeEmpty();
    await expect(words.getByText('Meaning evidence',{exact:true})).toHaveCount(0);
    await expect(words.getByText('Sources & evidence',{exact:true})).toHaveCount(0);
  }
});

test('vocabulary count distinguishes textbook entries from kanji context words',async({page})=>{
  await page.goto('/vocabulary');
  await expect(page.locator('.catalog-actions')).toContainText('145 entries · 108 textbook vocabulary + 37 kanji context words');
});
