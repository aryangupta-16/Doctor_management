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

// ============================================
// CONFIGURATION
// ============================================

const SEED_CONFIG = {
  ADMIN_COUNT: 1,
  PATIENT_COUNT: 10,
  DOCTOR_COUNT: 5,
  CONSULTATION_COUNT: 20,
  SLOT_DAYS_AHEAD: 14,
  PASSWORD: 'password',
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
  'Psychiatry',
  'Endocrinology',
];

const INDIAN_CITIES = [
  'Mumbai',
  'Delhi',
  'Bangalore',
  'Hyderabad',
  'Chennai',
  'Kolkata',
  'Pune',
  'Ahmedabad',
  'Jaipur',
  'Lucknow',
];

// ============================================
// HELPERS
// ============================================

const randomEnumValue = <T extends object>(anEnum: T): T[keyof T] => {
  const values = Object.values(anEnum) as T[keyof T][];
  return values[Math.floor(Math.random() * values.length)];
};

const log = (message: string) => console.log(`  ${message}`);
const logSection = (message: string) => console.log(`\n🔹 ${message}`);

// ============================================
// DATABASE CLEARING
// ============================================

async function clearDatabase() {
  log('Clearing existing data...');
  const tables = [
    'analytics',
    'auditLog',
    'notification',
    'review',
    'payment',
    'prescription',
    'consultation',
    'availabilitySlot',
    'doctorAvailability',
    'doctor',
    'userSession',
    'userProfile',
    'user',
  ];

  for (const table of tables) {
    await (prisma as any)[table].deleteMany();
  }
  log('✓ Database cleared');
}

// ============================================
// USER CREATION
// ============================================

