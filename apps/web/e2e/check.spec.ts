import { expect, type Page, test } from "@playwright/test";

// The sample person from the design: HA9, born 1952, lives alone, no benefits, council tenant,
// under the Pension Credit line, savings under £10,000, a health condition.

const FINDINGS = [
  {
    scheme: "pension-credit",
    verdict: "likely",
    why: "You have reached State Pension age and your income is under the line.",
    quote: "You must have reached State Pension age.",
    becauseYouSaid: ["you live alone"],
    quoteVerified: true,
    source: {
      url: "https://www.gov.uk/pension-credit/eligibility",
      title: "Pension Credit: Eligibility",
      readAt: "2026-10-30T10:00:00Z",
      publicUpdatedAt: "",
    },
  },
  {
    scheme: "attendance-allowance",
    verdict: "worth-checking",
    why: "It depends on how long you have needed help.",
    quote: "",
    becauseYouSaid: [],
    quoteVerified: false,
    source: {
      url: "https://www.gov.uk/attendance-allowance",
      title: "Attendance Allowance",
      readAt: "",
      publicUpdatedAt: "",
    },
  },
];

async function mockNetwork(page: Page) {
  await page.route("https://api.postcodes.io/outcodes/**", (route) =>
    route.fulfill({
      json: {
        status: 200,
        result: {
          outcode: "HA9",
          admin_district: ["Brent"],
          country: ["England"],
        },
      },
    }),
  );
  await page.route("**/api/check", async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    expect(body.postcodeDistrict).toBe("HA9");
    expect(body.birthYear).toBe(1952);
    expect(body).not.toHaveProperty("work");
    const events = [
      { type: "plan", schemes: ["pension-credit", "attendance-allowance"] },
      {
        type: "reading",
        scheme: "pension-credit",
        status: "done",
        title: "Pension Credit",
      },
      {
        type: "reading",
        scheme: "attendance-allowance",
        status: "done",
        title: "Attendance Allowance",
      },
      ...FINDINGS.map((finding) => ({ type: "finding", finding })),
      {
        type: "usage",
        step: "judge",
        effort: "high",
        inputTokens: 1200,
        outputTokens: 80,
        scheme: "pension-credit",
      },
      { type: "done", findings: FINDINGS, model: "beam-test", snapshot: false },
    ];
    await route.fulfill({
      contentType: "application/x-ndjson",
      body: events.map((e) => JSON.stringify(e)).join("\n"),
    });
  });
}

const cont = (page: Page) =>
  page.getByRole("button", { name: "Continue", exact: true }).click();
const heading = (page: Page, name: string | RegExp) =>
  expect(page.getByRole("heading", { level: 1, name })).toBeVisible();

