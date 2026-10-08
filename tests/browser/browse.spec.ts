import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';

test('supplementary vocabulary tiles use approved current readings and retain ivory mobile layout', async ({page})=>{
 test.skip(!process.env.REVIEW_BROWSER_TEST,'Requires isolated synthetic database');
 const db=new PrismaClient({datasourceUrl:process.env.REVIEW_TEST_URL});
 try {
  const word=await db.vocabulary.findFirstOrThrow({include:{item:true}});
  const payload={kind:'vocabularyComponentAid',itemRevision:word.item.revision,word:word.writtenForm,reading:word.reading,components:[{text:'設',reading:'せっ',meanings:['Synthetic establish'],readingType:'contextual',note:'Synthetic contextual sound change.'},{text:'定める',reading:'さだめる',meanings:['Synthetic determine'],readingType:'dictionary_form'}]};
  for(const [status,p] of [['approved',payload],['draft',{...payload,components:[{text:'未',reading:'み',meanings:['DRAFT_TILE'],readingType:'contextual'}]}],['approved',{...payload,itemRevision:word.item.revision+1,components:[{text:'旧',reading:'きゅう',meanings:['STALE_TILE'],readingType:'contextual'}]}]] as const){
   await db.$transaction(async tx=>{
    const c=await tx.content.create({data:{kind:'explanation',origin:'generated',status,revision:1,payloadJson:p}});
    await tx.contentItem.create({data:{contentId:c.id,itemId:word.itemId,role:'support'}});
   });
  }
  const before=createHash('sha256').update(JSON.stringify(await db.card.findMany({orderBy:{id:'asc'}}))).digest('hex');
  await page.goto(`/vocabulary/${word.itemId}`);
  const tiles=page.locator('.vocabulary-kanji-tiles');
  await expect(tiles.getByText('せっ',{exact:true})).toBeVisible();
  await expect(tiles.getByText('さだめる',{exact:true})).toBeVisible();
  await expect(tiles).not.toContainText('Dictionary form');
  await expect(tiles).not.toContainText('Synthetic contextual sound change.');
  await expect(page.getByText('Supplementary component study aid',{exact:true})).toHaveCount(0);
  await expect(tiles).not.toContainText('DRAFT_TILE');await expect(tiles).not.toContainText('STALE_TILE');
  await page.setViewportSize({width:375,height:812});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:'.local/components-mobile.png',fullPage:true});
  await page.goto(`/vocabulary/flashcards?query=${encodeURIComponent(word.writtenForm)}`);
  await page.getByRole('button',{name:'Flip card',exact:true}).focus();await page.keyboard.press('Space');
  await expect(page.locator('.browse-face .vocabulary-kanji-tiles').getByText('せっ',{exact:true})).toBeVisible();
  await page.reload();await expect(page.getByRole('region',{name:'Card back'})).toHaveCount(0);
  expect(createHash('sha256').update(JSON.stringify(await db.card.findMany({orderBy:{id:'asc'}}))).digest('hex')).toBe(before);
 }finally{await db.$disconnect();}
});

