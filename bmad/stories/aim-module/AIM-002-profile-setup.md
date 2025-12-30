# Story: Complete User Profile Setup (AIM-002)

> **Story ID**: AIM-002
> **Epic**: Authentication & Identity Management (AIM)
> **Priority**: P0 (Core)
> **Points**: 5
> **Status**: 📋 Ready for Development
> **Dependencies**: AIM-001 (User Registration)

---

## User Story

**As a** newly registered user who has verified their email,
**I want to** complete my profile with personal and company information,
**So that** I can access the full platform features with a properly configured workspace.

---

## Acceptance Criteria

### Scenario 1: Access Profile Setup Form
```gherkin
Feature: Profile Setup Access
  As a verified user with incomplete profile
  I need to complete my profile before accessing the platform

  Scenario: Redirect to profile setup after first login
    Given I am a user with verified email
    And my profile is not yet completed
    When I log in successfully
    Then I should be redirected to the profile setup page
    And I should see the profile completion form
    And I should not be able to access other platform features

  Scenario: Block access to platform without completed profile
    Given I am a user with incomplete profile
    When I try to access any platform feature directly
    Then I should be redirected to the profile setup page
    And I should see a message "Please complete your profile to continue"
```

### Scenario 2: Complete Profile with Personal Information
```gherkin
Feature: Personal Information Entry
  As a user completing my profile
  I need to provide my personal information

  Scenario: Submit valid personal information
    Given I am on the profile setup page
    When I enter "Jan" as first name
    And I enter "Kowalski" as last name
    And I enter "+48 600 123 456" as phone number
    And I click "Continue"
    Then the personal information should be saved
    And I should proceed to company information step

  Scenario: Validate required personal fields
    Given I am on the profile setup page
    When I leave first name empty
    And I click "Continue"
    Then I should see error "Imię jest wymagane"
    And the form should not submit

  Scenario: Validate phone number format
    Given I am on the profile setup page
    When I enter "invalid-phone" as phone number
    And I click "Continue"
    Then I should see error "Nieprawidłowy format numeru telefonu"
```

### Scenario 3: Company Information with GUS Auto-Fill
```gherkin
Feature: Company Information with GUS Integration
  As a user completing my profile
  I need to provide company information with optional GUS auto-fill

  Scenario: Auto-fill company data from GUS by NIP
    Given I am on the company information step
    When I enter "5252344078" as NIP
    And I click "Pobierz dane z GUS"
    Then the system should query GUS REGON API
    And company name should be auto-filled with "ANTHROPIC POLAND SP. Z O.O."
    And REGON should be auto-filled with "389012345"
    And address fields should be auto-filled
    And I should see success message "Dane pobrane z GUS"

  Scenario: Handle invalid NIP
    Given I am on the company information step
    When I enter "1234567890" as NIP (invalid checksum)
    And I click "Pobierz dane z GUS"
    Then I should see error "Nieprawidłowy numer NIP"
    And GUS API should not be called

  Scenario: Handle company not found in GUS
    Given I am on the company information step
    When I enter "5252344079" as NIP (valid format, not in GUS)
    And I click "Pobierz dane z GUS"
    Then I should see warning "Nie znaleziono firmy w rejestrze GUS"
    And I should be able to enter company data manually

  Scenario: Enter company data manually
    Given I am on the company information step
    When I enter "Moja Firma Sp. z o.o." as company name
    And I leave NIP empty (optional)
    And I enter "ul. Warszawska 1, 00-001 Warszawa" as address
    And I click "Continue"
    Then the company information should be saved
    And I should proceed to workspace creation step

  Scenario: Handle GUS API timeout
    Given I am on the company information step
    And the GUS API is experiencing delays
    When I enter valid NIP and click "Pobierz dane z GUS"
    And the request takes longer than 5 seconds
    Then I should see message "Pobieranie danych trwa dłużej niż zwykle..."
    And after 10 seconds timeout I should see "Nie udało się pobrać danych. Wprowadź dane ręcznie."
```

### Scenario 4: Workspace Creation
```gherkin
Feature: Default Workspace Creation
  As a user completing my profile
  I need to have a default workspace created

  Scenario: Create default workspace for individual user
    Given I have completed personal and company information
    And I selected "Individual" account type
    When I reach the workspace creation step
    Then a workspace named "[FirstName]'s Workspace" should be suggested
    And I should be able to customize the workspace name
    And I should click "Create Workspace"

  Scenario: Create default workspace for company
    Given I have completed personal and company information
    And I selected "Company" account type
    And company name is "Moja Firma Sp. z o.o."
    When I reach the workspace creation step
    Then a workspace named "Moja Firma Sp. z o.o." should be suggested
    And I should be able to customize the workspace name

  Scenario: Complete profile setup successfully
    Given I have completed all profile steps
    When I click "Finish Setup"
    Then my profile should be marked as completed
    And the workspace should be created
    And I should receive a welcome email
    And I should be redirected to the main dashboard
    And I should see welcome message "Witaj, Jan! Twoje konto jest gotowe."
```

### Scenario 5: Profile Setup Progress Persistence
```gherkin
Feature: Profile Setup Progress
  As a user completing my profile
  I need my progress to be saved if I leave the page

  Scenario: Resume profile setup
    Given I have completed personal information step
    And I logged out or closed the browser
    When I log in again
    Then I should be redirected to company information step
    And my personal information should be preserved

  Scenario: Edit previous steps
    Given I am on the company information step
    When I click "Back" or click on personal info step indicator
    Then I should see my previously entered personal information
    And I should be able to edit it
```

---

## Technical Specification

### Database Schema

