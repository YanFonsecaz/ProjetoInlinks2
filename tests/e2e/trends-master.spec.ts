import { test, expect } from '@playwright/test';

test('Trends Master Pipeline Execution', async ({ page }) => {
  // 1. Navigate to Trends Master
  await page.goto('/trends-master');
  
  // 2. Check initial state
  // Use exact match or level to avoid ambiguity with "Sobre o Trends Master"
  await expect(page.getByRole('heading', { level: 1, name: 'Trends Master' })).toBeVisible();
  
  // 3. Configure (Optional, utilizing default)
  
  // 4. Run Pipeline
  const runButton = page.getByRole('button', { name: 'Executar Pipeline' });
  await expect(runButton).toBeVisible();
  await expect(runButton).toBeEnabled();
  
  // Click
  await runButton.click();

  // 5. Wait for completion
  test.setTimeout(180000); // 3 minutes
  
  // Wait for success message in logs
  // Note: The logs might be in a scrollable container.
  await expect(page.getByText('Pipeline concluída com sucesso!')).toBeVisible({ timeout: 150000 });
  
  // 6. Verify Report
  await page.getByRole('button', { name: 'Relatório' }).click();
  
  // Check report content
  await expect(page.getByRole('heading', { name: 'Relatório: Inteligência Artificial' })).toBeVisible();
  
  // Check for "Resumo" column in the table
  await expect(page.getByRole('cell', { name: 'Resumo' })).toBeVisible();
});
