import { test, expect } from '@playwright/test';

// A fresh user is created for this file and deleted at the end
const email = `testuser_${Date.now()}@example.com`;
const password = 'Test@12345';

test.describe('Automation Exercise - login', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage({ baseURL: 'https://automationexercise.com' });
    await page.goto('/login');
    await page.locator('[data-qa="signup-name"]').fill('Test User');
    await page.locator('[data-qa="signup-email"]').fill(email);
    await page.locator('[data-qa="signup-button"]').click();
    await page.locator('#id_gender1').check();
    await page.locator('[data-qa="password"]').fill(password);
    await page.locator('[data-qa="days"]').selectOption('10');
    await page.locator('[data-qa="months"]').selectOption('May');
    await page.locator('[data-qa="years"]').selectOption('1995');
    await page.locator('[data-qa="first_name"]').fill('Test');
    await page.locator('[data-qa="last_name"]').fill('User');
    await page.locator('[data-qa="address"]').fill('123 Test Street');
    await page.locator('[data-qa="country"]').selectOption('Canada');
    await page.locator('[data-qa="state"]').fill('Ontario');
    await page.locator('[data-qa="city"]').fill('Toronto');
    await page.locator('[data-qa="zipcode"]').fill('M5V 2T6');
    await page.locator('[data-qa="mobile_number"]').fill('4165551234');
    await page.locator('[data-qa="create-account"]').click();
    await expect(page.locator('[data-qa="account-created"]')).toBeVisible();
    await page.close();
  });

  test.afterAll(async ({ browser }) => {
    const page = await browser.newPage({ baseURL: 'https://automationexercise.com' });
    await page.goto('/login');
    await page.locator('[data-qa="login-email"]').fill(email);
    await page.locator('[data-qa="login-password"]').fill(password);
    await page.locator('[data-qa="login-button"]').click();
    await page.getByRole('link', { name: 'Delete Account' }).click();
    await expect(page.locator('[data-qa="account-deleted"]')).toBeVisible();
    await page.close();
  });

  test('user can log in with valid credentials', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByText('Login to your account')).toBeVisible();
    await page.locator('[data-qa="login-email"]').fill(email);
    await page.locator('[data-qa="login-password"]').fill(password);
    await page.locator('[data-qa="login-button"]').click();

    await expect(page.getByText('Logged in as Test User')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Logout' })).toBeVisible();
  });

  test('user can log out after logging in', async ({ page }) => {
    await page.goto('/login');
    await page.locator('[data-qa="login-email"]').fill(email);
    await page.locator('[data-qa="login-password"]').fill(password);
    await page.locator('[data-qa="login-button"]').click();
    await page.getByRole('link', { name: 'Logout' }).click();

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('link', { name: 'Signup / Login' })).toBeVisible();
  });

  test('shows error for wrong password', async ({ page }) => {
    await page.goto('/login');
    await page.locator('[data-qa="login-email"]').fill(email);
    await page.locator('[data-qa="login-password"]').fill('Wrong@12345');
    await page.locator('[data-qa="login-button"]').click();

    await expect(page.getByText('Your email or password is incorrect!')).toBeVisible();
  });

  test('shows error for unregistered email', async ({ page }) => {
    await page.goto('/login');
    await page.locator('[data-qa="login-email"]').fill(`nouser_${Date.now()}@example.com`);
    await page.locator('[data-qa="login-password"]').fill(password);
    await page.locator('[data-qa="login-button"]').click();

    await expect(page.getByText('Your email or password is incorrect!')).toBeVisible();
  });

  test('does not submit login form when fields are empty', async ({ page }) => {
    await page.goto('/login');
    await page.locator('[data-qa="login-button"]').click();

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.locator('[data-qa="login-email"]')).toHaveJSProperty('validity.valueMissing', true);
  });
});