test('read-only flashcards: keyboard flip, navigation, mobile and unchanged learner state', async ({page}) => {
  test.skip(!process.env.REVIEW_BROWSER_TEST, 'Requires isolated synthetic database');
  const db = new PrismaClient({datasourceUrl: process.env.REVIEW_TEST_URL});
  const fingerprint = async () => createHash('sha256').update(JSON.stringify(await Promise.all([
    db.card.findMany({orderBy:{id:'asc'}}), db.userItem.findMany({orderBy:{itemId:'asc'}}),
    db.studySession.findMany({orderBy:{id:'asc'}}), db.sessionItem.findMany({orderBy:[{sessionId:'asc'},{itemId:'asc'},{role:'asc'}]}),
    db.attempt.findMany({orderBy:{id:'asc'}}), db.reviewLog.findMany({orderBy:{id:'asc'}}),
  ]))).digest('hex');
  try {
    const kanji=await db.kanji.findFirstOrThrow();
    const book=await db.source.findFirstOrThrow({where:{sourceType:'book'}});
    for(const word of ['合成語一','合成語二']) await db.$transaction(async tx=>{
      const content=await tx.content.create({data:{kind:'sentence',origin:'book',status:'approved',revision:1,payloadJson:{japanese:word,reading:'ごうせいご',meanings:['Synthetic example'],sourceWord:true}}});
      await tx.sourceEntry.create({data:{sourceId:book.id,contentId:content.id,sourceRecordKey:`synthetic/${randomUUID()}`,revision:1,originalPayloadJson:{synthetic:true},fieldPresenceJson:{},verificationStatus:'verified',verifiedAt:new Date()}});
      await tx.contentItem.create({data:{contentId:content.id,itemId:kanji.itemId,role:'support'}});
    });
    const before = await fingerprint();
    const mutations: string[] = [];
    page.on('request', r => { if (r.method() !== 'GET') mutations.push(r.url()); });
    for (const kind of ['vocabulary','kanji']) {
      await page.goto(`/${kind}`);
      await page.getByRole('link', {name:'Browse flashcards',exact:true}).click();
      const position = page.getByRole('status').filter({hasText:/Card \d+ of/});
      await expect(position).toContainText('Card 1 of');
      await expect(page.getByRole('region',{name:'Card front'})).toBeVisible();
      await expect(page.getByRole('region',{name:'Card back'})).toHaveCount(0);
      const flip = page.getByRole('button',{name:'Flip card',exact:true});
      await flip.focus(); await page.keyboard.press('Space');
      await expect(page.getByRole('region',{name:'Card back'})).toBeVisible();
      await expect(flip).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(page.getByRole('region',{name:'Card front'})).toBeVisible();
      await expect(page.getByRole('button',{name:'Previous card',exact:true})).toBeDisabled();
      if (kind === 'vocabulary') {
        await page.getByRole('button',{name:'Next card',exact:true}).click();
        await expect(position).toContainText('Card 2 of');
        await expect(page.getByRole('button',{name:'Next card',exact:true})).toBeFocused();
        await expect(page.getByRole('region',{name:'Card front'})).toBeVisible();
        await page.reload(); await expect(position).toContainText('Card 2 of');
        await page.getByRole('button',{name:'Previous card',exact:true}).click();
        await expect(position).toContainText('Card 1 of');
        await expect(page.getByRole('button',{name:'Flip card',exact:true})).toBeFocused();
      }
      await page.setViewportSize({width:375,height:812});
      await page.emulateMedia({reducedMotion:'reduce'});
      await page.locator('.browse-card').click();
      await expect(page.getByRole('region',{name:'Card back'})).toBeVisible();
      await expect(page.getByRole('region',{name:'Card back'}).getByRole('heading',{level:2})).toBeVisible();
      await expect(page.locator('.browse-face').getByText('Sources & evidence',{exact:true})).toHaveCount(0);
      await expect(page.locator('.browse-face .browse-example')).toHaveCount(kind==='kanji'?2:0);
      const cardBox=await page.locator('.browse-card').boundingBox();
      const leftBox=await page.getByRole('button',{name:'Previous card',exact:true}).boundingBox();
      const rightBox=await page.getByRole('button',{name:'Next card',exact:true}).boundingBox();
      expect(leftBox!.x+leftBox!.width).toBeLessThanOrEqual(cardBox!.x);
      expect(rightBox!.x).toBeGreaterThanOrEqual(cardBox!.x+cardBox!.width);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect(await page.locator('.browse-face').evaluate(e => getComputedStyle(e).animationName)).toBe('none');
      await page.screenshot({path:`.local/browse-${kind}-mobile.png`,fullPage:true});
      await page.setViewportSize({width:1280,height:800});
      await page.screenshot({path:`.local/browse-${kind}-desktop.png`,fullPage:true});
    }
    expect(mutations).toEqual([]);
    expect(await fingerprint()).toBe(before);
  } finally { await db.$disconnect(); }
});