```sql
-- User profiles extension table
CREATE TABLE user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone_number VARCHAR(20),
    phone_verified BOOLEAN DEFAULT false,
    avatar_url TEXT,
    locale VARCHAR(10) DEFAULT 'pl',
    timezone VARCHAR(50) DEFAULT 'Europe/Warsaw',
    profile_completed_at TIMESTAMPTZ,
    setup_step INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Company information table
CREATE TABLE companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    nip VARCHAR(10),
    regon VARCHAR(14),
    krs VARCHAR(10),
    legal_form VARCHAR(100),
    street VARCHAR(255),
    building_number VARCHAR(20),
    apartment_number VARCHAR(20),
    postal_code VARCHAR(10),
    city VARCHAR(100),
    country VARCHAR(2) DEFAULT 'PL',
    gus_data JSONB,
    gus_fetched_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT valid_nip CHECK (nip IS NULL OR LENGTH(nip) = 10),
    CONSTRAINT valid_regon CHECK (regon IS NULL OR LENGTH(regon) IN (9, 14))
);

-- User-company relationship
CREATE TABLE user_companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'owner',
    is_primary BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, company_id)
);

-- Workspaces table
CREATE TABLE workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    settings JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Workspace members
CREATE TABLE workspace_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'member',
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(workspace_id, user_id)
);

-- GUS API cache
CREATE TABLE gus_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nip VARCHAR(10) NOT NULL UNIQUE,
    data JSONB NOT NULL,
    fetched_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '24 hours'
);

-- Indexes
CREATE INDEX idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX idx_user_profiles_completed ON user_profiles(profile_completed_at) WHERE profile_completed_at IS NOT NULL;
CREATE INDEX idx_companies_nip ON companies(nip) WHERE nip IS NOT NULL;
CREATE INDEX idx_companies_regon ON companies(regon) WHERE regon IS NOT NULL;
CREATE INDEX idx_workspaces_owner ON workspaces(owner_id);
CREATE INDEX idx_workspaces_company ON workspaces(company_id);
CREATE INDEX idx_workspace_members_user ON workspace_members(user_id);
CREATE INDEX idx_gus_cache_nip ON gus_cache(nip);
CREATE INDEX idx_gus_cache_expires ON gus_cache(expires_at);

-- Row Level Security
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY user_profiles_own ON user_profiles
    FOR ALL USING (user_id = auth.uid());

CREATE POLICY companies_member ON companies
    FOR SELECT USING (
        id IN (SELECT company_id FROM user_companies WHERE user_id = auth.uid())
    );

CREATE POLICY companies_owner ON companies
    FOR ALL USING (
        id IN (SELECT company_id FROM user_companies WHERE user_id = auth.uid() AND role = 'owner')
    );

CREATE POLICY workspaces_member ON workspaces
    FOR SELECT USING (
        id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
        OR owner_id = auth.uid()
    );

CREATE POLICY workspaces_owner ON workspaces
    FOR ALL USING (owner_id = auth.uid());
```

### API Endpoints

```typescript
// Profile Setup Endpoints
PUT    /api/v1/users/profile              // Update user profile
GET    /api/v1/users/profile              // Get current user profile
GET    /api/v1/users/profile/setup-status // Get setup progress

// Company Endpoints
POST   /api/v1/companies                  // Create company
GET    /api/v1/companies/lookup           // Lookup company by NIP from GUS
PUT    /api/v1/companies/:id              // Update company

// Workspace Endpoints
POST   /api/v1/workspaces                 // Create workspace
GET    /api/v1/workspaces                 // List user's workspaces
PUT    /api/v1/workspaces/:id             // Update workspace
```

### Zod Validation Schemas

```typescript
import { z } from 'zod';

// Polish phone validation regex
const polishPhoneRegex = /^(\+48)?[\s-]?\d{3}[\s-]?\d{3}[\s-]?\d{3}$/;

// NIP validation with checksum
const nipSchema = z.string().length(10).refine((nip) => {
  const weights = [6, 5, 7, 2, 3, 4, 5, 6, 7];
  const digits = nip.split('').map(Number);
  const checksum = digits.slice(0, 9).reduce((sum, digit, i) => sum + digit * weights[i], 0) % 11;
  return checksum === digits[9];
}, { message: 'Nieprawidłowy numer NIP' });

// Personal information schema
export const personalInfoSchema = z.object({
  firstName: z.string()
    .min(2, 'Imię musi mieć minimum 2 znaki')
    .max(100, 'Imię może mieć maksimum 100 znaków')
    .regex(/^[a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻ\s-]+$/, 'Imię zawiera niedozwolone znaki'),
  lastName: z.string()
    .min(2, 'Nazwisko musi mieć minimum 2 znaki')
    .max(100, 'Nazwisko może mieć maksimum 100 znaków')
    .regex(/^[a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻ\s-]+$/, 'Nazwisko zawiera niedozwolone znaki'),
  phoneNumber: z.string()
    .regex(polishPhoneRegex, 'Nieprawidłowy format numeru telefonu')
    .optional()
    .nullable(),
});

// Company information schema
export const companyInfoSchema = z.object({
  name: z.string()
    .min(2, 'Nazwa firmy musi mieć minimum 2 znaki')
    .max(255, 'Nazwa firmy może mieć maksimum 255 znaków'),
  nip: nipSchema.optional().nullable(),
  regon: z.string()
    .refine((val) => !val || val.length === 9 || val.length === 14, {
      message: 'REGON musi mieć 9 lub 14 cyfr',
    })
    .optional()
    .nullable(),
  krs: z.string().length(10).optional().nullable(),
  legalForm: z.string().max(100).optional().nullable(),
  street: z.string().max(255).optional().nullable(),
  buildingNumber: z.string().max(20).optional().nullable(),
  apartmentNumber: z.string().max(20).optional().nullable(),
  postalCode: z.string()
    .regex(/^\d{2}-\d{3}$/, 'Nieprawidłowy kod pocztowy (format: XX-XXX)')
    .optional()
    .nullable(),
  city: z.string().max(100).optional().nullable(),
  country: z.string().length(2).default('PL'),
});

// Workspace creation schema
export const createWorkspaceSchema = z.object({
  name: z.string()
    .min(2, 'Nazwa workspace musi mieć minimum 2 znaki')
    .max(255, 'Nazwa workspace może mieć maksimum 255 znaków'),
  companyId: z.string().uuid().optional().nullable(),
});

// Complete profile schema
export const completeProfileSchema = z.object({
  personalInfo: personalInfoSchema,
  companyInfo: companyInfoSchema.optional(),
  workspace: createWorkspaceSchema,
  accountType: z.enum(['individual', 'company']),
});

// GUS lookup schema
export const gusLookupSchema = z.object({
  nip: nipSchema,
});

// Profile setup status response
export const profileSetupStatusSchema = z.object({
  isCompleted: z.boolean(),
  currentStep: z.number().min(1).max(4),
  completedSteps: z.array(z.number()),
  personalInfo: personalInfoSchema.partial().nullable(),
  companyInfo: companyInfoSchema.partial().nullable(),
  workspace: z.object({
    id: z.string().uuid(),
    name: z.string(),
  }).nullable(),
});
```

### Implementation

