import { test, expect } from '@playwright/test';
test.use({hasTouch:true});

test('flexible completion on all detail pages and daily caps persist on mobile and reload',async({page,request})=>{
 test.skip(!process.env.REVIEW_BROWSER_TEST,'Requires isolated synthetic review runner');
 for(const kind of ['vocabulary','kanji','grammar']){
  await page.goto(`/${kind}`);await page.locator('[data-item-link]').first().click();
  const button=page.getByRole('button',{name:'Mark as studied',exact:true});await button.focus();await page.keyboard.press('Enter');
  await expect(page.locator('.study-completion [role=status]')).toContainText('Studied · first recorded');
  const before=await page.locator('.study-completion [role=status]').innerText();
  await page.reload();await expect(page.locator('.study-completion [role=status]')).toHaveText(before);
  await page.setViewportSize({width:375,height:812});await button.tap();await expect(page.locator('.study-completion [role=status]')).toHaveText(before);
 }
 const denied=await request.post('/api/review',{headers:{Origin:'https://example.org'},data:{action:'studied',itemId:'00000000-0000-4000-8000-000000000001'}});expect(denied.status()).toBe(403);
 await page.goto('/');await page.getByText('Study pool & review settings',{exact:true}).click();await expect(page.getByText(/Studied today:/)).toBeVisible();
 await page.getByText('Daily review caps',{exact:true}).click();
 await page.getByLabel('Vocabulary per day',{exact:true}).fill('60');
 await page.getByRole('button',{name:'Save daily caps'}).click();await expect(page.getByText('Daily review caps saved.')).toBeVisible();
 await page.reload();await page.getByText('Study pool & review settings',{exact:true}).click();await page.getByText('Daily review caps',{exact:true}).click();
 await expect(page.getByLabel('Vocabulary per day',{exact:true})).toHaveValue('60');await expect(page.getByText(/Reviewed today:/)).toContainText('/60');
 await page.waitForLoadState('networkidle');await expect(page.getByRole('heading',{name:'Your studies, taking shape'})).toBeVisible();
 expect(await page.locator('body').evaluate(el=>el.scrollWidth<=window.innerWidth)).toBe(true);
 await page.screenshot({path:'.local/flexible-study-mobile.png',fullPage:true});
});

