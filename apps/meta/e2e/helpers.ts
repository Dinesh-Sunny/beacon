import { expect, type Page } from "@playwright/test";

export async function freshCheck(page: Page) {
  await page.goto("/check");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByTestId("question")).toBeVisible();
}

export async function answerPostcode(page: Page, pc: string) {
  await page.getByRole("textbox", { name: "Postcode", exact: true }).fill(pc);
  await page.getByTestId("continue").click();
}

export async function answerDate(page: Page, d: string, m: string, y: string) {
  await page.getByRole("textbox", { name: "Day", exact: true }).fill(d);
  await page.getByRole("textbox", { name: "Month", exact: true }).fill(m);
  await page.getByRole("textbox", { name: "Year", exact: true }).fill(y);
  await page.getByTestId("continue").click();
}
