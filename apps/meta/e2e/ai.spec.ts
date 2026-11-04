import { expect, type Page, test } from "@playwright/test";
import { freshCheck } from "./helpers";

// A 1x1 PNG is enough: the letter route is mocked, the browser only has to shrink and send it.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

async function openChat(page: Page) {
  const tab = page.getByTestId("view-chat");
  if (await tab.isVisible()) await tab.click();
  else if (await page.getByTestId("show-chat").isVisible()) await page.getByTestId("show-chat").click();
}

test.describe("Meta model features", () => {
  test("chat saves facts into the check", async ({ page }) => {
    let sent: { messages: { content: string }[] } | null = null;
    await page.route("**/api/chat", async (route) => {
      sent = route.request().postDataJSON();
      await route.fulfill({
        json: {
          reply: "Thanks. Pension Credit looks likely for your mum. Does she pay council tax?",
          saved: { postcode: "HA9 0WS", dob: "1948-05-01" },
          notes: [{ name: "save_details", text: "Saved 2 details. Checked 21 schemes: 1 likely." }],
        },
      });
    });
    await freshCheck(page);
    await openChat(page);
    await page.getByTestId("chat-input").fill("My mum is 78 and lives in HA9 0WS");
    await page.getByTestId("send").click();
    await expect(page.getByTestId("thread")).toContainText("Pension Credit looks likely");
    await expect(page.getByTestId("thread")).toContainText("Saved 2 details");
    expect(sent?.messages.at(-1)?.content).toContain("HA9 0WS");
    await expect(page.getByTestId("scheme-uc")).toHaveAttribute("data-status", "out");
  });

  test("a starter suggestion sends straight away", async ({ page }) => {
    await page.route("**/api/chat", (route) => route.fulfill({ json: { reply: "Got it.", saved: {}, notes: [] } }));
    await freshCheck(page);
    await openChat(page);
    await page.getByRole("button", { name: /I care for my brother/ }).click();
    await expect(page.getByTestId("thread")).toContainText("Got it.");
  });

  test("a model outage shows a calm message and the form keeps working", async ({ page }) => {
    await page.route("**/api/chat", (route) => route.fulfill({ status: 503, json: { error: "offline" } }));
    await freshCheck(page);
    await openChat(page);
    await page.getByTestId("chat-input").fill("hello");
    await page.getByTestId("send").click();
    await expect(page.getByTestId("thread")).toContainText("questions on the right still work");
  });

  test("speaking sends a WAV and the transcript goes to the agent", async ({ page }) => {
    let contentType = "";
    await page.route("**/api/voice", async (route) => {
      contentType = route.request().headers()["content-type"] ?? "";
      await route.fulfill({ json: { transcript: "I look after my brother fifty hours a week" } });
    });
    await page.route("**/api/chat", (route) =>
      route.fulfill({ json: { reply: "Carer's Allowance could be yours.", saved: { careHours: 50 }, notes: [] } }),
    );
    await freshCheck(page);
    await openChat(page);
    await page.getByTestId("mic").click();
    await expect(page.getByTestId("recording")).toBeVisible();
    await page.waitForTimeout(1200);
    await page.getByTestId("stop-rec").click();
    await expect(page.getByTestId("thread")).toContainText("fifty hours a week");
    await expect(page.getByTestId("thread")).toContainText("Said aloud");
    await expect(page.getByTestId("thread")).toContainText("Carer's Allowance could be yours.");
    expect(contentType).toContain("multipart/form-data");
  });

  test("a letter photo is outlined, read and added to the check", async ({ page }) => {
    await page.route("**/api/letter", (route) =>
      route.fulfill({
        json: {
          readable: true,
          box: { x1: 0, y1: 0, x2: 1, y2: 1, w: 1, h: 1 },
          saved: { ctax: "yes", postcode: "HA9 0WS" },
          reading: {
            from: "Brent Council",
            kind: "Council Tax bill",
            summary: "This is the bill for this year.",
            action: "Pay by direct debit or ask about help.",
            deadlines: [{ what: "First payment", date: "2026-12-01" }],
          },
        },
      }),
    );
    await freshCheck(page);
    await openChat(page);
    await page.getByTestId("add").click();
    await page.getByTestId("file-input").setInputFiles({ name: "letter.png", mimeType: "image/png", buffer: PNG });
    const card = page.getByTestId("letter-card");
    await expect(card).toContainText("Council Tax bill");
    await expect(card).toContainText("Letter found");
    await expect(card).toContainText("1 December 2026");
    if (await page.getByTestId("view-details").isVisible()) await page.getByTestId("view-details").click();
    await page.getByTestId("tab-see").click();
    await expect(page.getByTestId("detail-ctax")).toContainText("Read from your letter");
  });
});
