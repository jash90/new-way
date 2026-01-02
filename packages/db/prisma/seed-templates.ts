/**
 * ACC-002: Seed Polish Chart of Accounts Templates
 *
 * Seeds the Polish standard CoA templates into the database
 * Run with: npx prisma db seed or ts-node prisma/seed-templates.ts
 */

import { PrismaClient } from '@prisma/client';
import {
  POLISH_STANDARD_COA_FULL,
  POLISH_STANDARD_COA_SIMPLIFIED,
  POLISH_STANDARD_COA_MICRO,
  TEMPLATE_DEFINITIONS,
} from '@ksiegowacrm/shared';

const prisma = new PrismaClient();

async function seedTemplates() {
  console.log('🌱 Seeding Polish Chart of Accounts templates...');

  for (const templateDef of TEMPLATE_DEFINITIONS) {
    const {
      templateCode,
      templateName,
      templateNameEn,
      description,
      businessType,
      companySize,
      accounts,
    } = templateDef;

    // Check if template already exists
    const existing = await prisma.accountTemplate.findFirst({
      where: { templateCode },
    });

    if (existing) {
      console.log(`  ⏭️  Template ${templateCode} already exists, skipping...`);
      continue;
    }

    console.log(`  📋 Creating template: ${templateCode} (${accounts.length} accounts)...`);

    // Create template
    const template = await prisma.accountTemplate.create({
      data: {
        templateCode,
        templateName,
        templateNameEn,
        description,
        businessType,
        companySize,
        version: '1.0.0',
        isActive: true,
        isSystemTemplate: true,
        accountCount: accounts.length,
      },
    });

    // Create template accounts
    const templateAccounts = accounts.map((account, index) => ({
      templateId: template.id,
      accountCode: account.code,
      accountName: account.name,
      accountNameEn: account.nameEn,
      accountType: account.type,
      accountClass: account.class,
      accountGroup: null,
      parentAccountCode: 'parent' in account ? (account as any).parent : null,
      normalBalance: account.balance,
      allowsPosting: account.posting,
      taxCategory: 'taxCategory' in account ? (account as any).taxCategory : null,
      jpkSymbol: 'jpkSymbol' in account ? (account as any).jpkSymbol : null,
      sortOrder: index + 1,
    }));

    await prisma.templateAccount.createMany({
      data: templateAccounts,
    });

    console.log(`  ✅ Created ${templateCode} with ${accounts.length} accounts`);
  }

  console.log('\n🎉 Template seeding complete!');
}

async function main() {
  try {
    await seedTemplates();
  } catch (error) {
    console.error('❌ Error seeding templates:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

export { seedTemplates };
