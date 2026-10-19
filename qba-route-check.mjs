export default async function run(page) {
  const url = page.url();
  await page.waitForTimeout(6000);
  return await page.evaluate(() => ({
    url: location.href,
    title: document.title,
    rootKids: document.getElementById('root')?.children.length ?? null,
    hasQba: !!document.querySelector('.qba-widget'),
    hasLoadSample: [...document.querySelectorAll('button')].some((b) => /Load sample/i.test(b.textContent)),
    hasLanding: /Start for Free/i.test(document.body.innerText),
    sampleText: document.body.innerText.slice(0, 200),
  }));
}
