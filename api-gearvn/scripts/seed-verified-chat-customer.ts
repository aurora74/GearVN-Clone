import { randomBytes } from 'node:crypto';
import { argv } from 'node:process';
import { hash } from 'argon2';
import mongoose from 'mongoose';

import { AccountStatus } from '../src/auth/enums/account-status.enum';
import { UserRole } from '../src/auth/enums/user-role.enum';
import { User, UserSchema } from '../src/user/user.schema';
import { loadLocalEnv, requireEnvPresence } from './script-env';

type SeedArgs = {
  email?: string;
  password?: string;
};

function parseArgs(rawArgs: string[]): SeedArgs {
  return rawArgs.reduce<SeedArgs>((parsed, arg, index) => {
    if (arg.startsWith('--email=')) parsed.email = arg.slice('--email='.length);
    if (arg === '--email') parsed.email = rawArgs[index + 1];
    if (arg.startsWith('--password=')) {
      parsed.password = arg.slice('--password='.length);
    }
    if (arg === '--password') parsed.password = rawArgs[index + 1];
    return parsed;
  }, {});
}

function generatedEmail(): string {
  return `chatbot-uat-${Date.now()}@example.test`;
}

function generatedPassword(): string {
  return `ChatbotUat-${randomBytes(9).toString('base64url')}!1`;
}

async function main(): Promise<void> {
  loadLocalEnv();
  const envPresence = requireEnvPresence(['MONGO_URI']);
  if (!envPresence.MONGO_URI.present) {
    console.error(
      JSON.stringify({
        error: 'missing_required_env',
        required: envPresence,
      }),
    );
    process.exitCode = 1;
    return;
  }

  const args = parseArgs(argv.slice(2));
  const email = (args.email ?? generatedEmail()).trim().toLowerCase();
  const password = args.password ?? generatedPassword();
  const hashedPassword = await hash(password);

  await mongoose.connect(process.env.MONGO_URI as string);
  try {
    const userModel = mongoose.model(User.name, UserSchema);
    const existing = await userModel.findOne({ email });

    const update = {
      fullName: 'Chatbot UAT Customer',
      email,
      phone: '0900000000',
      address: 'Dia chi UAT noi bo',
      password: hashedPassword,
      role: UserRole.CUSTOMER,
      status: AccountStatus.VERIFIED,
      refreshToken: undefined,
    };

    const user = existing
      ? await userModel.findByIdAndUpdate(existing._id, update, {
          new: true,
          runValidators: true,
        })
      : await userModel.create(update);

    console.log(
      JSON.stringify(
        {
          status: 'ok',
          action: existing ? 'updated_existing_verified_customer' : 'created_verified_customer',
          email,
          password,
          generatedDefaults: {
            email: !args.email,
            password: !args.password,
          },
          user: {
            id: user?._id?.toString(),
            role: UserRole.CUSTOMER,
            accountStatus: AccountStatus.VERIFIED,
          },
        },
        null,
        2,
      ),
    );
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error(
    JSON.stringify({
      error: 'seed_verified_chat_customer_failed',
      message: error instanceof Error ? error.message : String(error),
    }),
  );
  process.exitCode = 1;
});
