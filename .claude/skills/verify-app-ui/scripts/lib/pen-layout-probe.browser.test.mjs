import assert from "node:assert/strict"
import { test } from "node:test"

import { launchBrowser } from "./cdp.mjs"
import { probeSource } from "./pen-layout-probe.mjs"

test("input text measurement follows alignment within the padded content box", async () => {
  const browser = await launchBrowser()
  try {
    const page = await browser.openPage({
      width: 800,
      height: 600,
      mobile: false,
      reducedMotion: true,
    })
    try {
      await page.goto("data:text/html,<body></body>")
      const expected = await page.evaluate(`(() => {
        document.body.style.margin = '0';
        const cases = [
          ['left', 'ltr', 'Left'], ['center', 'ltr', 'Center'],
          ['right', 'ltr', 'Right'], ['start', 'rtl', 'Start'],
          ['end', 'rtl', 'End'], ['end', 'ltr', 'Last']
        ];
        return cases.map(([align, direction, value]) => {
          const field = document.createElement('input');
          field.value = value;
          field.style.cssText = 'display:block;box-sizing:border-box;width:240px;height:60px;border:2px solid;padding:0 19px 0 11px;font:400 26px/39px Arial;letter-spacing:2px';
          field.style.textAlign = align;
          field.style.direction = direction;
          document.body.append(field);
          const mirror = document.createElement('div');
          mirror.style.cssText = field.style.cssText;
          const span = document.createElement('span');
          span.textContent = value;
          mirror.append(span);
          document.body.append(mirror);
          const range = document.createRange();
          range.selectNodeContents(span);
          const box = range.getBoundingClientRect();
          const result = {text:value, x:box.left, width:box.width, y:field.offsetTop};
          mirror.remove();
          return result;
        });
      })()`)
      const result = await page.evaluate(
        probeSource({ mode: "app", pane: "body", texts: expected, tokens: [] })
      )
      assert.equal(result.measured.length, expected.length)
      for (const [index, want] of expected.entries()) {
        const got = result.measured[index]
        assert.ok(got, `found ${want.text}`)
        assert.ok(
          Math.abs(got.x - want.x) < 0.6,
          `${want.text}: x=${got.x}, expected ${want.x}`
        )
        assert.ok(
          Math.abs(got.width - want.width) < 0.6,
          `${want.text}: width=${got.width}, expected ${want.width}`
        )
      }
    } finally {
      await page.close()
    }
  } finally {
    await browser.quit()
  }
})