```typescript
// src/modules/aim/services/profile.service.ts
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/prisma/prisma.service';
import { GusService } from './gus.service';
import { AuditService } from './audit.service';
import { EmailService } from '@/infrastructure/email/email.service';
import {
  PersonalInfoDto,
  CompanyInfoDto,
  CreateWorkspaceDto,
  CompleteProfileDto,
  ProfileSetupStatus
} from '../dto/profile.dto';
import { generateSlug } from '@/common/utils/slug';

@Injectable()
export class ProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gusService: GusService,
    private readonly auditService: AuditService,
    private readonly emailService: EmailService,
  ) {}

  async getSetupStatus(userId: string): Promise<ProfileSetupStatus> {
    const profile = await this.prisma.userProfile.findUnique({
      where: { userId },
      include: {
        user: {
          include: {
            userCompanies: {
              include: { company: true },
              where: { isPrimary: true },
            },
          },
        },
      },
    });

    const workspace = await this.prisma.workspace.findFirst({
      where: { ownerId: userId },
      orderBy: { createdAt: 'asc' },
    });

    const completedSteps: number[] = [];
    let currentStep = 1;

    if (profile?.firstName && profile?.lastName) {
      completedSteps.push(1);
      currentStep = 2;
    }

    const company = profile?.user?.userCompanies?.[0]?.company;
    if (company) {
      completedSteps.push(2);
      currentStep = 3;
    }

    if (workspace) {
      completedSteps.push(3);
      currentStep = 4;
    }

    if (profile?.profileCompletedAt) {
      completedSteps.push(4);
    }

    return {
      isCompleted: !!profile?.profileCompletedAt,
      currentStep,
      completedSteps,
      personalInfo: profile ? {
        firstName: profile.firstName,
        lastName: profile.lastName,
        phoneNumber: profile.phoneNumber,
      } : null,
      companyInfo: company ? {
        name: company.name,
        nip: company.nip,
        regon: company.regon,
        street: company.street,
        buildingNumber: company.buildingNumber,
        postalCode: company.postalCode,
        city: company.city,
      } : null,
      workspace: workspace ? {
        id: workspace.id,
        name: workspace.name,
      } : null,
    };
  }

  async updatePersonalInfo(userId: string, data: PersonalInfoDto): Promise<void> {
    const sanitizedData = {
      firstName: data.firstName.trim(),
      lastName: data.lastName.trim(),
      phoneNumber: data.phoneNumber?.replace(/[\s-]/g, '') || null,
    };

    await this.prisma.userProfile.upsert({
      where: { userId },
      create: {
        userId,
        ...sanitizedData,
        setupStep: 2,
      },
      update: {
        ...sanitizedData,
        setupStep: 2,
        updatedAt: new Date(),
      },
    });

    await this.auditService.log({
      userId,
      action: 'PROFILE_PERSONAL_INFO_UPDATED',
      resource: 'user_profile',
      resourceId: userId,
      details: { fields: Object.keys(sanitizedData) },
    });
  }

  async lookupCompanyByNip(nip: string): Promise<CompanyInfoDto> {
    // Check cache first
    const cached = await this.prisma.gusCache.findUnique({
      where: { nip },
    });

    if (cached && cached.expiresAt > new Date()) {
      return this.mapGusDataToCompanyInfo(cached.data as Record<string, any>);
    }

    // Fetch from GUS API
    const gusData = await this.gusService.fetchCompanyByNip(nip);

    if (!gusData) {
      throw new NotFoundException('Nie znaleziono firmy w rejestrze GUS');
    }

    // Cache the result
    await this.prisma.gusCache.upsert({
      where: { nip },
      create: {
        nip,
        data: gusData,
        fetchedAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      },
      update: {
        data: gusData,
        fetchedAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    return this.mapGusDataToCompanyInfo(gusData);
  }

  private mapGusDataToCompanyInfo(gusData: Record<string, any>): CompanyInfoDto {
    return {
      name: gusData.nazwa || gusData.Nazwa,
      nip: gusData.nip || gusData.Nip,
      regon: gusData.regon || gusData.Regon,
      krs: gusData.krs || gusData.NumerKRS || null,
      legalForm: gusData.formaPrawna || gusData.FormaPrawna || null,
      street: gusData.ulica || gusData.Ulica || null,
      buildingNumber: gusData.nrNieruchomosci || gusData.NrNieruchomosci || null,
      apartmentNumber: gusData.nrLokalu || gusData.NrLokalu || null,
      postalCode: gusData.kodPocztowy || gusData.KodPocztowy || null,
      city: gusData.miejscowosc || gusData.Miejscowosc || null,
      country: 'PL',
    };
  }

  async createOrUpdateCompany(userId: string, data: CompanyInfoDto): Promise<string> {
    // Check if user already has a company
    const existingUserCompany = await this.prisma.userCompany.findFirst({
      where: { userId, isPrimary: true },
      include: { company: true },
    });

    let companyId: string;

    if (existingUserCompany) {
      // Update existing company
      await this.prisma.company.update({
        where: { id: existingUserCompany.companyId },
        data: {
          ...data,
          updatedAt: new Date(),
        },
      });
      companyId = existingUserCompany.companyId;
    } else {
      // Create new company
      const company = await this.prisma.company.create({
        data: {
          ...data,
          userCompanies: {
            create: {
              userId,
              role: 'owner',
              isPrimary: true,
            },
          },
        },
      });
      companyId = company.id;
    }

    // Update profile setup step
    await this.prisma.userProfile.update({
      where: { userId },
      data: { setupStep: 3 },
    });

    await this.auditService.log({
      userId,
      action: existingUserCompany ? 'COMPANY_UPDATED' : 'COMPANY_CREATED',
      resource: 'company',
      resourceId: companyId,
      details: { nip: data.nip },
    });

    return companyId;
  }

  async createWorkspace(userId: string, data: CreateWorkspaceDto): Promise<string> {
    const slug = await this.generateUniqueSlug(data.name);

    const workspace = await this.prisma.workspace.create({
      data: {
        name: data.name,
        slug,
        ownerId: userId,
        companyId: data.companyId,
        members: {
          create: {
            userId,
            role: 'owner',
          },
        },
      },
    });

    await this.auditService.log({
      userId,
      action: 'WORKSPACE_CREATED',
      resource: 'workspace',
      resourceId: workspace.id,
      details: { name: data.name, slug },
    });

    return workspace.id;
  }

  private async generateUniqueSlug(name: string): Promise<string> {
    const baseSlug = generateSlug(name);
    let slug = baseSlug;
    let counter = 1;

    while (await this.prisma.workspace.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    return slug;
  }

  async completeProfile(userId: string, data: CompleteProfileDto): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.prisma.$transaction(async (tx) => {
      // Update personal info
      await tx.userProfile.upsert({
        where: { userId },
        create: {
          userId,
          firstName: data.personalInfo.firstName,
          lastName: data.personalInfo.lastName,
          phoneNumber: data.personalInfo.phoneNumber,
          profileCompletedAt: new Date(),
          setupStep: 4,
        },
        update: {
          firstName: data.personalInfo.firstName,
          lastName: data.personalInfo.lastName,
          phoneNumber: data.personalInfo.phoneNumber,
          profileCompletedAt: new Date(),
          setupStep: 4,
          updatedAt: new Date(),
        },
      });

      // Create company if provided
      let companyId: string | null = null;
      if (data.accountType === 'company' && data.companyInfo) {
        const company = await tx.company.create({
          data: {
            ...data.companyInfo,
            userCompanies: {
              create: {
                userId,
                role: 'owner',
                isPrimary: true,
              },
            },
          },
        });
        companyId = company.id;
      }

      // Create workspace
      const slug = await this.generateUniqueSlug(data.workspace.name);
      await tx.workspace.create({
        data: {
          name: data.workspace.name,
          slug,
          ownerId: userId,
          companyId,
          members: {
            create: {
              userId,
              role: 'owner',
            },
          },
        },
      });
    });

    // Send welcome email
    await this.emailService.sendWelcomeEmail({
      to: user.email,
      firstName: data.personalInfo.firstName,
      locale: 'pl',
    });

    await this.auditService.log({
      userId,
      action: 'PROFILE_SETUP_COMPLETED',
      resource: 'user',
      resourceId: userId,
      details: {
        accountType: data.accountType,
        hasCompany: !!data.companyInfo,
      },
    });
  }

  async getProfile(userId: string) {
    const profile = await this.prisma.userProfile.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            emailVerifiedAt: true,
          },
        },
      },
    });

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    return profile;
  }
}
```