async function createUsers(count: number, role: RoleType, hashedPassword: string) {
  const users = [];

  for (let i = 0; i < count; i++) {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const city = faker.helpers.arrayElement(INDIAN_CITIES);

    const user = await prisma.user.create({
      data: {
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}.${i}@example.com`,
        phoneNumber: `+91${faker.number.int({ min: 7000000000, max: 9999999999 })}`,
        passwordHash: hashedPassword,
        firstName,
        lastName,
        dateOfBirth: faker.date.birthdate({ min: 18, max: 70, mode: 'age' }),
        gender: randomEnumValue(Gender),
        emailVerified: true,
        phoneVerified: true,
        isActive: true,
        role,
        profile: {
          create: {
            addressLine1: faker.location.streetAddress(),
            city,
            state: faker.location.state(),
            pincode: faker.location.zipCode('######'),
            country: 'India',
            bloodGroup: faker.helpers.arrayElement(['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-']),
            height: faker.number.float({ min: 150, max: 185, fractionDigits: 1 }),
            weight: faker.number.float({ min: 45, max: 100, fractionDigits: 1 }),
            preferredLanguage: 'English',
            notificationPreferences: { email: true, sms: true, push: true },
          },
        },
      },
    });

    users.push(user);
  }

  return users;
}

// ============================================
// DOCTOR CREATION
// ============================================

async function createDoctors(users: Awaited<ReturnType<typeof createUsers>>) {
  logSection('DOCTORS');
  const doctors = [];

  // Create 5 doctor users first
  const hashedPassword = await hashPassword(SEED_CONFIG.PASSWORD);
  const doctorUsers = [];

  for (let i = 0; i < SEED_CONFIG.DOCTOR_COUNT; i++) {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();

    const doctorUser = await prisma.user.create({
      data: {
        email: `dr.${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`,
        phoneNumber: `+91${faker.number.int({ min: 7000000000, max: 9999999999 })}`,
        passwordHash: hashedPassword,
        firstName,
        lastName,
        dateOfBirth: faker.date.birthdate({ min: 30, max: 60, mode: 'age' }),
        gender: randomEnumValue(Gender),
        role: RoleType.DOCTOR,
        emailVerified: true,
        phoneVerified: true,
        isActive: true,
      },
    });

    doctorUsers.push(doctorUser);
  }

  // Create doctor profiles
  for (const user of doctorUsers) {
    const specialty = faker.helpers.arrayElement(SPECIALTIES);
    const experience = faker.number.int({ min: 2, max: 25 });

    const doctor = await prisma.doctor.create({
      data: {
        userId: user.id,
        licenseNumber: `MED${faker.number.int({ min: 100000, max: 999999 })}`,
        specialtyPrimary: specialty,
        specialtiesSecondary: faker.helpers.arrayElements(
          SPECIALTIES.filter((s) => s !== specialty),
          { min: 0, max: 2 }
        ),
        yearsOfExperience: experience,
        education: [
          { degree: 'MBBS', college: `${faker.location.city()} Medical College`, year: 2024 - experience - 5 },
        ],
        certifications: [{ name: 'Medical Council Registration', year: 2024 - experience }],
        bio: `Experienced ${specialty} specialist with ${experience} years of practice.`,
        consultationFee: faker.number.int({ min: 500, max: 2000, multipleOf: 100 }),
        consultationDuration: 30,
        languagesSpoken: ['English', 'Hindi'],
        isVerified: true,
        verifiedAt: new Date(),
        isActive: true,
        averageRating: faker.number.float({ min: 4.0, max: 5.0, fractionDigits: 1 }),
        totalConsultations: faker.number.int({ min: 50, max: 500 }),
        totalReviews: faker.number.int({ min: 20, max: 200 }),
      },
    });

    doctors.push(doctor);
  }

  log(`✓ Created ${doctors.length} doctors`);
  return doctors;
}

// ============================================
// AVAILABILITY & SLOTS
// ============================================

async function createAvailabilityAndSlots(doctorId: string) {
  // Create weekly availability (Mon-Fri, 9 AM - 5 PM)
  const workingDays = [1, 2, 3, 4, 5];

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

  // Generate slots for next 14 days
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let dayOffset = 0; dayOffset < SEED_CONFIG.SLOT_DAYS_AHEAD; dayOffset++) {
    const slotDate = new Date(today);
    slotDate.setDate(today.getDate() + dayOffset);

    // Skip weekends
    if (slotDate.getDay() === 0 || slotDate.getDay() === 6) continue;

    // Create 30-minute slots from 9 AM to 5 PM
    for (let hour = 9; hour < 17; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const slotStart = new Date(slotDate);
        slotStart.setHours(hour, minute, 0, 0);

        const slotEnd = new Date(slotStart);
        slotEnd.setMinutes(slotEnd.getMinutes() + 30);

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
}

// ============================================
// CONSULTATIONS, PAYMENTS & REVIEWS
// ============================================

async function createConsultationsAndPaymentsAndReviews(
  patients: Awaited<ReturnType<typeof createUsers>>,
  doctors: Awaited<ReturnType<typeof createDoctors>>,
) {
  log('Creating 20 consultations with payments and reviews...');

  for (let i = 0; i < 20; i++) {
    const patient = faker.helpers.arrayElement(patients);
    const doctor = faker.helpers.arrayElement(doctors);

    // Find next available slot
    const slot = await prisma.availabilitySlot.findFirst({
      where: {
        doctorId: doctor.id,
        status: SlotStatus.AVAILABLE,
        slotStartTime: { gte: new Date() },
      },
      orderBy: { slotStartTime: 'asc' },
    });

    if (!slot) continue;

    // Book the slot
    await prisma.availabilitySlot.update({
      where: { id: slot.id },
      data: { status: SlotStatus.BOOKED },
    });

    // Create consultation
    const consultation = await prisma.consultation.create({
      data: {
        consultationNumber: `CONS${faker.number.int({ min: 100000, max: 999999 })}`,
        patientId: patient.id,
        doctorId: doctor.id,
        slotId: slot.id,
        scheduledStartTime: slot.slotStartTime,
        scheduledEndTime: slot.slotEndTime,
        consultationType: randomEnumValue(ConsultationType),
        status: ConsultationStatus.SCHEDULED,
        consultationFee: doctor.consultationFee,
        chiefComplaint: faker.helpers.arrayElement([
          'Routine checkup',
          'Fever and cold',
          'Back pain',
          'Headache',
          'Annual physical',
        ]),
        symptoms: [faker.lorem.words(3), faker.lorem.words(2)],
        diagnosis: faker.datatype.boolean() ? faker.lorem.sentence() : null,
        doctorNotes: faker.datatype.boolean() ? faker.lorem.paragraph() : null,
        followUpRequired: faker.datatype.boolean(),
        followUpDate: faker.datatype.boolean()
          ? faker.date.soon({ days: 30, refDate: slot.slotEndTime })
          : null,
        meetingLink: faker.internet.url(),
        recordingUrl: null,
        attachments: [],
        patientRating: null,
        patientFeedback: null,
      },
    });

    // Create payment (80% completed)
    const paymentCompleted = Math.random() > 0.2;
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
        gatewayResponse: { success: paymentCompleted },
        refundAmount: null,
        refundReason: null,
        refundedAt: null,
        invoiceUrl: paymentCompleted ? faker.internet.url() : null,
        invoiceNumber: paymentCompleted ? `INV${faker.number.int({ min: 100000, max: 999999 })}` : null,
        paidAt: paymentCompleted ? faker.date.recent({ days: 2 }) : null,
      },
    });

    // Create review (50% of paid consultations get reviewed)
    if (paymentCompleted && faker.datatype.boolean()) {
      const rating = faker.number.int({ min: 3, max: 5 });

      await prisma.review.create({
        data: {
          consultationId: consultation.id,
          patientId: patient.id,
          doctorId: doctor.id,
          rating,
          comment: faker.helpers.arrayElement([
            'Excellent doctor, very helpful!',
            'Good consultation, satisfied with treatment.',
            'Professional and caring.',
            'Helpful advice and clear explanations.',
          ]),
          isAnonymous: faker.datatype.boolean(),
          isVerified: true,
        },
      });
    }
  }
}

// ============================================
// ANALYTICS
// ============================================

async function createDoctorAnalytics(doctors: Awaited<ReturnType<typeof createDoctors>>) {
  log('Creating analytics data for doctors...');

  for (const doctor of doctors) {
    const consultationsCount = await prisma.consultation.count({
      where: { doctorId: doctor.id },
    });

    const reviewsCount = await prisma.review.count({
      where: { doctorId: doctor.id },
    });

    const avgRatingResult = await prisma.review.aggregate({
      where: { doctorId: doctor.id },
      _avg: { rating: true },
    });

    await prisma.doctor.update({
      where: { id: doctor.id },
      data: {
        totalConsultations: consultationsCount,
        totalReviews: reviewsCount,
        averageRating: avgRatingResult._avg.rating || 0,
      },
    });
  }
}

// ============================================
// MAIN SEED FUNCTION
// ============================================

async function main() {
  console.log('\n' + '='.repeat(50));
  console.log('🌱 Starting Database Seed Process');
  console.log('='.repeat(50) + '\n');

  const hashedPassword = await hashPassword(SEED_CONFIG.PASSWORD);

  await clearDatabase();

  // Create admin user
  logSection('ADMIN');
  await prisma.user.create({
    data: {
      email: 'admin@example.com',
      phoneNumber: '+919876543210',
      passwordHash: hashedPassword,
      firstName: 'Admin',
      lastName: 'User',
      role: RoleType.ADMIN,
      emailVerified: true,
      phoneVerified: true,
      isActive: true,
    },
  });
  log('✓ Admin user created');

  const users = await createUsers(SEED_CONFIG.PATIENT_COUNT, RoleType.PATIENT, hashedPassword);
  const doctors = await createDoctors(users);

  logSection('AVAILABILITY & SLOTS');
  log('Generating availability and time slots for doctors...');
  for (const doctor of doctors) {
    await createAvailabilityAndSlots(doctor.id);
  }

  await createConsultationsAndPaymentsAndReviews(users, doctors);
  await createDoctorAnalytics(doctors);

  console.log('\n' + '='.repeat(50));
  console.log('✅ Database Seeding Completed Successfully!');
  console.log('='.repeat(50));
  console.log(`📊 Summary:`);
  console.log(`   - Users: ${users.length} patients`);
  console.log(`   - Doctors: ${doctors.length}`);
  console.log(`   - Consultations: 20 with payments & reviews`);
  console.log(`   - Slots: Generated for next ${SEED_CONFIG.SLOT_DAYS_AHEAD} days\n`);
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });