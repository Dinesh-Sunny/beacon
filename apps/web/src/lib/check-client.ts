// The one place the web app reaches the check engine (packages/brain). Contract:
//   runCheck(situation, { signal }): AsyncGenerator<CheckEvent>
// The agent reads each open scheme's GOV.UK page on Beam and settleFinding verifies every quote.

import "server-only";

export { explainFinding, explainLetter, runCheck } from "@beacon/brain";