### GUS REGON API Service

```typescript
// src/modules/aim/services/gus.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { parseStringPromise } from 'xml2js';

interface GusCompanyData {
  nazwa: string;
  nip: string;
  regon: string;
  krs?: string;
  formaPrawna?: string;
  ulica?: string;
  nrNieruchomosci?: string;
  nrLokalu?: string;
  kodPocztowy?: string;
  miejscowosc?: string;
  wojewodztwo?: string;
  powiat?: string;
  gmina?: string;
  dataRozpoczeciaDzialalnosci?: string;
  statusNip?: string;
}

@Injectable()
export class GusService {
  private readonly logger = new Logger(GusService.name);
  private readonly client: AxiosInstance;
  private sessionId: string | null = null;
  private sessionExpiresAt: Date | null = null;

  constructor(private readonly configService: ConfigService) {
    const isProduction = this.configService.get('NODE_ENV') === 'production';
    const baseURL = isProduction
      ? 'https://wyszukiwarkaregon.stat.gov.pl/wsBIR/UslugaBIRzewnWorking.svc'
      : 'https://wyszukiwarkaregontest.stat.gov.pl/wsBIR/UslugaBIRzewnWorking.svc';

    this.client = axios.create({
      baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/soap+xml; charset=utf-8',
      },
    });
  }

  private async ensureSession(): Promise<string> {
    if (this.sessionId && this.sessionExpiresAt && this.sessionExpiresAt > new Date()) {
      return this.sessionId;
    }

    const apiKey = this.configService.get<string>('GUS_API_KEY');

    const loginEnvelope = `
      <soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:ns="http://CIS/BIR/PUBL/2014/07">
        <soap:Header xmlns:wsa="http://www.w3.org/2005/08/addressing">
          <wsa:To>https://wyszukiwarkaregon.stat.gov.pl/wsBIR/UslugaBIRzewnWorking.svc</wsa:To>
          <wsa:Action>http://CIS/BIR/PUBL/2014/07/IUslugaBIRzworking/Zaloguj</wsa:Action>
        </soap:Header>
        <soap:Body>
          <ns:Zaloguj>
            <ns:pKluczUzytkownika>${apiKey}</ns:pKluczUzytkownika>
          </ns:Zaloguj>
        </soap:Body>
      </soap:Envelope>
    `;

    try {
      const response = await this.client.post('', loginEnvelope);
      const parsed = await parseStringPromise(response.data);

      this.sessionId = this.extractSessionId(parsed);
      this.sessionExpiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      return this.sessionId;
    } catch (error) {
      this.logger.error('Failed to authenticate with GUS API', error);
      throw new Error('GUS API authentication failed');
    }
  }

  private extractSessionId(parsed: any): string {
    try {
      return parsed['soap:Envelope']['soap:Body'][0]['ZalogujResponse'][0]['ZalogujResult'][0];
    } catch {
      throw new Error('Invalid GUS API login response');
    }
  }

  async fetchCompanyByNip(nip: string): Promise<GusCompanyData | null> {
    const sessionId = await this.ensureSession();

    const searchEnvelope = `
      <soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:ns="http://CIS/BIR/PUBL/2014/07" xmlns:dat="http://CIS/BIR/PUBL/2014/07/DataContract">
        <soap:Header xmlns:wsa="http://www.w3.org/2005/08/addressing">
          <wsa:To>https://wyszukiwarkaregon.stat.gov.pl/wsBIR/UslugaBIRzewnWorking.svc</wsa:To>
          <wsa:Action>http://CIS/BIR/PUBL/2014/07/IUslugaBIRzworking/DaneSzukajPodmioty</wsa:Action>
        </soap:Header>
        <soap:Body>
          <ns:DaneSzukajPodmioty>
            <ns:pParametryWyszukiwania>
              <dat:Nip>${nip}</dat:Nip>
            </ns:pParametryWyszukiwania>
          </ns:DaneSzukajPodmioty>
        </soap:Body>
      </soap:Envelope>
    `;

    try {
      const response = await this.client.post('', searchEnvelope, {
        headers: {
          sid: sessionId,
        },
      });

      const parsed = await parseStringPromise(response.data);
      const result = this.extractSearchResult(parsed);

      if (!result) {
        return null;
      }

      // Fetch full report for more details
      return await this.fetchFullReport(result.regon, result.typ);
    } catch (error) {
      this.logger.error(`Failed to fetch company data for NIP: ${nip}`, error);
      throw error;
    }
  }

  private extractSearchResult(parsed: any): { regon: string; typ: string } | null {
    try {
      const resultXml = parsed['soap:Envelope']['soap:Body'][0]
        ['DaneSzukajPodmiotyResponse'][0]['DaneSzukajPodmiotyResult'][0];

      if (!resultXml || resultXml === '') {
        return null;
      }

      const innerParsed = await parseStringPromise(resultXml);
      const dane = innerParsed.root?.dane?.[0];

      if (!dane) {
        return null;
      }

      return {
        regon: dane.Regon?.[0] || '',
        typ: dane.Typ?.[0] || 'P', // P = prawna (company), F = fizyczna (individual)
      };
    } catch {
      return null;
    }
  }

  private async fetchFullReport(regon: string, typ: string): Promise<GusCompanyData> {
    const sessionId = await this.ensureSession();
    const reportName = typ === 'P' ? 'BIR11OsPrawna' : 'BIR11OsFizycznaDzworking';

    const reportEnvelope = `
      <soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:ns="http://CIS/BIR/PUBL/2014/07">
        <soap:Header xmlns:wsa="http://www.w3.org/2005/08/addressing">
          <wsa:To>https://wyszukiwarkaregon.stat.gov.pl/wsBIR/UslugaBIRzewnWorking.svc</wsa:To>
          <wsa:Action>http://CIS/BIR/PUBL/2014/07/IUslugaBIRzworking/DanePobierzPelnyRaport</wsa:Action>
        </soap:Header>
        <soap:Body>
          <ns:DanePobierzPelnyRaport>
            <ns:pRegon>${regon}</ns:pRegon>
            <ns:pNazwaRaportu>${reportName}</ns:pNazwaRaportu>
          </ns:DanePobierzPelnyRaport>
        </soap:Body>
      </soap:Envelope>
    `;

    const response = await this.client.post('', reportEnvelope, {
      headers: { sid: sessionId },
    });

    const parsed = await parseStringPromise(response.data);
    return this.parseFullReport(parsed);
  }

  private parseFullReport(parsed: any): GusCompanyData {
    try {
      const resultXml = parsed['soap:Envelope']['soap:Body'][0]
        ['DanePobierzPelnyRaportResponse'][0]['DanePobierzPelnyRaportResult'][0];

      const innerParsed = await parseStringPromise(resultXml);
      const dane = innerParsed.root?.dane?.[0] || {};

      return {
        nazwa: dane.praw_nazwa?.[0] || dane.fiz_nazwa?.[0] || '',
        nip: dane.praw_nip?.[0] || dane.fiz_nip?.[0] || '',
        regon: dane.praw_regon14?.[0] || dane.fiz_regon9?.[0] || '',
        krs: dane.praw_numerWRejestrzeEwidencji?.[0] || null,
        formaPrawna: dane.praw_formaPrawna_Nazwa?.[0] || null,
        ulica: dane.praw_adSiedzUlica_Nazwa?.[0] || dane.fiz_adSiedzUlica_Nazwa?.[0] || null,
        nrNieruchomosci: dane.praw_adSiedzNumerNieruchomosci?.[0] || dane.fiz_adSiedzNumerNieruchomosci?.[0] || null,
        nrLokalu: dane.praw_adSiedzNumerLokalu?.[0] || dane.fiz_adSiedzNumerLokalu?.[0] || null,
        kodPocztowy: dane.praw_adSiedzKodPocztowy?.[0] || dane.fiz_adSiedzKodPocztowy?.[0] || null,
        miejscowosc: dane.praw_adSiedzMiejscowosc_Nazwa?.[0] || dane.fiz_adSiedzMiejscowosc_Nazwa?.[0] || null,
        wojewodztwo: dane.praw_adSiedzWojewodztwo_Nazwa?.[0] || null,
        powiat: dane.praw_adSiedzPowiat_Nazwa?.[0] || null,
        gmina: dane.praw_adSiedzGmina_Nazwa?.[0] || null,
        dataRozpoczeciaDzialalnosci: dane.praw_dataRozpoczeciaDzior?.[0] || null,
        statusNip: dane.praw_statusNip?.[0] || null,
      };
    } catch (error) {
      this.logger.error('Failed to parse GUS full report', error);
      throw new Error('Invalid GUS API report response');
    }
  }
}
```

