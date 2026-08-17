export function nextApplicationStep(status: string) {
  switch (status) {
    case "interested":
      return "Tailor the CV and send it.";
    case "applied":
      return "Prepare your intro in Pitch.";
    case "interviewing":
      return "Rehearse one answer from Pitch.";
    case "offer":
      return "Write down what you know about the offer.";
    case "rejected":
      return "Look at Search for the next opening.";
    default:
      return "Pick one next step and do it this week.";
  }
}
