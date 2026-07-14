import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

type TestRole = 'member' | 'manager' | 'admin';

const enabled = process.env.MARKETING_OPS_E2E_ENABLED === 'true';
const fixturePrefix = '[E2E-PHASE2]';

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required when MARKETING_OPS_E2E_ENABLED=true`);
  return value;
}

function credentials(role: TestRole): { email: string; password: string } {
  const prefix = `MARKETING_OPS_E2E_${role.toUpperCase()}`;
  return {
    email: requiredEnv(`${prefix}_EMAIL`),
    password: requiredEnv(`${prefix}_PASSWORD`)
  };
}

function dateFromNow(offsetDays: number): string {
  const value = new Date();
  value.setUTCDate(value.getUTCDate() + offsetDays);
  return value.toISOString().slice(0, 10);
}

async function login(page: Page, role: TestRole): Promise<void> {
  const account = credentials(role);
  await page.goto('/login');
  await page.getByLabel('E-mail').fill(account.email);
  await page.getByLabel('Senha').fill(account.password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByText('Login realizado com sucesso!')).toBeVisible();
  await page.goto('/marketing-ops/campaigns');
  await expect(page.getByRole('heading', { name: 'Campanhas' })).toBeVisible();
}

async function createCampaign(page: Page, name: string): Promise<string> {
  await page.getByRole('button', { name: 'Nova campanha' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Nova campanha' });
  await dialog.getByLabel('Nome').fill(name);
  await dialog.getByRole('button', { name: 'Criar' }).click();
  await expect(page.getByRole('heading', { name })).toBeVisible();
  await expect(page).toHaveURL(/\/marketing-ops\/campaigns\/[0-9a-f-]{36}$/i);
  return page.url();
}

async function archiveCampaign(page: Page): Promise<void> {
  const archive = page.getByRole('button', { name: 'Arquivar campanha' });
  await expect(archive).toBeVisible();
  await archive.click();
  const dialog = page.getByRole('alertdialog', { name: 'Arquivar campanha' });
  await dialog.getByRole('button', { name: 'Confirmar arquivamento' }).click();
  await expect(page.getByText(/somente leitura/i)).toBeVisible();
}

async function expectNoWcagViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page })
    .include('main')
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();
  expect(results.violations.map(({ id, impact, nodes }) => ({ id, impact, nodes: nodes.length }))).toEqual([]);
}

test.describe('Marketing Ops integrated phase-2 journey', () => {
  test.skip(!enabled, 'Set MARKETING_OPS_E2E_ENABLED=true only in the controlled VPS gate.');

  test('manager completes collaboration, material and timeline flow', async ({ page }) => {
    const name = `${fixturePrefix} manager ${Date.now()}`;
    let participantAdded = false;
    let materialLinked = false;
    await login(page, 'manager');
    await createCampaign(page, name);

    try {
      await page.getByLabel('Objetivo').fill('Validar a jornada operacional E2E');
      await page.getByLabel('Tipo de referência').selectOption('course');
      const courseQuery = requiredEnv('MARKETING_OPS_E2E_COURSE_QUERY');
      const courseTitle = requiredEnv('MARKETING_OPS_E2E_COURSE_TITLE');
      await page.getByRole('searchbox', { name: 'Buscar curso oficial' }).fill(courseQuery);
      await page.getByRole('button', { name: courseTitle }).click();
      await expect(page.getByText(courseTitle, { exact: true })).toBeVisible();
      await page.getByLabel('Público').fill('Tenant controlado de testes');
      await page.getByLabel('Início').fill(dateFromNow(1));
      await page.getByLabel('Término').fill(dateFromNow(8));
      await page.getByLabel('Canal principal').selectOption('email');
      await page.getByLabel('Briefing').fill('Conteúdo sintético marcado para o gate da Fase 2.');
      await page.getByRole('button', { name: 'Salvar alterações' }).click();
      await expect(page.getByText(/versão 2/i)).toBeVisible();

      const candidateName = requiredEnv('MARKETING_OPS_E2E_CANDIDATE_NAME');
      await page.getByRole('button', { name: 'Adicionar participante' }).click();
      const participantDialog = page.getByRole('dialog', { name: 'Adicionar participante' });
      await participantDialog.getByLabel('Buscar pessoa').fill(candidateName);
      await participantDialog.getByRole('button', { name: `Selecionar ${candidateName}` }).click();
      await participantDialog.getByRole('button', { name: 'Confirmar participante' }).click();
      participantAdded = true;
      await expect(page.getByText(candidateName)).toBeVisible();

      const artifactId = requiredEnv('MARKETING_OPS_E2E_EXISTING_ARTIFACT_ID');
      await page.getByRole('button', { name: 'Vincular existente' }).click();
      const materialDialog = page.getByRole('dialog', { name: 'Vincular artefato existente' });
      await materialDialog.getByLabel('ID do artefato').fill(artifactId);
      await materialDialog.getByRole('button', { name: 'Confirmar vínculo' }).click();
      materialLinked = true;
      await expect(page.getByText('1 material')).toBeVisible();

      let uploadRequests = 0;
      page.on('request', (request) => {
        if (request.url().includes('/materials/upload')) uploadRequests += 1;
      });
      await page.locator('#campaign-material-upload').setInputFiles({
        name: 'oversized.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.alloc(25 * 1024 * 1024 + 1)
      });
      await expect(page.getByText(/máximo de 25 MiB/i)).toBeVisible();
      expect(uploadRequests).toBe(0);

      await page.getByRole('button', { name: 'Planejar' }).click();
      await expect(page.getByText('Planejada')).toBeVisible();
      await expect(page.getByText(/Participante adicionado|Material vinculado/).first()).toBeVisible();
      await expectNoWcagViolations(page);
    } finally {
      try {
        if (materialLinked) {
          await page.getByRole('button', { name: /^Desvincular / }).click();
          await page.getByRole('alertdialog', { name: 'Desvincular material' })
            .getByRole('button', { name: 'Confirmar desvínculo' }).click();
          await expect(page.getByText('0 materiais')).toBeVisible();
        }
        if (participantAdded) {
          const candidateName = requiredEnv('MARKETING_OPS_E2E_CANDIDATE_NAME');
          await page.getByRole('button', { name: `Remover ${candidateName}` }).click();
          await page.getByRole('alertdialog', { name: 'Remover participante' })
            .getByRole('button', { name: 'Confirmar remoção' }).click();
          await expect(page.getByText(candidateName)).toHaveCount(0);
        }
      } finally {
        await archiveCampaign(page);
      }
    }

    await page.goto('/marketing-ops/campaigns');
    await page.getByRole('searchbox', { name: 'Buscar campanhas' }).fill(name);
    await page.getByLabel('Status').selectOption('archived');
    await expect(page).toHaveURL(/q=.*E2E-PHASE2.*&status=archived|status=archived.*&q=.*E2E-PHASE2/i);
    await expect(page.getByRole('button', { name }).first()).toBeVisible();
    await page.getByRole('button', { name }).first().click();
    await expect(page.getByText(/somente leitura/i)).toBeVisible();
  });

  test('manager receives a version conflict across two sessions without losing local values', async ({ page, browser }) => {
    const name = `${fixturePrefix} conflict ${Date.now()}`;
    await login(page, 'manager');
    const campaignUrl = await createCampaign(page, name);
    const secondContext = await browser.newContext();
    const secondPage = await secondContext.newPage();

    try {
      await login(secondPage, 'manager');
      await secondPage.goto(campaignUrl);
      await expect(secondPage.getByRole('heading', { name })).toBeVisible();

      await page.getByLabel('Notas').fill('Valor salvo pela sessão A');
      await page.getByRole('button', { name: 'Salvar alterações' }).click();
      await expect(page.getByText(/versão 2/i)).toBeVisible();

      await secondPage.getByLabel('Notas').fill('Valor local preservado pela sessão B');
      await secondPage.getByRole('button', { name: 'Salvar alterações' }).click();
      const conflict = secondPage.getByRole('dialog', { name: 'Conflito de versão' });
      await expect(conflict.getByText('Valor local preservado pela sessão B')).toBeVisible();
      await conflict.getByRole('button', { name: 'Reaplicar minhas alterações' }).click();
      await expect(secondPage.getByLabel('Notas')).toHaveValue('Valor local preservado pela sessão B');
    } finally {
      await secondContext.close();
      await page.reload();
      await archiveCampaign(page);
    }
  });

  test('manager and admin reach the campaign workspace while a viewer fails closed', async ({ browser }) => {
    for (const role of ['manager', 'admin'] as const) {
      const context = await browser.newContext();
      const rolePage = await context.newPage();
      await login(rolePage, role);
      await expect(rolePage.getByRole('button', { name: 'Nova campanha' }).first()).toBeVisible();
      await context.close();
    }

    const viewerContext = await browser.newContext();
    const viewerPage = await viewerContext.newPage();
    await login(viewerPage, 'member');
    await viewerPage.goto(`/marketing-ops/campaigns/${requiredEnv('MARKETING_OPS_E2E_VIEWER_CAMPAIGN_ID')}`);
    await expect(viewerPage.getByText(/somente leitura/i)).toBeVisible();
    await expect(viewerPage.getByRole('button', { name: 'Salvar alterações' })).toHaveCount(0);
    await expect(viewerPage.getByRole('button', { name: 'Adicionar participante' })).toHaveCount(0);
    await expect(viewerPage.getByText('Adicionar material')).toHaveCount(0);
    await viewerContext.close();
  });

  test('@mobile renders the campaign workspace without overflow and passes axe', async ({ page }) => {
    await login(page, 'manager');
    await page.goto(`/marketing-ops/campaigns/${requiredEnv('MARKETING_OPS_E2E_VIEWER_CAMPAIGN_ID')}`);
    await expect(page.getByRole('heading', { name: 'Essenciais' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Pessoas' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Materiais' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Atividade' })).toBeVisible();
    const dimensions = await page.evaluate(() => ({ innerWidth: window.innerWidth, scrollWidth: document.documentElement.scrollWidth }));
    expect(dimensions).toEqual({ innerWidth: 390, scrollWidth: 390 });
    await expect(page.getByRole('button', { name: 'Abrir menu' })).toBeVisible();
    await expectNoWcagViolations(page);
  });
});