### tRPC Router

```typescript
// src/modules/aim/routers/profile.router.ts
import { router, protectedProcedure } from '@/infrastructure/trpc';
import { TRPCError } from '@trpc/server';
import {
  personalInfoSchema,
  companyInfoSchema,
  createWorkspaceSchema,
  completeProfileSchema,
  gusLookupSchema
} from '../schemas/profile.schema';
import { ProfileService } from '../services/profile.service';
import { z } from 'zod';

export const profileRouter = router({
  // Get profile setup status
  getSetupStatus: protectedProcedure
    .query(async ({ ctx }) => {
      const profileService = ctx.container.get(ProfileService);
      return profileService.getSetupStatus(ctx.user.id);
    }),

  // Get current user profile
  getProfile: protectedProcedure
    .query(async ({ ctx }) => {
      const profileService = ctx.container.get(ProfileService);
      return profileService.getProfile(ctx.user.id);
    }),

  // Update personal information (Step 1)
  updatePersonalInfo: protectedProcedure
    .input(personalInfoSchema)
    .mutation(async ({ ctx, input }) => {
      const profileService = ctx.container.get(ProfileService);
      await profileService.updatePersonalInfo(ctx.user.id, input);
      return { success: true, step: 2 };
    }),

  // Lookup company by NIP from GUS
  lookupCompanyByNip: protectedProcedure
    .input(gusLookupSchema)
    .query(async ({ ctx, input }) => {
      const profileService = ctx.container.get(ProfileService);
      try {
        return await profileService.lookupCompanyByNip(input.nip);
      } catch (error) {
        if (error.message === 'Nie znaleziono firmy w rejestrze GUS') {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: error.message,
          });
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Błąd podczas pobierania danych z GUS',
        });
      }
    }),

  // Create or update company (Step 2)
  updateCompanyInfo: protectedProcedure
    .input(companyInfoSchema)
    .mutation(async ({ ctx, input }) => {
      const profileService = ctx.container.get(ProfileService);
      const companyId = await profileService.createOrUpdateCompany(ctx.user.id, input);
      return { success: true, companyId, step: 3 };
    }),

  // Create workspace (Step 3)
  createWorkspace: protectedProcedure
    .input(createWorkspaceSchema)
    .mutation(async ({ ctx, input }) => {
      const profileService = ctx.container.get(ProfileService);
      const workspaceId = await profileService.createWorkspace(ctx.user.id, input);
      return { success: true, workspaceId, step: 4 };
    }),

  // Complete entire profile setup in one transaction
  completeProfile: protectedProcedure
    .input(completeProfileSchema)
    .mutation(async ({ ctx, input }) => {
      const profileService = ctx.container.get(ProfileService);
      await profileService.completeProfile(ctx.user.id, input);
      return { success: true, redirectTo: '/dashboard' };
    }),

  // Skip company step (for individual accounts)
  skipCompanyStep: protectedProcedure
    .mutation(async ({ ctx }) => {
      const profileService = ctx.container.get(ProfileService);
      // Just move to next step without company
      await ctx.prisma.userProfile.update({
        where: { userId: ctx.user.id },
        data: { setupStep: 3 },
      });
      return { success: true, step: 3 };
    }),
});
```

### Email Templates

