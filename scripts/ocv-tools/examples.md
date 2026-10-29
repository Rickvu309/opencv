# feat: Show a saved search on the jobs page

### Type

feat

### What and why

The jobs page forgets what you typed. You have to type it again each visit. This keeps your last search so you can pick up where you left off.

### Done when

- I search for "designer", leave the page, and come back. The search box still says "designer".
- A button next to the box clears the search.
- Another person's search is never shown to me.

### Risk

low

### Questions for you

Should the saved search last a day or until you clear it?

### Details for the agent

Store it per user in the jobs read. Keep the web side in the jobs feature folder.

# fix: Stop sending two sign-in emails

### Type

fix

### What and why

Asking for a sign-in code sometimes sends two emails. The first code stops working when the second arrives. People think sign-in is broken.

### Done when

- I ask for a code once and get one email.
- The code in that email works.
- Asking again after a minute gives one new email.

### Risk

high

### What could go wrong

People could be locked out of sign-in for a while if the fix is wrong. Existing codes might stop working at the moment of the change.

### Out of scope

Changing how long a code lasts.

### Details for the agent

Look at the double submit in the sign-in form and the mail module.
