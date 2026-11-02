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

test("the probe lists controls and headings that no frame text accounts for", async () => {
  const browser = await launchBrowser()
  try {
    const page = await browser.openPage({
      width: 800,
      height: 600,
      mobile: false,
      reducedMotion: true,
    })
    try {
      const markup = [
        "<main id=pane>",
        "<h1>Letters</h1>",
        "<h2>Your letters</h2>",
        "<button>Save</button>",
        '<button aria-label="Collapse sidebar" style="opacity:0"><svg width=16 height=16></svg></button>',
        '<button aria-label="Closed menu" style="opacity:0;pointer-events:none">x</button>',
        '<span style="position:absolute;width:1px;height:1px;overflow:hidden">Hidden helper</span>',
        '<p style="display:none">Gone</p>',
        "</main>",
      ].join("")
      await page.goto(`data:text/html,${encodeURIComponent(markup)}`)
      const want = (value) => ({ text: value, x: 0, y: 0 })
      const result = await page.evaluate(
        probeSource({
          mode: "app",
          pane: "#pane",
          texts: [want("Letters"), want("Save")],
          tokens: [],
        })
      )
      assert.deepEqual(
        result.extras.map(({ kind, text }) => ({ kind, text })),
        [
          { kind: "control", text: "Collapse sidebar" },
          { kind: "heading", text: "Your letters" },
        ]
      )
    } finally {
      await page.close()
    }
  } finally {
    await browser.quit()
  }
})