```typescript
// src/infrastructure/email/templates/welcome.template.ts
export const welcomeEmailTemplate = {
  subject: 'Witaj w KsięgowaCRM! Twoje konto jest gotowe',

  html: (data: { firstName: string }) => `
    <!DOCTYPE html>
    <html lang="pl">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Witaj w KsięgowaCRM</title>
    </head>
    <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 28px;">🎉 Witaj w KsięgowaCRM!</h1>
      </div>

      <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
        <p style="font-size: 18px; margin-bottom: 20px;">
          Cześć <strong>${data.firstName}</strong>!
        </p>

        <p>
          Gratulacje! Twoje konto zostało w pełni skonfigurowane i jest gotowe do użycia.
          Teraz możesz w pełni korzystać z wszystkich funkcji platformy KsięgowaCRM.
        </p>

        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 25px 0;">
          <h3 style="margin-top: 0; color: #667eea;">Co możesz teraz zrobić?</h3>
          <ul style="padding-left: 20px;">
            <li>Dodaj swoich pierwszych klientów do CRM</li>
            <li>Skonfiguruj plan kont księgowych</li>
            <li>Zaimportuj dokumenty do systemu</li>
            <li>Zaproś członków zespołu do workspace'a</li>
          </ul>
        </div>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.FRONTEND_URL}/dashboard"
             style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
            Przejdź do panelu
          </a>
        </div>

        <p style="color: #666; font-size: 14px;">
          Jeśli masz pytania, odwiedź nasze <a href="${process.env.FRONTEND_URL}/help" style="color: #667eea;">Centrum pomocy</a>
          lub napisz do nas na <a href="mailto:support@ksiegowacrm.pl" style="color: #667eea;">support@ksiegowacrm.pl</a>.
        </p>

        <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 25px 0;">

        <p style="color: #999; font-size: 12px; text-align: center; margin: 0;">
          KsięgowaCRM - Kompleksowa platforma dla biur rachunkowych<br>
          © ${new Date().getFullYear()} KsięgowaCRM. Wszelkie prawa zastrzeżone.
        </p>
      </div>
    </body>
    </html>
  `,

  text: (data: { firstName: string }) => `
Witaj w KsięgowaCRM!

Cześć ${data.firstName}!

Gratulacje! Twoje konto zostało w pełni skonfigurowane i jest gotowe do użycia.
Teraz możesz w pełni korzystać z wszystkich funkcji platformy KsięgowaCRM.

Co możesz teraz zrobić?
- Dodaj swoich pierwszych klientów do CRM
- Skonfiguruj plan kont księgowych
- Zaimportuj dokumenty do systemu
- Zaproś członków zespołu do workspace'a

Przejdź do panelu: ${process.env.FRONTEND_URL}/dashboard

Jeśli masz pytania, odwiedź nasze Centrum pomocy lub napisz do nas na support@ksiegowacrm.pl.

Pozdrawiamy,
Zespół KsięgowaCRM
  `,
};
```

---

## Test Specifications

### Unit Tests

```typescript
// src/modules/aim/services/__tests__/profile.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { ProfileService } from '../profile.service';
import { PrismaService } from '@/infrastructure/prisma/prisma.service';
import { GusService } from '../gus.service';
import { AuditService } from '../audit.service';
import { EmailService } from '@/infrastructure/email/email.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('ProfileService', () => {
  let service: ProfileService;
  let prisma: jest.Mocked<PrismaService>;
  let gusService: jest.Mocked<GusService>;
  let auditService: jest.Mocked<AuditService>;
  let emailService: jest.Mocked<EmailService>;

  const mockUserId = 'user-123';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfileService,
        {
          provide: PrismaService,
          useValue: {
            userProfile: {
              findUnique: jest.fn(),
              upsert: jest.fn(),
              update: jest.fn(),
            },
            workspace: {
              findFirst: jest.fn(),
              findUnique: jest.fn(),
              create: jest.fn(),
            },
            company: {
              create: jest.fn(),
              update: jest.fn(),
            },
            userCompany: {
              findFirst: jest.fn(),
            },
            gusCache: {
              findUnique: jest.fn(),
              upsert: jest.fn(),
            },
            user: {
              findUnique: jest.fn(),
            },
            $transaction: jest.fn((callback) => callback(prisma)),
          },
        },
        {
          provide: GusService,
          useValue: {
            fetchCompanyByNip: jest.fn(),
          },
        },
        {
          provide: AuditService,
          useValue: {
            log: jest.fn(),
          },
        },
        {
          provide: EmailService,
          useValue: {
            sendWelcomeEmail: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ProfileService>(ProfileService);
    prisma = module.get(PrismaService);
    gusService = module.get(GusService);
    auditService = module.get(AuditService);
    emailService = module.get(EmailService);
  });

  describe('getSetupStatus', () => {
    it('should return initial status for new user', async () => {
      prisma.userProfile.findUnique.mockResolvedValue(null);
      prisma.workspace.findFirst.mockResolvedValue(null);

      const result = await service.getSetupStatus(mockUserId);

      expect(result).toEqual({
        isCompleted: false,
        currentStep: 1,
        completedSteps: [],
        personalInfo: null,
        companyInfo: null,
        workspace: null,
      });
    });

    it('should return step 2 after personal info completed', async () => {
      prisma.userProfile.findUnique.mockResolvedValue({
        userId: mockUserId,
        firstName: 'Jan',
        lastName: 'Kowalski',
        phoneNumber: '+48600123456',
        profileCompletedAt: null,
        user: { userCompanies: [] },
      });
      prisma.workspace.findFirst.mockResolvedValue(null);

      const result = await service.getSetupStatus(mockUserId);

      expect(result.currentStep).toBe(2);
      expect(result.completedSteps).toContain(1);
      expect(result.personalInfo).toEqual({
        firstName: 'Jan',
        lastName: 'Kowalski',
        phoneNumber: '+48600123456',
      });
    });

    it('should return completed status', async () => {
      prisma.userProfile.findUnique.mockResolvedValue({
        userId: mockUserId,
        firstName: 'Jan',
        lastName: 'Kowalski',
        profileCompletedAt: new Date(),
        user: {
          userCompanies: [{
            company: {
              name: 'Test Company',
              nip: '5252344078',
            },
          }],
        },
      });
      prisma.workspace.findFirst.mockResolvedValue({
        id: 'ws-123',
        name: 'Test Workspace',
      });

      const result = await service.getSetupStatus(mockUserId);

      expect(result.isCompleted).toBe(true);
      expect(result.completedSteps).toEqual([1, 2, 3, 4]);
    });
  });

  describe('updatePersonalInfo', () => {
    it('should create profile for new user', async () => {
      prisma.userProfile.upsert.mockResolvedValue({
        userId: mockUserId,
        firstName: 'Jan',
        lastName: 'Kowalski',
      });

      await service.updatePersonalInfo(mockUserId, {
        firstName: 'Jan',
        lastName: 'Kowalski',
        phoneNumber: '+48 600 123 456',
      });

      expect(prisma.userProfile.upsert).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        create: expect.objectContaining({
          firstName: 'Jan',
          lastName: 'Kowalski',
          phoneNumber: '+48600123456', // Sanitized
        }),
        update: expect.any(Object),
      });
      expect(auditService.log).toHaveBeenCalled();
    });

    it('should sanitize phone number', async () => {
      await service.updatePersonalInfo(mockUserId, {
        firstName: 'Jan',
        lastName: 'Kowalski',
        phoneNumber: '+48 600-123-456',
      });

      expect(prisma.userProfile.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            phoneNumber: '+48600123456',
          }),
        }),
      );
    });
  });

  describe('lookupCompanyByNip', () => {
    const validNip = '5252344078';
    const mockGusData = {
      nazwa: 'Test Company',
      nip: validNip,
      regon: '389012345',
      ulica: 'Testowa',
      nrNieruchomosci: '1',
      kodPocztowy: '00-001',
      miejscowosc: 'Warszawa',
    };

    it('should return cached data if valid', async () => {
      prisma.gusCache.findUnique.mockResolvedValue({
        nip: validNip,
        data: mockGusData,
        expiresAt: new Date(Date.now() + 3600000),
      });

      const result = await service.lookupCompanyByNip(validNip);

      expect(result.name).toBe('Test Company');
      expect(gusService.fetchCompanyByNip).not.toHaveBeenCalled();
    });

    it('should fetch from GUS if cache expired', async () => {
      prisma.gusCache.findUnique.mockResolvedValue({
        nip: validNip,
        data: mockGusData,
        expiresAt: new Date(Date.now() - 3600000), // Expired
      });
      gusService.fetchCompanyByNip.mockResolvedValue(mockGusData);

      await service.lookupCompanyByNip(validNip);

      expect(gusService.fetchCompanyByNip).toHaveBeenCalledWith(validNip);
      expect(prisma.gusCache.upsert).toHaveBeenCalled();
    });

    it('should throw NotFoundException if company not found', async () => {
      prisma.gusCache.findUnique.mockResolvedValue(null);
      gusService.fetchCompanyByNip.mockResolvedValue(null);

      await expect(service.lookupCompanyByNip(validNip))
        .rejects.toThrow(NotFoundException);
    });
  });

  describe('completeProfile', () => {
    const completeData = {
      personalInfo: {
        firstName: 'Jan',
        lastName: 'Kowalski',
        phoneNumber: '+48600123456',
      },
      companyInfo: {
        name: 'Test Company',
        nip: '5252344078',
      },
      workspace: {
        name: 'Test Workspace',
      },
      accountType: 'company' as const,
    };

    it('should complete profile in transaction', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: mockUserId,
        email: 'test@example.com',
      });
      prisma.workspace.findUnique.mockResolvedValue(null);

      await service.completeProfile(mockUserId, completeData);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(emailService.sendWelcomeEmail).toHaveBeenCalledWith({
        to: 'test@example.com',
        firstName: 'Jan',
        locale: 'pl',
      });
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PROFILE_SETUP_COMPLETED',
        }),
      );
    });

    it('should skip company creation for individual account', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: mockUserId,
        email: 'test@example.com',
      });

      await service.completeProfile(mockUserId, {
        ...completeData,
        accountType: 'individual',
        companyInfo: undefined,
      });

      expect(prisma.company?.create).not.toHaveBeenCalled();
    });
  });
});
```

