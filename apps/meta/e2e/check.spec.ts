import { expect, test } from "@playwright/test";
import { answerDate, answerPostcode, freshCheck } from "./helpers";

test.describe("adaptive check", () => {
  test("asks one question at a time and narrows the board", async ({ page }) => {
    await freshCheck(page);
    await expect(page.getByTestId("question")).toHaveAttribute("data-fact", "postcode");
    await expect(page.getByTestId("unlocks")).toContainText("Checks");

    await page.getByRole("textbox", { name: "Postcode", exact: true }).fill("HA9");
    await page.getByTestId("continue").click();
    await expect(page.locator(".err")).toContainText("full postcode");

    await answerPostcode(page, "HA9 0WS");
    await expect(page.getByTestId("question")).toHaveAttribute("data-fact", "dob");
    await page.getByRole("textbox", { name: "Day", exact: true }).fill("12");
    await page.getByRole("textbox", { name: "Month", exact: true }).fill("3");
    await page.getByRole("textbox", { name: "Year", exact: true }).fill("1948");
    await expect(page.locator(".derived")).toContainText("Pension age reached");
    await page.getByTestId("continue").click();

    await expect(page.getByTestId("scheme-uc")).toHaveAttribute("data-status", "out");
    await expect(page.getByTestId("agents")).toContainText("Rules engine");
  });

  test("back undoes the last answer", async ({ page }) => {
    await freshCheck(page);
    await answerPostcode(page, "G2 1DY");
    await expect(page.getByTestId("scheme-pip")).toHaveAttribute("data-status", "out");
    await page.getByRole("button", { name: "Back" }).click();
    await expect(page.getByTestId("question")).toHaveAttribute("data-fact", "postcode");
    await expect(page.getByTestId("scheme-pip")).toHaveAttribute("data-status", "open");
  });

  test("'I'm not sure' moves on and keeps schemes worth checking", async ({ page }) => {
    await freshCheck(page);
    await page.getByTestId("unsure").click();
    await expect(page.getByTestId("question")).not.toHaveAttribute("data-fact", "postcode");
  });

  test("a scheme sheet explains each condition", async ({ page }) => {
    await freshCheck(page);
    await answerPostcode(page, "HA9 0WS");
    await answerDate(page, "12", "3", "1948");
    await page.getByTestId("scheme-pc").click();
    const sheet = page.getByTestId("sheet");
    await expect(sheet).toContainText("Reached State Pension age");
    await expect(sheet.getByRole("link", { name: /Official page/ })).toHaveAttribute("href", /gov\.uk/);
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
  });

  test("an example plays through to results", async ({ page }) => {
    await freshCheck(page);
    await page.getByTestId("examples").click();
    await page.getByRole("menuitem", { name: /Margaret/ }).click();
    await expect(page.getByTestId("results")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("scheme-pc")).toHaveAttribute("data-status", "likely");
    await expect(page.getByTestId("scheme-aa")).toHaveAttribute("data-status", "likely");
  });

  test("answers survive a reload", async ({ page }) => {
    await freshCheck(page);
    await answerPostcode(page, "CF10 1EP");
    await page.reload();
    await expect(page.getByTestId("question")).not.toHaveAttribute("data-fact", "postcode");
  });
});