// The review browser runner uses an isolated, synthetic database. Never write learner events in the real library.
test('new card opens the recall choice first, then reveal, rating and an optional study card; committed choice survives stop, reload and resume', async({page,request})=>{
 test.skip(!process.env.REVIEW_BROWSER_TEST, 'Requires isolated review browser runner');
 const denied=await request.post('/api/review',{headers:{Origin:'https://example.org'},data:{action:'start'}});
 expect(denied.status()).toBe(403);
 await page.goto('/review');
 await page.route('https://**/*',route=>route.abort());
 await page.getByRole('button',{name:'Start daily review',exact:true}).click();
 // A new card is answered before any answer or study reference is shown.
 await expect(page.getByRole('heading',{name:'Study first'})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Study this new card'})).toHaveCount(0);
 await expect(page.getByTestId('revealed-answer')).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Dictionary',exact:true})).toBeDisabled();
 const choices=page.locator('.recall-choices label');
 await expect(choices).toHaveCount(4);
 const columns=await choices.evaluateAll(nodes=>nodes.map(node=>{
  const index=node.querySelector('.choice-index')!.getBoundingClientRect().left;
  const reading=node.querySelector('.choice-reading')?.getBoundingClientRect().left??index;
  const meaning=node.querySelector('.choice-meaning')?.getBoundingClientRect().left??reading;
  return {index:Math.round(index),reading:Math.round(reading),meaning:Math.round(meaning)};
 }));
 expect(new Set(columns.map(row=>row.index)).size).toBe(1);
 expect(new Set(columns.map(row=>row.reading)).size).toBe(1);
 expect(columns.every(row=>row.meaning===row.reading)).toBe(true);
 await expect(page.locator('.recall-choices [data-correct]')).toHaveCount(0);
 await page.locator('.recall-choices input').first().focus();
 await page.keyboard.press('1');
 await expect(page.locator('.recall-choices input').first()).toBeChecked();
 const chosen=choices.first();
 const chosenReading=await chosen.getAttribute('data-reading');
 const chosenMeaning=await chosen.getAttribute('data-meaning');
 await page.getByRole('button',{name:'Commit choice and reveal'}).click();
 await expect(page.getByTestId('revealed-answer')).toBeVisible();
 const revealed=page.getByTestId('revealed-answer');
 const reading=await revealed.locator('[data-field="reading"]').innerText();
 const meaning=await revealed.locator('[data-field="meaning"]').innerText();
 const bothCorrect=reading===chosenReading&&meaning===chosenMeaning;
 await expect(page.getByTestId('objective-feedback')).toContainText(bothCorrect?'Both components correct':'Again');
 await expect(page.getByRole('button',{name:'Good',exact:true})).toBeEnabled({enabled:bothCorrect});
 await expect(page.getByRole('button',{name:'Easy',exact:true})).toBeDisabled();
 // The extra study reference is optional and starts collapsed.
 const studyReference=page.locator('.study-details');
 await expect(studyReference).toHaveCount(1);
 await expect(studyReference).not.toHaveAttribute('open','');
 await studyReference.locator('summary').click();
 await expect(studyReference).toHaveAttribute('open','');
 await page.waitForLoadState('networkidle');await page.screenshot({path:'.local/review-desktop.png',fullPage:true});
 await page.reload();
 await expect(page.getByTestId('revealed-answer')).toBeVisible();
 await expect(page.locator('.committed-answer')).toContainText(chosenReading!);
 await expect(page.getByTestId('objective-feedback')).toBeVisible();
 await page.getByRole('button',{name:'Stop and save'}).click();
 await page.reload();
 await page.getByRole('button',{name:'Resume reviews'}).click();
 await expect(page.getByTestId('revealed-answer')).toBeVisible();
 await expect(page.locator('.committed-answer')).toContainText(chosenReading!);
 await page.getByRole('button',{name:bothCorrect?'Good':'Again',exact:true}).click();
 await expect(page.getByRole('status')).toContainText('Saved');
 // Second card: learn its answer through the retained introduce endpoint, then deliberately choose a wrong option; only Again remains.
 const introduced=await page.evaluate(async()=>{
  const view=await (await fetch('/api/review',{cache:'no-store'})).json();
  const result=await fetch('/api/review',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'introduce',sessionId:view.sessionId,cardId:view.card.id})});
  return result.json();
 });
 const secondReading=introduced.answer.reading as string;
 const secondMeaning=introduced.answer.meaning as string;
 await expect(page.getByTestId('revealed-answer')).toHaveCount(0);
 await page.setViewportSize({width:375,height:812});
 const secondLabels=page.locator('.recall-choices label');
 await expect(secondLabels).toHaveCount(4);
 await page.waitForLoadState('networkidle');await page.screenshot({path:'.local/review-mobile.png',fullPage:true});
 const count=await secondLabels.count();
 let wrong=-1;
 for(let i=0;i<count;i++){const label=secondLabels.nth(i);if((await label.getAttribute('data-reading'))!==secondReading||(await label.getAttribute('data-meaning'))!==secondMeaning){wrong=i;break;}}
 expect(wrong).toBeGreaterThanOrEqual(0);
 await secondLabels.nth(wrong).click();
 await page.getByRole('button',{name:'Commit choice and reveal'}).click();
 await expect(page.getByTestId('objective-feedback')).toContainText('Again');
 await expect(page.getByRole('button',{name:'Good',exact:true})).toBeDisabled();
 await expect(page.getByRole('button',{name:'Easy',exact:true})).toBeDisabled();
 await page.getByRole('button',{name:'Again',exact:true}).click();
 await expect(page.getByRole('status')).toContainText('Saved · Again');
 // The missed card returns once at the end of this session, labelled Again. Answer the rest (Again) through the API.
 const returned=await page.evaluate(async()=>{
  const call=async(body?:unknown)=>(await fetch('/api/review',body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{cache:'no-store'})).json();
  for(let i=0;i<60;i++){
   const view=await call();if(!view?.card)return null;if(view.card.role==='again')return view.card.id as string;
   const base={sessionId:view.sessionId,cardId:view.card.id,stateVersion:view.card.stateVersion,clientEventId:crypto.randomUUID()};
   const answer=view.recall?{choiceId:view.recall.choices[0].id,choiceFingerprint:view.recall.fingerprint}:{reading:'forgot',meaning:'forgot',response:'forgot'};
   await call({action:'respond',...base,answer});await call({action:'rate',...base,answer,rating:1,components:{readingCorrect:false,meaningCorrect:false,correct:false}});
  }
  return null;
 });
 expect(returned).toBeTruthy();
 await page.reload();await expect(page.locator('.again-tag')).toHaveText('Again');
 expect(await page.locator('body').evaluate(el=>el.scrollWidth<=window.innerWidth)).toBe(true);
});

test('daily dashboard, stored grammar comparisons and explicit selected-text lookup',async({page})=>{
 test.skip(!process.env.REVIEW_BROWSER_TEST,'Requires synthetic database');
 await page.route('https://**/*',route=>route.abort());
 await page.goto('/');
 await expect(page.getByRole('heading',{name:'Your studies, taking shape'})).toBeVisible();
 await page.getByText('Study pool & review settings',{exact:true}).click();
 await page.getByLabel('Default study block budget').fill('25');await page.getByRole('button',{name:'Save budget'}).click();
 await expect(page.getByText('Block budget saved. Activation allowances stay the same.')).toBeVisible();
 await page.reload();await page.getByText('Study pool & review settings',{exact:true}).click();await expect(page.getByLabel('Default study block budget')).toHaveValue('25');
 await expect(page.getByRole('heading',{name:/Your saved block is ready|Ready for today/})).toBeVisible();await page.waitForLoadState('networkidle');await page.screenshot({path:'.local/phase3-dashboard-desktop.png',fullPage:true});
 await page.setViewportSize({width:375,height:812});await page.screenshot({path:'.local/phase3-dashboard-mobile.png',fullPage:true});
 await page.locator('footer').scrollIntoViewIfNeeded();
 const clear=await page.evaluate(()=>document.querySelector('main')!.getBoundingClientRect().bottom<=document.querySelector('.dictionary-trigger')!.getBoundingClientRect().top);expect(clear).toBe(true);
 expect(await page.locator('body').evaluate(el=>el.scrollWidth<=window.innerWidth)).toBe(true);
 await page.goto('/grammar');await page.locator('[data-item-link]').first().click();
 await expect(page.getByRole('heading',{name:'Compare with…'})).toBeVisible();
 await expect(page.getByText('synthetic checked distinction')).toBeVisible();
 const links=page.locator('.comparison h3 a');const second=await links.nth(1).getAttribute('href');
 await page.goto(second!);await expect(page.getByText('synthetic checked distinction')).toBeVisible();
 await page.evaluate(()=>{const node=document.querySelector('h1')!;const range=document.createRange();range.selectNodeContents(node);const selection=window.getSelection()!;selection.removeAllRanges();selection.addRange(range);});
 await page.context().route('https://takoboto.jp/**',route=>route.fulfill({status:200,body:'Synthetic dictionary destination'}));
 const popupPromise=page.waitForEvent('popup');
 await page.getByRole('button',{name:'Dictionary',exact:true}).click();
 const popup=await popupPromise;await popup.waitForLoadState();
 expect(popup.url()).toBe('https://takoboto.jp/?q=%E3%80%9C%E3%82%82%E3%81%AE');
 expect(await popup.evaluate(()=>window.opener===null)).toBe(true);
 await popup.close();
 await expect(page.getByRole('dialog')).toHaveCount(0);
 await page.getByRole('button',{name:'Mark this item unfamiliar'}).click();await expect(page.getByText('Flagged for attention. Scheduling is unchanged.')).toBeVisible();
 await page.evaluate(()=>{window.getSelection()?.removeAllRanges();Object.defineProperty(navigator,'clipboard',{configurable:true,value:{readText:async()=>{throw new DOMException('Denied','NotAllowedError');}}});});
 await page.getByRole('button',{name:'Dictionary',exact:true}).click();
 await expect(page.getByLabel('Word or phrase')).toBeFocused();
 await page.getByLabel('Word or phrase').fill('辞書 & 試験');
 const fallbackPopup=page.waitForEvent('popup');await page.getByRole('button',{name:'Open Takoboto'}).click();
 const destination=await fallbackPopup;await destination.waitForLoadState();
 expect(destination.url()).toBe('https://takoboto.jp/?q=%E8%BE%9E%E6%9B%B8%20%26%20%E8%A9%A6%E9%A8%93');await destination.close();
 await page.setViewportSize({width:1280,height:800});
 await page.getByRole('button',{name:'Dictionary',exact:true}).click();
 await expect(page.getByLabel('Word or phrase')).toBeVisible();
 await page.keyboard.press('Escape');await expect(page.getByRole('button',{name:'Dictionary',exact:true})).toBeFocused();
});

// Runs last: it reviews a few synthetic words and must not disturb the session flows above.
// The review browser runner uses an isolated, synthetic database. Never write learner events in the real library.
test('match round: tap word then meaning, one deliberate miss adds a second, thin pools explain themselves', async({page})=>{
 test.skip(!process.env.REVIEW_BROWSER_TEST,'Requires isolated review browser runner');
 await page.route('https://**/*',route=>route.abort());
 await page.goto('/review');
 // Setup: give a few studied words a genuine Easy review so they are reviewed and not due today.
 const easy=await page.evaluate(async()=>{
  const call=async(body?:unknown)=>(await fetch('/api/review',body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{cache:'no-store'})).json();
  let done=0;
  for(let i=0;i<40&&done<6;i++){
   let view=await call();
   if(!view?.card)view=await call({action:'start'});
   if(!view?.card)break;
   const base={sessionId:view.sessionId,cardId:view.card.id,stateVersion:view.card.stateVersion,clientEventId:crypto.randomUUID()};
   const answer={reading:'synthetic',meaning:'synthetic'};
   if(view.attempt)Object.assign(base,{clientEventId:view.attempt.clientEventId});else await call({action:'respond',...base,answer});
   const rated=await call({action:'rate',...base,answer:view.attempt?.answer||answer,rating:4,components:{readingCorrect:true,meaningCorrect:true,correct:true}});
   if(rated.rating===4)done++;
  }
  return done;
 });
 expect(easy).toBeGreaterThanOrEqual(3);
 await page.goto('/practice/match');
 const tiles=page.locator('.match-tile');
 await expect(tiles.first()).toBeVisible();
 const jp=page.locator('.match-tile[data-side="jp"]');
 const count=await jp.count();expect(count).toBeGreaterThanOrEqual(3);
 // Deliberate miss: a word with another word's meaning.
 const firstPair=await jp.nth(0).getAttribute('data-pair');
 await jp.nth(0).click();
 await page.locator(`.match-tile[data-side="en"]:not([data-pair="${firstPair}"])`).first().click();
 await expect(page.locator('.match-game .status')).toContainText('misses 1');
 for(let i=0;i<count;i++){
  const tile=page.locator('.match-tile[data-side="jp"]:not([disabled])').first();
  const pair=await tile.getAttribute('data-pair');
  await tile.click();await expect(tile).toHaveAttribute('aria-pressed','true');
  await page.locator(`.match-tile[data-side="en"][data-pair="${pair}"]`).click();
 }
 const result=page.locator('.match-game [role=status][aria-live=polite]');
 await expect(result).toContainText('Board cleared in');
 const time=Number((await result.innerText()).match(/in ([\d.]+) s/)![1]);
 expect(time).toBeGreaterThanOrEqual(1.0);
 await expect(page.getByRole('button',{name:'Play again'})).toBeVisible();
 await page.setViewportSize({width:375,height:812});
 expect(await page.locator('body').evaluate(el=>el.scrollWidth<=window.innerWidth)).toBe(true);
 await page.screenshot({path:'.local/match-mobile.png',fullPage:true});
 // Kanji draws from studied kanji: a board of at most 10 pairs, or an explanation when fewer than three exist.
 await page.getByRole('button',{name:'Kanji',exact:true}).click();
 const kanji=page.locator('.match-tile[data-side="jp"]');
 await expect(page.getByText('Mark at least three items studied first.',{exact:false}).or(kanji.first())).toBeVisible();
 expect(await kanji.count()).toBeLessThanOrEqual(10);
});