### Integration Tests

```typescript
// src/modules/aim/routers/__tests__/profile.router.integration.spec.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createTestContext, cleanupTestData } from '@/test/helpers';
import { profileRouter } from '../profile.router';

describe('Profile Router Integration', () => {
  let ctx: Awaited<ReturnType<typeof createTestContext>>;
  let testUserId: string;

  beforeAll(async () => {
    ctx = await createTestContext();
  });

  afterAll(async () => {
    await cleanupTestData(ctx);
  });

  beforeEach(async () => {
    // Create test user with verified email
    const user = await ctx.prisma.user.create({
      data: {
        email: `test-${Date.now()}@example.com`,
        passwordHash: 'hashed',
        emailVerifiedAt: new Date(),
      },
    });
    testUserId = user.id;
    ctx.user = { id: testUserId };
  });

  describe('getSetupStatus', () => {
    it('should return initial status for new user', async () => {
      const caller = profileRouter.createCaller(ctx);
      const result = await caller.getSetupStatus();

      expect(result.isCompleted).toBe(false);
      expect(result.currentStep).toBe(1);
      expect(result.completedSteps).toEqual([]);
    });
  });

  describe('updatePersonalInfo', () => {
    it('should save personal information', async () => {
      const caller = profileRouter.createCaller(ctx);

      const result = await caller.updatePersonalInfo({
        firstName: 'Jan',
        lastName: 'Kowalski',
        phoneNumber: '+48600123456',
      });

      expect(result.success).toBe(true);
      expect(result.step).toBe(2);

      // Verify in database
      const profile = await ctx.prisma.userProfile.findUnique({
        where: { userId: testUserId },
      });
      expect(profile?.firstName).toBe('Jan');
    });

    it('should reject invalid phone number', async () => {
      const caller = profileRouter.createCaller(ctx);

      await expect(
        caller.updatePersonalInfo({
          firstName: 'Jan',
          lastName: 'Kowalski',
          phoneNumber: 'invalid',
        }),
      ).rejects.toThrow();
    });
  });

  describe('completeProfile', () => {
    it('should complete full profile setup', async () => {
      const caller = profileRouter.createCaller(ctx);

      const result = await caller.completeProfile({
        personalInfo: {
          firstName: 'Jan',
          lastName: 'Kowalski',
          phoneNumber: '+48600123456',
        },
        companyInfo: {
          name: 'Test Company',
          nip: '5252344078',
          city: 'Warszawa',
        },
        workspace: {
          name: 'Test Workspace',
        },
        accountType: 'company',
      });

      expect(result.success).toBe(true);
      expect(result.redirectTo).toBe('/dashboard');

      // Verify profile is complete
      const status = await caller.getSetupStatus();
      expect(status.isCompleted).toBe(true);
    });
  });
});
```

### E2E Tests

