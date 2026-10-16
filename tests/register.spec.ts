import { test, expect } from '@playwright/test';

test.describe('Automation Exercise - register', () => {
  test('user can register a new account and delete it', async ({ page }) => {
    const email = `testuser_${Date.now()}@example.com`;

    await page.goto('/login');
    await expect(page.getByText('New User Signup!')).toBeVisible();
    await page.locator('[data-qa="signup-name"]').fill('Test User');
    await page.locator('[data-qa="signup-email"]').fill(email);
    await page.locator('[data-qa="signup-button"]').click();

    // Account information form
    await expect(page.getByText('Enter Account Information')).toBeVisible();
    await page.locator('#id_gender1').check();
    await page.locator('[data-qa="password"]').fill('Test@12345');
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

    await expect(page.locator('[data-qa="account-created"]')).toHaveText('Account Created!');
    await page.locator('[data-qa="continue-button"]').click();
    await expect(page.getByText('Logged in as Test User')).toBeVisible();

    // Clean up
    await page.getByRole('link', { name: 'Delete Account' }).click();
    await expect(page.locator('[data-qa="account-deleted"]')).toHaveText('Account Deleted!');
  });

  test('cannot register with an already registered email', async ({ page }) => {
    const email = `testuser_${Date.now()}@example.com`;

    // Create the account first
    await page.goto('/login');
    await page.locator('[data-qa="signup-name"]').fill('Test User');
    await page.locator('[data-qa="signup-email"]').fill(email);
    await page.locator('[data-qa="signup-button"]').click();
    await page.locator('#id_gender1').check();
    await page.locator('[data-qa="password"]').fill('Test@12345');
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
    await page.locator('[data-qa="continue-button"]').click();

    // Log out and try to sign up again with the same email
    await page.getByRole('link', { name: 'Logout' }).click();
    await page.locator('[data-qa="signup-name"]').fill('Test User');
    await page.locator('[data-qa="signup-email"]').fill(email);
    await page.locator('[data-qa="signup-button"]').click();

    await expect(page.getByText('Email Address already exist!')).toBeVisible();

    // Clean up: log back in and delete the account
    await page.locator('[data-qa="login-email"]').fill(email);
    await page.locator('[data-qa="login-password"]').fill('Test@12345');
    await page.locator('[data-qa="login-button"]').click();
    await page.getByRole('link', { name: 'Delete Account' }).click();
    await expect(page.locator('[data-qa="account-deleted"]')).toBeVisible();
  });

  test('does not submit signup form when name and email are empty', async ({ page }) => {
    await page.goto('/login');
    await page.locator('[data-qa="signup-button"]').click();

    // HTML5 validation keeps the user on the login page
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.locator('[data-qa="signup-name"]')).toHaveJSProperty('validity.valueMissing', true);
  });
});
