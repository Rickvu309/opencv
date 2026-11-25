export const screen = {
  id: "sign-in-too-many-codes",
  route: "/sign-in",
  signedIn: false,
  steps: [
    { waitFor: { selector: 'input[type="email"]' } },
    {
      respond: {
        path: "/api/auth/email-otp/send-verification-otp",
        status: 429,
        headers: { "Retry-After": "661" },
        json: { message: "Too many requests. Please try again later." },
      },
    },
    { fill: { selector: 'input[type="email"]', text: "ada@example.com" } },
    { click: { role: "button", name: "Continue" } },
    { waitFor: { selector: '[role="alert"]' } },
  ],
}