test("the sample person goes through the adaptive check to results", async ({
  page,
}) => {
  await mockNetwork(page);
  await page.goto("/check");

  await heading(page, "Where do you live?");
  await page.getByLabel("First half of the postcode").fill("ha9");
  await cont(page);

  await heading(page, "What year were you born?");
  await page.getByRole("textbox").fill("1952");
  await cont(page);

  // Month and State Pension age are worked out from the year, so the next question is the household.
  await heading(page, "Who lives with you?");
  await page.getByLabel("No one - I live alone").check();
  await cont(page);

  await heading(page, "Do you get any of these now?");
  await page.getByLabel("None of these").check();
  await cont(page);

  await heading(page, "Which is closest to your home?");
  await page
    .getByLabel("I rent from the council or a housing association")
    .check();
  await cont(page);

  // Work is skipped over State Pension age.
  await heading(page, "How much money comes in each month?");
  await page.getByLabel(/^Less than £1,031/).check();
  await cont(page);

  await heading(page, "How much is in savings?");
  await page.getByLabel("£10,000 or less").check();
  await cont(page);

  await heading(page, "Do any of these apply to you?");
  // On phones the rail folds into a "Your answers" disclosure above the question.
  const fold = page.locator("summary", { hasText: /done$/ });
  if (await fold.isVisible()) await fold.click();
  const rail = (key: string) =>
    page.getByTestId(`rail-${key}`).filter({ visible: true });
  await expect(rail("work")).toHaveText(
    "Not needed - you've reached State Pension age",
  );
  await expect(rail("pregnancy")).toHaveText(
    "Not needed - you've reached State Pension age",
  );
  await expect(page.getByTestId("path-label")).toHaveText(
    "Step 8 of 10 - Health and caring",
  );
  await page
    .getByLabel("A health condition or disability makes daily life harder")
    .check();
  await cont(page);

  await heading(page, "Anything else we should know?");
  await page.getByRole("button", { name: "Skip this" }).click();

  await heading(page, "Is this all right?");
  const review = page.getByTestId("review");
  await expect(review).toContainText("Brent, England");
  await expect(review).toContainText("1952");
  await expect(review).toContainText("No one - I live alone");
  await expect(review).toContainText("Answered (private)");
  await expect(review).not.toContainText("Work");
  await expect(review).not.toContainText("Pregnancy");

  // Change keeps every other answer and comes back to the review.
  await page.getByRole("button", { name: /^Change year of birth/ }).click();
  await heading(page, "What year were you born?");
  await expect(page.getByRole("textbox")).toHaveValue("1952");
  await page.getByRole("button", { name: "Save and go back" }).click();
  await heading(page, "Is this all right?");
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  await expect(review).toContainText("£10,000 or less");

  await page.getByRole("button", { name: "Read the rules for me" }).click();
  await expect(page.getByTestId("reveal")).toHaveText("1 looks likely for you");
  await page.getByRole("button", { name: "See what may be yours" }).click();

  await heading(page, "1 looks likely for you");
  await expect(
    page.getByRole("heading", {
      name: "Start here: Pension Credit looks likely for you",
    }),
  ).toBeVisible();
  await expect(
    page.getByText("You must have reached State Pension age."),
  ).toBeVisible();
  // The private link carries results only, never the answers.
  expect(page.url()).toContain("#r=");

  await page.route("**/api/explain", (route) =>
    route.fulfill({
      json: {
        text: "Next steps\n1. Call the Pension Credit claim line.",
        usage: { inputTokens: 300, outputTokens: 120 },
      },
    }),
  );
  await page
    .getByRole("link", { name: /See what to do next/ })
    .first()
    .click();
  await page.getByRole("button", { name: "Help me with what to say" }).click();
  await expect(
    page.getByText("Call the Pension Credit claim line."),
  ).toBeVisible();
});

test("Continue with no answer shows the error summary", async ({ page }) => {
  await mockNetwork(page);
  await page.goto("/check");
  await cont(page);
  const summary = page.getByRole("alert", { name: "There is a problem" });
  await expect(summary).toContainText("There is a problem");
  await expect(summary).toBeFocused();
  await expect(page).toHaveTitle(/^Error:/);
});

test("Back keeps answers", async ({ page }) => {
  await mockNetwork(page);
  await page.goto("/check");
  await page.getByLabel("First half of the postcode").fill("HA9");
  await cont(page);
  await page.getByRole("textbox").fill("1952");
  await cont(page);
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByRole("textbox")).toHaveValue("1952");
});

test("Not sure of the postcode asks which part of the UK", async ({ page }) => {
  await mockNetwork(page);
  await page.goto("/check");
  await page.getByLabel("I'm not sure of the postcode").check();
  await cont(page);
  await expect(
    page.getByRole("alert", { name: "There is a problem" }),
  ).toContainText("Choose the part of the UK");
  await page.getByLabel("Scotland").check();
  await expect(
    page.getByText("Beacon checks support in England"),
  ).toBeVisible();
  await cont(page);
  await heading(page, /born/i);
});

test("Going home keeps a started check", async ({ page }) => {
  await mockNetwork(page);
  await page.goto("/check");
  await page.getByLabel("First half of the postcode").fill("HA9");
  await cont(page);
  await heading(page, /born/i);
  await page.getByRole("link", { name: "Beacon", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.getByRole("link", { name: "Continue my check" }).click();
  await expect(
    page.getByText(/Your answers - 1 of/).filter({ visible: true }),
  ).toBeVisible();
});