test('approved local mnemonics distinguish complete text from excerpts; radical and meaning highlights', async ({page}) => {
  test.skip(!process.env.REVIEW_BROWSER_TEST, 'Requires isolated synthetic database');
  const db=new PrismaClient({datasourceUrl:process.env.REVIEW_TEST_URL});
  try {
    const kanji=await db.kanji.findFirstOrThrow();
    const source=await db.source.create({data:{id:randomUUID(),title:'Synthetic mnemonic reference',sourceType:'dictionary',language:'en'}});
    const complete='A tree and a sun help you remember synthetic meaning. '+ 'This is a synthetic memory aid with enough space to read on a phone. '.repeat(8)+'The complete ending is here.';
    for (const [key,payload,status] of [
      ['full',{meaningMnemonic:complete},'approved'],
      ['excerpt',{meaningMnemonicExcerpt:'A tree and a sun…'},'approved'],
      ['draft',{meaningMnemonic:'UNAPPROVED mnemonic must stay hidden'},'draft'],
    ] as const) {
      await db.$transaction(async tx=>{
        const content=await tx.content.create({data:{kind:'explanation',origin:'user',status,revision:1,payloadJson:{kind:'dictionaryKanjiReference',radicalCombinations:[{glyph:'木',name:'tree'},{glyph:'日',name:'sun'}],...payload}}});
        await tx.sourceEntry.create({data:{sourceId:source.id,contentId:content.id,sourceRecordKey:key,revision:1,originalPayloadJson:{synthetic:true},fieldPresenceJson:{},verificationStatus:'verified',verifiedAt:new Date()}});
        await tx.contentItem.create({data:{contentId:content.id,itemId:kanji.itemId,role:'support'}});
      });
    }
    await page.goto('/kanji/flashcards');
    await page.locator('.browse-card').click();
    await expect(page.locator('.browse-face [data-wanikani-reference]')).toHaveCount(0);
    await expect(page.getByText('UNAPPROVED mnemonic must stay hidden')).toHaveCount(0);
    await page.getByRole('link',{name:'Entry details',exact:true}).click();
    const full=page.locator('.content-block:not(.draft) > [data-wanikani-reference]').filter({hasText:'The complete ending is here.'});
    await expect(full.getByRole('heading',{name:'Meaning mnemonic',exact:true})).toBeVisible();
    await expect(full.locator('.mnemonic')).toHaveText(complete);
    await expect(full.locator('.radical-tile')).toHaveCount(2);
    await expect(full.locator('.radical-plus')).toHaveText('+');
    await expect(full.locator('mark.radical-tone-0')).toHaveText('tree');
    await expect(full.locator('mark.radical-tone-1')).toHaveText('sun');
    await expect(full.locator('mark.meaning-highlight')).toHaveText('synthetic meaning');
    await expect(page.locator('.content-block:not(.draft) > [data-wanikani-reference]').getByText('Only an excerpt is stored; the rest is unavailable locally.')).toHaveCount(0);
    await page.setViewportSize({width:375,height:812});
    const ending=full.locator('.mnemonic'); await ending.scrollIntoViewIfNeeded();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:'.local/mnemonic-mobile.png',fullPage:true});
    await page.setViewportSize({width:1280,height:800});await page.screenshot({path:'.local/mnemonic-desktop.png',fullPage:true});
  } finally {await db.$disconnect();}
});

