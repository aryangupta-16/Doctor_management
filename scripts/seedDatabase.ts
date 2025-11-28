import {
  PrismaClient,
  RoleType,
  Gender,
  SlotStatus,
  ConsultationType,
  ConsultationStatus,
  PaymentMethod,
  PaymentStatus,
  NotificationType,
  NotificationStatus,
  AuditAction,
} from '@prisma/client';
import { faker } from '@faker-js/faker/locale/en_IN';
import { hashPassword } from '../src/utils/password';

const prisma = new PrismaClient();

// ---------- Helpers ----------

const randomEnumValue = <T extends object>(anEnum: T): T[keyof T] => {
  const values = Object.values(anEnum) as T[keyof T][];
  return values[Math.floor(Math.random() * values.length)];
};

const SPECIALTIES = [
  'Cardiology',
  'Dermatology',
  'Neurology',
  'Pediatrics',
  'Orthopedics',
  'Gynecology',
  'General Surgery',
  'Ophthalmology',
  'ENT',
  'Dentistry',
];

// ---------- Seeding pieces ----------

async function clearDatabase() {
  // Respect FK constraints; delete in dependency order
  await prisma.analytics.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.review.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.prescription.deleteMany();
  await prisma.consultation.deleteMany();
  await prisma.availabilitySlot.deleteMany();
  await prisma.doctorAvailability.deleteMany();
  await prisma.doctor.deleteMany();
  await prisma.userSession.deleteMany();
  await prisma.userProfile.deleteMany();
  await prisma.user.deleteMany();
}

async function createUsers(count: number, role: RoleType, hashedPassword: string) {
  const users: Awaited<ReturnType<typeof prisma.user.create>>[] = [];

  for (let i = 0; i < count; i++) {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();

    const user = await prisma.user.create({
      data: {
        email: faker.internet
          .email({
            firstName,
            lastName,
            provider: 'example.com',
          })
          .toLowerCase(),
        phoneNumber: `+91${faker.number.int({ min: 6000000000, max: 9999999999 })}`,
        passwordHash: hashedPassword,
        firstName,
        lastName,
        dateOfBirth: faker.date.birthdate({ min: 18, max: 80, mode: 'age' }),
        gender: randomEnumValue(Gender),
        profilePicture: null,
        emailVerified: true,
        phoneVerified: true,
        isActive: true,
        role,
        profile: {
          create: {
            addressLine1: faker.location.streetAddress(),
            addressLine2: faker.datatype.boolean() ? faker.location.streetAddress() : null,
            city: faker.location.city(),
            state: faker.location.state(),
            pincode: faker.location.zipCode('######'),
            country: 'India',
            bloodGroup: faker.helpers.arrayElement([
              'A+',
              'A-',
              'B+',
              'B-',
              'O+',
              'O-',
              'AB+',
              'AB-',
            ]),
            height: faker.number.float({ min: 140, max: 190, fractionDigits: 1 }),
            weight: faker.number.float({ min: 50, max: 110, fractionDigits: 1 }),
            allergies: [
              {
                name: 'Dust',
                severity: 'mild',
              },
            ],
            chronicConditions: [
              {
                name: 'Hypertension',
                since: '2018-01-01',
              },
            ],
            currentMedications: [
              {
                name: 'Atorvastatin',
                dose: '10mg',
              },
            ],
            emergencyContactName: faker.person.fullName(),
            emergencyContactPhone: `+91${faker.number.int({
              min: 6000000000,
              max: 9999999999,
            })}`,
            emergencyContactRelation: 'Family',
            preferredLanguage: 'English',
            notificationPreferences: {
              email: true,
              sms: true,
              push: true,
            },
          },
        },
      },
    });

    users.push(user);
  }

  return users;
}

