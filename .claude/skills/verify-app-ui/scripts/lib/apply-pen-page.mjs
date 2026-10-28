// In-page helpers, by accessible name like the unit tests.
export const HELPERS = `
  window.__pen = {
    named(name, roles) {
      const wanted = roles.split(",")
      return [...document.querySelectorAll("button,a,[role=button],[role=menuitem],[role=radio],input,textarea")].find((el) => {
        const role = el.getAttribute("role") || (el.tagName === "BUTTON" ? "button" : el.tagName === "A" ? "link" : "textbox")
        const label = (el.getAttribute("aria-label") || el.textContent || "").trim()
        return wanted.includes(role) && el.getBoundingClientRect().width > 0 && (name instanceof RegExp ? name.test(label) : label === name)
      })
    },
    click(name, roles = "button") {
      const el = this.named(name, roles)
      if (el) el.click()
      return Boolean(el)
    },
    set(label, value) {
      const byFor = [...document.querySelectorAll("label")].find((n) => n.textContent.trim() === label && n.htmlFor)
      const el = [...document.querySelectorAll("input,textarea")].find((n) => (n.getAttribute("aria-label") === label || (byFor && n.id === byFor.htmlFor)) && n.getBoundingClientRect().width > 0)
      if (!el) return false
      el.focus()
      const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
      Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value)
      el.dispatchEvent(new Event("input", { bubbles: true }))
      el.dispatchEvent(new Event("change", { bubbles: true }))
      return true
    },
    blur(label) {
      const el = document.querySelector('[aria-label="' + label + '"]')
      if (!el) return false
      el.focus()
      el.blur()
      return true
    },
    has(text) {
      return document.body.textContent.replace(/\s+/g, " ").includes(text)
    },
  }`
