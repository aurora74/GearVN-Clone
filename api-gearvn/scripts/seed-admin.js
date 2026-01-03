const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');
const { hash } = require('argon2');

function loadEnvFromFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith('#')) continue;

    const equalIndex = line.indexOf('=');
    if (equalIndex <= 0) continue;

    const key = line.slice(0, equalIndex).trim();
    const value = line.slice(equalIndex + 1).trim();

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

async function seedAdmin() {
  loadEnvFromFile(path.resolve(process.cwd(), '.env'));

  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    throw new Error('MONGO_URI is missing. Please set it in .env');
  }

  const adminEmail = process.env.ADMIN_EMAIL || 'a@gmail.com';
  const adminPassword = process.env.ADMIN_PASSWORD || '@Dmin23072004';
  const adminName = process.env.ADMIN_FULL_NAME || 'System Admin';

  await mongoose.connect(mongoUri);

  const password = await hash(adminPassword);
  const users = mongoose.connection.collection('users');
  const now = new Date();

  const result = await users.updateOne(
    { email: adminEmail },
    {
      $set: {
        fullName: adminName,
        password,
        role: 'ADMIN',
        status: 'VERIFIED',
        updatedAt: now,
      },
      $setOnInsert: {
        createdAt: now,
      },
    },
    { upsert: true },
  );

  if (result.upsertedCount > 0) {
    console.log(`Created admin account: ${adminEmail}`);
  } else if (result.modifiedCount > 0) {
    console.log(`Updated existing account to admin: ${adminEmail}`);
  } else {
    console.log(`Admin account is already up to date: ${adminEmail}`);
  }
}

seedAdmin()
  .catch((error) => {
    console.error('Failed to seed admin:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await mongoose.disconnect();
    } catch {
      // no-op
    }
  });