async function createDoctors(doctorUsers: Awaited<ReturnType<typeof prisma.user.create>>[]) {
  const doctors: Awaited<ReturnType<typeof prisma.doctor.create>>[] = [];

  for (const user of doctorUsers) {
    const primary = faker.helpers.arrayElement(SPECIALTIES);
    const secondary = faker.helpers
      .arrayElements(
        SPECIALTIES.filter((s) => s !== primary),
        { min: 1, max: 3 },
      )
      .filter((v, i, a) => a.indexOf(v) === i);

    const doctor = await prisma.doctor.create({
      data: {
        userId: user.id,
        licenseNumber: `MED${faker.number.int({ min: 10000, max: 99999 })}`,
        specialtyPrimary: primary,
        specialtiesSecondary: secondary,
        yearsOfExperience: faker.number.int({ min: 1, max: 30 }),
        education: [
          {
            degree: 'MBBS',
            college: `${faker.location.city()} Medical College`,
            year: faker.date.past({ years: 20 }).getFullYear(),
          },
        ],
        certifications: [
          {
            name: 'Medical Council Registration',
            year: faker.date.past({ years: 10 }).getFullYear(),
          },
        ],
        bio: faker.lorem.paragraphs(2),
        consultationFee: faker.number.int({ min: 300, max: 2000, multipleOf: 50 }),
        consultationDuration: faker.helpers.arrayElement([15, 30, 45, 60]),
        languagesSpoken: [
          'English',
          'Hindi',
          ...faker.helpers.arrayElements(
            ['Tamil', 'Telugu', 'Kannada', 'Malayalam', 'Bengali', 'Marathi', 'Gujarati'],
            { min: 0, max: 2 },
          ),
        ],
        isVerified: true,
        verifiedAt: new Date(),
        verifiedBy: 'system',
        isActive: true,
        averageRating: faker.number.float({ min: 3, max: 5, fractionDigits: 1 }),
        totalConsultations: faker.number.int({ min: 10, max: 500 }),
        totalReviews: faker.number.int({ min: 5, max: 200 }),
      },
    });

    doctors.push(doctor);
  }

  return doctors;
}

async function createAvailabilityAndSlots(doctorId: string) {
  const workingDays = [1, 2, 3, 4, 5]; // Mon–Fri

  for (const dayOfWeek of workingDays) {
    await prisma.doctorAvailability.create({
      data: {
        doctorId,
        dayOfWeek,
        startTime: '09:00',
        endTime: '17:00',
        isActive: true,
      },
    });
  }

  // Generate slots for next 7 days
  const today = new Date();
  for (let offset = 0; offset < 7; offset++) {
    const date = new Date(today);
    date.setDate(today.getDate() + offset);

    // Skip Sunday (0) and Saturday (6)
    if (date.getDay() === 0 || date.getDay() === 6) continue;

    for (let hour = 9; hour < 17; hour++) {
      const slotStart = new Date(date);
      slotStart.setHours(hour, 0, 0, 0);

      const slotEnd = new Date(slotStart);
      slotEnd.setMinutes(slotStart.getMinutes() + 30);

      await prisma.availabilitySlot.create({
        data: {
          doctorId,
          slotStartTime: slotStart,
          slotEndTime: slotEnd,
          status: SlotStatus.AVAILABLE,
        },
      });
    }
  }
}