```typescript
// e2e/profile-setup.spec.ts
import { test, expect } from '@playwright/test';
import { createTestUser, loginAs } from './helpers';

test.describe('Profile Setup Flow', () => {
  let testUser: { email: string; password: string };

  test.beforeEach(async () => {
    testUser = await createTestUser({ emailVerified: true, profileCompleted: false });
  });

  test('should redirect to profile setup after login', async ({ page }) => {
    await loginAs(page, testUser);

    await expect(page).toHaveURL(/\/profile\/setup/);
    await expect(page.getByText('Uzupełnij swój profil')).toBeVisible();
  });

  test('should complete step 1 - personal info', async ({ page }) => {
    await loginAs(page, testUser);

    await page.fill('[name="firstName"]', 'Jan');
    await page.fill('[name="lastName"]', 'Kowalski');
    await page.fill('[name="phoneNumber"]', '+48 600 123 456');

    await page.click('button:has-text("Dalej")');

    await expect(page.getByText('Informacje o firmie')).toBeVisible();
  });

  test('should auto-fill company data from GUS', async ({ page }) => {
    await loginAs(page, testUser);

    // Complete step 1
    await page.fill('[name="firstName"]', 'Jan');
    await page.fill('[name="lastName"]', 'Kowalski');
    await page.click('button:has-text("Dalej")');

    // Step 2 - GUS lookup
    await page.fill('[name="nip"]', '5252344078');
    await page.click('button:has-text("Pobierz dane z GUS")');

    // Wait for GUS response
    await expect(page.locator('[name="companyName"]')).toHaveValue(/\S+/, { timeout: 10000 });
    await expect(page.getByText('Dane pobrane z GUS')).toBeVisible();
  });

  test('should handle invalid NIP', async ({ page }) => {
    await loginAs(page, testUser);

    await page.fill('[name="firstName"]', 'Jan');
    await page.fill('[name="lastName"]', 'Kowalski');
    await page.click('button:has-text("Dalej")');

    await page.fill('[name="nip"]', '1234567890');
    await page.click('button:has-text("Pobierz dane z GUS")');

    await expect(page.getByText('Nieprawidłowy numer NIP')).toBeVisible();
  });

  test('should complete full profile setup flow', async ({ page }) => {
    await loginAs(page, testUser);

    // Step 1 - Personal Info
    await page.fill('[name="firstName"]', 'Jan');
    await page.fill('[name="lastName"]', 'Kowalski');
    await page.fill('[name="phoneNumber"]', '+48 600 123 456');
    await page.click('button:has-text("Dalej")');

    // Step 2 - Company Info (manual)
    await page.click('label:has-text("Firma")');
    await page.fill('[name="companyName"]', 'Moja Firma Sp. z o.o.');
    await page.fill('[name="street"]', 'ul. Testowa 1');
    await page.fill('[name="postalCode"]', '00-001');
    await page.fill('[name="city"]', 'Warszawa');
    await page.click('button:has-text("Dalej")');

    // Step 3 - Workspace
    await expect(page.locator('[name="workspaceName"]')).toHaveValue('Moja Firma Sp. z o.o.');
    await page.click('button:has-text("Utwórz workspace")');

    // Step 4 - Completion
    await expect(page.getByText('Witaj, Jan!')).toBeVisible();
    await page.click('button:has-text("Przejdź do panelu")');

    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('should preserve progress on page refresh', async ({ page }) => {
    await loginAs(page, testUser);

    // Complete step 1
    await page.fill('[name="firstName"]', 'Jan');
    await page.fill('[name="lastName"]', 'Kowalski');
    await page.click('button:has-text("Dalej")');

    // Refresh page
    await page.reload();

    // Should be on step 2 with step 1 data preserved
    await expect(page.getByText('Informacje o firmie')).toBeVisible();

    // Go back to step 1
    await page.click('button:has-text("Wstecz")');
    await expect(page.locator('[name="firstName"]')).toHaveValue('Jan');
    await expect(page.locator('[name="lastName"]')).toHaveValue('Kowalski');
  });
});
```

---

## Security Checklist

| Requirement | Implementation | Status |
|-------------|----------------|--------|
| Input validation | Zod schemas with Polish-specific validation | ✅ |
| SQL injection prevention | Prisma parameterized queries | ✅ |
| XSS prevention | Input sanitization, React escaping | ✅ |
| CSRF protection | SameSite cookies, CSRF tokens | ✅ |
| Rate limiting | GUS API calls: 10/min per user | ✅ |
| Authentication required | Protected procedures only | ✅ |
| Authorization | RLS policies enforce user boundaries | ✅ |
| Sensitive data handling | No PII in logs, encrypted at rest | ✅ |
| GUS API security | Session-based auth, HTTPS only | ✅ |
| Phone validation | Polish format regex | ✅ |
| NIP validation | Checksum algorithm verification | ✅ |
| Error handling | Generic messages, detailed internal logs | ✅ |

---

## Audit Events

| Event | Trigger | Data Captured |
|-------|---------|---------------|
| PROFILE_PERSONAL_INFO_UPDATED | Personal info saved | Fields updated |
| COMPANY_CREATED | New company added | Company ID, NIP |
| COMPANY_UPDATED | Company info modified | Changed fields |
| GUS_LOOKUP_SUCCESS | GUS data retrieved | NIP, cached |
| GUS_LOOKUP_FAILED | GUS lookup error | NIP, error type |
| WORKSPACE_CREATED | Workspace created | Workspace ID, name |
| PROFILE_SETUP_COMPLETED | Setup finished | Account type, has company |
| PROFILE_SETUP_RESUMED | Setup continued | Current step |

---

## Implementation Notes

### GUS API Integration
- Use test environment (wyszukiwarkaregontest.stat.gov.pl) for development
- Production API key required from GUS for live environment
- Implement 24-hour caching to reduce API calls
- Handle SOAP XML responses with xml2js parser
- Session expires after 1 hour, implement auto-refresh

### NIP Validation Algorithm
```typescript
const validateNip = (nip: string): boolean => {
  const weights = [6, 5, 7, 2, 3, 4, 5, 6, 7];
  const digits = nip.replace(/[^0-9]/g, '').split('').map(Number);

  if (digits.length !== 10) return false;

  const checksum = digits
    .slice(0, 9)
    .reduce((sum, digit, i) => sum + digit * weights[i], 0) % 11;

  return checksum === digits[9];
};
```

### Workspace Slug Generation
- Base slug from company/user name using transliteration
- Polish characters mapped: ą→a, ć→c, ę→e, ł→l, ń→n, ó→o, ś→s, ź→z, ż→z
- Append counter if slug exists: moja-firma, moja-firma-1, moja-firma-2

### Profile Setup Middleware
```typescript
// Middleware to enforce profile completion
export const requireCompleteProfile = async (ctx, next) => {
  const profile = await ctx.prisma.userProfile.findUnique({
    where: { userId: ctx.user.id },
  });

  if (!profile?.profileCompletedAt) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Profile setup required',
      cause: { redirectTo: '/profile/setup' },
    });
  }

  return next();
};
```

---

*Last updated: December 2024*
