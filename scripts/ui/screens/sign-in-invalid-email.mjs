export const screen = {
  id: "sign-in-invalid-email",
  route: "/sign-in",
  signedIn: false,
  steps: [
    { waitFor: { selector: 'input[type="email"]' } },
    { fill: { selector: 'input[type="email"]', text: "ada" } },
    { click: { role: "button", name: "Continue" } },
    { waitFor: { selector: 'input[type="email"][aria-invalid="true"]' } },
  ],
}