async function createConsultationsAndPaymentsAndReviews(
  patients: Awaited<ReturnType<typeof createUsers>>,
  doctors: Awaited<ReturnType<typeof createDoctors>>,
) {
  for (let i = 0; i < 20; i++) {
    const patient = faker.helpers.arrayElement(patients);
    const doctor = faker.helpers.arrayElement(doctors);

    const slot = await prisma.availabilitySlot.findFirst({
      where: {
        doctorId: doctor.id,
        status: SlotStatus.AVAILABLE,
        slotStartTime: { gte: new Date() },
      },
      orderBy: { slotStartTime: 'asc' },
    });

    if (!slot) continue;

    // Mark slot as booked
    await prisma.availabilitySlot.update({
      where: { id: slot.id },
      data: { status: SlotStatus.BOOKED },
    });

    const scheduledStartTime = slot.slotStartTime;
    const scheduledEndTime = slot.slotEndTime;

    const consultation = await prisma.consultation.create({
      data: {
        consultationNumber: `CONS${faker.number.int({ min: 100000, max: 999999 })}`,
        patientId: patient.id,
        doctorId: doctor.id,
        slotId: slot.id,
        scheduledStartTime,
        scheduledEndTime,
        consultationType: randomEnumValue(ConsultationType),
        status: ConsultationStatus.SCHEDULED,
        consultationFee: doctor.consultationFee,
        chiefComplaint: faker.lorem.sentence(),
        symptoms: [faker.lorem.words(3), faker.lorem.words(2)],
        diagnosis: faker.datatype.boolean() ? faker.lorem.sentence() : null,
        doctorNotes: faker.datatype.boolean() ? faker.lorem.paragraph() : null,
        followUpRequired: faker.datatype.boolean(),
        followUpDate: faker.datatype.boolean()
          ? faker.date.soon({ days: 30, refDate: scheduledEndTime })
          : null,
        meetingLink: faker.internet.url(),
        recordingUrl: null,
        attachments: [],
        patientRating: null,
        patientFeedback: null,
      },
    });

    // Payment
    const paymentCompleted = faker.datatype.boolean();
    await prisma.payment.create({
      data: {
        transactionNumber: `PAY${faker.number.int({ min: 100000, max: 999999 })}`,
        patientId: patient.id,
        consultationId: consultation.id,
        amount: consultation.consultationFee,
        currency: 'INR',
        paymentMethod: randomEnumValue(PaymentMethod),
        status: paymentCompleted ? PaymentStatus.COMPLETED : PaymentStatus.PENDING,
        gatewayName: 'Razorpay',
        gatewayTransactionId: paymentCompleted ? `RZP_${faker.string.alphanumeric(12)}` : null,
        gatewayResponse: {
          success: paymentCompleted,
        },
        refundAmount: null,
        refundReason: null,
        refundedAt: null,
        invoiceUrl: paymentCompleted ? faker.internet.url() : null,
        invoiceNumber: paymentCompleted ? `INV${faker.number.int({ min: 100000, max: 999999 })}` : null,
        paidAt: paymentCompleted ? faker.date.recent({ days: 2 }) : null,
      },
    });

    // Review (only for completed/paid consultations) – simplified
    if (paymentCompleted && faker.datatype.boolean()) {
      const rating = faker.number.int({ min: 3, max: 5 });

      await prisma.review.create({
        data: {
          consultationId: consultation.id,
          patientId: patient.id,
          doctorId: doctor.id,
          rating,
          comment: faker.lorem.sentences(2),
          isAnonymous: faker.datatype.boolean(),
          isVerified: true,
        },
      });

      await prisma.doctor.update({
        where: { id: doctor.id },
        data: {
          totalReviews: { increment: 1 },
          totalConsultations: { increment: 1 },
          averageRating: rating,
        },
      });
    }

    // Notification to patient
    await prisma.notification.create({
      data: {
        userId: patient.id,
        type: NotificationType.IN_APP,
        status: NotificationStatus.SENT,
        title: 'Consultation Booked',
        message: `Your consultation ${consultation.consultationNumber} is scheduled.`,
        data: {
          consultationId: consultation.id,
          doctorId: doctor.id,
        },
        sentAt: new Date(),
        readAt: null,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: patient.id,
        action: AuditAction.CREATE,
        entityType: 'Consultation',
        entityId: consultation.id,
        ipAddress: faker.internet.ip(),
        userAgent: faker.internet.userAgent(),
        changes: {
          created: true,
        },
        metadata: {
          source: 'seed',
        },
      },
    });
  }
}

async function createAnalytics() {
  const today = new Date();
  for (let offset = 0; offset < 7; offset++) {
    const date = new Date(today);
    date.setDate(today.getDate() - offset);

    await prisma.analytics.createMany({
      data: [
        {
          metricName: 'daily_consultations',
          metricValue: faker.number.float({ min: 10, max: 100, fractionDigits: 0 }),
          dimensions: {},
          date,
        },
        {
          metricName: 'daily_revenue',
          metricValue: faker.number.float({ min: 10000, max: 100000, fractionDigits: 2 }),
          dimensions: { currency: 'INR' },
          date,
        },
      ],
      skipDuplicates: true,
    });
  }
}

// ---------- Main ----------

async function main() {
  console.log('🌱 Starting database seeding...');

  console.log('🧹 Clearing existing data...');
  await clearDatabase();

  // Hash seed password once
  const HASHED_PASSWORD = await hashPassword('password');

  console.log('👨‍💼 Creating admin user...');
  await prisma.user.create({
    data: {
      email: 'admin@example.com',
      phoneNumber: '+919876543210',
      passwordHash: HASHED_PASSWORD,
      firstName: 'Admin',
      lastName: 'User',
      role: RoleType.ADMIN,
      emailVerified: true,
      phoneVerified: true,
      isActive: true,
    },
  });

  console.log('👥 Creating patients...');
  const patients = await createUsers(10, RoleType.PATIENT, HASHED_PASSWORD);

  console.log('👨‍⚕️ Creating doctors...');
  const doctorUsers = await createUsers(5, RoleType.DOCTOR, HASHED_PASSWORD);
  const doctors = await createDoctors(doctorUsers);

  console.log('📅 Creating availability & slots...');
  for (const doctor of doctors) {
    await createAvailabilityAndSlots(doctor.id);
  }

  console.log('📝 Creating consultations, payments, reviews, notifications, audit logs...');
  await createConsultationsAndPaymentsAndReviews(patients, doctors);

  console.log('📊 Creating analytics metrics...');
  await createAnalytics();

  console.log('✅ Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });