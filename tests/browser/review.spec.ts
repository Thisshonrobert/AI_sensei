import { test, expect } from '@playwright/test';

// The review browser runner uses an isolated, synthetic database. Never write learner events in the real library.
test('recall → reveal → rate; committed response survives stop, reload and resume', async({page,request})=>{
 test.skip(!process.env.REVIEW_BROWSER_TEST, 'Requires isolated review browser runner');
 const denied=await request.post('/api/review',{headers:{Origin:'https://example.org'},data:{action:'start',includeNew:true}});
 expect(denied.status()).toBe(403);
 await page.goto('/review');
 await page.getByRole('button',{name:'Continue learning',exact:true}).click();
 await page.getByRole('button',{name:'Study this new card'}).click();
 await expect(page.getByRole('heading',{name:'Study first'})).toBeVisible();
 await page.getByRole('button',{name:'Hide and recall'}).click();
 await expect(page.getByTestId('revealed-answer')).toHaveCount(0);
 await page.getByLabel('Reading response').fill('しけん');
 await page.getByLabel('Meaning response').fill('a valid paraphrase');
 await page.getByRole('button',{name:'Commit response and reveal'}).click();
 await expect(page.getByTestId('revealed-answer')).toBeVisible();
 await page.screenshot({path:'.local/review-desktop.png'});
 await page.reload();
 await expect(page.getByTestId('revealed-answer')).toBeVisible();
 await page.getByRole('button',{name:'Stop and save'}).click();
 await page.reload();
 await page.getByRole('button',{name:'Resume reviews'}).click();
 await expect(page.getByTestId('revealed-answer')).toBeVisible();
 await expect(page.getByText('a valid paraphrase',{exact:true})).toBeVisible();
 await page.getByLabel('Reading recalled correctly').check();
 await page.getByLabel('Meaning recalled correctly').check();
 await page.getByRole('button',{name:'Good',exact:true}).click();
 await expect(page.getByRole('status')).toContainText('Saved');
 // Refresh an active revealed card and rate without a resume action.
 await page.getByRole('button',{name:'Study this new card'}).click();
 await page.getByRole('button',{name:'Hide and recall'}).click();
 await page.setViewportSize({width:375,height:812});
 await page.screenshot({path:'.local/review-mobile.png'});
 await page.getByLabel('Reading response').fill('しけん');
 await page.getByLabel('Meaning response').fill('forgot');
 await page.getByRole('button',{name:'Commit response and reveal'}).click();
 await page.reload();
 await page.getByLabel('Reading recalled correctly').check();
 await expect(page.getByRole('button',{name:'Good',exact:true})).toBeDisabled();
 await page.getByRole('button',{name:'Again',exact:true}).click();
 await expect(page.getByRole('status')).toContainText('Saved · Again');
 await page.setViewportSize({width:375,height:812});
 expect(await page.locator('body').evaluate(el=>el.scrollWidth<=window.innerWidth)).toBe(true);
});
