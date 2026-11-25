export const screen = {
  id: "sign-in",
  route: "/sign-in",
  signedIn: false,
  steps: [{ waitFor: { selector: 'input[type="email"]' } }],
}