test('word meanings use only one approved exact word/reading supplement; ambiguity stays unresolved',async({page})=>{
  test.skip(!process.env.REVIEW_BROWSER_TEST,'Requires isolated synthetic database');
  const db=new PrismaClient({datasourceUrl:process.env.REVIEW_TEST_URL});
  try {
    const kanji=await db.kanji.findFirstOrThrow();
    const add=async(kind:string,payload:object,status='approved')=>db.$transaction(async tx=>{
      const content=await tx.content.create({data:{kind,origin:'user',status,revision:1,payloadJson:payload}});
      await tx.contentItem.create({data:{contentId:content.id,itemId:kanji.itemId,role:'support'}});return content;
    });
    const matched=await add('sentence',{japanese:'合成語',reading:'ごうせいご',sourceWord:true});
    const missing=await add('sentence',{japanese:'生物',reading:null,sourceWord:true});
    const competing=await add('sentence',{japanese:'合成例',reading:'ごうせいれい',sourceWord:true});
    for(const [word,reading,meaning,status] of [
      ['合成語','ごうせいご','Synthetic exact sense','approved'],['合成語','べつ','Wrong reading','approved'],['合成語','ごうせいご','Unapproved replacement','draft'],
      ['生物','せいぶつ','Living thing','approved'],['生物','なまもの','Raw food','approved'],
      ['合成例','ごうせいれい','Competing one','approved'],['合成例','ごうせいれい','Competing two','approved'],
    ]) await add('explanation',{originalJapanese:word,selectedMeanings:[meaning],dictionaryEvidence:{originalReading:reading}},status);
    await page.goto(`/kanji/${kanji.itemId}`);
    await expect(page.locator(`[data-content-id="${matched.id}"] [data-example-meaning]`)).toHaveText(/Synthetic exact sense/);
    await expect(page.locator(`[data-content-id="${matched.id}"]`)).not.toContainText('Wrong reading');
    for(const content of [missing,competing]) {
      await expect(page.locator(`[data-content-id="${content.id}"] [data-example-meaning]`)).toHaveCount(0);
      await expect(page.locator(`[data-content-id="${content.id}"]`)).toContainText('Translation / meaning not supplied by book.');
    }
  } finally {await db.$disconnect();}
});

test('Dictionary uses copied text on click, selection first, and an inline blocked-popup fallback', async ({page})=>{
  test.skip(!process.env.REVIEW_BROWSER_TEST, 'Requires isolated synthetic database');
  await page.context().route('https://takoboto.jp/**',route=>route.fulfill({status:200,body:'Synthetic dictionary destination'}));
  await page.addInitScript(()=>{Object.defineProperty(navigator,'clipboard',{configurable:true,value:{readText:async()=>'辞書 & 試験'}});});
  await page.goto('/vocabulary/flashcards');
  await page.locator('.browse-card').click();
  const before=page.url();
  const popupPromise=page.waitForEvent('popup');
  await page.getByRole('button',{name:'Dictionary',exact:true}).click();
  const copied=await popupPromise;
  await copied.waitForURL('https://takoboto.jp/?q=%E8%BE%9E%E6%9B%B8%20%26%20%E8%A9%A6%E9%A8%93');
  expect(await copied.evaluate(()=>window.opener===null)).toBe(true);await copied.close();
  expect(page.url()).toBe(before);await expect(page.getByRole('region',{name:'Card back'})).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.evaluate(()=>{
    const node=document.querySelector('h1')!;node.textContent='語彙';const range=document.createRange();range.selectNodeContents(node);window.getSelection()!.removeAllRanges();window.getSelection()!.addRange(range);
    window.open=()=>null; // A blocked popup is an external browser boundary.
  });
  await page.getByRole('button',{name:'Dictionary',exact:true}).click();
  await expect(page.getByRole('link',{name:'Open Takoboto',exact:true})).toHaveAttribute('href','https://takoboto.jp/?q=%E8%AA%9E%E5%BD%99');
  await expect(page.getByRole('link',{name:'Open Takoboto',exact:true})).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button',{name:'Dictionary',exact:true})).toBeFocused();
});
