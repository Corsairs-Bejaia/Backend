import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// ─── Field helpers ────────────────────────────────────────────────────────────

function field(
  fieldName: string,
  fieldLabelFr: string,
  fieldLabelAr: string | null,
  fieldType: string,
  sortOrder: number,
  isRequired = true,
  validationRegex?: string,
) {
  return {
    fieldName,
    fieldLabelFr,
    fieldLabelAr,
    fieldType,
    isRequired,
    sortOrder,
    validationRegex,
  };
}

// ─── System templates definition ─────────────────────────────────────────────

const SYSTEM_TEMPLATES = [
  {
    name: "Carte Nationale d'Identité",
    slug: 'national_id',
    docType: 'national_id',
    description: "Carte nationale d'identité biométrique algérienne",
    fields: [
      field(
        'full_name_fr',
        'Nom et prénom (FR)',
        'الاسم الكامل (FR)',
        'name_fr',
        0,
      ),
      field(
        'full_name_ar',
        'Nom et prénom (AR)',
        'الاسم الكامل (AR)',
        'name_ar',
        1,
      ),
      field('date_of_birth', 'Date de naissance', 'تاريخ الميلاد', 'date', 2),
      field('place_of_birth', 'Lieu de naissance', 'مكان الميلاد', 'text', 3),
      field(
        'nin',
        "NIN (Numéro d'identification national)",
        'رقم التعريف الوطني',
        'text',
        4,
        true,
        '^\\d{18}$',
      ),
      field('wilaya', 'Wilaya', 'الولاية', 'text', 5),
      field(
        'expiry_date',
        "Date d'expiration",
        'تاريخ انتهاء الصلاحية',
        'date',
        6,
      ),
      field('gender', 'Sexe', 'الجنس', 'enum', 7),
    ],
  },
  {
    name: 'Diplôme de Docteur en Médecine',
    slug: 'diploma',
    docType: 'diploma',
    description:
      'Diplôme de doctorat en médecine délivré par une université algérienne',
    fields: [
      field(
        'doctor_name_fr',
        'Nom du médecin (FR)',
        'اسم الطبيب (FR)',
        'name_fr',
        0,
      ),
      field(
        'doctor_name_ar',
        'Nom du médecin (AR)',
        'اسم الطبيب (AR)',
        'name_ar',
        1,
      ),
      field('university_name', 'Université', 'الجامعة', 'text', 2),
      field('specialty', 'Spécialité', 'التخصص', 'text', 3),
      field('diploma_number', 'Numéro de diplôme', 'رقم الشهادة', 'text', 4),
      field(
        'graduation_year',
        'Année de graduation',
        'سنة التخرج',
        'year',
        5,
        true,
        '^(19|20)\\d{2}$',
      ),
      field(
        'dean_signature',
        'Signature du doyen',
        'توقيع العميد',
        'boolean',
        6,
      ),
      field(
        'university_stamp',
        "Cachet de l'université",
        'ختم الجامعة',
        'boolean',
        7,
      ),
      field(
        'ministry_approval',
        'Visa ministériel',
        'مصادقة الوزارة',
        'boolean',
        8,
      ),
      field('issue_date', 'Date de délivrance', 'تاريخ الإصدار', 'date', 9),
    ],
  },
  {
    name: "Attestation d'affiliation CNAS",
    slug: 'affiliation',
    docType: 'affiliation',
    description: "Attestation d'affiliation délivrée par la CNAS",
    fields: [
      field(
        'employee_name_fr',
        "Nom de l'employé (FR)",
        'اسم الموظف (FR)',
        'name_fr',
        0,
      ),
      field(
        'employee_name_ar',
        "Nom de l'employé (AR)",
        'اسم الموظف (AR)',
        'name_ar',
        1,
      ),
      field(
        'cnas_number',
        "Numéro d'attestation CNAS",
        'رقم شهادة الضمان',
        'text',
        2,
      ),
      field(
        'employer_number',
        "Numéro de l'employeur",
        'رقم صاحب العمل',
        'text',
        3,
      ),
      field('employer_name', "Nom de l'employeur", 'اسم صاحب العمل', 'text', 4),
      field(
        'affiliation_date',
        "Date d'affiliation",
        'تاريخ الانتساب',
        'date',
        5,
      ),
      field(
        'affiliation_end',
        'Date de fin (si disponible)',
        'تاريخ الانتهاء',
        'date',
        6,
        false,
      ),
      field(
        'employer_wilaya',
        "Wilaya de l'employeur",
        'ولاية صاحب العمل',
        'text',
        7,
      ),
    ],
  },
  {
    name: 'Convention / Contrat de travail',
    slug: 'agreement',
    docType: 'agreement',
    description:
      'Convention ou contrat de travail liant le médecin à son employeur',
    fields: [
      field(
        'doctor_name_fr',
        'Nom du médecin (FR)',
        'اسم الطبيب (FR)',
        'name_fr',
        0,
      ),
      field('employer_name', "Nom de l'employeur", 'اسم صاحب العمل', 'text', 1),
      field('contract_type', 'Type de contrat', 'نوع العقد', 'enum', 2),
      field('contract_start', 'Date de début', 'تاريخ البداية', 'date', 3),
      field('contract_end', 'Date de fin', 'تاريخ النهاية', 'date', 4, false),
      field(
        'specialty_agreed',
        'Spécialité convenue',
        'التخصص المتفق عليه',
        'text',
        5,
      ),
      field(
        'weekly_hours',
        'Heures hebdomadaires',
        'الساعات الأسبوعية',
        'number',
        6,
        false,
      ),
      field(
        'employer_stamp',
        "Cachet de l'employeur",
        'ختم صاحب العمل',
        'boolean',
        7,
      ),
      field(
        'both_signatures',
        'Signatures des deux parties',
        'توقيع الطرفين',
        'boolean',
        8,
      ),
    ],
  },
  {
    name: 'Carte Chifa',
    slug: 'chifa',
    docType: 'chifa',
    description: "Carte Chifa (carte d'assuré social CNAS)",
    fields: [
      field(
        'chifa_number',
        'Numéro Chifa',
        'رقم شيفا',
        'text',
        0,
        true,
        '^\\d{20}$',
      ),
      field(
        'beneficiary_name',
        'Nom du bénéficiaire',
        'اسم المستفيد',
        'name_fr',
        1,
      ),
      field('nin', 'NIN', 'رقم التعريف الوطني', 'text', 2, true, '^\\d{18}$'),
      field(
        'expiry_date',
        "Date d'expiration",
        'تاريخ انتهاء الصلاحية',
        'date',
        3,
      ),
      field('issuing_agency', 'Organisme émetteur', 'الجهة المصدرة', 'text', 4),
    ],
  },
  {
    name: "Ordonnance médicale / Autorisation d'exercer",
    slug: 'ordonnance',
    docType: 'ordonnance',
    description:
      "Ordonnance médicale ou autorisation d'exercer délivrée par l'Ordre des Médecins",
    fields: [
      field(
        'doctor_name_fr',
        'Nom du médecin (FR)',
        'اسم الطبيب (FR)',
        'name_fr',
        0,
      ),
      field('license_number', "Numéro d'inscription", 'رقم التسجيل', 'text', 1),
      field('specialty', 'Spécialité', 'التخصص', 'text', 2),
      field(
        'issuing_body',
        'Ordre / Organisme émetteur',
        'الجهة المصدرة',
        'text',
        3,
      ),
      field('issue_date', 'Date de délivrance', 'تاريخ الإصدار', 'date', 4),
      field(
        'expiry_date',
        "Date d'expiration",
        'تاريخ انتهاء الصلاحية',
        'date',
        5,
        false,
      ),
      field('official_stamp', 'Cachet officiel', 'الختم الرسمي', 'boolean', 6),
    ],
  },
];

// ─── Seed ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Seeding system document templates...');

  for (const tpl of SYSTEM_TEMPLATES) {
    const existing = await prisma.documentTemplate.findUnique({
      where: { slug: tpl.slug },
    });

    if (existing) {
      console.log(`  ↳ Skipping "${tpl.name}" — already exists`);
      continue;
    }

    await prisma.documentTemplate.create({
      data: {
        name: tpl.name,
        slug: tpl.slug,
        docType: tpl.docType,
        description: tpl.description,
        isSystem: true,
        isActive: true,
        fields: {
          create: tpl.fields.map((f) => ({
            fieldName: f.fieldName,
            fieldLabelFr: f.fieldLabelFr,
            fieldLabelAr: f.fieldLabelAr,
            fieldType: f.fieldType,
            isRequired: f.isRequired,
            sortOrder: f.sortOrder,
            validationRegex: f.validationRegex ?? null,
          })),
        },
      },
    });

    console.log(`  ✓ Created "${tpl.name}" with ${tpl.fields.length} fields`);
  }

  console.log('✅ Seeding complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
